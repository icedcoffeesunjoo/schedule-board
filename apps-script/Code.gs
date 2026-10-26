/**
 * 연구·교육 일정 편성표 - 공유 저장소 (Google Apps Script 웹앱)
 * - 이 스크립트가 연결된 구글 시트를 DB로 사용 (schedules / assignees 시트 자동 생성)
 * - 조회(GET)는 누구나, 쓰기(POST)는 스크립트 속성 EDIT_PASSWORD 와 일치해야 허용
 * - 모든 쓰기는 LockService 로 직렬화하여 동시 편집 시 데이터 유실 방지
 * - 응답은 항상 전체 상태 { ok, schedules, assignees } 를 반환
 */

const SCHEDULE_SHEET = 'schedules';
const ASSIGNEE_SHEET = 'assignees';
const SCHEDULE_FIELDS = ['id', 'title', 'category', 'assignee', 'startDate', 'endDate', 'status', 'priority', 'memo'];
const VALID_STATUS = ['진행중', '대기', '완료'];
const VALID_PRIORITY = ['높음', '보통', '낮음'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function doGet() {
  return jsonOut(Object.assign({ ok: true }, readState()));
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOut({ ok: false, error: 'BAD_REQUEST', message: '요청 형식이 올바르지 않습니다.' });
  }

  const expected = PropertiesService.getScriptProperties().getProperty('EDIT_PASSWORD');
  if (!expected) {
    return jsonOut({ ok: false, error: 'NO_PASSWORD_SET', message: '관리자가 스크립트 속성 EDIT_PASSWORD 를 설정하지 않았습니다.' });
  }
  if (String(req.password || '') !== expected) {
    return jsonOut({ ok: false, error: 'BAD_PASSWORD', message: '편집 비밀번호가 올바르지 않습니다.' });
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return jsonOut({ ok: false, error: 'BUSY', message: '다른 사용자가 저장 중입니다. 잠시 후 다시 시도해주세요.' });
  }
  try {
    const state = readState();
    const result = applyAction(state, req);
    if (result.error) {
      return jsonOut(Object.assign({ ok: false }, result, readState()));
    }
    if (result.changed) writeState(state);
    return jsonOut(Object.assign({ ok: true, id: result.id || null }, state));
  } finally {
    lock.releaseLock();
  }
}

function applyAction(state, req) {
  const schedules = state.schedules;
  const assignees = state.assignees;
  const findSchedule = id => schedules.find(s => s.id === id);

  switch (req.action) {
    case 'checkPassword':
      return { changed: false };

    case 'addSchedule': {
      const s = sanitizeSchedule(req.schedule || {});
      if (!s) return { error: 'INVALID', message: '일정 입력값이 올바르지 않습니다.' };
      s.id = nextId(schedules);
      schedules.push(s);
      if (s.assignee !== '미지정' && assignees.indexOf(s.assignee) === -1) assignees.push(s.assignee);
      return { changed: true, id: s.id };
    }

    case 'updateStatus': {
      const target = findSchedule(req.id);
      if (!target) return { error: 'NOT_FOUND', message: '이미 삭제된 일정입니다.' };
      if (VALID_STATUS.indexOf(req.status) === -1) return { error: 'INVALID', message: '상태값이 올바르지 않습니다.' };
      target.status = req.status;
      return { changed: true };
    }

    case 'updateMemo': {
      const target = findSchedule(req.id);
      if (!target) return { error: 'NOT_FOUND', message: '이미 삭제된 일정입니다.' };
      target.memo = clip(req.memo, 2000);
      return { changed: true };
    }

    case 'deleteSchedule': {
      const before = schedules.length;
      state.schedules = schedules.filter(s => s.id !== req.id);
      return { changed: state.schedules.length !== before };
    }

    case 'addAssignee': {
      const name = clip(req.name, 40).trim();
      if (!name) return { error: 'INVALID', message: '담당자 이름을 입력해주세요.' };
      if (assignees.indexOf(name) !== -1) return { error: 'DUPLICATE', message: `'${name}'은(는) 이미 등록된 담당자입니다.` };
      assignees.push(name);
      return { changed: true };
    }

    case 'deleteAssignee': {
      state.assignees = assignees.filter(a => a !== req.name);
      schedules.forEach(s => {
        if (s.assignee === req.name) s.assignee = '미지정';
      });
      return { changed: true };
    }

    case 'replaceAll': {
      if (!Array.isArray(req.schedules)) return { error: 'INVALID', message: '일정 데이터 형식이 올바르지 않습니다.' };
      const cleaned = [];
      req.schedules.forEach(raw => {
        const s = sanitizeSchedule(raw || {});
        if (!s) return;
        const rawId = String(raw.id || '');
        s.id = /^SCH-\d+$/.test(rawId) && !cleaned.some(c => c.id === rawId) ? rawId : nextId(cleaned);
        cleaned.push(s);
      });
      const names = Array.isArray(req.assignees) ? req.assignees.map(n => clip(n, 40).trim()).filter(Boolean) : [];
      cleaned.forEach(s => {
        if (s.assignee !== '미지정' && names.indexOf(s.assignee) === -1) names.push(s.assignee);
      });
      state.schedules = cleaned;
      state.assignees = names.filter((n, i) => names.indexOf(n) === i);
      return { changed: true };
    }

    default:
      return { error: 'UNKNOWN_ACTION', message: '알 수 없는 요청입니다.' };
  }
}

function sanitizeSchedule(raw) {
  const s = {
    title: clip(raw.title, 200).trim(),
    category: clip(raw.category, 40).trim() || '연구과제',
    assignee: clip(raw.assignee, 40).trim() || '미지정',
    startDate: String(raw.startDate || ''),
    endDate: String(raw.endDate || ''),
    status: VALID_STATUS.indexOf(raw.status) !== -1 ? raw.status : '진행중',
    priority: VALID_PRIORITY.indexOf(raw.priority) !== -1 ? raw.priority : '보통',
    memo: clip(raw.memo, 2000)
  };
  if (!s.title || !DATE_RE.test(s.startDate) || !DATE_RE.test(s.endDate) || s.startDate > s.endDate) return null;
  return s;
}

function nextId(list) {
  const maxNum = list.reduce((acc, s) => {
    const m = String(s.id || '').match(/^SCH-(\d+)$/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return 'SCH-' + String(maxNum + 1).padStart(2, '0');
}

function clip(value, max) {
  return String(value == null ? '' : value).slice(0, max);
}

// ---------- 시트 입출력 ----------

function getSheet(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  // 날짜 문자열이 자동으로 Date 로 변환되지 않도록 전체를 텍스트 서식으로 고정
  sheet.getRange(1, 1, sheet.getMaxRows(), header.length).setNumberFormat('@');
  return sheet;
}

function readState() {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const toText = v => (v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v));

  const sSheet = getSheet(SCHEDULE_SHEET, SCHEDULE_FIELDS);
  const sRows = sSheet.getLastRow() > 1
    ? sSheet.getRange(2, 1, sSheet.getLastRow() - 1, SCHEDULE_FIELDS.length).getValues()
    : [];
  const schedules = sRows
    .filter(r => r[0] !== '')
    .map(r => {
      const obj = {};
      SCHEDULE_FIELDS.forEach((f, i) => { obj[f] = toText(r[i]); });
      return obj;
    });

  const aSheet = getSheet(ASSIGNEE_SHEET, ['name']);
  const aRows = aSheet.getLastRow() > 1 ? aSheet.getRange(2, 1, aSheet.getLastRow() - 1, 1).getValues() : [];
  const assignees = aRows.map(r => String(r[0]).trim()).filter(Boolean);

  return { schedules, assignees };
}

function writeState(state) {
  const sSheet = getSheet(SCHEDULE_SHEET, SCHEDULE_FIELDS);
  if (sSheet.getLastRow() > 1) sSheet.getRange(2, 1, sSheet.getLastRow() - 1, SCHEDULE_FIELDS.length).clearContent();
  if (state.schedules.length > 0) {
    const rows = state.schedules.map(s => SCHEDULE_FIELDS.map(f => (s[f] == null ? '' : String(s[f]))));
    sSheet.getRange(2, 1, rows.length, SCHEDULE_FIELDS.length).setNumberFormat('@').setValues(rows);
  }

  const aSheet = getSheet(ASSIGNEE_SHEET, ['name']);
  if (aSheet.getLastRow() > 1) aSheet.getRange(2, 1, aSheet.getLastRow() - 1, 1).clearContent();
  if (state.assignees.length > 0) {
    aSheet.getRange(2, 1, state.assignees.length, 1).setNumberFormat('@').setValues(state.assignees.map(n => [n]));
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

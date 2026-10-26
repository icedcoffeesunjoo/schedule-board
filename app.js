/**
 * 연구·교육 일정 자동 편성표 애플리케이션
 * - 기준일: 접속한 날의 실제 오늘 날짜 (마감 임박 = 오늘 ~ D-3)
 * - 타임라인 범위: 2026-10-15 ~ 2026-11-20 (총 37일)
 * - 외부 라이브러리 미의존 (완전 오프라인 동작 지원)
 * - 담당자 풀(Pool) 관리 (추가 / 삭제 / 일정 연동)
 * - 로컬스토리지 자동 영속성
 * - 공유 모드: config.js 에 Apps Script 웹앱 URL 지정 시 구글 시트에 저장·동기화 (편집은 공용 비밀번호 필요)
 */

const STORAGE_KEY_SCHEDULES = 'schedule_board_data_v1';
const STORAGE_KEY_ASSIGNEES = 'schedule_board_assignees_v1';
const STORAGE_KEY_REMOTE_CACHE = 'schedule_board_remote_cache_v1';
const STORAGE_KEY_PASSWORD = 'schedule_board_edit_password_v1';

// 공유 모드 설정 (config.js)
const CONFIG = window.SCHEDULE_BOARD_CONFIG || {};
const API_URL = (CONFIG.apiUrl || '').trim();
const IS_REMOTE = API_URL !== '';
const POLL_INTERVAL_MS = CONFIG.pollIntervalMs || 20000;

const BASE_DATE_STR = formatDate(new Date());
const URGENT_END_STR = formatDate(new Date(new Date().setDate(new Date().getDate() + 3)));
// 타임라인 범위: 이번 달 1일 ~ 2029년 2월 말
const TIMELINE_END_YEAR = 2029;
const TIMELINE_END_MONTH = 2;
const TIMELINE_START_STR = BASE_DATE_STR.slice(0, 8) + '01';
const TIMELINE_END_STR = formatDate(new Date(TIMELINE_END_YEAR, TIMELINE_END_MONTH, 0));

// 이번 달부터 2029년 2월까지의 월별 목록
const MONTHS_LIST = (() => {
  const list = [];
  let y = parseInt(BASE_DATE_STR.slice(0, 4), 10);
  let m = parseInt(BASE_DATE_STR.slice(5, 7), 10);
  while (y < TIMELINE_END_YEAR || (y === TIMELINE_END_YEAR && m <= TIMELINE_END_MONTH)) {
    list.push({ year: y, month: m, full: `${y}년 ${m}월`, isYearStart: m === 1 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return list;
})();

// 초기 기본 담당자 목록 (예시 지도학생)
const DEFAULT_ASSIGNEES = [
  '김민준 (박사과정)',
  '이서연 (석사과정)',
  '박지훈 (석사과정)',
  '정하늘 (박사수료)'
];

// 초기 기본 일정 목록 (예시)
const DEFAULT_SCHEDULES = [
  {
    id: 'SCH-01',
    title: '박사 학위논문 프로포절 발표',
    category: '프로포절 발표',
    assignee: '김민준 (박사과정)',
    startDate: '2026-10-20',
    endDate: '2026-10-28', // 마감 임박 (D-3)
    status: '진행중',
    priority: '높음',
    memo: '발표 자료 지도교수님 1차 검토 완료, 심사위원 일정 확정 필요'
  },
  {
    id: 'SCH-02',
    title: '연구계획서 IRB 심의 제출',
    category: 'IRB 제출',
    assignee: '김민준 (박사과정)',
    startDate: '2026-10-26', // SCH-01과 기간 중복 (충돌 예시)
    endDate: '2026-11-13',
    status: '대기',
    priority: '높음',
    memo: ''
  },
  {
    id: 'SCH-03',
    title: '석사 학위논문 요지 발표',
    category: '요지 발표',
    assignee: '이서연 (석사과정)',
    startDate: '2026-11-02',
    endDate: '2026-11-20',
    status: '진행중',
    priority: '보통',
    memo: ''
  },
  {
    id: 'SCH-04',
    title: '논문자격시험 (논자시) 응시',
    category: '논자시',
    assignee: '박지훈 (석사과정)',
    startDate: '2026-12-01',
    endDate: '2026-12-18',
    status: '대기',
    priority: '보통',
    memo: '전공 2과목 + 영어'
  },
  {
    id: 'SCH-05',
    title: 'KCI 학술지 논문 투고 및 수정',
    category: '논문 투고',
    assignee: '정하늘 (박사수료)',
    startDate: '2026-11-01',
    endDate: '2027-04-30',
    status: '진행중',
    priority: '높음',
    memo: ''
  },
  {
    id: 'SCH-06',
    title: '박사 학위논문 심사 및 졸업',
    category: '졸업 계획',
    assignee: '정하늘 (박사수료)',
    startDate: '2027-09-01',
    endDate: '2028-02-25',
    status: '대기',
    priority: '높음',
    memo: ''
  },
  {
    id: 'SCH-07',
    title: '석사 학위논문 프로포절 발표',
    category: '프로포절 발표',
    assignee: '박지훈 (석사과정)',
    startDate: '2027-03-02',
    endDate: '2027-04-16',
    status: '대기',
    priority: '보통',
    memo: ''
  },
  {
    id: 'SCH-08',
    title: '석사 졸업 (학위논문 최종 제출)',
    category: '졸업 계획',
    assignee: '이서연 (석사과정)',
    startDate: '2027-05-03',
    endDate: '2027-08-20',
    status: '대기',
    priority: '보통',
    memo: ''
  },
  {
    id: 'SCH-09',
    title: '한국심리학회 연차학술대회 포스터 발표',
    category: '학회 참석',
    assignee: '이서연 (석사과정)',
    startDate: '2027-08-18',
    endDate: '2027-08-20',
    status: '대기',
    priority: '보통',
    memo: '초록 마감 6월 말'
  },
  {
    id: 'SCH-10',
    title: '석사 학위논문 심사 및 졸업',
    category: '졸업 계획',
    assignee: '박지훈 (석사과정)',
    startDate: '2028-09-01',
    endDate: '2029-02-20',
    status: '대기',
    priority: '보통',
    memo: ''
  }
];

// 상태 관리
let schedules = [];
let assignees = [];
let currentAssigneeFilter = 'ALL';
let currentStatusFilter = 'ALL';
let currentYearTab = 'ALL'; // 상세 현황표 연도 탭 ('ALL' 또는 연도 숫자)
let newlyAddedScheduleId = null;

// 날짜 유틸 함수
function parseDate(str) {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDayDiff(d1, d2) {
  const oneDay = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((utc2 - utc1) / oneDay);
}

// 마감 임박 여부 판별 (오늘 ~ D-3 사이 마감, 완료 아닌 일정)
function isUrgent(item) {
  if (item.status === '완료') return false;
  return item.endDate >= BASE_DATE_STR && item.endDate <= URGENT_END_STR;
}

// 마감 디데이 텍스트 계산
function getDDayText(item) {
  if (item.status === '완료') {
    return { text: '완료', isUrgent: false };
  }
  const baseDate = parseDate(BASE_DATE_STR);
  const targetDate = parseDate(item.endDate);
  const diff = getDayDiff(baseDate, targetDate);

  if (diff < 0) {
    return { text: `지연 (+${Math.abs(diff)})`, isUrgent: false, isOverdue: true };
  } else if (diff === 0) {
    return { text: 'D-Day (오늘)', isUrgent: true };
  } else if (diff <= 3) {
    return { text: `D-${diff} 임박!`, isUrgent: true };
  } else {
    return { text: `D-${diff}`, isUrgent: false };
  }
}

// 동일 담당자의 기간 겹침 감지 (A.start <= B.end && B.start <= A.end)
function analyzeConflicts(scheduleList) {
  const conflictPairs = [];
  const conflictingIdSet = new Set();

  for (let i = 0; i < scheduleList.length; i++) {
    for (let j = i + 1; j < scheduleList.length; j++) {
      const a = scheduleList[i];
      const b = scheduleList[j];

      const aAssignee = (a.assignee || '').trim();
      const bAssignee = (b.assignee || '').trim();

      if (aAssignee && aAssignee !== '미지정' && aAssignee === bAssignee) {
        const aStart = a.startDate;
        const aEnd = a.endDate;
        const bStart = b.startDate;
        const bEnd = b.endDate;

        if (aStart <= bEnd && bStart <= aEnd) {
          conflictingIdSet.add(a.id);
          conflictingIdSet.add(b.id);
          conflictPairs.push({
            assignee: a.assignee,
            scheduleA: a,
            scheduleB: b
          });
        }
      }
    }
  }

  return { conflictPairs, conflictingIdSet };
}

// 로컬 스토리지 로드/저장
function loadData() {
  // 공유 모드: 마지막으로 받아온 서버 데이터를 먼저 표시하고, 이후 서버에서 최신 데이터를 가져옴
  if (IS_REMOTE) {
    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY_REMOTE_CACHE) || '{}');
      schedules = Array.isArray(cached.schedules) ? cached.schedules : [];
      assignees = Array.isArray(cached.assignees) ? cached.assignees : [];
    } catch (e) {
      schedules = [];
      assignees = [];
    }
    return;
  }

  // 1. 일정 로드
  const storedSchedules = localStorage.getItem(STORAGE_KEY_SCHEDULES);
  if (storedSchedules) {
    try {
      schedules = JSON.parse(storedSchedules);
    } catch (e) {
      console.error('일정 데이터 파싱 오류:', e);
      schedules = JSON.parse(JSON.stringify(DEFAULT_SCHEDULES));
    }
  } else {
    schedules = JSON.parse(JSON.stringify(DEFAULT_SCHEDULES));
  }

  // 2. 담당자 목록 로드
  const storedAssignees = localStorage.getItem(STORAGE_KEY_ASSIGNEES);
  if (storedAssignees) {
    try {
      assignees = JSON.parse(storedAssignees);
    } catch (e) {
      console.error('담당자 목록 파싱 오류:', e);
      assignees = [...DEFAULT_ASSIGNEES];
    }
  } else {
    assignees = [...DEFAULT_ASSIGNEES];
  }

  // 일정에 쓰인 담당자가 assignees에 누락된 경우 자동 합병
  schedules.forEach(s => {
    const name = (s.assignee || '').trim();
    if (name && name !== '미지정' && !assignees.includes(name)) {
      assignees.push(name);
    }
  });
}

function saveData() {
  if (IS_REMOTE) {
    localStorage.setItem(STORAGE_KEY_REMOTE_CACHE, JSON.stringify({ schedules, assignees }));
    return;
  }
  localStorage.setItem(STORAGE_KEY_SCHEDULES, JSON.stringify(schedules));
  localStorage.setItem(STORAGE_KEY_ASSIGNEES, JSON.stringify(assignees));
}

// ---------- 공유 모드 동기화 ----------
let isSaving = false;
let writeSeq = 0; // 쓰기 요청마다 증가: 쓰기 이전에 시작된 조회 결과가 최신 상태를 덮어쓰지 않도록 함

function setSyncStatus(state, text) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.dataset.state = state;
  el.textContent = text;
}

function nowTimeText() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// 서버 응답을 화면 상태에 반영 (변경이 있으면 true)
function applyServerState(data) {
  const nextSchedules = (Array.isArray(data.schedules) ? data.schedules : []).map(s => ({ ...s, memo: s.memo || '' }));
  const nextAssignees = Array.isArray(data.assignees) ? data.assignees : [];
  if (JSON.stringify({ s: nextSchedules, a: nextAssignees }) === JSON.stringify({ s: schedules, a: assignees })) {
    return false;
  }
  schedules = nextSchedules;
  assignees = nextAssignees;
  saveData();
  return true;
}

async function fetchRemoteState() {
  const seqAtStart = writeSeq;
  try {
    const res = await fetch(API_URL, { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || '조회 실패');
    if (isSaving || seqAtStart !== writeSeq) return;
    if (applyServerState(data)) render();
    setSyncStatus('online', `🟢 공유 모드 · ${nowTimeText()} 동기화`);
  } catch (err) {
    console.error('공유 데이터 조회 오류:', err);
    setSyncStatus('error', '🔴 연결 오류 · 마지막으로 받은 데이터 표시 중');
  }
}

function getEditPassword(forcePrompt) {
  let pw = localStorage.getItem(STORAGE_KEY_PASSWORD);
  if (!pw || forcePrompt) {
    const input = prompt('연구실 공용 편집 비밀번호를 입력하세요.');
    if (input === null || !input.trim()) return null;
    pw = input.trim();
    localStorage.setItem(STORAGE_KEY_PASSWORD, pw);
  }
  return pw;
}

// 서버에 변경 요청 전송 (비밀번호가 틀리면 한 번 다시 물어봄). 실패 시 null 반환
async function apiPost(action, payload) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const password = getEditPassword(attempt > 0);
    if (!password) {
      showToast('비밀번호를 입력하지 않아 저장하지 않았습니다.');
      return null;
    }

    writeSeq++;
    isSaving = true;
    setSyncStatus('saving', '🟡 저장 중…');
    let data;
    try {
      // text/plain 으로 보내야 Apps Script 웹앱에서 CORS preflight 없이 동작함
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, password, ...payload })
      });
      data = await res.json();
    } catch (err) {
      setSyncStatus('error', '🔴 연결 오류 · 저장되지 않았습니다');
      alert('서버에 연결하지 못해 저장되지 않았습니다.\n' + err.message);
      return null;
    } finally {
      isSaving = false;
    }

    if (data.error === 'BAD_PASSWORD') {
      localStorage.removeItem(STORAGE_KEY_PASSWORD);
      alert(data.message);
      continue;
    }

    if (Array.isArray(data.schedules)) applyServerState(data);
    render();
    setSyncStatus('online', `🟢 공유 모드 · ${nowTimeText()} 저장됨`);
    if (!data.ok) {
      alert(data.message || '저장에 실패했습니다.');
      return null;
    }
    return data;
  }
  return null;
}

// 로컬 모드는 즉시 반영, 공유 모드는 서버에 요청 후 서버 상태로 갱신
async function commitChange(action, payload, applyLocal) {
  if (!IS_REMOTE) {
    const result = applyLocal ? applyLocal() : null;
    saveData();
    render();
    return result || { ok: true };
  }
  return apiPost(action, payload);
}

function startRemoteSync() {
  setSyncStatus('saving', '🟡 공유 데이터 불러오는 중…');
  fetchRemoteState();
  setInterval(() => {
    const active = document.activeElement;
    const isEditing = document.getElementById('memo-dialog').open ||
      (active && active.classList && active.classList.contains('status-select'));
    if (!document.hidden && !isSaving && !isEditing) fetchRemoteState();
  }, POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !isSaving) fetchRemoteState();
  });
}

// 토스트 알림 띄우기
let toastTimer = null;
function showToast(message) {
  const toastEl = document.getElementById('toast-message');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3200);
}

// 담당자 추가/삭제 기능
async function addAssignee(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    alert('담당자 이름을 입력해주세요.');
    return false;
  }
  if (assignees.includes(trimmed)) {
    alert(`'${trimmed}'은(는) 이미 등록된 담당자입니다.`);
    return false;
  }
  const result = await commitChange('addAssignee', { name: trimmed }, () => {
    assignees.push(trimmed);
  });
  if (!result) return false;
  showToast(`담당자 '${trimmed}'이(가) 등록되었습니다.`);
  return true;
}

async function deleteAssignee(name) {
  const count = schedules.filter(s => s.assignee === name).length;
  let confirmMsg = `'${name}' 담당자를 목록에서 삭제하시겠습니까?`;
  if (count > 0) {
    confirmMsg = `'${name}' 담당자에게 배정된 일정이 ${count}건 있습니다.\n삭제 시 해당 일정의 담당자는 '미지정'으로 변경됩니다. 계속하시겠습니까?`;
  }

  if (confirm(confirmMsg)) {
    if (currentAssigneeFilter === name) {
      currentAssigneeFilter = 'ALL';
    }

    const result = await commitChange('deleteAssignee', { name }, () => {
      assignees = assignees.filter(a => a !== name);
      // 연동된 일정 담당자 처리
      schedules.forEach(s => {
        if (s.assignee === name) {
          s.assignee = '미지정';
        }
      });
    });
    if (!result) return;
    showToast(`'${name}' 담당자가 삭제되었습니다.`);
  }
}

// 필터링 적용된 일정 목록
function getFilteredSchedules() {
  return schedules.filter(item => {
    const matchesAssignee = currentAssigneeFilter === 'ALL' || item.assignee === currentAssigneeFilter;
    const matchesStatus = currentStatusFilter === 'ALL' || item.status === currentStatusFilter;
    return matchesAssignee && matchesStatus;
  });
}

// 담당자 과정 순서: 이름 뒤 괄호 안의 과정으로 판별 (예: '김민준 (박사과정)')
const DEGREE_ORDER = ['박사수료', '박사과정', '석박통합과정수료', '석사수료', '석사과정'];

function degreeRank(name) {
  const match = (name || '').match(/\(([^)]+)\)\s*$/);
  const degree = match ? match[1].replace(/\s/g, '') : '';
  const idx = DEGREE_ORDER.indexOf(degree);
  return idx === -1 ? DEGREE_ORDER.length : idx;
}

// 과정 순서 → 같은 과정 안에서는 가나다 순 ('미지정'은 맨 뒤)
function compareAssigneeNames(a, b) {
  if (a === '미지정' || b === '미지정') return (a === '미지정') - (b === '미지정');
  return degreeRank(a) - degreeRank(b) || a.localeCompare(b, 'ko');
}

function sortedAssigneeNames() {
  return [...assignees].sort(compareAssigneeNames);
}

// 담당자(학생)별로 묶고, 같은 담당자 안에서는 시작일 순으로 정렬
function sortByAssignee(list) {
  const ordered = sortedAssigneeNames();
  const orderOf = name => {
    const idx = ordered.indexOf(name);
    return idx === -1 ? ordered.length : idx;
  };
  return [...list].sort((a, b) =>
    orderOf(a.assignee) - orderOf(b.assignee) ||
    a.assignee.localeCompare(b.assignee, 'ko') ||
    a.startDate.localeCompare(b.startDate)
  );
}

// 일정 기간이 해당 연도에 걸쳐 있는지 (여러 해에 걸친 일정은 각 연도 탭에 모두 표시)
function overlapsYear(item, year) {
  return item.startDate <= `${year}-12-31` && item.endDate >= `${year}-01-01`;
}

// UI 전체 렌더링
function render() {
  const { conflictPairs, conflictingIdSet } = analyzeConflicts(schedules);
  const urgentCount = schedules.filter(isUrgent).length;
  const inProgressCount = schedules.filter(s => s.status === '진행중').length;

  // 1. 요약 통계 카드 갱신
  document.getElementById('base-date-label').textContent = BASE_DATE_STR;
  document.getElementById('urgent-range-label').textContent = `${BASE_DATE_STR.slice(5).replace('-', '/')} ~ ${URGENT_END_STR.slice(5).replace('-', '/')} 미완료`;
  document.getElementById('stat-total').textContent = schedules.length;
  document.getElementById('stat-progress').textContent = inProgressCount;
  document.getElementById('stat-urgent').textContent = urgentCount;
  document.getElementById('stat-conflict').textContent = conflictingIdSet.size;

  // 2. 충돌 경고 배너 갱신
  const alertBox = document.getElementById('conflict-alert-box');
  const alertTitle = document.getElementById('conflict-alert-title');
  const conflictListEl = document.getElementById('conflict-list');

  if (conflictingIdSet.size > 0) {
    alertBox.classList.add('active');
    alertTitle.textContent = `일정 충돌 감지 (${conflictingIdSet.size}건):`;
    conflictListEl.innerHTML = conflictPairs.map(p => `
      <li>
        <strong>${escapeHtml(p.assignee)}</strong>: 
        [${escapeHtml(p.scheduleA.title)}] (${p.scheduleA.startDate} ~ ${p.scheduleA.endDate})
        <span class="conflict-arrow">↔</span>
        [${escapeHtml(p.scheduleB.title)}] (${p.scheduleB.startDate} ~ ${p.scheduleB.endDate})
      </li>
    `).join('');
  } else {
    alertBox.classList.remove('active');
    conflictListEl.innerHTML = '';
  }

  // 3. 담당자 풀 태그 렌더링
  renderAssigneeTags();

  // 4. 셀렉트 박스들 동기화 (등록 폼 담당자 & 상단 필터 담당자)
  updateAssigneeSelectOptions();

  // 5. 간트 타임라인 렌더링
  renderTimeline(conflictingIdSet);

  // 6. 하단 상세 테이블 렌더링
  renderTable(conflictingIdSet);
}

// 담당자 관리 태그 렌더링
function renderAssigneeTags() {
  const container = document.getElementById('assignee-tag-container');
  if (!container) return;

  if (assignees.length === 0) {
    container.innerHTML = `<span style="font-size: 0.82rem; color: var(--text-tertiary);">등록된 담당자가 없습니다. 상단에서 담당자를 추가해주세요.</span>`;
    return;
  }

  container.innerHTML = sortedAssigneeNames().map(name => {
    const count = schedules.filter(s => s.assignee === name).length;
    return `
      <div class="assignee-tag">
        <span>${escapeHtml(name)}</span>
        <span class="assignee-count" title="배정된 일정 건수">${count}건</span>
        <button type="button" class="assignee-tag-delete" data-name="${escapeHtml(name)}" title="${escapeHtml(name)} 삭제">✕</button>
      </div>
    `;
  }).join('');
}

// 담당자 선택 셀렉트박스 갱신
function updateAssigneeSelectOptions() {
  // 1) 새 일정 등록 폼 셀렉트박스 (#form-assignee)
  const formSelect = document.getElementById('form-assignee');
  if (formSelect) {
    const prevFormVal = formSelect.value;
    formSelect.innerHTML = sortedAssigneeNames().map(name => `
      <option value="${escapeHtml(name)}">${escapeHtml(name)}</option>
    `).join('');
    if (assignees.includes(prevFormVal)) {
      formSelect.value = prevFormVal;
    }
  }

  // 2) 필터 셀렉트박스 (#filter-assignee)
  const filterSelect = document.getElementById('filter-assignee');
  if (filterSelect) {
    const prevFilterVal = currentAssigneeFilter;
    let optionsHtml = `<option value="ALL">담당자 전체</option>`;
    sortedAssigneeNames().forEach(name => {
      optionsHtml += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    });
    // 혹시 '미지정' 일정이 있다면 미지정 옵션도 추가
    if (schedules.some(s => s.assignee === '미지정')) {
      optionsHtml += `<option value="미지정">미지정</option>`;
    }
    filterSelect.innerHTML = optionsHtml;

    if (prevFilterVal === 'ALL' || assignees.includes(prevFilterVal) || prevFilterVal === '미지정') {
      filterSelect.value = prevFilterVal;
      currentAssigneeFilter = prevFilterVal;
    } else {
      filterSelect.value = 'ALL';
      currentAssigneeFilter = 'ALL';
    }
  }
}

// 간트 타임라인 렌더링 (이번 달 ~ 2029.02 월별, 위·아래 2단으로 나눠 표시)
function renderTimeline(conflictingIdSet) {
  const container = document.getElementById('timeline-container');
  const filtered = getFilteredSchedules();

  const sorted = sortByAssignee(filtered);

  // 오늘 기준선 위치 계산용
  const todayDate = parseDate(BASE_DATE_STR);
  const todayMs = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), 12, 0, 0).getTime();

  // 월 목록을 앞·뒤 절반으로 나눠 2단 구성
  const half = Math.ceil(MONTHS_LIST.length / 2);
  const panels = [MONTHS_LIST.slice(0, half), MONTHS_LIST.slice(half)].filter(p => p.length > 0);

  const panelLabel = m => `${m.year}.${String(m.month).padStart(2, '0')}`;

  container.innerHTML = panels.map(months => {
    const first = months[0];
    const last = months[months.length - 1];
    const panelStartMs = new Date(first.year, first.month - 1, 1, 0, 0, 0).getTime();
    const panelEndMs = new Date(last.year, last.month, 0, 23, 59, 59).getTime();
    const totalDurationMs = panelEndMs - panelStartMs;

    // 월별 눈금 (단의 첫 달과 1월에는 연도 표시)
    const ticksHtml = months.map((m, idx) => {
      const label = (idx === 0 || m.isYearStart)
        ? `'${String(m.year).slice(2)}.${String(m.month).padStart(2, '0')}`
        : `${String(m.month).padStart(2, '0')}월`;
      return `
      <div class="axis-tick ${m.isYearStart ? 'year-start' : ''}" title="${m.full}">
        ${label}
      </div>
    `;
    }).join('');

    // 이 단의 기간과 겹치는 일정만 표시
    const items = sorted.filter(item => {
      const startMs = parseDate(item.startDate).getTime();
      const endMs = parseDate(item.endDate).getTime() + (24 * 60 * 60 * 1000 - 1);
      return endMs >= panelStartMs && startMs <= panelEndMs;
    });

    let rowsHtml = '';
    if (items.length === 0) {
      rowsHtml = `<div style="padding: 28px; text-align: center; color: var(--text-tertiary);">이 기간에 해당하는 일정이 없습니다.</div>`;
    } else {
      let currentGroup = null;
      items.forEach(item => {
        if (item.assignee !== currentGroup) {
          currentGroup = item.assignee;
          const groupCount = items.filter(s => s.assignee === currentGroup).length;
          rowsHtml += `
          <div class="timeline-group-header">
            👤 ${escapeHtml(currentGroup)} <span class="timeline-group-count">${groupCount}건</span>
          </div>
        `;
        }

        const startMs = parseDate(item.startDate).getTime();
        const endMs = parseDate(item.endDate).getTime() + (24 * 60 * 60 * 1000 - 1);

        const clampedStart = Math.max(panelStartMs, startMs);
        const clampedEnd = Math.min(panelEndMs, endMs);

        const leftPct = Math.max(0, ((clampedStart - panelStartMs) / totalDurationMs) * 100);
        const widthPct = Math.max(1.0, ((clampedEnd - clampedStart) / totalDurationMs) * 100);

        // 앞·뒤 단으로 이어지는 일정 표시
        const continuesBefore = startMs < panelStartMs;
        const continuesAfter = endMs > panelEndMs;

        const isConflict = conflictingIdSet.has(item.id);
        const isItemUrgent = isUrgent(item);

        let barClass = 'state-normal';
        if (item.status === '완료') {
          barClass = 'state-done';
        } else if (isConflict) {
          barClass = 'state-conflict';
        } else if (isItemUrgent) {
          barClass = 'state-urgent';
        }

        rowsHtml += `
          <div class="timeline-row">
            <div class="timeline-row-meta" title="${escapeHtml(item.title)}">
              <span class="row-title">${escapeHtml(item.title)}</span>
              <span class="row-desc">${escapeHtml(item.assignee)} · ${item.startDate.slice(2)}~${item.endDate.slice(2)}</span>
            </div>
            <div class="timeline-track">
              <div class="gantt-bar ${barClass}"
                   style="left: ${leftPct.toFixed(2)}%; width: ${widthPct.toFixed(2)}%;"
                   title="${escapeHtml(item.title)} [${item.startDate} ~ ${item.endDate}] (${item.status}${isConflict ? ', 충돌' : ''}${isItemUrgent ? ', 마감임박' : ''})${item.memo ? '\n메모: ' + escapeHtml(item.memo) : ''}">
                ${continuesBefore ? '◀ ' : ''}${item.memo ? '📝 ' : ''}${escapeHtml(item.title)}${continuesAfter ? ' ▶' : ''}
              </div>
            </div>
          </div>
        `;
      });
    }

    // 오늘 기준선은 오늘이 포함된 단에만 표시
    const todayInPanel = todayMs >= panelStartMs && todayMs <= panelEndMs;
    const todayLeftPct = ((todayMs - panelStartMs) / totalDurationMs) * 100;
    const todayHtml = todayInPanel ? `
      <div class="today-line" style="left: calc(220px + (100% - 220px) * ${todayLeftPct / 100});">
        <div class="today-badge">오늘 (${todayDate.getMonth() + 1}/${todayDate.getDate()})</div>
      </div>
    ` : '';

    return `
      <div class="timeline-panel">
        <div class="timeline-panel-title">${panelLabel(first)} ~ ${panelLabel(last)}</div>
        <div class="timeline-panel-body">
          <div class="timeline-axis-header">
            <div>일정 / 담당자</div>
            <div class="timeline-axis-dates" style="grid-template-columns: repeat(${months.length}, 1fr);">
              ${ticksHtml}
            </div>
          </div>
          ${todayHtml}
          <div class="timeline-rows">
            ${rowsHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// 하단 테이블 렌더링
function renderTable(conflictingIdSet) {
  const tbody = document.getElementById('schedule-tbody');
  const countInfo = document.getElementById('table-count-info');
  const baseFiltered = getFilteredSchedules();

  // 연도 탭 (전체 + 타임라인에 포함된 연도)
  const years = [...new Set(MONTHS_LIST.map(m => m.year))];
  if (currentYearTab !== 'ALL' && !years.includes(currentYearTab)) currentYearTab = 'ALL';
  const tabs = [{ key: 'ALL', label: '전체', count: baseFiltered.length }]
    .concat(years.map(y => ({ key: y, label: `${y}년`, count: baseFiltered.filter(s => overlapsYear(s, y)).length })));
  document.getElementById('year-tabs').innerHTML = tabs.map(t => `
    <button type="button" class="year-tab ${t.key === currentYearTab ? 'active' : ''}" role="tab"
            aria-selected="${t.key === currentYearTab}" data-year="${t.key}">
      ${t.label} <span class="year-tab-count">${t.count}</span>
    </button>
  `).join('');

  const filtered = sortByAssignee(
    currentYearTab === 'ALL' ? baseFiltered : baseFiltered.filter(s => overlapsYear(s, currentYearTab))
  );

  const tabLabel = currentYearTab === 'ALL' ? '' : `${currentYearTab}년 · `;
  countInfo.textContent = `${tabLabel}총 ${schedules.length}건 중 ${filtered.length}건 표시 (완료 ${schedules.filter(s => s.status === '완료').length}건)`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 32px; color: var(--text-tertiary);">조건에 맞는 일정이 없습니다.</td></tr>`;
    return;
  }

  let currentGroup = null;
  tbody.innerHTML = filtered.map(item => {
    // 담당자(연구원)가 바뀔 때마다 구분 행 삽입
    let groupRowHtml = '';
    if (item.assignee !== currentGroup) {
      currentGroup = item.assignee;
      const groupCount = filtered.filter(s => s.assignee === currentGroup).length;
      groupRowHtml = `
      <tr class="table-group-row">
        <td colspan="10">👤 ${escapeHtml(currentGroup)} <span class="timeline-group-count">${groupCount}건</span></td>
      </tr>
    `;
    }

    const isConflict = conflictingIdSet.has(item.id);
    const ddayInfo = getDDayText(item);
    const isNewlyAdded = item.id === newlyAddedScheduleId;

    let priorityClass = 'priority-medium';
    if (item.priority === '높음') priorityClass = 'priority-high';
    else if (item.priority === '낮음') priorityClass = 'priority-low';

    return groupRowHtml + `
      <tr class="${isConflict ? 'row-conflict' : ''} ${isNewlyAdded ? 'row-newly-added' : ''}" data-id="${item.id}">
        <td><span class="id-badge">${item.id}</span></td>
        <td>
          <strong>${escapeHtml(item.title)}</strong>
          ${isConflict ? '<span class="badge badge-conflict">충돌</span>' : ''}
        </td>
        <td><span class="badge badge-category">${escapeHtml(item.category)}</span></td>
        <td>${escapeHtml(item.assignee)}</td>
        <td style="font-variant-numeric: tabular-nums; font-size: 0.84rem;">
          ${item.startDate} ~ ${item.endDate}
        </td>
        <td class="${priorityClass}">${escapeHtml(item.priority)}</td>
        <td>
          <span class="badge ${ddayInfo.isUrgent ? 'badge-urgent' : 'badge-dday'}">
            ${ddayInfo.text}
          </span>
        </td>
        <td>
          <select class="status-select val-${item.status}" data-id="${item.id}" aria-label="진행 상태 변경">
            <option value="진행중" ${item.status === '진행중' ? 'selected' : ''}>진행중</option>
            <option value="대기" ${item.status === '대기' ? 'selected' : ''}>대기</option>
            <option value="완료" ${item.status === '완료' ? 'selected' : ''}>완료</option>
          </select>
        </td>
        <td class="memo-cell">
          <div class="memo-text">${item.memo ? escapeHtml(item.memo) : '<span class="memo-empty">—</span>'}</div>
          <button type="button" class="btn-memo" data-id="${item.id}" title="메모 편집" aria-label="메모 편집">✏️</button>
        </td>
        <td>
          <button type="button" class="btn-icon-danger btn-delete" data-id="${item.id}" title="일정 삭제" aria-label="삭제">
            ✕
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // 신규 추가된 행이 있다면 자동 스크롤
  if (newlyAddedScheduleId) {
    const newRow = tbody.querySelector(`tr[data-id="${newlyAddedScheduleId}"]`);
    if (newRow) {
      setTimeout(() => {
        newRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }
}

// HTML 엔티티 이스케이프
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 고유 ID 발급 (SCH-01, SCH-02 ...)
function generateNextId() {
  const maxNum = schedules.reduce((acc, curr) => {
    const match = curr.id.match(/^SCH-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      return num > acc ? num : acc;
    }
    return acc;
  }, 0);
  return `SCH-${String(maxNum + 1).padStart(2, '0')}`;
}

// 이벤트 핸들러 초기화
function initEventListeners() {
  // 1. 담당자 직접 추가
  const btnAddAssignee = document.getElementById('btn-add-assignee');
  const inputNewAssignee = document.getElementById('new-assignee-name');

  const degreeSelect = document.getElementById('new-assignee-degree');

  const handleAddAssignee = async () => {
    const nameOnly = inputNewAssignee.value.trim();
    const degree = degreeSelect.value;
    // 이미 '(과정)'을 직접 붙여 쓴 경우는 그대로 사용
    const val = nameOnly && degree && !/\)\s*$/.test(nameOnly) ? `${nameOnly} (${degree})` : nameOnly;
    if (await addAssignee(val)) {
      inputNewAssignee.value = '';
      inputNewAssignee.focus();
    }
  };

  btnAddAssignee.addEventListener('click', handleAddAssignee);
  inputNewAssignee.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAssignee();
    }
  });

  // 2. 담당자 태그 삭제 (이벤트 위임)
  document.getElementById('assignee-tag-container').addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.assignee-tag-delete');
    if (deleteBtn) {
      const name = deleteBtn.getAttribute('data-name');
      if (name) deleteAssignee(name);
    }
  });

  // 3. 새 일정 등록
  const form = document.getElementById('schedule-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('form-title').value.trim();
    const category = document.getElementById('form-category').value;
    const assigneeSelect = document.getElementById('form-assignee');
    const assignee = assigneeSelect ? assigneeSelect.value : '';
    const startDate = document.getElementById('form-start').value;
    const endDate = document.getElementById('form-end').value;
    const priority = document.getElementById('form-priority').value;
    const memo = document.getElementById('form-memo').value.trim();

    if (!title) {
      alert('일정 또는 과제명을 입력해주세요.');
      document.getElementById('form-title').focus();
      return;
    }
    if (!assignee) {
      alert('담당자를 먼저 등록하거나 선택해주세요.');
      return;
    }
    if (startDate > endDate) {
      alert('시작일이 마감일보다 늦을 수 없습니다. 기간을 확인해주세요.');
      return;
    }

    const newSchedule = {
      title,
      category,
      assignee,
      startDate,
      endDate,
      status: '진행중', // 기본 상태
      priority,
      memo
    };

    // ★ 사용자가 새 일정을 바로 볼 수 있도록 필터를 '전체'로 자동 초기화
    currentAssigneeFilter = 'ALL';
    currentStatusFilter = 'ALL';
    document.getElementById('filter-assignee').value = 'ALL';
    document.getElementById('filter-status').value = 'ALL';

    const submitBtn = document.getElementById('btn-submit');
    submitBtn.disabled = true;
    const result = await commitChange('addSchedule', { schedule: newSchedule }, () => {
      const nextId = generateNextId();
      schedules.push({ id: nextId, ...newSchedule });
      return { ok: true, id: nextId };
    });
    submitBtn.disabled = false;
    if (!result) return;

    newlyAddedScheduleId = result.id;
    render();

    showToast(`'${title}' 일정이 등록되어 아래 상세 목록에 반영되었습니다.`);

    // 폼 초기화 (기본 날짜 유지)
    document.getElementById('form-title').value = '';
    document.getElementById('form-memo').value = '';
    document.getElementById('form-title').focus();

    // 3.5초 후 신규 행 하이라이트 플래그 해제
    setTimeout(() => {
      newlyAddedScheduleId = null;
    }, 3500);
  });

  // 4. 필터 변경
  document.getElementById('filter-assignee').addEventListener('change', (e) => {
    currentAssigneeFilter = e.target.value;
    render();
  });

  document.getElementById('filter-status').addEventListener('change', (e) => {
    currentStatusFilter = e.target.value;
    render();
  });

  // 4-1. 상세 현황표 연도 탭 전환
  document.getElementById('year-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.year-tab');
    if (!tab) return;
    const key = tab.getAttribute('data-year');
    currentYearTab = key === 'ALL' ? 'ALL' : parseInt(key, 10);
    render();
  });

  // 5. 테이블 내 상태 변경 및 삭제
  const tbody = document.getElementById('schedule-tbody');
  tbody.addEventListener('change', async (e) => {
    if (e.target.classList.contains('status-select')) {
      const id = e.target.getAttribute('data-id');
      const newStatus = e.target.value;
      const target = schedules.find(s => s.id === id);
      if (target) {
        const result = await commitChange('updateStatus', { id, status: newStatus }, () => {
          target.status = newStatus;
        });
        if (!result) {
          render(); // 실패 시 셀렉트박스를 원래 값으로 되돌림
          return;
        }
        showToast(`'${target.title}' 상태가 [${newStatus}]로 변경되었습니다.`);
      }
    }
  });

  tbody.addEventListener('click', async (e) => {
    const memoBtn = e.target.closest('.btn-memo');
    if (memoBtn) {
      openMemoDialog(memoBtn.getAttribute('data-id'));
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const target = schedules.find(s => s.id === id);
      if (target && confirm(`'${target.title}' 일정을 삭제하시겠습니까?`)) {
        const result = await commitChange('deleteSchedule', { id }, () => {
          schedules = schedules.filter(s => s.id !== id);
        });
        if (!result) return;
        showToast(`'${target.title}' 일정이 삭제되었습니다.`);
      }
    }
  });

  // 5-1. 메모 편집 창 저장
  const memoDialog = document.getElementById('memo-dialog');
  memoDialog.addEventListener('close', async () => {
    const id = memoDialog.dataset.id;
    const target = schedules.find(s => s.id === id);
    if (memoDialog.returnValue !== 'save' || !target) return;

    const memo = document.getElementById('memo-dialog-input').value.trim();
    if (memo === (target.memo || '')) return;
    const result = await commitChange('updateMemo', { id, memo }, () => {
      target.memo = memo;
    });
    if (!result) return;
    showToast(`'${target.title}' 메모가 저장되었습니다.`);
  });

  // 6. 기본 데이터 복원 (공유 모드에서는 공유 데이터 전체 비우기)
  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (IS_REMOTE) {
      if (!confirm('공유 일정과 담당자를 모두 삭제합니다. 모든 지도학생의 화면에서 사라집니다.\n먼저 [일정 내보내기]로 백업하는 것을 권장합니다. 계속하시겠습니까?')) return;
      if (!confirm('정말로 공유 데이터를 전부 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
      currentAssigneeFilter = 'ALL';
      currentStatusFilter = 'ALL';
      document.getElementById('filter-assignee').value = 'ALL';
      document.getElementById('filter-status').value = 'ALL';
      const result = await apiPost('replaceAll', { schedules: [], assignees: [] });
      if (result) showToast('공유 데이터가 모두 초기화되었습니다.');
      return;
    }
    if (confirm('예시 데이터 10건 및 예시 담당자 4명으로 되돌리시겠습니까? 추가된 일정 및 담당자는 초기화됩니다.')) {
      localStorage.removeItem(STORAGE_KEY_SCHEDULES);
      localStorage.removeItem(STORAGE_KEY_ASSIGNEES);
      schedules = JSON.parse(JSON.stringify(DEFAULT_SCHEDULES));
      assignees = [...DEFAULT_ASSIGNEES];
      currentAssigneeFilter = 'ALL';
      currentStatusFilter = 'ALL';
      document.getElementById('filter-assignee').value = 'ALL';
      document.getElementById('filter-status').value = 'ALL';
      newlyAddedScheduleId = null;
      saveData();
      render();
      showToast('예시 데이터로 복원되었습니다.');
    }
  });

  // 7. 일정 데이터 내보내기 (JSON 다운로드)
  document.getElementById('btn-export').addEventListener('click', () => {
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      assignees,
      schedules
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const nowStr = formatDate(new Date());
    a.download = `연구교육_일정편성표_${nowStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('일정 데이터가 JSON 파일로 다운로드되었습니다.');
  });

  // 8. 일정 데이터 불러오기 (JSON 업로드)
  const importInput = document.getElementById('file-import');
  document.getElementById('btn-import-trigger').addEventListener('click', () => {
    importInput.click();
  });

  importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported.schedules) && IS_REMOTE) {
          importInput.value = '';
          if (!confirm(`'${file.name}' 내용으로 공유 일정 전체를 교체합니다. 모든 지도학생의 화면에 반영됩니다. 계속하시겠습니까?`)) return;
          currentAssigneeFilter = 'ALL';
          currentStatusFilter = 'ALL';
          document.getElementById('filter-assignee').value = 'ALL';
          document.getElementById('filter-status').value = 'ALL';
          const result = await apiPost('replaceAll', {
            schedules: imported.schedules,
            assignees: Array.isArray(imported.assignees) ? imported.assignees : []
          });
          if (result) showToast(`'${file.name}' 일정 데이터를 공유 일정표에 반영했습니다.`);
          return;
        }
        if (Array.isArray(imported.schedules)) {
          schedules = imported.schedules;
          if (Array.isArray(imported.assignees) && imported.assignees.length > 0) {
            assignees = imported.assignees;
          }
          currentAssigneeFilter = 'ALL';
          currentStatusFilter = 'ALL';
          document.getElementById('filter-assignee').value = 'ALL';
          document.getElementById('filter-status').value = 'ALL';
          saveData();
          render();
          showToast(`'${file.name}' 일정 데이터를 성공적으로 불러왔습니다.`);
        } else {
          alert('유효하지 않은 일정 데이터 파일 형식입니다.');
        }
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
      }
      importInput.value = '';
    };
    reader.readAsText(file);
  });

  // 9. 인쇄 / PDF 출력
  document.getElementById('btn-print').addEventListener('click', () => {
    window.print();
  });

  // 10. 공유 모드 전용: 편집 비밀번호 입력/변경, 초기화 버튼 문구 변경
  if (IS_REMOTE) {
    const btnPassword = document.getElementById('btn-password');
    btnPassword.hidden = false;
    btnPassword.addEventListener('click', async () => {
      if (!getEditPassword(true)) return;
      const result = await apiPost('checkPassword', {});
      if (result) showToast('편집 비밀번호가 확인되었습니다.');
    });

    const btnReset = document.getElementById('btn-reset');
    btnReset.innerHTML = '<span class="icon">🗑️</span> 공유 데이터 초기화';
    btnReset.title = '공유 일정과 담당자를 모두 삭제합니다 (비밀번호 필요)';
  }
}

// 일정 등록 폼 날짜 범위(이번 달 ~ 2029.02)와 기본값, 타임라인 제목 설정
function initFormDateRange() {
  const startInput = document.getElementById('form-start');
  const endInput = document.getElementById('form-end');
  [startInput, endInput].forEach(input => {
    input.min = TIMELINE_START_STR;
    input.max = TIMELINE_END_STR;
  });
  startInput.value = BASE_DATE_STR;
  endInput.value = formatDate(new Date(new Date().setDate(new Date().getDate() + 14)));

  const first = MONTHS_LIST[0];
  const last = MONTHS_LIST[MONTHS_LIST.length - 1];
  document.getElementById('timeline-title').textContent =
    `간트 타임라인 (${first.year}.${String(first.month).padStart(2, '0')} ~ ${last.year}.${String(last.month).padStart(2, '0')} · 월별)`;
}

// 메모 편집 창 열기
function openMemoDialog(id) {
  const target = schedules.find(s => s.id === id);
  if (!target) return;
  const dialog = document.getElementById('memo-dialog');
  dialog.dataset.id = id;
  document.getElementById('memo-dialog-title').textContent = `메모 편집 · ${target.title}`;
  const input = document.getElementById('memo-dialog-input');
  input.value = target.memo || '';
  dialog.showModal();
  input.focus();
}

// 애플리케이션 초기 구동
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initFormDateRange();
  initEventListeners();
  render();
  if (IS_REMOTE) startRemoteSync();
});

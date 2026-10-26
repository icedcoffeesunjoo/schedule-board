/**
 * 연구·교육 일정 자동 편성표 애플리케이션
 * - 기준일 고정: 2026-10-25
 * - 타임라인 범위: 2026-10-15 ~ 2026-11-20 (총 37일)
 * - 외부 라이브러리 미의존 (완전 오프라인 동작 지원)
 * - 담당자 풀(Pool) 관리 (추가 / 삭제 / 일정 연동)
 * - 로컬스토리지 자동 영속성
 */

const STORAGE_KEY_SCHEDULES = 'schedule_board_data_v1';
const STORAGE_KEY_ASSIGNEES = 'schedule_board_assignees_v1';

const BASE_DATE_STR = '2026-10-25';
const TIMELINE_START_STR = '2026-10-01';
const TIMELINE_END_STR = '2028-02-29';

// 2026년 10월부터 2028년 2월까지의 월별 목록 (총 17개월)
const MONTHS_LIST = [
  { year: 2026, month: 10, label: "'26.10", full: '2026년 10월', isYearStart: false },
  { year: 2026, month: 11, label: '11월', full: '2026년 11월', isYearStart: false },
  { year: 2026, month: 12, label: '12월', full: '2026년 12월', isYearStart: false },
  { year: 2027, month: 1, label: "'27.01", full: '2027년 1월', isYearStart: true },
  { year: 2027, month: 2, label: '02월', full: '2027년 2월', isYearStart: false },
  { year: 2027, month: 3, label: '03월', full: '2027년 3월', isYearStart: false },
  { year: 2027, month: 4, label: '04월', full: '2027년 4월', isYearStart: false },
  { year: 2027, month: 5, label: '05월', full: '2027년 5월', isYearStart: false },
  { year: 2027, month: 6, label: '06월', full: '2027년 6월', isYearStart: false },
  { year: 2027, month: 7, label: '07월', full: '2027년 7월', isYearStart: false },
  { year: 2027, month: 8, label: '08월', full: '2027년 8월', isYearStart: false },
  { year: 2027, month: 9, label: '09월', full: '2027년 9월', isYearStart: false },
  { year: 2027, month: 10, label: '10월', full: '2027년 10월', isYearStart: false },
  { year: 2027, month: 11, label: '11월', full: '2027년 11월', isYearStart: false },
  { year: 2027, month: 12, label: '12월', full: '2027년 12월', isYearStart: false },
  { year: 2028, month: 1, label: "'28.01", full: '2028년 1월', isYearStart: true },
  { year: 2028, month: 2, label: '02월', full: '2028년 2월', isYearStart: false }
];

// 초기 기본 담당자 목록
const DEFAULT_ASSIGNEES = [
  '김민준 연구원',
  '박지영 교수',
  '이선우 연구원',
  '정하늘 기획관',
  '최진호 책임',
  '김지연 강사'
];

// 초기 기본 일정 목록
const DEFAULT_SCHEDULES = [
  {
    id: 'SCH-01',
    title: '2026 하반기 국책연구 중간보고서 제출',
    category: '연구과제',
    assignee: '김민준 연구원',
    startDate: '2026-10-20',
    endDate: '2026-10-28', // 마감 임박 #1 (D-3)
    status: '진행중',
    priority: '높음'
  },
  {
    id: 'SCH-02',
    title: '공공정책 빅데이터 융합과정 교재 편찬',
    category: '교육기획',
    assignee: '박지영 교수',
    startDate: '2026-10-22',
    endDate: '2026-11-05',
    status: '진행중',
    priority: '보통'
  },
  {
    id: 'SCH-03',
    title: '학술세미나 발표자료 최종 검수',
    category: '학술행사',
    assignee: '이선우 연구원',
    startDate: '2026-10-25',
    endDate: '2026-10-27', // 마감 임박 #2 (D-2)
    status: '진행중',
    priority: '높음'
  },
  {
    id: 'SCH-04',
    title: '신규 연구원 온보딩 직무교육 강의',
    category: '인재개발',
    assignee: '김민준 연구원',
    startDate: '2026-10-26', // 김민준 연구원 SCH-01과 중복 충돌 (쌍 1)
    endDate: '2026-10-30',
    status: '대기',
    priority: '보통'
  },
  {
    id: 'SCH-05',
    title: '2027 연구과제 예산편성 심의안 작성',
    category: '행정기획',
    assignee: '정하늘 기획관',
    startDate: '2026-11-01',
    endDate: '2026-11-12',
    status: '대기',
    priority: '보통'
  },
  {
    id: 'SCH-06',
    title: '전반기 교육성과 평가 및 수료증 발급',
    category: '교육운영',
    assignee: '최진호 책임',
    startDate: '2026-10-15',
    endDate: '2026-10-24',
    status: '완료',
    priority: '낮음'
  },
  {
    id: 'SCH-07',
    title: '산학협력 공동연구 협약 체결식 지원',
    category: '대외협력',
    assignee: '박지영 교수',
    startDate: '2026-11-03', // 박지영 교수 SCH-02와 중복 충돌 (쌍 2)
    endDate: '2026-11-04',
    status: '대기',
    priority: '보통'
  },
  {
    id: 'SCH-08',
    title: '기관 연구윤리 실태조사 설문 취합',
    category: '연구윤리',
    assignee: '이선우 연구원',
    startDate: '2026-10-16',
    endDate: '2026-10-22',
    status: '완료',
    priority: '보통'
  },
  {
    id: 'SCH-09',
    title: '인공지능 정책포럼 결과보고서 발간',
    category: '연구과제',
    assignee: '정하늘 기획관',
    startDate: '2026-11-14',
    endDate: '2026-11-20',
    status: '대기',
    priority: '보통'
  },
  {
    id: 'SCH-10',
    title: '연구·행정 역량 강화 의사소통 기법 강의',
    category: '인재개발',
    assignee: '김지연 강사',
    startDate: '2026-11-10',
    endDate: '2026-11-18',
    status: '진행중',
    priority: '보통'
  }
];

// 상태 관리
let schedules = [];
let assignees = [];
let currentAssigneeFilter = 'ALL';
let currentStatusFilter = 'ALL';
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

// 마감 임박 여부 판별 (실습 기준일 2026-10-25 고정, 10-25 ~ 10-28 사이 마감, 완료 아닌 일정)
function isUrgent(item) {
  if (item.status === '완료') return false;
  return item.endDate >= '2026-10-25' && item.endDate <= '2026-10-28';
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
  localStorage.setItem(STORAGE_KEY_SCHEDULES, JSON.stringify(schedules));
  localStorage.setItem(STORAGE_KEY_ASSIGNEES, JSON.stringify(assignees));
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
function addAssignee(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    alert('담당자 이름을 입력해주세요.');
    return false;
  }
  if (assignees.includes(trimmed)) {
    alert(`'${trimmed}'은(는) 이미 등록된 담당자입니다.`);
    return false;
  }
  assignees.push(trimmed);
  saveData();
  render();
  showToast(`담당자 '${trimmed}'이(가) 등록되었습니다.`);
  return true;
}

function deleteAssignee(name) {
  const count = schedules.filter(s => s.assignee === name).length;
  let confirmMsg = `'${name}' 담당자를 목록에서 삭제하시겠습니까?`;
  if (count > 0) {
    confirmMsg = `'${name}' 담당자에게 배정된 일정이 ${count}건 있습니다.\n삭제 시 해당 일정의 담당자는 '미지정'으로 변경됩니다. 계속하시겠습니까?`;
  }

  if (confirm(confirmMsg)) {
    assignees = assignees.filter(a => a !== name);
    // 연동된 일정 담당자 처리
    if (count > 0) {
      schedules.forEach(s => {
        if (s.assignee === name) {
          s.assignee = '미지정';
        }
      });
    }

    if (currentAssigneeFilter === name) {
      currentAssigneeFilter = 'ALL';
    }

    saveData();
    render();
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

// UI 전체 렌더링
function render() {
  const { conflictPairs, conflictingIdSet } = analyzeConflicts(schedules);
  const urgentCount = schedules.filter(isUrgent).length;
  const inProgressCount = schedules.filter(s => s.status === '진행중').length;

  // 1. 요약 통계 카드 갱신
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

  container.innerHTML = assignees.map(name => {
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
    formSelect.innerHTML = assignees.map(name => `
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
    assignees.forEach(name => {
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

// 간트 타임라인 렌더링 (2026.10 ~ 2028.02 월별)
function renderTimeline(conflictingIdSet) {
  const container = document.getElementById('timeline-container');
  const filtered = getFilteredSchedules();

  const timelineStartMs = new Date(2026, 9, 1, 0, 0, 0).getTime(); // 2026-10-01 00:00:00
  const timelineEndMs = new Date(2028, 1, 29, 23, 59, 59).getTime(); // 2028-02-29 23:59:59
  const totalDurationMs = timelineEndMs - timelineStartMs;

  // 17개 월별 눈금 생성
  let ticksHtml = '';
  MONTHS_LIST.forEach(m => {
    ticksHtml += `
      <div class="axis-tick ${m.isYearStart ? 'year-start' : ''}" title="${m.full}">
        ${m.label}
      </div>
    `;
  });

  // 오늘 기준선 위치 계산 (2026-10-25)
  const todayMs = new Date(2026, 9, 25, 12, 0, 0).getTime();
  const todayLeftPct = ((todayMs - timelineStartMs) / totalDurationMs) * 100;

  // 일정별 막대 행 구성
  let rowsHtml = '';
  if (filtered.length === 0) {
    rowsHtml = `<div style="padding: 28px; text-align: center; color: var(--text-tertiary);">조건에 부합하는 일정이 없습니다.</div>`;
  } else {
    filtered.forEach(item => {
      const startMs = parseDate(item.startDate).getTime();
      const endMs = parseDate(item.endDate).getTime() + (24 * 60 * 60 * 1000 - 1);

      const clampedStart = Math.max(timelineStartMs, startMs);
      const clampedEnd = Math.min(timelineEndMs, endMs);

      const leftPct = Math.max(0, ((clampedStart - timelineStartMs) / totalDurationMs) * 100);
      const widthPct = Math.max(1.0, ((clampedEnd - clampedStart) / totalDurationMs) * 100);

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
                 title="${escapeHtml(item.title)} [${item.startDate} ~ ${item.endDate}] (${item.status}${isConflict ? ', 충돌' : ''}${isItemUrgent ? ', 마감임박' : ''})">
              ${escapeHtml(item.title)}
            </div>
          </div>
        </div>
      `;
    });
  }

  container.innerHTML = `
    <div class="timeline-axis-header">
      <div>일정 / 담당자</div>
      <div class="timeline-axis-dates">
        ${ticksHtml}
      </div>
    </div>
    <!-- 2026-10-25 오늘 기준선 -->
    <div class="today-line" style="left: calc(220px + (100% - 220px) * ${todayLeftPct / 100});">
      <div class="today-badge">오늘 (10/25)</div>
    </div>
    <div class="timeline-rows">
      ${rowsHtml}
    </div>
  `;
}

// 하단 테이블 렌더링
function renderTable(conflictingIdSet) {
  const tbody = document.getElementById('schedule-tbody');
  const countInfo = document.getElementById('table-count-info');
  const filtered = getFilteredSchedules();

  countInfo.textContent = `총 ${schedules.length}건 중 ${filtered.length}건 표시 (완료 ${schedules.filter(s => s.status === '완료').length}건)`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 32px; color: var(--text-tertiary);">조건에 맞는 일정이 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const isConflict = conflictingIdSet.has(item.id);
    const ddayInfo = getDDayText(item);
    const isNewlyAdded = item.id === newlyAddedScheduleId;

    let priorityClass = 'priority-medium';
    if (item.priority === '높음') priorityClass = 'priority-high';
    else if (item.priority === '낮음') priorityClass = 'priority-low';

    return `
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

  const handleAddAssignee = () => {
    const val = inputNewAssignee.value.trim();
    if (addAssignee(val)) {
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
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('form-title').value.trim();
    const category = document.getElementById('form-category').value;
    const assigneeSelect = document.getElementById('form-assignee');
    const assignee = assigneeSelect ? assigneeSelect.value : '';
    const startDate = document.getElementById('form-start').value;
    const endDate = document.getElementById('form-end').value;
    const priority = document.getElementById('form-priority').value;

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

    const nextId = generateNextId();
    const newSchedule = {
      id: nextId,
      title,
      category,
      assignee,
      startDate,
      endDate,
      status: '진행중', // 기본 상태
      priority
    };

    schedules.push(newSchedule);
    saveData();

    // ★ 사용자가 새 일정을 바로 볼 수 있도록 필터를 '전체'로 자동 초기화
    currentAssigneeFilter = 'ALL';
    currentStatusFilter = 'ALL';
    document.getElementById('filter-assignee').value = 'ALL';
    document.getElementById('filter-status').value = 'ALL';

    newlyAddedScheduleId = nextId;
    render();

    showToast(`'${title}' 일정이 등록되어 아래 상세 목록에 반영되었습니다.`);

    // 폼 초기화 (기본 날짜 유지)
    document.getElementById('form-title').value = '';
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

  // 5. 테이블 내 상태 변경 및 삭제
  const tbody = document.getElementById('schedule-tbody');
  tbody.addEventListener('change', (e) => {
    if (e.target.classList.contains('status-select')) {
      const id = e.target.getAttribute('data-id');
      const newStatus = e.target.value;
      const target = schedules.find(s => s.id === id);
      if (target) {
        target.status = newStatus;
        saveData();
        render();
        showToast(`'${target.title}' 상태가 [${newStatus}]로 변경되었습니다.`);
      }
    }
  });

  tbody.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.btn-delete');
    if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const target = schedules.find(s => s.id === id);
      if (target && confirm(`'${target.title}' 일정을 삭제하시겠습니까?`)) {
        schedules = schedules.filter(s => s.id !== id);
        saveData();
        render();
        showToast(`'${target.title}' 일정이 삭제되었습니다.`);
      }
    }
  });

  // 6. 기본 데이터 복원
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('초기 데이터 9건 및 기본 담당자 5명으로 되돌리시겠습니까? 추가된 일정 및 담당자는 초기화됩니다.')) {
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
      showToast('초기 데이터로 복원되었습니다.');
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
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
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
}

// 애플리케이션 초기 구동
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initEventListeners();
  render();
});

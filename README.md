# 연구·교육 일정 자동 편성표 (Schedule Board)

프로젝트 및 교육과정 일정을 한눈에 파악하고, 동일 담당자 간 업무 중복 충돌 및 마감 임박을 자동으로 감지하는 **간트 타임라인 기반의 스마트 일정 관리 웹 애플리케이션**입니다.

---

## 🌟 주요 기능

1. **간트 타임라인 (2026.10 ~ 2028.02 · 월별)**
   * 외부 차트 라이브러리(Chart.js 등) 전혀 없이 순수 CSS Grid / Absolute Ratio 기반으로 구현된 초경량 간트 차트.
   * 눈이 편안한 **소프트 파스텔 톤** 막대바 적용 (일반, 마감 임박, 충돌 경고, 완료).
   * 실습 기준일(`2026-10-25`) 수직 기준선 및 뱃지 표시.

2. **동일 담당자 일정 충돌 정밀 자동 감지**
   * 같은 담당자의 업무 기간이 하루라도 겹칠 경우 상단 경고 배너에 `[일정 A] ↔ [일정 B]` 상세 안내.
   * 타임라인 바 및 테이블 행에 주황색 경고 뱃지 동시 노출.

3. **마감 임박 자동 감지**
   * 실습 기준일(`2026-10-25`) 기준 D-3 이내(10/25 ~ 10/28) 미완료 과제를 붉은색 코랄 파스텔 톤과 디데이 뱃지로 강조.

4. **👥 담당자 풀(Pool) 관리**
   * 담당자 추가 및 삭제 기능.
   * 일정 등록 시 담당자를 드롭다운으로 선택하여 오타 및 이름 불일치 방지.

5. **연구원 간 일정 공유 및 백업 (Export / Import)**
   * **[📤 일정 내보내기]**: 현재 작성된 모든 일정과 담당자를 `.json` 파일로 즉시 다운로드.
   * **[📥 일정 불러오기]**: 다른 연구원이 전달한 `.json` 파일을 업로드하면 즉시 화면과 로컬스토리지에 반영 및 동기화.

6. **영속성 및 오프라인 보장**
   * `localStorage` 기반 자동 저장 (새로고침/재접속 시 데이터 보존).
   * 외부 CDN 요청이 전혀 없어 인터넷이 없는 폐쇄망에서도 100% 정상 작동.
   * 인쇄 / PDF 출력 최적화 스타일시트(@media print) 내장.

---

## 🚀 GitHub Pages 무료 웹 배포 방법

이 저장소를 GitHub에 업로드하면 전 세계 어디서나 연구원들이 접속할 수 있는 웹 링크가 무료로 생성됩니다:

1. **GitHub 새 저장소 생성**:
   * GitHub에서 `schedule-board`라는 이름으로 Public 리포지토리를 생성합니다.

2. **로컬 코드 푸시**:
   ```bash
   git remote add origin https://github.com/당신의계정/schedule-board.git
   git branch -M main
   git push -u origin main
   ```

3. **GitHub Pages 활성화**:
   * 저장소 메뉴 `Settings` → 좌측 `Pages` 클릭
   * **Build and deployment** 항목의 Branch를 `main` / `/(root)`로 지정하고 **Save** 클릭
   * 1~2분 뒤 생성되는 `https://당신의계정.github.io/schedule-board/` 링크로 모든 연구원이 바로 접속 가능합니다!

---

## 🛠️ 기술 스택
* **Structure**: Semantic HTML5
* **Style**: Apple Pro Dark Glassmorphism (Vanilla CSS, SF Pro System Typography)
* **Logic**: Vanilla JavaScript (ES6+, Zero External Library)

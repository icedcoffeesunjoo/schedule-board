/**
 * 공유 모드 설정
 * - apiUrl: Apps Script 웹앱 배포 URL (https://script.google.com/macros/s/.../exec)
 *   비워두면 기존처럼 이 브라우저의 localStorage 에만 저장되는 로컬 모드로 동작합니다.
 * - pollIntervalMs: 다른 사람의 변경 사항을 가져오는 주기 (밀리초)
 */
window.SCHEDULE_BOARD_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbzq6n1XLw6iRwt7BrzJBP66u-KZNsfN6ZwfP3MG6DsREP9EVfOnh9bkSWY5GmhwvtIHMA/exec',
  pollIntervalMs: 20000
};

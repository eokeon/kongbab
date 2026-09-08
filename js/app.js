/**
 * 콩밥특별시 GTA RP 아카이브 - 앱 메인 엔트리포인트 (app.js)
 * 
 * [모듈 분리 구성]
 * 1. js/data.js      : 초기 데이터 (경찰 35명, EMS, 갱단, 사업체, 기자, 시민)
 * 2. js/state.js     : 앱 상태, 인증 로딩, 데이터 동기화, 테마 & 아이콘 유틸
 * 3. js/drag-drop.js : 인원/갱단/사업체/영상 카드 드래그 앤 드롭 순서 변경 엔진
 * 4. js/backup.js    : 20개 롤링 JSON 백업, 외부 서버 동기화, 복구 관리자
 * 5. js/admin.js     : 어드민 로그인, 영상 추가/수정/삭제, 인원 추가/수정/삭제
 * 6. js/render.js    : 카테고리/인원/영상/검색 UI 렌더링 및 네비게이션
 * 7. js/app.js       : 메인 초기화 및 실행
 */

// 앱 초기화 및 시작
document.addEventListener("DOMContentLoaded", () => {
  loadStoredAuth();       // 1. 인증 정보 불러오기
  loadStoredData();       // 2. 로컬 스토리지 커스텀 데이터 동기화
  initBackupStorage();    // 3. 백업 저장소 및 외부 서버 동기화 초기화
  renderHeaderAuth();     // 4. 상단 어드민/게스트 상태 바 렌더링
  renderCategoryTabs();   // 5. 6대 카테고리 탭 렌더링
  renderContent();        // 6. 메인 컨텐츠 렌더링
  setupEventListeners();  // 7. 검색 및 단축키 이벤트 리스너 등록
  updateStats();          // 8. 상단 통계(인원 수, 영상 수) 집계
});

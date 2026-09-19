// ==========================================
// 방문자 종합 통계 대시보드 새 창 열기 (Google Analytics 4)
// ==========================================

function openAnalyticsDashboard() {
  if (!isAdmin()) {
    alert("관리자 전용 기능입니다.");
    return;
  }
  // GitHub Pages 정적 배포 환경인 경우 안내 메시지 출력
  if (window.location.hostname.endsWith("github.io")) {
    alert("방문자 통계 분석 대시보드는 백엔드 서버(Spring Boot 로컬 또는 독립 서버) 환경에서만 제공됩니다.");
    return;
  }
  // 모달 대신 전용 통계 대시보드 웹페이지를 새 탭으로 오픈
  window.open('./analytics.html', '_blank');
}

// 구버전 호환
window.openAnalyticsModal = openAnalyticsDashboard;
window.openAnalyticsDashboard = openAnalyticsDashboard;

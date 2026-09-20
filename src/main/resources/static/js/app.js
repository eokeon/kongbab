async function initializeApplication() {
  loadStoredAuth();
  loadStoredData();
  initBackupStorage();
  setupEventListeners();

  // 1. 이미 캐시된 데이터가 있다면 즉시 화면을 렌더링하여 첫 로딩 체감 속도를 0ms(즉시 표시)로 극대화
  const hasCachedData = KONGBAP_DATA && Array.isArray(KONGBAP_DATA.categories) &&
    KONGBAP_DATA.categories.some(c => (c.hasSubgroups ? (c.groups || []).some(g => (g.members || []).length > 0) : (c.members || []).length > 0));

  if (hasCachedData) {
    if (typeof restoreNavigationState === "function") {
      restoreNavigationState();
    }
    renderHeaderAuth();
    renderCategoryTabs();
    renderContent();
    updateStats();
  }

  // 2. 백그라운드에서 사용자 인증, 카테고리 구조 및 DB 데이터 동기화 진행
  try {
    const me = await apiGetMe();
    if (me && me.success) {
      if (me.role === "admin") {
        state.currentUser = { role: "admin", username: me.username };
        const expireDuration = (me.expiresInSeconds || 3600) * 1000;
        localStorage.setItem("kongbap_auth_user", JSON.stringify(state.currentUser));
        localStorage.setItem("kongbap_auth_expire_at", String(Date.now() + expireDuration));
      } else {
        state.currentUser = { role: "guest", username: "게스트" };
        localStorage.setItem("kongbap_auth_user", JSON.stringify(state.currentUser));
        localStorage.removeItem("kongbap_auth_expire_at");
      }
      renderHeaderAuth();
    }
  } catch (e) {}

  // 3. 서버(DB/백업)에 영구 보관된 카테고리 및 조직 순서 구조 동기화
  try {
    await fetchCategoryStructure();
  } catch (e) {
    console.warn("카테고리/조직 구조 서버 동기화 건너뜀 (로컬 캐시 사용):", e);
  }

  // 4. DB 스트리머 및 영상 데이터 로드
  let loadedFromDb = false;
  try {
    const dbStreamers = await fetchStreamersFromDb();
    if (dbStreamers === "STATIC_CATEGORIES_LOADED") {
      loadedFromDb = true;
    } else if (Array.isArray(dbStreamers)) {
      if (dbStreamers.length > 0) {
        applyStreamersToKongbapData(dbStreamers);
        loadedFromDb = true;
      } else {
        const currentList = extractAllStreamersFromKongbapData();
        if (currentList.length > 0) {
          await syncAllStreamersToDb(currentList);
        }
      }
    }
  } catch (e) {
    console.warn("DB 연결 대기 중 (오프라인 캐시 사용):", e);
  }

  if (!hasCachedData || loadedFromDb) {
    if (typeof restoreNavigationState === "function") {
      restoreNavigationState();
    }
    renderHeaderAuth();
    renderCategoryTabs();
    renderContent();
    updateStats();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initializeApplication();
});

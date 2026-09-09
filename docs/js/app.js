async function initializeApplication() {
  loadStoredAuth();
  loadStoredData();
  initBackupStorage();
  setupEventListeners();

  try {
    const me = await apiGetMe();
    if (me && me.success) {
      if (me.role === "admin") {
        state.currentUser = { role: "admin", username: me.username };
        const expireDuration = (me.expiresInSeconds || 3600) * 1000;
        localStorage.setItem("kongbab_auth_user", JSON.stringify(state.currentUser));
        localStorage.setItem("kongbab_auth_expire_at", String(Date.now() + expireDuration));
      } else {
        state.currentUser = { role: "guest", username: "게스트" };
        localStorage.setItem("kongbab_auth_user", JSON.stringify(state.currentUser));
        localStorage.removeItem("kongbab_auth_expire_at");
      }
    }
  } catch (e) {}

  // 1. 서버(DB/백업)에 영구 보관된 카테고리 및 조직 순서 구조 동기화
  try {
    await fetchCategoryStructure();
  } catch (e) {
    console.warn("카테고리/조직 구조 서버 동기화 건너뜀 (로컬 캐시 사용):", e);
  }

  // 2. DB 스트리머 및 영상 데이터 로드
  let loadedFromDb = false;
  try {
    const dbStreamers = await fetchStreamersFromDb();
    if (dbStreamers === "STATIC_CATEGORIES_LOADED") {
      loadedFromDb = true;
    } else if (Array.isArray(dbStreamers)) {
      if (dbStreamers.length > 0) {
        applyStreamersToKongbabData(dbStreamers);
        loadedFromDb = true;
      } else {
        const currentList = extractAllStreamersFromKongbabData();
        if (currentList.length > 0) {
          await syncAllStreamersToDb(currentList);
        }
      }
    }
  } catch (e) {
    console.warn("DB 연결 대기 중 (오프라인 캐시 사용):", e);
  }

  if (typeof restoreNavigationState === "function") {
    restoreNavigationState();
  }

  renderHeaderAuth();
  renderCategoryTabs();
  renderContent();
  updateStats();
}

document.addEventListener("DOMContentLoaded", () => {
  initializeApplication();
});

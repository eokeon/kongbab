async function initializeApplication() {
  loadStoredAuth();
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

  if (!loadedFromDb) {
    loadStoredData();
  }

  renderHeaderAuth();
  renderCategoryTabs();
  renderContent();
  updateStats();
}

document.addEventListener("DOMContentLoaded", () => {
  initializeApplication();
});

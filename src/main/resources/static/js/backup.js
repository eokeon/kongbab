const BACKUP_SERVER_URL = typeof API_BASE !== "undefined" ? API_BASE : "";
let serverBackupInfo = null;
let isServerConnected = false;
let isBackupModalOpen = false;

function getBackupDirectoryPath() {
  return serverBackupInfo?.directory || "D:\\백업 파일\\kongbap_backupS_JSON";
}

async function checkBackupServerHealth(notifyToast = false) {
  try {
    const authHeaders = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
    let healthOk = false;
    try {
      const hRes = await fetch(`${BACKUP_SERVER_URL}/api/health`, { cache: "no-store" });
      if (hRes.ok) healthOk = true;
    } catch (e) {}

    const res = await fetch(`${BACKUP_SERVER_URL}/api/status`, { 
      cache: "no-store",
      credentials: "include",
      headers: authHeaders
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.status === "ok") {
        isServerConnected = true;
        serverBackupInfo = data;
        updateServerStatusBadge();
        const offlineModal = document.getElementById("backend-offline-modal");
        if (offlineModal && !offlineModal.classList.contains("hidden")) {
          offlineModal.classList.add("hidden");
        }
        if (notifyToast) {
          showToast("🟢 백엔드 서버(8080)와 정상 연결되었습니다.");
        }
        return true;
      }
    } else if (healthOk) {
      isServerConnected = true;
      updateServerStatusBadge();
      const offlineModal = document.getElementById("backend-offline-modal");
      if (offlineModal && !offlineModal.classList.contains("hidden")) {
        offlineModal.classList.add("hidden");
      }
      if (notifyToast) {
        showToast("🟢 백엔드 서버(8080)와 정상 연결되었습니다.");
      }
      return true;
    }
  } catch (e) {}
  isServerConnected = false;
  serverBackupInfo = null;
  updateServerStatusBadge();
  if (notifyToast) {
    showToast("🔴 백엔드 서버(8080)에 연결할 수 없습니다. IntelliJ에서 서버를 실행해주세요.");
  }
  return false;
}

function showBackendOfflineModal(actionName = "저장 및 변경") {
  if (typeof isLocalEnvironment === "function" && !isLocalEnvironment()) {
    return;
  }

  let modal = document.getElementById("backend-offline-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "backend-offline-modal";
    modal.className = "fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none animate-fade-in";
    modal.innerHTML = `
      <div class="bg-zinc-900 border-2 border-red-500/80 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl text-zinc-100 ring-1 ring-red-500/30">
        <div class="flex items-start gap-3.5 text-red-400 mb-4 pb-3.5 border-b border-zinc-800">
          <div class="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-2xl flex-shrink-0">
            ⚠️
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>백엔드 서버 미연결 경고</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 font-bold">저장 차단됨</span>
            </h3>
            <p class="text-xs text-red-300/90 mt-0.5">데이터 유실 방지를 위해 안전하게 작업이 차단되었습니다.</p>
          </div>
        </div>

        <div class="bg-zinc-950/90 rounded-xl p-4 border border-zinc-800 text-xs sm:text-sm space-y-2.5 mb-5">
          <p class="text-zinc-200 font-medium leading-relaxed">
            현재 <span class="text-amber-300 font-bold">Spring Boot 백엔드 서버(localhost:8080)</span>가 실행되지 않은 상태입니다.
          </p>
          <p class="text-zinc-400 leading-relaxed text-xs">
            서버가 꺼진 상태에서 <span id="backend-offline-action-name" class="text-red-400 font-bold">[작업]</span>을 진행하면 DB 및 백업 파일에 영구 저장되지 않고 임시 캐시에만 남아 새로고침 시 <span class="text-red-300 font-semibold underline">데이터가 모두 유실</span>될 수 있습니다.
          </p>
          <div class="pt-2.5 border-t border-zinc-800/80 text-xs space-y-1.5">
            <div class="font-bold text-amber-300 flex items-center gap-1">
              <span>💡</span>
              <span>해결 방법 (30초 소요):</span>
            </div>
            <div class="text-zinc-300 pl-4 border-l-2 border-amber-500/40 space-y-1">
              <div>1. <span class="text-white font-semibold">IntelliJ IDEA</span> 또는 터미널에서 Spring Boot 애플리케이션을 실행해주세요.</div>
              <div>2. 서버 실행(8080 포트) 후 아래 <span class="text-emerald-400 font-bold">"서버 연결 재확인"</span> 버튼을 눌러주세요.</div>
              <div class="text-[11px] text-zinc-400 mt-1.5">* 입력하신 내용 및 양식은 그대로 유지되어 있으니 창을 닫지 마세요.</div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2">
          <button type="button" id="backend-offline-retry-btn" class="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all cursor-pointer flex items-center gap-1.5">
            <span>🔄</span>
            <span>서버 연결 재확인</span>
          </button>
          <button type="button" onclick="document.getElementById('backend-offline-modal').classList.add('hidden')" class="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition-all cursor-pointer">
            닫기
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("backend-offline-retry-btn").onclick = async () => {
      const btn = document.getElementById("backend-offline-retry-btn");
      btn.textContent = "연결 확인 중...";
      btn.disabled = true;
      const ok = await checkBackupServerHealth(false);
      btn.disabled = false;
      btn.innerHTML = `<span>🔄</span><span>서버 연결 재확인</span>`;
      if (ok) {
        modal.classList.add("hidden");
        showToast("🟢 백엔드 서버와 연결되었습니다! 이제 저장을 진행하실 수 있습니다.");
      } else {
        alert("아직 백엔드 서버(8080)에 연결할 수 없습니다.\nIntelliJ에서 Spring Boot 서버가 정상 실행되었는지 확인해주세요.");
      }
    };
  }

  const actionSpan = document.getElementById("backend-offline-action-name");
  if (actionSpan) actionSpan.textContent = `[${actionName}]`;
  modal.classList.remove("hidden");
  modal.classList.add("flex");

  showToast(`❌ 백엔드(8080) 미연결: 데이터 유실 방지를 위해 [${actionName}] 작업이 차단되었습니다.`);
}

async function requireServerConnection(actionName = "저장 및 변경") {
  if (typeof isLocalEnvironment === "function" && !isLocalEnvironment()) {
    return true; // GitHub Pages 등 정적 배포 환경에서는 백엔드가 없으므로 브라우저 로컬 동작 허용
  }
  if (isServerConnected) {
    return true;
  }
  const connected = await checkBackupServerHealth();
  if (!connected) {
    showBackendOfflineModal(actionName);
    return false;
  }
  return true;
}

window.requireServerConnection = requireServerConnection;
window.showBackendOfflineModal = showBackendOfflineModal;
window.checkBackupServerHealth = checkBackupServerHealth;

async function syncToBackupServer(payload, showToastFeedback = false) {
  try {
    const authHeaders = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
    const res = await fetch(`${BACKUP_SERVER_URL}/api/backup`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload, null, 2)
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success) {
        isServerConnected = true;
        serverBackupInfo = data;
        updateServerStatusBadge();
        if (showToastFeedback && isBackupModalOpen) {
          loadAndRenderBackupList(false);
        }
        if (showToastFeedback) {
          showToast(`💾 백업 저장이 완료되었습니다.<br><span class="text-[11px] text-amber-300">${data.fileName}</span>`);
        }
        return true;
      }
    }
  } catch (e) {}
  isServerConnected = false;
  updateServerStatusBadge();
  if (showToastFeedback) {
    showToast(`❌ 백엔드(8080) 서버 미연결: 백업 파일이 저장되지 않았습니다. 서버를 실행해주세요.`);
  }
  return false;
}

function formatDisplayTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function createBackupSnapshot(actionReason = "데이터 변경", showFeedback = false) {
  const now = new Date();
  const displayTime = formatDisplayTimestamp(now);

  const uniqueMembers = new Map();
  let totalVideos = 0;
  if (KONGBAP_DATA && KONGBAP_DATA.categories) {
    KONGBAP_DATA.categories.forEach(cat => {
      const mems = getCategoryMembers(cat);
      mems.forEach(m => {
        if (!m) return;
        const mKey = m.id || (m.streamer && m.name ? `${m.streamer}_${m.name}` : m.name);
        if (!mKey) return;
        if (!uniqueMembers.has(mKey)) {
          uniqueMembers.set(mKey, m);
          const validVideos = (m.videos || []).filter(v => v && v.url && v.url !== "undefined" && v.url.trim() !== "");
          totalVideos += validVideos.length;
        }
      });
    });
  }

  const totalMembers = uniqueMembers.size;

  // 안전장치: 정상적인 전체 인원 수(240명)보다 비정상적으로 적은 경우(구버전 캐시),
  // 최신 DB 및 backup.json 파일을 구버전으로 덮어쓰지 않도록 백업 스냅샷 저장을 안전하게 차단
  if (totalMembers < 200) {
    console.warn(`[백업 스냅샷 차단] 인원 누락 감지 (현재 메모리: ${totalMembers}명 < 정상 기준 240명). 데이터 유실 방지를 위해 서버 덮어쓰기를 차단합니다.`);
    return;
  }

  const cleanCategories = JSON.parse(JSON.stringify(KONGBAP_DATA.categories, (key, value) => {
    if (key.startsWith("_")) return undefined;
    return value;
  }));

  // 러브라인 데이터 수집 및 백업 스냅샷 동기화
  const lovelinesList = typeof getLovelineList === "function" ? getLovelineList() : (KONGBAP_DATA?.lovelines || []);
  const loveCat = cleanCategories.find(c => c.id === "loveline");
  if (loveCat) {
    loveCat.lovelines = lovelinesList;
  }

  const payload = {
    appName: "kongbap-gta-rp",
    version: "1.0",
    createdAt: displayTime,
    reason: actionReason,
    stats: {
      totalCategories: KONGBAP_DATA && KONGBAP_DATA.categories ? KONGBAP_DATA.categories.length : 0,
      totalMembers,
      totalVideos,
      totalLovelines: lovelinesList.length
    },
    categories: cleanCategories,
    lovelines: lovelinesList
  };

  return syncToBackupServer(payload, showFeedback);
}

function isLocalEnvironment() {
  const host = window.location.hostname;
  return host === "localhost" || 
         host === "127.0.0.1" || 
         window.location.protocol === "file:" || 
         host === "";
}

function initBackupStorage() {
  if (!isLocalEnvironment()) {
    // GitHub Pages 등 정적 배포 환경에서는 로컬 8080 백엔드 헬스체크 및 오프라인 경고를 비활성화 (순수 시청자 모드)
    isServerConnected = false;
    updateServerStatusBadge();
    return;
  }
  checkBackupServerHealth();
  setInterval(checkBackupServerHealth, 8000);
}

function updateServerStatusBadge() {
  const badge = document.getElementById("backend-status-badge");
  const banner = document.getElementById("backend-offline-banner");

  if (banner) {
    // 로컬 환경(localhost)이면서 관리자 로그인 상태일 때만 백엔드 미연결 배너 표시 (배포 사이트에서는 절대 미표시)
    if (isLocalEnvironment() && !isServerConnected && typeof isAdmin === "function" && isAdmin()) {
      banner.classList.remove("hidden");
      banner.classList.add("flex");
    } else {
      banner.classList.add("hidden");
      banner.classList.remove("flex");
    }
  }

  if (badge) {
    if (isServerConnected || !isLocalEnvironment()) {
      badge.className = "hidden";
      badge.innerHTML = "";
    } else {
      badge.className = "inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-300 text-[11px] sm:text-xs font-bold shadow-sm cursor-pointer hover:bg-red-900/90 transition-all whitespace-nowrap animate-pulse";
      badge.title = "백엔드 미연결 (클릭하여 상태 확인 및 실행 안내)";
      badge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-red-400"></span>
        <span>🔴 8080 미연결</span>
      `;
      badge.onclick = () => {
        showBackendOfflineModal("서버 상태 확인");
      };
    }
  }

  const modalStatus = document.getElementById("backup-modal-server-status");
  if (modalStatus) {
    modalStatus.innerHTML = isServerConnected 
      ? `<span class="text-emerald-400 font-semibold">🟢 MariaDB / 백엔드 정상 연동 중</span>` 
      : `<span class="text-red-400 font-semibold">🔴 백엔드 미연결 (IntelliJ에서 8080 서버 실행 필요)</span>`;
  }
}

function manualBackupNow() {
  openBackupModal();
}

function openBackupModal() {
  if (typeof selectAdminPage === "function") {
    selectAdminPage('backup');
    return;
  }
  refreshBackupTabUI();
}

function refreshBackupTabUI() {
  const dirEl = document.getElementById("backup-modal-dir-path");
  if (dirEl) dirEl.textContent = getBackupDirectoryPath();

  const countBadge = document.getElementById("backup-modal-count-badge");
  if (countBadge) {
    const count = serverBackupInfo?.count ?? "0";
    countBadge.textContent = `${count}개 보관 중`;
  }

  const statusEl = document.getElementById("backup-modal-server-status");
  if (statusEl) {
    statusEl.innerHTML = isServerConnected 
      ? `🟢 MariaDB / 백엔드 정상 연동 중` 
      : `<span class="text-zinc-400">⚪ 백엔드 미연결 (8080 서버 실행 필요)</span>`;
  }

  loadAndRenderBackupList();
}
window.refreshBackupTabUI = refreshBackupTabUI;

function closeBackupModal() {
  const modal = document.getElementById("backup-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  isBackupModalOpen = false;
}

let backupCurrentPage = 0;
const BACKUP_PAGE_SIZE = 10;
let backupHasMore = true;
let backupIsLoading = false;
let backupTotalCount = 0;
let currentBackupRenderCount = 0;
let isBackupScrollAttached = false;

function handleBackupContainerScroll(e) {
  const el = e.currentTarget;
  if (!el || backupIsLoading || !backupHasMore) return;
  // 바닥에서 50px 이내로 스크롤 시 다음 10개 로드
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
    loadNextBackupPage();
  }
}

function renderBackupItemHtml(item, idx) {
  const isLatest = idx === 0;
  const badgeText = isLatest ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">최신</span>` : "";
  const memberTag = item.totalMembers ? `<span class="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">인원 ${item.totalMembers}명</span>` : "";
  const videoTag = item.totalVideos ? `<span class="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-red-300 font-medium">영상 ${item.totalVideos}개</span>` : "";
  const lovelineTag = item.totalLovelines ? `<span class="text-[11px] px-1.5 py-0.5 rounded bg-pink-950/60 text-pink-300 border border-pink-500/30 font-medium">러브라인 ${item.totalLovelines}쌍</span>` : "";
  const sizeTag = item.fileSizeFormatted ? `<span class="text-[10px] text-zinc-500 font-mono">${item.fileSizeFormatted}</span>` : "";

  const safeFileName = typeof escapeHtml === 'function' ? escapeHtml(item.fileName) : item.fileName;
  const safeCreatedAt = typeof escapeHtml === 'function' ? escapeHtml(item.createdAt || item.fileName) : (item.createdAt || item.fileName);
  const safeReason = typeof escapeHtml === 'function' ? escapeHtml(item.reason || '') : (item.reason || '');

  return `
    <div class="bg-zinc-950/80 hover:bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <span class="text-xs font-bold text-white tracking-tight">${safeCreatedAt}</span>
          ${badgeText}
          ${memberTag}
          ${videoTag}
          ${lovelineTag}
          ${sizeTag}
        </div>
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <span class="text-zinc-300 truncate max-w-sm" title="${safeReason}">
            ${safeReason ? `📝 ${safeReason}` : '데이터 변경 백업'}
          </span>
          <span class="text-[10px] text-zinc-500 font-mono hidden md:inline truncate max-w-xs" title="${safeFileName}">
            (${safeFileName})
          </span>
        </div>
      </div>

      <div class="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
        <button 
          type="button"
          onclick="handleDownloadBackup('${safeFileName}')"
          class="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700/60 transition-colors cursor-pointer"
          title="백업 JSON 파일 다운로드"
        >
          💾 저장
        </button>
        <button 
          type="button"
          onclick="handleRestoreBackup('${safeFileName}', '${safeCreatedAt}')"
          class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1"
          title="이 시점으로 전체 데이터 복원"
        >
          <span>📥 불러오기</span>
        </button>
      </div>
    </div>
  `;
}

async function loadAndRenderBackupList(showSpinner = true) {
  backupCurrentPage = 0;
  backupHasMore = true;
  backupIsLoading = false;
  currentBackupRenderCount = 0;

  const container = document.getElementById("backup-modal-list-container");
  if (!container) return;

  if (showSpinner) {
    container.innerHTML = `
      <div id="backup-initial-spinner" class="text-center py-6 text-zinc-500 text-xs flex items-center justify-center gap-2">
        <span class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
        <span>백업 기록을 조회하는 중...</span>
      </div>
    `;
  }

  if (!isBackupScrollAttached) {
    container.addEventListener("scroll", handleBackupContainerScroll);
    isBackupScrollAttached = true;
  }

  await loadNextBackupPage();
}

async function loadNextBackupPage() {
  if (backupIsLoading || !backupHasMore) return;
  backupIsLoading = true;

  const container = document.getElementById("backup-modal-list-container");
  const countLabel = document.getElementById("backup-modal-list-count");
  const countBadge = document.getElementById("backup-modal-count-badge");
  if (!container) {
    backupIsLoading = false;
    return;
  }

  // 2페이지 이상일 때 하단 로딩 표시기 부착
  let bottomSpinner = null;
  if (backupCurrentPage > 0) {
    bottomSpinner = document.getElementById("backup-scroll-spinner");
    if (!bottomSpinner) {
      bottomSpinner = document.createElement("div");
      bottomSpinner.id = "backup-scroll-spinner";
      bottomSpinner.className = "text-center py-2.5 text-zinc-500 text-xs flex items-center justify-center gap-2 select-none";
      bottomSpinner.innerHTML = `
        <span class="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
        <span>추가 백업 기록 불러오는 중...</span>
      `;
      container.appendChild(bottomSpinner);
    }
  }

  try {
    const res = await fetch(`${BACKUP_SERVER_URL}/api/backup/list?page=${backupCurrentPage}&size=${BACKUP_PAGE_SIZE}`, {
      cache: "no-store",
      credentials: "include"
    });

    const initSpinner = document.getElementById("backup-initial-spinner");
    if (initSpinner) initSpinner.remove();
    if (bottomSpinner) bottomSpinner.remove();

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.backups)) {
        backupTotalCount = typeof data.totalCount === "number" ? data.totalCount : (data.count ?? data.backups.length);
        if (countLabel) countLabel.textContent = `(총 ${backupTotalCount}개)`;
        if (countBadge) countBadge.textContent = `${backupTotalCount}개 보관 중`;

        if (backupCurrentPage === 0 && data.backups.length === 0) {
          container.innerHTML = `
            <div class="text-center py-10 bg-zinc-950/40 rounded-2xl border border-zinc-800/60 p-4">
              <div class="text-2xl mb-2">📂</div>
              <p class="text-xs text-zinc-400 font-semibold mb-1">저장된 백업 파일이 없습니다.</p>
              <p class="text-[11px] text-zinc-600">위의 [즉시 저장] 버튼을 누르면 첫 번째 백업 스냅샷이 생성됩니다.</p>
            </div>
          `;
          backupHasMore = false;
          return;
        }

        const itemsHtml = data.backups.map((item, idx) => {
          return renderBackupItemHtml(item, currentBackupRenderCount + idx);
        }).join("");

        if (backupCurrentPage === 0) {
          container.innerHTML = itemsHtml;
        } else {
          container.insertAdjacentHTML("beforeend", itemsHtml);
        }

        currentBackupRenderCount += data.backups.length;
        backupCurrentPage++;

        if (typeof data.hasMore === "boolean") {
          backupHasMore = data.hasMore;
        } else {
          backupHasMore = currentBackupRenderCount < backupTotalCount && data.backups.length === BACKUP_PAGE_SIZE;
        }

        // 전체 로드 완료 메시지
        if (!backupHasMore && currentBackupRenderCount > 10) {
          const finishedEl = document.createElement("div");
          finishedEl.className = "text-center py-2.5 text-zinc-600 text-[11px] border-t border-zinc-800/60 mt-2";
          finishedEl.textContent = `✓ 총 ${backupTotalCount}개의 백업 기록을 모두 불러왔습니다.`;
          container.appendChild(finishedEl);
        }
      }
    } else {
      console.warn("백업 목록 조회 실패:", res.status);
      backupHasMore = false;
    }
  } catch (e) {
    console.warn("백업 목록 조회 네트워크 오류:", e);
    const initSpinner = document.getElementById("backup-initial-spinner");
    if (initSpinner) initSpinner.remove();
    if (bottomSpinner) bottomSpinner.remove();
    backupHasMore = false;
  } finally {
    backupIsLoading = false;
  }
}

function formatFileNameToDate(name) {
  const match = name.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}.${match[2]}.${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
  }
  return name;
}

async function handleManualBackupFromModal() {
  if (typeof isAdmin === "function" && !isAdmin()) {
    showToast("⚠️ 백업 저장은 관리자 로그인이 필요합니다.");
    openLoginModal();
    return;
  }

  const reasonInput = document.getElementById("backup-manual-reason");
  const customReason = reasonInput ? reasonInput.value.trim() : "";
  const reason = customReason ? `수동 백업: ${customReason}` : "수동 즉시 백업 요청";

  createBackupSnapshot(reason, true);

  if (reasonInput) reasonInput.value = "";
}

async function handleRestoreBackup(fileName, displayLabel) {
  if (typeof isAdmin === "function" && !isAdmin()) {
    showToast("⚠️ 백업 복원은 관리자 로그인이 필요합니다.");
    openLoginModal();
    return;
  }

  const ok = confirm(
    `⚠️ [${displayLabel}]\n이 백업 시점으로 모든 인원, 조직, 영상 데이터를 복원하시겠습니까?\n\n※ 현재 데이터베이스 및 화면이 해당 백업본 상태로 완전히 복원됩니다.`
  );
  if (!ok) return;

  showToast(`⏳ [${displayLabel}] 백업 데이터 복원 진행 중...`);

  try {
    const authHeaders = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
    const res = await fetch(`${BACKUP_SERVER_URL}/api/backup/restore`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ fileName })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        if (typeof invalidateStaticStreamersCache === "function") {
          invalidateStaticStreamersCache();
        }
        if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
          KONGBAP_DATA.categories = data.categories;
        } else {
          if (typeof fetchCategoryStructure === "function") {
            await fetchCategoryStructure();
          }
          if (typeof fetchStreamersFromDb === "function") {
            const dbStreamers = await fetchStreamersFromDb();
            if (Array.isArray(dbStreamers)) {
              applyStreamersToKongbapData(dbStreamers);
            }
          }
        }

        // 러브라인 데이터 복원
        const restoredLovelines = data.lovelines || 
          (Array.isArray(data.categories) ? data.categories.find(c => c.id === "loveline")?.lovelines : null);
        if (Array.isArray(restoredLovelines) && typeof saveLovelineList === "function") {
          saveLovelineList(restoredLovelines);
        }

        persistData();
        renderCategoryTabs();
        renderContent();
        if (state.currentCategory === "loveline" && typeof renderLovelineContent === "function") {
          const mainContent = document.getElementById("main-content");
          if (mainContent) renderLovelineContent(mainContent);
        }
        updateStats();

        showToast(`🎉 [${displayLabel}] 백업본으로 완벽히 복원되었습니다!`);
        closeBackupModal();
        return;
      }
    }
    const errData = await res.json().catch(() => null);
    showToast(`❌ 복원 실패: ${errData?.message || errData?.error || "서버 응답 오류"}`);
  } catch (e) {
    console.error("복원 중 에러 발생:", e);
    showToast(`❌ 복원 요청 중 네트워크 오류가 발생했습니다.`);
  }
}

async function handleBackupFileUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  if (typeof isAdmin === "function" && !isAdmin()) {
    showToast("⚠️ 백업 복원은 관리자 로그인이 필요합니다.");
    openLoginModal();
    event.target.value = "";
    return;
  }

  const ok = confirm(`⚠️ 선택한 백업 파일 '${file.name}'의 데이터로 복원하시겠습니까?\n현재 데이터가 파일의 내용으로 대체됩니다.`);
  if (!ok) {
    event.target.value = "";
    return;
  }

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      showToast(`⏳ 파일 데이터 복원 진행 중...`);

      const authHeaders = typeof getAuthHeaders === "function" ? getAuthHeaders() : {};
      const res = await fetch(`${BACKUP_SERVER_URL}/api/backup/restore`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ content })
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          if (typeof invalidateStaticStreamersCache === "function") {
            invalidateStaticStreamersCache();
          }
          if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
            KONGBAP_DATA.categories = data.categories;
          } else {
            if (typeof fetchCategoryStructure === "function") {
              await fetchCategoryStructure();
            }
            if (typeof fetchStreamersFromDb === "function") {
              const dbStreamers = await fetchStreamersFromDb();
              if (Array.isArray(dbStreamers)) {
                applyStreamersToKongbapData(dbStreamers);
              }
            }
          }

          // 러브라인 데이터 복원
          const restoredLovelines = data?.lovelines || 
            (Array.isArray(data?.categories) ? data.categories.find(c => c.id === "loveline")?.lovelines : null);
          if (Array.isArray(restoredLovelines) && typeof saveLovelineList === "function") {
            saveLovelineList(restoredLovelines);
          }

          persistData();
          renderCategoryTabs();
          renderContent();
          if (state.currentCategory === "loveline" && typeof renderLovelineContent === "function") {
            const mainContent = document.getElementById("main-content");
            if (mainContent) renderLovelineContent(mainContent);
          }
          updateStats();
          showToast(`🎉 '${file.name}' 파일로부터 성공적으로 복원되었습니다!`);
          closeBackupModal();
          return;
        }
      }
      showToast(`❌ 파일 복원 실패: 유효하지 않은 백업 JSON 형식이거나 서버 에러입니다.`);
    };
    reader.readAsText(file, "UTF-8");
  } catch (err) {
    console.error("파일 읽기 오류:", err);
    showToast("❌ 파일 읽기 실패");
  }
  event.target.value = "";
}

function handleDownloadBackup(fileName) {
  const downloadUrl = `${BACKUP_SERVER_URL}/api/backup/download/${encodeURIComponent(fileName)}`;
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


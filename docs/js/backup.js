const BACKUP_SERVER_URL = "";
let serverBackupInfo = null;
let isServerConnected = false;
let isBackupModalOpen = false;

function getBackupDirectoryPath() {
  return serverBackupInfo?.directory || "D:\\백업 파일\\KONGBAB_BACKUPS_JSON";
}

async function checkBackupServerHealth() {
  try {
    const res = await fetch(`${BACKUP_SERVER_URL}/api/status`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data?.status === "ok") {
        isServerConnected = true;
        serverBackupInfo = data;
        updateServerStatusBadge();
        return true;
      }
    }
  } catch (e) {}
  isServerConnected = false;
  serverBackupInfo = null;
  updateServerStatusBadge();
  return false;
}

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
    showToast(`⚠️ 백엔드(8080) 미연결: 브라우저 캐시에만 보관됩니다.`);
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

  let totalMembers = 0;
  let totalVideos = 0;
  KONGBAB_DATA.categories.forEach(cat => {
    const mems = getCategoryMembers(cat);
    totalMembers += mems.length;
    mems.forEach(m => { totalVideos += (m.videos || []).length; });
  });

  const payload = {
    appName: "kongbab-gta-rp",
    version: "1.0",
    createdAt: displayTime,
    reason: actionReason,
    stats: {
      totalCategories: KONGBAB_DATA.categories.length,
      totalMembers,
      totalVideos
    },
    categories: JSON.parse(JSON.stringify(KONGBAB_DATA.categories))
  };

  syncToBackupServer(payload, showFeedback);
}

function initBackupStorage() {
  checkBackupServerHealth();
  setInterval(checkBackupServerHealth, 10000);
}

function updateServerStatusBadge() {
  const badge = document.getElementById("backend-status-badge");
  if (!badge) return;

  const dir = getBackupDirectoryPath();

  if (isServerConnected) {
    const count = serverBackupInfo?.count ?? "-";
    badge.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-bold shadow-sm cursor-pointer hover:bg-emerald-900/90 transition-all";
    badge.title = `클릭하여 DB / 백업 관리 센터 열기 (즉시저장, 백업 기록, 불러오기)\n지정 백업 폴더: ${dir} (${count}개 보관 중)`;
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span>🟢 DB / 백업 연동 (${count}개)</span>
    `;
    badge.onclick = () => {
      openBackupModal();
    };
  } else {
    badge.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs font-medium cursor-pointer hover:bg-zinc-800 transition-all";
    badge.title = "백엔드 미연결 (클릭하여 상태 확인 및 백업 관리)";
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-zinc-500"></span>
      <span>백엔드 미연결 (8080)</span>
    `;
    badge.onclick = () => {
      openBackupModal();
    };
  }
}

function manualBackupNow() {
  openBackupModal();
}

function openBackupModal() {
  const modal = document.getElementById("backup-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  isBackupModalOpen = true;

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

function closeBackupModal() {
  const modal = document.getElementById("backup-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  isBackupModalOpen = false;
}

async function loadAndRenderBackupList(showSpinner = true) {
  const container = document.getElementById("backup-modal-list-container");
  const countLabel = document.getElementById("backup-modal-list-count");
  const countBadge = document.getElementById("backup-modal-count-badge");
  if (!container) return;

  if (showSpinner && (!container.children || container.children.length === 0)) {
    container.innerHTML = `
      <div class="text-center py-6 text-zinc-500 text-xs flex items-center justify-center gap-2">
        <span class="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></span>
        <span>백업 기록을 조회하는 중...</span>
      </div>
    `;
  }

  let backupList = [];
  try {
    const res = await fetch(`${BACKUP_SERVER_URL}/api/backup/list`, { 
      cache: "no-store",
      credentials: "include"
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.backups)) {
        backupList = data.backups;
      }
    } else if (res.status === 404) {
      // 구버전 백엔드 대비 fallback (/api/status 파일 목록)
      const statusRes = await fetch(`${BACKUP_SERVER_URL}/api/status`, { cache: "no-store" });
      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (Array.isArray(sData.files)) {
          backupList = sData.files.map(name => ({
            fileName: name,
            createdAt: formatFileNameToDate(name),
            reason: "자동 백업 스냅샷",
            totalMembers: 35,
            totalVideos: 0,
            fileSizeFormatted: "-"
          }));
        }
      }
    }
  } catch (e) {
    console.warn("백업 목록 조회 실패:", e);
  }

  if (countLabel) countLabel.textContent = `(총 ${backupList.length}개)`;
  if (countBadge) countBadge.textContent = `${backupList.length}개 보관 중`;

  if (backupList.length === 0) {
    container.innerHTML = `
      <div class="text-center py-10 bg-zinc-950/40 rounded-2xl border border-zinc-800/60 p-4">
        <div class="text-2xl mb-2">📂</div>
        <p class="text-xs text-zinc-400 font-semibold mb-1">저장된 백업 파일이 없습니다.</p>
        <p class="text-[11px] text-zinc-600">위의 [즉시 저장] 버튼을 누르면 첫 번째 백업 스냅샷이 생성됩니다.</p>
      </div>
    `;
    return;
  }

  const html = backupList.map((item, idx) => {
    const isLatest = idx === 0;
    const badgeText = isLatest ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">최신</span>` : "";
    const memberTag = item.totalMembers ? `<span class="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">인원 ${item.totalMembers}명</span>` : "";
    const videoTag = item.totalVideos ? `<span class="text-[11px] px-1.5 py-0.5 rounded bg-zinc-800 text-red-300 font-medium">영상 ${item.totalVideos}개</span>` : "";
    const sizeTag = item.fileSizeFormatted ? `<span class="text-[10px] text-zinc-500 font-mono">${item.fileSizeFormatted}</span>` : "";

    return `
      <div class="bg-zinc-950/80 hover:bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700/80 rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <span class="text-xs font-bold text-white tracking-tight">${item.createdAt || item.fileName}</span>
            ${badgeText}
            ${memberTag}
            ${videoTag}
            ${sizeTag}
          </div>
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <span class="text-zinc-300 truncate max-w-sm" title="${item.reason || ''}">
              ${item.reason ? `📝 ${item.reason}` : '데이터 변경 백업'}
            </span>
            <span class="text-[10px] text-zinc-500 font-mono hidden md:inline truncate max-w-xs" title="${item.fileName}">
              (${item.fileName})
            </span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
          <button 
            type="button"
            onclick="handleDownloadBackup('${item.fileName}')"
            class="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700/60 transition-colors cursor-pointer"
            title="백업 JSON 파일 다운로드"
          >
            💾 저장
          </button>
          <button 
            type="button"
            onclick="handleRestoreBackup('${item.fileName}', '${item.createdAt || item.fileName}')"
            class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1"
            title="이 시점으로 전체 데이터 복원"
          >
            <span>📥 불러오기</span>
          </button>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
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
        if (typeof fetchCategoryStructure === "function") {
          await fetchCategoryStructure();
        }
        if (typeof fetchStreamersFromDb === "function") {
          const dbStreamers = await fetchStreamersFromDb();
          if (Array.isArray(dbStreamers)) {
            applyStreamersToKongbabData(dbStreamers);
          }
        }

        persistData();
        renderCategoryTabs();
        renderContent();
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
          if (typeof fetchCategoryStructure === "function") {
            await fetchCategoryStructure();
          }
          if (typeof fetchStreamersFromDb === "function") {
            const dbStreamers = await fetchStreamersFromDb();
            if (Array.isArray(dbStreamers)) {
              applyStreamersToKongbabData(dbStreamers);
            }
          }
          persistData();
          renderCategoryTabs();
          renderContent();
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


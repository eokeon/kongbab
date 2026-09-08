/**
 * 콩밥특별시 GTA RP 아카이브 - JSON 백업 & 복구 시스템 (backup.js)
 * 
 * - 최대 20개 자동 롤링 JSON 백업 (FIFO 방식: 20개 초과 시 가장 오래된 백업 1개 자동 삭제)
 * - 로컬 서버(D:\백업 파일\KONGBAB_BACKUPS_JSON) 실시간 자동 전송 및 저장
 * - 백업 관리자 모달 렌더링, 시점별 1클릭 복구, 개별 JSON 다운로드, 수동 백업 생성
 * - 외부 JSON 파일 업로드 복구 지원
 */

const BACKUP_CONFIG = {
  maxBackups: 20, // 최대 20개 자동 롤링 보관
  storageKey: "kongbab_rolling_backups",
  autoDownloadKey: "kongbab_backup_auto_download"
};

const BACKUP_SERVER_URL = "http://localhost:38888";
const TARGET_EXTERNAL_DIR = "D:\\백업 파일\\KONGBAB_BACKUPS_JSON";

let isServerConnected = false;
let serverBackupInfo = null;
let localDirectoryHandle = null;

// 백업 동기화 서버 연결 상태 확인
async function checkBackupServerHealth() {
  try {
    const res = await fetch(`${BACKUP_SERVER_URL}/api/status`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === "ok") {
        isServerConnected = true;
        serverBackupInfo = data;
        updateFolderStatusUI();
        return true;
      }
    }
  } catch (e) {
    // 서버 비연결 상태
  }
  isServerConnected = false;
  serverBackupInfo = null;
  updateFolderStatusUI();
  return false;
}

// 외부 서버(D:\백업 파일\KONGBAB_BACKUPS_JSON)로 백업 파일 전송 및 20개 롤링 저장
async function syncToBackupServer(payload, fileName) {
  try {
    const res = await fetch(`${BACKUP_SERVER_URL}/api/backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        isServerConnected = true;
        serverBackupInfo = data;
        updateFolderStatusUI();
        showToast(`💾 D:\\백업 파일\\KONGBAB_BACKUPS_JSON 에 자동 저장 완료 (${data.count}/20개)`);
        console.log(`[Backup Server] Successfully saved to ${data.directory}\\${data.fileName} (Count: ${data.count}/20)`);
        return true;
      }
    }
  } catch (e) {
    console.warn("External backup server not reachable, saving to local store", e);
  }
  return false;
}

function getStoredBackups() {
  try {
    const saved = localStorage.getItem(BACKUP_CONFIG.storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load stored backups", e);
  }
  return [];
}

function saveStoredBackups(backups) {
  try {
    localStorage.setItem(BACKUP_CONFIG.storageKey, JSON.stringify(backups));
  } catch (e) {
    console.error("Failed to save backups to localStorage", e);
  }
  updateBackupBadge();
}

function isAutoDownloadEnabled() {
  const val = localStorage.getItem(BACKUP_CONFIG.autoDownloadKey);
  return val === null ? true : val === "true"; // 기본값 true
}

function toggleAutoDownload(enabled) {
  localStorage.setItem(BACKUP_CONFIG.autoDownloadKey, enabled ? "true" : "false");
  showToast(enabled ? "✓ 브라우저 자동 다운로드가 활성화되었습니다." : "브라우저 자동 다운로드가 비활성화되었습니다.");
}

function formatFileTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}${m}${day}_${h}${min}${s}`;
}

function formatDisplayTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}.${m}.${day} ${h}:${min}:${s}`;
}

// 롤링 20개 백업 스냅샷 생성
function createBackupSnapshot(actionReason = "데이터 백업", forceDownload = null) {
  const now = new Date();
  const fileTime = formatFileTimestamp(now);
  const displayTime = formatDisplayTimestamp(now);
  const fileName = `kongbab_backup_${fileTime}.json`;

  let totalMembers = 0;
  let totalVideos = 0;
  KONGBAB_DATA.categories.forEach(cat => {
    const mems = getCategoryMembers(cat);
    totalMembers += mems.length;
    mems.forEach(m => totalVideos += (m.videos || []).length);
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

  const snapshot = {
    id: "bk_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    fileName,
    createdAt: displayTime,
    timestamp: Date.now(),
    reason: actionReason,
    memberCount: totalMembers,
    videoCount: totalVideos,
    payload
  };

  let backups = getStoredBackups();
  // 맨 앞에 최신 백업 추가
  backups.unshift(snapshot);

  // 20개 초과 시 가장 오래된 1개 자동 삭제 (롤링 20개 유지)
  if (backups.length > BACKUP_CONFIG.maxBackups) {
    backups = backups.slice(0, BACKUP_CONFIG.maxBackups);
  }

  saveStoredBackups(backups);

  // 1. 외부 동기화 서버(D:\백업 파일\KONGBAB_BACKUPS_JSON)로 실시간 저장 전송
  syncToBackupServer(payload, fileName);

  // 2. 브라우저 로컬 폴더 직접 핸들이 연동되어 있을 경우 저장
  saveToLocalDirectoryHandle(fileName, payload);

  // 3. 브라우저 자동 다운로드 처리 (서버 미실행 시 안전망)
  const shouldDownload = forceDownload !== null ? forceDownload : isAutoDownloadEnabled();
  if (shouldDownload && !isServerConnected) {
    downloadJsonFile(fileName, payload);
  }

  // 모달이 열려있다면 리스트 갱신
  renderBackupList();

  console.log(`[Backup] Generated ${fileName} (${backups.length}/${BACKUP_CONFIG.maxBackups}) - Reason: ${actionReason}`);
  return snapshot;
}

// 초기 백업 시딩
function initBackupStorage() {
  const backups = getStoredBackups();
  if (backups.length === 0) {
    // 최초 실행 시 기본 데이터 백업 생성
    createBackupSnapshot("초기 데이터 백업 (경찰~시민 스트리머, RP네임, 영상링크)", false);
  }
  updateBackupBadge();
  checkBackupServerHealth();
}

// 브라우저 파일 다운로드
function downloadJsonFile(fileName, dataObj) {
  try {
    const jsonStr = typeof dataObj === "string" ? dataObj : JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    console.error("Failed to download JSON file", e);
  }
}

// 헤더 백업 뱃지 텍스트 갱신
function updateBackupBadge() {
  const badgeText = document.getElementById("backup-badge-text");
  const pill = document.getElementById("backup-count-pill");
  const count = getStoredBackups().length;

  if (badgeText) {
    badgeText.textContent = `백업/복구 (${count}/20)`;
  }
  if (pill) {
    pill.textContent = `${count} / 20개`;
  }
}

// 백업 관리자 모달 열기 / 닫기
function openBackupModal() {
  if (!isAdmin()) {
    alert("어드민만 백업 관리자에 접근할 수 있습니다.");
    return;
  }
  const modal = document.getElementById("backup-modal");
  const toggle = document.getElementById("backup-auto-download-toggle");
  if (toggle) {
    toggle.checked = isAutoDownloadEnabled();
  }
  checkBackupServerHealth();
  renderBackupList();
  updateBackupBadge();
  updateFolderStatusUI();

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
  }
}

function closeBackupModal() {
  const modal = document.getElementById("backup-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
}

// 백업 목록 렌더링
function renderBackupList() {
  const container = document.getElementById("backup-list-container");
  if (!container) return;

  const backups = getStoredBackups();

  if (backups.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-zinc-500 text-xs bg-zinc-950/40 rounded-2xl border border-zinc-800/40">
        보관된 백업 파일이 없습니다. 상단의 [💾 현재 데이터 즉시 백업]을 클릭해보세요.
      </div>
    `;
    return;
  }

  container.innerHTML = backups.map((bk, index) => {
    const isLatest = index === 0;
    return `
      <div class="bg-zinc-950 border ${isLatest ? 'border-amber-500/50 bg-amber-950/10' : 'border-zinc-800'} rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors">
        <div class="flex items-start gap-3 min-w-0">
          <span class="w-7 h-7 rounded-xl ${isLatest ? 'bg-amber-500 text-black font-black' : 'bg-zinc-800 text-zinc-400 font-bold'} flex items-center justify-center text-xs flex-shrink-0">
            ${index + 1}
          </span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-mono text-xs font-bold text-white truncate">${bk.fileName}</span>
              ${isLatest ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-black font-extrabold">최신</span>' : ''}
              <span class="text-[11px] text-zinc-500">${bk.createdAt}</span>
            </div>
            <div class="flex items-center gap-3 mt-1 text-[11px] text-zinc-400">
              <span class="text-zinc-300 font-medium truncate">📝 ${bk.reason || "데이터 저장"}</span>
              <span class="text-zinc-600">|</span>
              <span>인원 <strong class="text-white">${bk.memberCount ?? "-"}</strong>명</span>
              <span>영상 <strong class="text-red-400">${bk.videoCount ?? "-"}</strong>개</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
          <button 
            onclick="downloadBackupItem('${bk.id}')"
            class="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            title="이 JSON 파일 다운로드"
          >
            📥 다운로드
          </button>
          <button 
            onclick="restoreFromSnapshot('${bk.id}')"
            class="px-2.5 py-1.5 bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
            title="이 시점 데이터로 복구"
          >
            🔄 복구
          </button>
          <button 
            onclick="deleteBackupItem('${bk.id}')"
            class="px-2 py-1.5 bg-zinc-900 hover:bg-red-950 text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-800/50 text-xs rounded-xl transition-colors cursor-pointer"
            title="이 백업 삭제"
          >
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// 특정 백업 다운로드
function downloadBackupItem(backupId) {
  const backups = getStoredBackups();
  const bk = backups.find(b => b.id === backupId);
  if (!bk) return;
  downloadJsonFile(bk.fileName, bk.payload);
  showToast(`📥 ${bk.fileName} 다운로드를 시작했습니다.`);
}

// 특정 백업으로 복구
function restoreFromSnapshot(backupId) {
  if (!isAdmin()) {
    alert("어드민만 데이터를 복구할 수 있습니다.");
    return;
  }
  const backups = getStoredBackups();
  const bk = backups.find(b => b.id === backupId);
  if (!bk || !bk.payload || !Array.isArray(bk.payload.categories)) {
    alert("백업 파일이 손상되었거나 찾을 수 없습니다.");
    return;
  }

  const confirmMsg = `[${bk.fileName}]\n생성일시: ${bk.createdAt}\n내용: ${bk.reason}\n\n위 시점의 데이터로 복구하시겠습니까?\n현재 데이터가 이 시점의 데이터로 롤백됩니다.`;
  if (!confirm(confirmMsg)) return;

  KONGBAB_DATA.categories = JSON.parse(JSON.stringify(bk.payload.categories));
  persistData();
  updateStats();
  renderContent();

  // 복구 행위 자체도 하나의 백업으로 기록 (자동 다운로드는 false)
  createBackupSnapshot(`데이터 복구: ${bk.fileName} 시점 적용`, false);
  renderBackupList();

  showToast(`✓ ${bk.fileName} 시점의 데이터로 복구되었습니다.`);
}

// 특정 백업 항목 삭제
function deleteBackupItem(backupId) {
  if (!confirm("이 백업 기록을 삭제하시겠습니까?")) return;
  let backups = getStoredBackups();
  backups = backups.filter(b => b.id !== backupId);
  saveStoredBackups(backups);
  renderBackupList();
  showToast("백업 항목이 삭제되었습니다.");
}

// 수동 백업 생성
function createManualBackup() {
  const snapshot = createBackupSnapshot("수동 생성 백업", isAutoDownloadEnabled());
  renderBackupList();
  showToast(`💾 새 백업 생성 완료: ${snapshot.fileName}`);
}

// 외부 JSON 파일 업로드 복구
function handleBackupFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || !Array.isArray(parsed.categories)) {
        alert("올바른 콩밥특별시 백업 JSON 형식이 아닙니다. (categories 배열 누락)");
        return;
      }

      const memCount = parsed.stats?.totalMembers ?? "확인불가";
      const vidCount = parsed.stats?.totalVideos ?? "확인불가";
      const confirmMsg = `[외부 백업 파일: ${file.name}]\n- 총 카테고리: ${parsed.categories.length}개\n- 인원 수: ${memCount}명\n- 영상 수: ${vidCount}개\n\n이 백업 데이터로 복구하시겠습니까?`;
      if (!confirm(confirmMsg)) return;

      KONGBAB_DATA.categories = parsed.categories;
      persistData();
      updateStats();
      renderContent();

      createBackupSnapshot(`외부 파일 복구: ${file.name}`, false);
      renderBackupList();
      showToast(`✓ ${file.name} 파일로부터 데이터가 성공적으로 복구되었습니다.`);
    } catch (err) {
      alert("JSON 파싱 오류: 올바른 JSON 파일인지 확인해주세요.");
      console.error(err);
    }
  };
  reader.readAsText(file, "utf-8");
  event.target.value = "";
}

// File System Access API: 로컬 폴더 연동
async function selectLocalBackupDirectory() {
  if (!window.showDirectoryPicker) {
    alert("현재 브라우저에서는 폴더 직접 선택 API를 지원하지 않습니다.\n대신 상단의 자동 다운로드 및 [📥 다운로드] 기능으로 완벽히 보관 및 복구하실 수 있습니다.");
    return;
  }

  try {
    localDirectoryHandle = await window.showDirectoryPicker({
      mode: "readwrite"
    });
    updateFolderStatusUI();
    showToast(`📂 로컬 폴더 연동 완료: [${localDirectoryHandle.name}]`);
    createBackupSnapshot("로컬 폴더 연동 첫 백업", false);
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Directory picker error", err);
      alert("폴더 선택 중 오류가 발생했습니다: " + err.message);
    }
  }
}

async function saveToLocalDirectoryHandle(fileName, payload) {
  if (!localDirectoryHandle) return;
  try {
    const fileHandle = await localDirectoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();

    // 20개 초과 시 폴더 내 가장 오래된 파일 삭제 (롤링)
    cleanLocalDirectoryFiles();
  } catch (err) {
    console.warn("Could not write directly to local folder handle", err);
  }
}

async function cleanLocalDirectoryFiles() {
  if (!localDirectoryHandle) return;
  try {
    const backupFiles = [];
    for await (const entry of localDirectoryHandle.values()) {
      if (entry.kind === "file" && entry.name.startsWith("kongbab_backup_") && entry.name.endsWith(".json")) {
        backupFiles.push(entry.name);
      }
    }
    backupFiles.sort();
    while (backupFiles.length > BACKUP_CONFIG.maxBackups) {
      const oldestName = backupFiles.shift();
      await localDirectoryHandle.removeEntry(oldestName);
      console.log(`[Directory] Removed oldest backup from disk: ${oldestName}`);
    }
  } catch (err) {
    console.warn("Directory cleanup error", err);
  }
}

function updateFolderStatusUI() {
  const statusEl = document.getElementById("backup-folder-status");
  const badgeEl = document.getElementById("backup-server-badge");

  if (badgeEl) {
    if (isServerConnected) {
      badgeEl.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-bold shadow-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>🟢 외부 폴더 자동 동기화 활성</span>
        </span>
      `;
    } else {
      badgeEl.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs font-medium">
          <span class="w-2 h-2 rounded-full bg-zinc-500"></span>
          <span>서버 대기 중 (start_backup_server.bat)</span>
        </span>
      `;
    }
  }

  if (statusEl) {
    if (isServerConnected) {
      const count = serverBackupInfo ? serverBackupInfo.count : 0;
      statusEl.innerHTML = `
        <span class="text-emerald-400 font-bold flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>D:\\백업 파일\\KONGBAB_BACKUPS_JSON 연동 중 (${count}/20개 보관)</span>
        </span>
      `;
    } else if (localDirectoryHandle) {
      statusEl.innerHTML = `
        <span class="text-emerald-400 font-bold">✓ 브라우저 폴더 직접 연결됨: [${localDirectoryHandle.name}]</span>
      `;
    } else {
      statusEl.innerHTML = `
        <span class="text-zinc-400">외부 폴더 미연동 시 브라우저 다운로드 및 내부 20개 롤링 저장소 활용</span>
      `;
    }
  }
}

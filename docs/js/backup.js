const BACKUP_SERVER_URL = "";
let serverBackupInfo = null;
let isServerConnected = false;

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

async function syncToBackupServer(payload) {
  try {
    const res = await fetch(`${BACKUP_SERVER_URL}/api/backup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload, null, 2)
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success) {
        isServerConnected = true;
        serverBackupInfo = data;
        updateServerStatusBadge();
        showToast(`💾 ${getBackupDirectoryPath()} 에 자동 저장 완료 (${data.fileName})`);
        return true;
      }
    }
  } catch (e) {}
  isServerConnected = false;
  updateServerStatusBadge();
  showToast(`⚠️ 백엔드(8080) 미연결: 브라우저 캐시에만 임시 보관됩니다.`);
  return false;
}

function formatDisplayTimestamp(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function createBackupSnapshot(actionReason = "데이터 변경") {
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

  syncToBackupServer(payload);
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
    badge.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 text-xs font-bold shadow-sm cursor-pointer";
    badge.title = `지정 백업 폴더: ${dir} (${count}개 보관 중)`;
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span>🟢 DB / 백업 연동 (${count}개)</span>
    `;
    badge.onclick = () => {
      showToast(`📁 지정 백업 경로:<br><b class="text-amber-300">${dir}</b><br>(백업 파일 ${count}개 보관 중)`);
    };
  } else {
    badge.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-400 text-xs font-medium cursor-pointer";
    badge.title = "인텔리제이에서 Spring Boot(8080)를 실행하시면 DB와 지정 폴더로 자동 저장됩니다.";
    badge.innerHTML = `
      <span class="w-2 h-2 rounded-full bg-zinc-500"></span>
      <span>백엔드 미연결 (8080)</span>
    `;
    badge.onclick = () => {
      checkBackupServerHealth().then(ok => {
        if (ok) {
          showToast(`✓ 백엔드 연결 성공!`);
        } else {
          showToast(`인텔리제이에서 KongbabApplication을 실행해주세요.`);
        }
      });
    };
  }
}

function manualBackupNow() {
  createBackupSnapshot("수동 백업 요청");
}

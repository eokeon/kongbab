// ==========================================
// 관리자 - 유튜브 재생목록 일괄 등록 관리 모듈
// ==========================================

let loadedPlaylistVideos = [];

function extractPlaylistId(url) {
  if (!url) return null;
  const str = String(url).trim();
  const listMatch = str.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (listMatch && listMatch[1]) return listMatch[1];
  if (/^[a-zA-Z0-9_-]{12,}$/.test(str)) return str;
  return null;
}

function openPlaylistModal() {
  if (!isAdmin()) {
    alert("어드민 전용 기능입니다.");
    return;
  }
  if (!state.currentMember) return;

  const modal = document.getElementById("playlist-modal");
  const subtitle = document.getElementById("playlist-modal-subtitle");
  const urlInput = document.getElementById("playlist-form-url");
  const previewContainer = document.getElementById("playlist-preview-container");
  const statusEl = document.getElementById("playlist-fetch-status");
  const submitBtn = document.getElementById("btn-submit-playlist");

  if (subtitle) {
    subtitle.textContent = `${state.currentMember.streamer} (${state.currentMember.name})에게 재생목록 영상 일괄 등록`;
  }
  if (urlInput) urlInput.value = "";
  if (previewContainer) previewContainer.classList.add("hidden");
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "text-xs font-medium hidden";
  }
  if (submitBtn) submitBtn.disabled = true;

  loadedPlaylistVideos = [];

  const targetTab = (state.currentVideoTab === 'binge' || state.currentVideoTab === 'full') ? state.currentVideoTab : 'clip';
  const radio = document.querySelector(`input[name="playlist-form-type"][value="${targetTab}"]`);
  if (radio) radio.checked = true;

  const keepOrderCheck = document.getElementById("playlist-keep-order");
  if (keepOrderCheck) keepOrderCheck.checked = true;

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
    if (urlInput) setTimeout(() => urlInput.focus(), 50);
  }
}

function closePlaylistModal() {
  const modal = document.getElementById("playlist-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
  loadedPlaylistVideos = [];
}

function formatIsoDateToKst(isoDateStr) {
  if (!isoDateStr) return "";
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (y && m && day) {
      return `${y}.${m}.${day}`;
    }
    return d.toISOString().substring(0, 10).replace(/-/g, ".");
  } catch (e) {
    if (typeof isoDateStr === "string" && isoDateStr.length >= 10) {
      return isoDateStr.substring(0, 10).replace(/-/g, ".");
    }
    return "";
  }
}

async function apiGetPlaylistInfo(urlOrId) {
  const playlistId = extractPlaylistId(urlOrId);
  if (!playlistId) return { success: false, message: "유효한 재생목록 링크 또는 ID가 아닙니다." };

  let videos = [];

  // 1. 백엔드 API 시도
  try {
    const res = await fetch(`${API_BASE}/api/youtube/playlist?url=${encodeURIComponent(urlOrId)}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        videos = data.map(item => {
          const vId = item.videoId || extractYoutubeId(item.url);
          let vUrl = item.url;
          if (!vUrl || vUrl === "undefined") {
            vUrl = vId ? `https://www.youtube.com/watch?v=${vId}&list=${playlistId}` : "";
          } else if (playlistId && !vUrl.includes("list=")) {
            vUrl = `https://www.youtube.com/watch?v=${vId}&list=${playlistId}`;
          }
          return {
            ...item,
            videoId: vId,
            url: vUrl,
            publishedDate: item.publishedDate || "",
            thumbnailUrl: item.thumbnailUrl || (vId ? `https://img.youtube.com/vi/${vId}/hqdefault.jpg` : "")
          };
        }).filter(item => item.url && item.url !== "undefined");
      }
    }
  } catch (e) {
    console.warn("백엔드 재생목록 조회 실패, 브라우저 직접 조회 시도:", e);
  }

  // 2. 백엔드 실패 시 YouTube Data API v3 직접 호출 fallback
  if (videos.length === 0) {
    try {
      const apiKey = "AIzaSyAyY4g9-iwjwQNXb5F9Xx0LLGtLUEpowl8";
      let pageToken = "";

      for (let p = 0; p < 6; p++) {
        let apiUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}`;
        if (pageToken) apiUrl += `&pageToken=${pageToken}`;

        const res = await fetch(apiUrl);
        if (!res.ok) break;
        const data = await res.json();
        const items = data.items || [];
        if (items.length === 0) break;

        for (const item of items) {
          const vId = item.snippet?.resourceId?.videoId || item.contentDetails?.videoId;
          if (!vId) continue;
          const title = item.snippet?.title || "";
          if (title.toLowerCase().includes("private video") || title.toLowerCase().includes("deleted video")) continue;

          // contentDetails.videoPublishedAt가 영상의 실제 업로드일
          const rawDate = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt || "";
          const kstDate = formatIsoDateToKst(rawDate);

          videos.push({
            videoId: vId,
            title,
            url: `https://www.youtube.com/watch?v=${vId}&list=${playlistId}`,
            publishedDate: kstDate,
            channelTitle: item.snippet?.channelTitle || "",
            thumbnailUrl: `https://img.youtube.com/vi/${vId}/hqdefault.jpg`,
            duration: ""
          });
        }

        pageToken = data.nextPageToken;
        if (!pageToken) break;
      }
    } catch (e) {
      console.error("YouTube Data API 직접 호출 실패:", e);
    }
  }

  if (videos.length === 0) {
    return { success: false, message: "재생목록을 찾을 수 없거나 비공개 재생목록입니다." };
  }

  // 3. ⭐ 핵심: 백엔드/프론트 출처에 무관하게, YouTube videos.list API로 실제 영상 게시일(snippet.publishedAt)과 길이를 정확히 일괄 보정!
  // 재생목록 추가 날짜(snippet.publishedAt in playlistItems)가 아닌 실제 영상 업로드일로 100% 보장
  try {
    const apiKey = "AIzaSyAyY4g9-iwjwQNXb5F9Xx0LLGtLUEpowl8";
    const vIds = videos.map(v => v.videoId || extractYoutubeId(v.url)).filter(Boolean);

    for (let i = 0; i < vIds.length; i += 50) {
      const chunk = vIds.slice(i, i + 50);
      if (chunk.length === 0) continue;
      const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${chunk.join(",")}&key=${apiKey}`);
      if (vRes.ok) {
        const vData = await vRes.json();
        const infoMap = {};
        (vData.items || []).forEach(item => {
          infoMap[item.id] = {
            duration: formatIsoDuration(item.contentDetails?.duration),
            publishedDate: formatIsoDateToKst(item.snippet?.publishedAt)
          };
        });
        videos.forEach(v => {
          const id = v.videoId || extractYoutubeId(v.url);
          if (infoMap[id]) {
            if (infoMap[id].duration) v.duration = infoMap[id].duration;
            // 실제 영상의 게시일(KST)로 정확히 갱신
            if (infoMap[id].publishedDate) v.publishedDate = infoMap[id].publishedDate;
          }
          if (playlistId && v.url && !v.url.includes("list=")) {
            v.url = `https://www.youtube.com/watch?v=${id}&list=${playlistId}`;
          }
        });
      }
    }
  } catch (err) {
    console.warn("영상 상세 정보 실시간 보정 경고:", err);
  }

  return { success: true, videos, playlistId };
}

let playlistDragSourceIndex = null;

function renderPlaylistPreviewList() {
  const previewContainer = document.getElementById("playlist-preview-container");
  const previewList = document.getElementById("playlist-preview-list");
  const previewCount = document.getElementById("playlist-preview-count");
  const submitBtn = document.getElementById("btn-submit-playlist");

  if (!loadedPlaylistVideos || loadedPlaylistVideos.length === 0) {
    if (previewCount) previewCount.textContent = "0개 영상";
    if (previewList) {
      previewList.innerHTML = `
        <div class="py-8 text-center text-zinc-500 text-xs">
          선택된 영상이 없습니다. 다른 재생목록 링크를 입력하여 불러와주세요.
        </div>
      `;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>일괄 등록하기</span>`;
    }
    return;
  }

  const totalCount = loadedPlaylistVideos.length;
  if (previewCount) {
    previewCount.textContent = `총 ${totalCount}개 영상`;
  }
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>총 ${totalCount}개 영상 일괄 등록하기</span>`;
  }

  if (previewList) {
    previewList.innerHTML = loadedPlaylistVideos.map((v, idx) => {
      const safeTitle = (v.title || '').replace(/"/g, '&quot;');
      const vId = v.videoId || extractYoutubeId(v.url);
      const vUrl = (v.url && v.url !== "undefined") ? v.url : (vId ? `https://www.youtube.com/watch?v=${vId}` : "");
      const vThumb = v.thumbnailUrl || (vId ? `https://img.youtube.com/vi/${vId}/hqdefault.jpg` : "");

      return `
        <div 
          draggable="true"
          data-playlist-index="${idx}"
          ondragstart="handlePlaylistDragStart(event, ${idx})"
          ondragover="handlePlaylistDragOver(event)"
          ondragenter="handlePlaylistDragEnter(event)"
          ondragleave="handlePlaylistDragLeave(event)"
          ondrop="handlePlaylistDrop(event, ${idx})"
          ondragend="handlePlaylistDragEnd(event)"
          class="playlist-preview-item group flex items-center gap-2.5 p-2 bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800/80 hover:border-zinc-700 rounded-xl transition-all select-none"
        >
          <!-- 드래그 핸들 -->
          <div class="cursor-grab active:cursor-grabbing text-zinc-500 hover:text-amber-400 p-1 flex-shrink-0" title="드래그하여 순서 변경">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 4a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm6-12a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm0 6a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
            </svg>
          </div>

          <!-- 순번 뱃지 -->
          <div class="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
            ${idx + 1}
          </div>

          <!-- 썸네일 (클릭 시 새 탭) -->
          <a href="${vUrl || '#'}" target="_blank" rel="noopener noreferrer" class="flex-shrink-0 cursor-pointer group/thumb" title="유튜브에서 영상 확인 (새 탭)">
            <img src="${vThumb}" class="w-16 h-9 object-cover rounded-lg border border-zinc-800 bg-black group-hover/thumb:scale-105 transition-transform" loading="lazy" />
          </a>

          <!-- 정보 (제목, 날짜, 시간) -->
          <div class="flex-1 min-w-0 pr-1">
            <a href="${vUrl || '#'}" target="_blank" rel="noopener noreferrer" class="block font-bold text-white text-xs truncate hover:text-red-400 transition-colors cursor-pointer" title="${safeTitle} (유튜브로 열기)">
              ${v.title}
            </a>
            <div class="flex items-center gap-2 text-[11px] text-zinc-400 mt-1 flex-wrap">
              <span class="text-zinc-400 font-mono text-[11px] bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-0.5">📅 ${v.publishedDate || '-'}</span>
              ${v.duration ? `<span class="text-zinc-300 font-mono font-semibold bg-zinc-950 border border-zinc-800 rounded-lg px-1.5 py-0.5">⏱️ ${v.duration}</span>` : ''}
              <a href="${vUrl || '#'}" target="_blank" rel="noopener noreferrer" class="text-[11px] text-zinc-400 hover:text-amber-400 flex items-center gap-0.5 cursor-pointer ml-0.5">열기 ↗</a>
            </div>
          </div>

          <!-- 삭제 (✕) 버튼 -->
          <div class="flex items-center flex-shrink-0">
            <button 
              type="button" 
              onclick="removePlaylistItem(${idx})" 
              class="w-7 h-7 rounded-lg bg-red-950/40 hover:bg-red-900/80 border border-red-800/40 text-red-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              title="목록에서 제외"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join("");
  }
}

function removePlaylistItem(index) {
  if (!loadedPlaylistVideos || index < 0 || index >= loadedPlaylistVideos.length) return;
  const [removed] = loadedPlaylistVideos.splice(index, 1);
  renderPlaylistPreviewList();
  if (removed && removed.title) {
    showToast(`'${removed.title.slice(0, 16)}...' 영상이 목록에서 제외되었습니다.`);
  }
}

function sortPlaylistPreview(direction) {
  if (!loadedPlaylistVideos || loadedPlaylistVideos.length <= 1) return;
  loadedPlaylistVideos.sort((a, b) => {
    const timeA = typeof parseDateToTimestamp === "function" ? parseDateToTimestamp(a.publishedDate) : 0;
    const timeB = typeof parseDateToTimestamp === "function" ? parseDateToTimestamp(b.publishedDate) : 0;
    return direction === 'asc' ? (timeA - timeB) : (timeB - timeA);
  });
  renderPlaylistPreviewList();
  showToast(direction === 'asc' ? "과거순(날짜 빠른 순)으로 정렬되었습니다." : "최신순으로 정렬되었습니다.");
}

function reversePlaylistPreview() {
  if (!loadedPlaylistVideos || loadedPlaylistVideos.length <= 1) return;
  loadedPlaylistVideos.reverse();
  renderPlaylistPreviewList();
  showToast("🔄 목록 순서가 역순으로 뒤집혔습니다.");
}

function clearPlaylistPreview() {
  if (!loadedPlaylistVideos || loadedPlaylistVideos.length === 0) return;
  if (!confirm("불러온 영상을 모두 제외하시겠습니까?")) return;
  loadedPlaylistVideos = [];
  renderPlaylistPreviewList();
}

function handlePlaylistDragStart(e, index) {
  if (e.target.closest('button') || e.target.closest('a')) {
    e.preventDefault();
    return;
  }
  playlistDragSourceIndex = index;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(index));
  const el = e.currentTarget;
  if (el) {
    setTimeout(() => {
      el.classList.add("opacity-40", "scale-[0.98]");
    }, 0);
  }
}

function handlePlaylistDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function handlePlaylistDragEnter(e) {
  e.preventDefault();
  const itemEl = e.currentTarget;
  if (itemEl && itemEl.classList.contains("playlist-preview-item")) {
    itemEl.classList.add("border-amber-500", "bg-amber-950/40");
  }
}

function handlePlaylistDragLeave(e) {
  const itemEl = e.currentTarget;
  if (itemEl && itemEl.classList.contains("playlist-preview-item")) {
    itemEl.classList.remove("border-amber-500", "bg-amber-950/40");
  }
}

function handlePlaylistDrop(e, targetIndex) {
  e.preventDefault();
  e.stopPropagation();
  clearPlaylistDragStyles();

  if (playlistDragSourceIndex === null || playlistDragSourceIndex === targetIndex) return;
  if (!loadedPlaylistVideos || targetIndex < 0 || targetIndex >= loadedPlaylistVideos.length) return;

  const [moved] = loadedPlaylistVideos.splice(playlistDragSourceIndex, 1);
  loadedPlaylistVideos.splice(targetIndex, 0, moved);
  playlistDragSourceIndex = null;
  renderPlaylistPreviewList();
}

function handlePlaylistDragEnd(e) {
  playlistDragSourceIndex = null;
  clearPlaylistDragStyles();
}

function clearPlaylistDragStyles() {
  document.querySelectorAll(".playlist-preview-item").forEach(el => {
    el.classList.remove("border-amber-500", "bg-amber-950/40", "opacity-40", "scale-[0.98]");
  });
}

async function fetchPlaylistPreview() {
  const urlInput = document.getElementById("playlist-form-url");
  const url = urlInput ? urlInput.value.trim() : "";
  if (!url) {
    showToast("재생목록 URL을 입력해주세요.");
    return;
  }

  const btnText = document.getElementById("btn-fetch-playlist-text");
  const statusEl = document.getElementById("playlist-fetch-status");
  const previewContainer = document.getElementById("playlist-preview-container");

  if (btnText) btnText.textContent = "조회 중...";
  if (statusEl) {
    statusEl.textContent = "⏳ 유튜브 재생목록 영상 목록을 분석하여 불러오는 중입니다...";
    statusEl.className = "text-xs text-amber-400 font-medium block";
  }

  try {
    const res = await apiGetPlaylistInfo(url);
    if (res && res.success && Array.isArray(res.videos) && res.videos.length > 0) {
      loadedPlaylistVideos = res.videos;
      renderPlaylistPreviewList();

      if (previewContainer) previewContainer.classList.remove("hidden");
      if (statusEl) {
        statusEl.textContent = `✓ 재생목록에서 총 ${res.videos.length}개의 영상을 성공적으로 확인했습니다.`;
        statusEl.className = "text-xs text-emerald-400 font-medium block";
      }
      showToast(`✓ 재생목록에서 ${res.videos.length}개의 영상을 불러왔습니다.`);
    } else {
      loadedPlaylistVideos = [];
      renderPlaylistPreviewList();
      if (previewContainer) previewContainer.classList.add("hidden");
      if (statusEl) {
        statusEl.textContent = `❌ ${res?.message || '재생목록을 불러올 수 없습니다. 링크를 확인해주세요.'}`;
        statusEl.className = "text-xs text-red-400 font-medium block";
      }
    }
  } catch (err) {
    console.error("재생목록 불러오기 실패:", err);
    loadedPlaylistVideos = [];
    renderPlaylistPreviewList();
    if (previewContainer) previewContainer.classList.add("hidden");
    if (statusEl) {
      statusEl.textContent = "❌ 재생목록을 불러오는 중 오류가 발생했습니다.";
      statusEl.className = "text-xs text-red-400 font-medium block";
    }
  } finally {
    if (btnText) btnText.textContent = "목록 불러오기";
  }
}

async function handleBatchImportPlaylist(e) {
  if (e) e.preventDefault();
  if (!isAdmin()) return;
  if (!state.currentMember) return;
  if (!loadedPlaylistVideos || loadedPlaylistVideos.length === 0) {
    showToast("먼저 재생목록을 불러와주세요.");
    return;
  }

  const typeRadio = document.querySelector('input[name="playlist-form-type"]:checked');
  const videoType = typeRadio ? typeRadio.value : "clip";
  const skipDuplicates = document.getElementById("playlist-skip-duplicates")?.checked ?? true;
  const keepOrder = document.getElementById("playlist-keep-order")?.checked ?? true;

  // 1. 기존 영상 중 url이 없거나 'undefined'로 잘못 들어간 불량 영상 자동 정리
  if (Array.isArray(state.currentMember.videos)) {
    state.currentMember.videos = state.currentMember.videos.filter(v => v && v.url && v.url !== "undefined" && v.url.trim() !== "");
  } else {
    state.currentMember.videos = [];
  }

  const existingUrls = new Set(state.currentMember.videos.map(v => (v.url || "").trim()).filter(u => u && u !== "undefined"));
  const existingIds = new Set(state.currentMember.videos.map(v => extractYoutubeId(v.url)).filter(Boolean));

  let addedCount = 0;
  let skippedCount = 0;

  const playlistUrlInput = document.getElementById("playlist-form-url");
  const currentPlaylistId = playlistUrlInput ? extractPlaylistId(playlistUrlInput.value) : null;

  for (let i = 0; i < loadedPlaylistVideos.length; i++) {
    const item = loadedPlaylistVideos[i];
    const videoId = item.videoId || extractYoutubeId(item.url);
    let videoUrl = (item.url && item.url !== "undefined") ? item.url : "";
    if (!videoUrl) {
      videoUrl = videoId ? (currentPlaylistId ? `https://www.youtube.com/watch?v=${videoId}&list=${currentPlaylistId}` : `https://www.youtube.com/watch?v=${videoId}`) : "";
    } else if (currentPlaylistId && !videoUrl.includes("list=")) {
      videoUrl = `https://www.youtube.com/watch?v=${videoId}&list=${currentPlaylistId}`;
    }

    if (!videoUrl || !videoId) {
      console.warn("유효하지 않은 영상 항목 건너뜀:", item);
      continue;
    }

    if (skipDuplicates && (existingUrls.has(videoUrl) || existingIds.has(videoId))) {
      skippedCount++;
      continue;
    }

    const newVideo = {
      id: "v-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5) + "-" + i,
      title: item.title || "유튜브 영상",
      url: videoUrl,
      videoType: videoType,
      date: item.publishedDate || getTodayDateString(),
      duration: item.duration || "",
      description: item.description || ""
    };

    state.currentMember.videos.push(newVideo);
    existingUrls.add(videoUrl);
    existingIds.add(videoId);
    addedCount++;
  }

  if (addedCount === 0) {
    alert("선택된 재생목록의 모든 영상이 이미 등록되어 있어 추가할 새 영상이 없습니다.");
    return;
  }

  if (!keepOrder) {
    // 사용자가 모달 순서 유지를 해제한 경우에만 전체 날짜순 정렬
    sortVideosByDateAsc(state.currentMember.videos);
  } else {
    // 모달에서 지정/조정한 순서를 그대로 보존하도록 순차적으로 displayOrder 재부여
    state.currentMember.videos.forEach((v, idx) => {
      v.displayOrder = idx;
    });
  }

  // DB 및 로컬 동기화
  if (typeof syncAllStreamersToDb === "function") {
    await syncAllStreamersToDb(extractAllStreamersFromKongbabData());
  }
  persistData();
  updateStats();
  closePlaylistModal();

  // 해당 탭으로 자동 전환하여 방금 추가된 영상들이 바로 보이도록 설정
  state.currentVideoTab = videoType;
  const container = document.getElementById("main-content");
  if (container) renderMemberVideos(container);

  let msg = `✓ ${addedCount}개 영상이 일괄 등록되었습니다!`;
  if (skippedCount > 0) {
    msg += ` (${skippedCount}개 중복 건너뜀)`;
  }
  showToast(msg);
  createBackupSnapshot(`재생목록 일괄 등록: ${state.currentMember.name} (${addedCount}개)`);
}

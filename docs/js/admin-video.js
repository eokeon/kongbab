// ==========================================
// 관리자 - 영상 관리 모듈 (Admin Video Management)
// 단일 영상 등록/수정 및 다중 링크 일괄 등록 지원
// ==========================================

let editingVideoId = null;
let currentVideoModalMode = 'single';
let loadedMultiVideos = [];

function switchVideoModalMode(mode = 'single') {
  currentVideoModalMode = mode;
  const singleBtn = document.getElementById("btn-video-mode-single");
  const multiBtn = document.getElementById("btn-video-mode-multi");
  const singleForm = document.getElementById("video-single-form");
  const multiForm = document.getElementById("video-multi-form");

  if (mode === 'multi') {
    if (singleBtn) {
      singleBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer";
    }
    if (multiBtn) {
      multiBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-zinc-800 text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer";
    }
    if (singleForm) singleForm.classList.add("hidden");
    if (multiForm) multiForm.classList.remove("hidden");

    // 동기화: single form의 라디오 선택 상태를 multi form에도 반영
    const singleType = document.querySelector('input[name="video-form-type"]:checked')?.value || 'clip';
    const multiRadio = document.querySelector(`input[name="video-multi-type"][value="${singleType}"]`);
    if (multiRadio) multiRadio.checked = true;

    const multiTextarea = document.getElementById("video-multi-urls");
    if (multiTextarea) setTimeout(() => multiTextarea.focus(), 50);
  } else {
    if (singleBtn) {
      singleBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all bg-zinc-800 text-white shadow-sm flex items-center justify-center gap-1.5 cursor-pointer";
    }
    if (multiBtn) {
      multiBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer";
    }
    if (singleForm) singleForm.classList.remove("hidden");
    if (multiForm) multiForm.classList.add("hidden");

    const singleInput = document.getElementById("video-form-url");
    if (singleInput) setTimeout(() => singleInput.focus(), 50);
  }
}

/**
 * 여러 영상 링크 붙여넣기(Ctrl+V) 시 자동으로 줄바꿈(Enter) 추가
 */
function handleMultiUrlsPaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData;
  if (!clipboardData) return;
  const pastedText = clipboardData.getData("text");
  if (!pastedText) return;

  e.preventDefault();

  const textarea = e.target || document.getElementById("video-multi-urls");
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  // 커서 앞에 텍스트가 있고 마지막이 줄바꿈이 아니라면 줄바꿈 추가하여 새 줄에서 시작하도록 함
  const prefix = (start > 0 && val[start - 1] !== "\n") ? "\n" : "";
  let cleanText = pastedText;
  if (cleanText.includes("%")) {
    try { cleanText = decodeURIComponent(cleanText); } catch(e) {}
  }
  // 붙여넣은 텍스트 끝에 엔터(줄바꿈) 한 번 추가
  const textToInsert = prefix + cleanText.trimEnd() + "\n";

  let inserted = false;
  try {
    inserted = document.execCommand && document.execCommand("insertText", false, textToInsert);
  } catch (err) {
    inserted = false;
  }

  if (!inserted) {
    textarea.value = val.substring(0, start) + textToInsert + val.substring(end);
    const newPos = start + textToInsert.length;
    textarea.selectionStart = newPos;
    textarea.selectionEnd = newPos;
  }

  textarea.scrollTop = textarea.scrollHeight;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function openVideoModal(mode = 'add', videoId = null) {
  if (!isAdmin()) {
    alert("어드민 전용 기능입니다.");
    return;
  }
  if (!state.currentMember) return;

  editingVideoId = videoId;
  const modal = document.getElementById("video-modal");
  const modalTitle = document.getElementById("video-modal-title");
  const modalSubtitle = document.getElementById("video-modal-subtitle");
  const modeTabs = document.getElementById("video-modal-mode-tabs");
  const formId = document.getElementById("video-form-id");
  const formUrl = document.getElementById("video-form-url");
  const formTitle = document.getElementById("video-form-title");
  const formDate = document.getElementById("video-form-date");
  const formDuration = document.getElementById("video-form-duration");
  const radioClip = document.querySelector('input[name="video-form-type"][value="clip"]');
  const radioFull = document.querySelector('input[name="video-form-type"][value="full"]');
  const radioBinge = document.querySelector('input[name="video-form-type"][value="binge"]');

  if (mode === 'edit' && videoId) {
    const video = (state.currentMember.videos || []).find(v => v.id === videoId);
    if (!video) return;

    if (modeTabs) modeTabs.classList.add("hidden");
    switchVideoModalMode('single');

    modalTitle.textContent = "영상 수정";
    modalSubtitle.textContent = `${state.currentMember.streamer} (${state.currentMember.name})의 영상 수정`;
    formId.value = video.id;
    formUrl.value = video.url || "";
    formTitle.value = video.title || "";
    formDate.value = video.date || getTodayDateString();
    if (formDuration) formDuration.value = video.duration || "";
    if (isBingeVideo(video)) {
      if (radioBinge) radioBinge.checked = true;
    } else if (isFullVideo(video)) {
      if (radioFull) radioFull.checked = true;
    } else {
      if (radioClip) radioClip.checked = true;
    }
    previewVideoModalThumb(video.url, video.thumbnailUrl);
  } else {
    if (modeTabs) modeTabs.classList.remove("hidden");
    switchVideoModalMode('single');

    modalTitle.textContent = "영상 추가";
    modalSubtitle.textContent = `${state.currentMember.streamer} (${state.currentMember.name})의 새 영상 등록`;
    formId.value = "";
    formUrl.value = "";
    formTitle.value = "";
    formDate.value = getTodayDateString();
    if (formDuration) formDuration.value = "";
    if (state.currentVideoTab === 'binge') {
      if (radioBinge) radioBinge.checked = true;
    } else if (state.currentVideoTab === 'full') {
      if (radioFull) radioFull.checked = true;
    } else {
      if (radioClip) radioClip.checked = true;
    }
    previewVideoModalThumb("");

    // 다중 링크 모달 상태 초기화
    const multiTextarea = document.getElementById("video-multi-urls");
    if (multiTextarea) multiTextarea.value = "";
    loadedMultiVideos = [];
    renderMultiVideoPreviewList();
    const statusEl = document.getElementById("video-multi-fetch-status");
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.classList.add("hidden");
    }
  }

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
    lastFetchedVideoKey = null;
    lastFetchedVideoInfo = null;
    const subtextEl = document.getElementById("video-modal-thumb-subtext");
    if (subtextEl) {
      subtextEl.textContent = "";
      subtextEl.classList.add("hidden");
    }
    if (formUrl) setTimeout(() => formUrl.focus(), 50);
  }
}

function closeVideoModal() {
  const modal = document.getElementById("video-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
  editingVideoId = null;
  lastFetchedVideoKey = null;
  lastFetchedVideoInfo = null;
  loadedMultiVideos = [];
  if (videoFetchDebounceTimer) {
    clearTimeout(videoFetchDebounceTimer);
    videoFetchDebounceTimer = null;
  }
}

let videoFetchDebounceTimer = null;
let lastFetchedVideoKey = null;
let lastFetchedVideoInfo = null;

function handleVideoUrlInput(url) {
  if (url && url.includes("%")) {
    try {
      const dec = decodeURIComponent(url);
      if (dec !== url) {
        url = dec;
        const singleInput = document.getElementById("video-form-url");
        if (singleInput) singleInput.value = dec;
      }
    } catch (e) {}
  }

  // 사용자가 단일 input에 여러 줄 또는 여러 링크를 붙여넣은 경우, 다중 링크 일괄 등록 모드로 자동 전환!
  if (url && (url.includes("\n") || (url.match(/https?:\/\//g) || []).length > 1)) {
    switchVideoModalMode('multi');
    const multiTextarea = document.getElementById("video-multi-urls");
    if (multiTextarea) {
      multiTextarea.value = url;
    }
    const singleInput = document.getElementById("video-form-url");
    if (singleInput) singleInput.value = "";
    handleFetchMultiVideos();
    return;
  }

  previewVideoModalThumb(url);

  const ytId = typeof extractYoutubeId === "function" ? extractYoutubeId(url) : null;
  const chzzkNo = typeof extractChzzkVideoNo === "function" ? extractChzzkVideoNo(url) : null;
  const videoKey = ytId || chzzkNo;

  if (!videoKey) {
    lastFetchedVideoKey = null;
    return;
  }

  // 같은 ID/번호면 중복 호출 방지
  if (videoKey === lastFetchedVideoKey) return;

  clearTimeout(videoFetchDebounceTimer);
  videoFetchDebounceTimer = setTimeout(() => {
    // 신규 추가 중이거나 제목이 비어있는 경우 자동 입력
    const titleInput = document.getElementById("video-form-title");
    const isAddingNew = !editingVideoId;
    const shouldOverwrite = isAddingNew || (titleInput && !titleInput.value.trim());
    fetchAndFillVideoInfo(url, shouldOverwrite);
  }, 400);
}

async function triggerFetchYouTubeInfo() {
  const urlInput = document.getElementById("video-form-url");
  if (!urlInput || !urlInput.value.trim()) {
    showToast("영상 URL을 먼저 입력해주세요.");
    return;
  }
  await fetchAndFillVideoInfo(urlInput.value.trim(), true);
}

async function fetchAndFillVideoInfo(url, forceOverwrite = false) {
  const isChzzk = typeof isChzzkUrl === "function" && isChzzkUrl(url);
  const videoKey = isChzzk
    ? (typeof extractChzzkVideoNo === "function" ? extractChzzkVideoNo(url) : null)
    : (typeof extractYoutubeId === "function" ? extractYoutubeId(url) : null);

  if (!videoKey) return;

  const titleInput = document.getElementById("video-form-title");
  const dateInput = document.getElementById("video-form-date");
  const durationInput = document.getElementById("video-form-duration");
  const statusEl = document.getElementById("video-modal-thumb-status");
  const subtextEl = document.getElementById("video-modal-thumb-subtext");
  const thumbImg = document.getElementById("video-modal-thumb-img");
  const previewBox = document.getElementById("video-modal-thumb-preview");
  const btnText = document.getElementById("btn-fetch-youtube-text");
  const platformName = isChzzk ? "치지직" : "유튜브";

  if (btnText) btnText.textContent = "조회 중...";
  if (statusEl) {
    statusEl.textContent = `⏳ ${platformName} 영상 정보(제목, 날짜, 영상 길이) 불러오는 중...`;
    statusEl.className = "text-xs text-amber-400 font-medium";
  }

  try {
    const info = isChzzk ? await apiGetChzzkInfo(url) : await apiGetYouTubeInfo(url);

    if (info && info.success) {
      lastFetchedVideoKey = videoKey;
      lastFetchedVideoInfo = info;

      if (titleInput && info.title && (forceOverwrite || !titleInput.value.trim())) {
        titleInput.value = info.title;
      }
      if (dateInput && info.publishedDate && (forceOverwrite || !dateInput.value.trim() || dateInput.value === getTodayDateString())) {
        dateInput.value = info.publishedDate;
      }
      if (durationInput && info.duration && (forceOverwrite || !durationInput.value.trim())) {
        durationInput.value = info.duration;
      }

      // 치지직 영상인 경우 풀영상(full)으로 기본 선택 (신규 추가 시)
      if (isChzzk && !editingVideoId) {
        const fullRadio = document.querySelector('input[name="video-form-type"][value="full"]');
        if (fullRadio) fullRadio.checked = true;
      }

      // 썸네일 표시 갱신
      if (info.thumbnailUrl && thumbImg && previewBox) {
        thumbImg.src = info.thumbnailUrl;
        previewBox.classList.remove("hidden");
        previewBox.classList.add("flex");
      }

      if (statusEl) {
        const durText = info.duration ? ` · 길이: ${info.duration}` : "";
        statusEl.textContent = `✓ [${platformName}] 제목, 업로드 날짜, 영상 길이 자동 입력 완료 (${info.publishedDate || '성공'}${durText})`;
        statusEl.className = "text-xs text-emerald-400 font-medium";
      }

      if (subtextEl) {
        let sub = "";
        if (info.channelTitle) sub += `채널: ${info.channelTitle}`;
        if (info.publishedDate) sub += (sub ? " | " : "") + `업로드: ${info.publishedDate}`;
        if (info.duration) sub += (sub ? " | " : "") + `길이: ${info.duration}`;
        if (sub) {
          subtextEl.textContent = sub;
          subtextEl.classList.remove("hidden");
        }
      }
      showToast(`✓ ${platformName} 정보(제목, 날짜${info.duration ? `, 길이 ${info.duration}` : ""})를 불러왔습니다.`);
    } else {
      lastFetchedVideoKey = null;
      const failMsg = (info && info.message) || `${platformName} 영상 정보 자동 조회 실패`;
      if (statusEl) {
        statusEl.textContent = `❌ ${failMsg}`;
        statusEl.className = "text-xs text-rose-400 font-medium";
      }
      showToast(`❌ ${failMsg}`);
    }
  } catch (err) {
    console.error(`${platformName} 정보 자동 완성 실패:`, err);
    lastFetchedVideoKey = null;
    if (statusEl) {
      statusEl.textContent = `❌ ${platformName} 정보 조회 중 오류가 발생했습니다.`;
      statusEl.className = "text-xs text-rose-400 font-medium";
    }
    showToast(`❌ ${platformName} 정보 조회 중 오류가 발생했습니다.`);
  } finally {
    if (btnText) btnText.textContent = "정보 가져오기";
  }
}

// 기존 함수명 호환
async function fetchAndFillYouTubeInfo(url, forceOverwrite = false) {
  return fetchAndFillVideoInfo(url, forceOverwrite);
}

function previewVideoModalThumb(url, fallbackThumb = "") {
  const previewBox = document.getElementById("video-modal-thumb-preview");
  const thumbImg = document.getElementById("video-modal-thumb-img");
  const statusEl = document.getElementById("video-modal-thumb-status");
  const subtextEl = document.getElementById("video-modal-thumb-subtext");

  const ytId = typeof extractYoutubeId === "function" ? extractYoutubeId(url) : null;
  const chzzkNo = typeof extractChzzkVideoNo === "function" ? extractChzzkVideoNo(url) : null;

  if (ytId && previewBox && thumbImg) {
    thumbImg.src = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
    previewBox.classList.remove("hidden");
    previewBox.classList.add("flex");
    if (statusEl && !statusEl.textContent.includes("자동")) {
      statusEl.textContent = "✓ 유튜브 썸네일 인식 성공";
      statusEl.className = "text-xs text-emerald-400 font-medium";
    }
  } else if (chzzkNo && previewBox && thumbImg) {
    previewBox.classList.remove("hidden");
    previewBox.classList.add("flex");
    const thumbSrc = (lastFetchedVideoInfo && lastFetchedVideoInfo.thumbnailUrl) || fallbackThumb;
    if (thumbSrc) {
      thumbImg.src = thumbSrc;
      if (statusEl && !statusEl.textContent.includes("자동")) {
        statusEl.textContent = "✓ 치지직 썸네일 인식 성공";
        statusEl.className = "text-xs text-emerald-400 font-medium";
      }
    } else {
      thumbImg.src = "assets/default-thumbnail.svg";
      if (statusEl && !statusEl.textContent.includes("자동")) {
        statusEl.textContent = "⏳ 치지직 영상 정보 조회 중...";
        statusEl.className = "text-xs text-amber-400 font-medium";
      }
    }
  } else if (previewBox) {
    previewBox.classList.add("hidden");
    previewBox.classList.remove("flex");
    if (subtextEl) subtextEl.classList.add("hidden");
  }
}

// ==========================================
// 다중 링크 일괄 등록 (재생목록 스타일)
// ==========================================

async function handleFetchMultiVideos() {
  const textarea = document.getElementById("video-multi-urls");
  const rawText = textarea ? textarea.value.trim() : "";
  const statusEl = document.getElementById("video-multi-fetch-status");
  const btn = document.getElementById("btn-fetch-multi-videos");
  const btnText = document.getElementById("btn-fetch-multi-text");

  if (!rawText) {
    alert("영상 URL을 최소 1개 이상 입력해주세요.");
    return;
  }

  // URL 추출 (줄바꿈, 쉼표, 공백 등으로 분리)
  const matches = rawText.match(/https?:\/\/[^\s,'"<>]+/g) || [];
  // 중복 URL 제거하되 순서 보존
  const urls = Array.from(new Set(matches.map(u => u.trim())));

  if (urls.length === 0) {
    alert("올바른 영상 URL(유튜브 / 치지직)을 찾을 수 없습니다.");
    return;
  }

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = `조회 중 (0/${urls.length})...`;
  if (statusEl) {
    statusEl.textContent = `⏳ ${urls.length}개 영상 정보 불러오는 중...`;
    statusEl.className = "text-xs font-medium text-amber-400";
    statusEl.classList.remove("hidden");
  }

  const apiKey = typeof getEffectiveYouTubeApiKey === "function" 
    ? getEffectiveYouTubeApiKey() 
    : (localStorage.getItem("youtube_api_key") || "AIzaSyCaWTqIMqfGvXE8-Wg4FpYxvAW-qRWYDYA");

  // URL들을 YouTube와 Chzzk로 분류
  const items = [];
  const ytVideoIds = [];
  const ytIndexMap = new Map(); // videoId -> [indices in items]

  urls.forEach((url, idx) => {
    const isChzzk = typeof isChzzkUrl === "function" && isChzzkUrl(url);
    const ytId = !isChzzk && typeof extractYoutubeId === "function" ? extractYoutubeId(url) : null;
    const chzzkNo = isChzzk && typeof extractChzzkVideoNo === "function" ? extractChzzkVideoNo(url) : null;

    const item = {
      id: "v-multi-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4) + "-" + idx,
      url,
      isChzzk,
      videoId: ytId,
      chzzkNo,
      title: isChzzk ? "치지직 영상" : (ytId ? `유튜브 영상 (${ytId})` : url),
      date: getTodayDateString(),
      duration: "",
      thumbnailUrl: isChzzk ? "assets/default-thumbnail.svg" : (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : "assets/default-thumbnail.svg"),
      selected: true
    };
    items.push(item);

    if (ytId) {
      if (!ytIndexMap.has(ytId)) {
        ytIndexMap.set(ytId, []);
        ytVideoIds.push(ytId);
      }
      ytIndexMap.get(ytId).push(idx);
    }
  });

  // 1) YouTube 영상 일괄 배치 조회 (50개 단위)
  if (ytVideoIds.length > 0 && apiKey) {
    for (let i = 0; i < ytVideoIds.length; i += 50) {
      const chunk = ytVideoIds.slice(i, i + 50);
      try {
        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${chunk.join(",")}&key=${apiKey.trim()}`);
        if (vRes.ok) {
          const vData = await vRes.json();
          (vData.items || []).forEach(vItem => {
            const vId = vItem.id;
            const indices = ytIndexMap.get(vId) || [];
            const title = vItem.snippet?.title || "";
            const publishedDate = typeof formatIsoDateToKst === "function" ? formatIsoDateToKst(vItem.snippet?.publishedAt) : (vItem.snippet?.publishedAt ? vItem.snippet.publishedAt.substring(0, 10).replace(/-/g, ".") : "");
            const duration = typeof formatIsoDuration === "function" ? formatIsoDuration(vItem.contentDetails?.duration) : "";
            const thumb = vItem.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${vId}/mqdefault.jpg`;

            indices.forEach(idx => {
              if (title) items[idx].title = title;
              if (publishedDate) items[idx].date = publishedDate;
              if (duration) items[idx].duration = duration;
              if (thumb) items[idx].thumbnailUrl = thumb;
            });
          });
        } else {
          console.warn("[Multi Video] YouTube batch API response not OK:", vRes.status);
        }
      } catch (err) {
        console.warn("[Multi Video] YouTube batch API error:", err);
      }
    }
  }

  // 1-1) 배치 조회 실패 시 또는 정보가 누락된 YouTube 영상에 대해 개별 조회 보정 (백엔드 API 또는 oEmbed fallback)
  for (const it of items) {
    if (!it.isChzzk && it.videoId && (!it.duration || !it.title || it.title.startsWith("유튜브 영상"))) {
      try {
        const info = typeof apiGetYouTubeInfo === "function" ? await apiGetYouTubeInfo(it.url) : null;
        if (info && info.success) {
          if (info.title) it.title = info.title;
          if (info.publishedDate) it.date = info.publishedDate;
          if (info.duration) it.duration = info.duration;
          if (info.thumbnailUrl) it.thumbnailUrl = info.thumbnailUrl;
        }
      } catch (e) {
        console.warn("[Multi Video] 개별 보완 조회 실패:", e);
      }
    }
  }

  // 2) Chzzk 영상 개별 조회
  const chzzkItems = items.filter(it => it.isChzzk && it.chzzkNo);
  for (const cItem of chzzkItems) {
    try {
      const info = typeof apiGetChzzkInfo === "function" ? await apiGetChzzkInfo(cItem.url) : null;
      if (info && info.success) {
        if (info.title) cItem.title = info.title;
        if (info.publishedDate) cItem.date = info.publishedDate;
        if (info.duration) cItem.duration = info.duration;
        if (info.thumbnailUrl) cItem.thumbnailUrl = info.thumbnailUrl;
      }
    } catch (err) {
      console.warn("[Multi Video] Chzzk API error:", err);
    }
  }

  loadedMultiVideos = items;
  renderMultiVideoPreviewList();

  if (btn) btn.disabled = false;
  if (btnText) btnText.textContent = "정보 가져오기";
  if (statusEl) {
    statusEl.textContent = `✓ 총 ${items.length}개 영상 정보 불러오기 완료!`;
    statusEl.className = "text-xs font-medium text-emerald-400";
  }
  showToast(`✓ ${items.length}개 영상 정보를 불러왔습니다.`);
}

function renderMultiVideoPreviewList() {
  const container = document.getElementById("video-multi-preview-container");
  const listEl = document.getElementById("video-multi-preview-list");
  const selectedCountEl = document.getElementById("video-multi-selected-count");
  const totalCountEl = document.getElementById("video-multi-total-count");
  const submitBtn = document.getElementById("btn-submit-multi-videos");
  const selectAllCheck = document.getElementById("video-multi-select-all");

  if (!loadedMultiVideos || loadedMultiVideos.length === 0) {
    if (container) container.classList.add("hidden");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>일괄 등록하기</span>`;
    }
    return;
  }

  if (container) container.classList.remove("hidden");

  const total = loadedMultiVideos.length;
  const selectedCount = loadedMultiVideos.filter(v => v.selected !== false).length;

  if (totalCountEl) totalCountEl.textContent = String(total);
  if (selectedCountEl) selectedCountEl.textContent = String(selectedCount);
  if (selectAllCheck) selectAllCheck.checked = (total > 0 && selectedCount === total);

  if (submitBtn) {
    submitBtn.disabled = selectedCount === 0;
    submitBtn.innerHTML = `<span>총 ${selectedCount}개 영상 일괄 등록하기</span>`;
  }

  if (listEl) {
    listEl.innerHTML = loadedMultiVideos.map((v, idx) => {
      const isSelected = v.selected !== false;
      const num = idx + 1;
      const thumb = v.thumbnailUrl || (v.videoId ? `https://img.youtube.com/vi/${v.videoId}/mqdefault.jpg` : "assets/default-thumbnail.svg");

      return `
        <div class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-zinc-800/50 transition-colors group ${isSelected ? 'opacity-100' : 'opacity-40'}">
          <input 
            type="checkbox" 
            ${isSelected ? 'checked' : ''} 
            onchange="toggleMultiVideoItem(${idx}, this.checked)"
            class="rounded border-zinc-700 text-red-600 focus:ring-0 w-4 h-4 cursor-pointer flex-shrink-0"
          />
          <span class="w-6 text-center text-xs font-mono font-bold text-zinc-500 flex-shrink-0">#${num}</span>
          <img src="${thumb}" alt="" class="w-16 aspect-video rounded-lg object-cover bg-black flex-shrink-0 border border-zinc-800" />
          <div class="flex-1 min-w-0 pr-1">
            <p class="text-xs font-bold text-zinc-200 truncate group-hover:text-white transition-colors" title="${v.title}">${v.title}</p>
            <div class="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
              <span>📅 ${v.date || '날짜 미확인'}</span>
              ${v.duration ? `<span class="text-zinc-500">·</span><span class="text-zinc-300 font-mono">⏱️ ${v.duration}</span>` : ''}
              ${v.isChzzk ? `<span class="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold">치지직</span>` : ''}
            </div>
          </div>
          <button 
            type="button" 
            onclick="removeMultiVideoItem(${idx})" 
            class="w-7 h-7 rounded-lg hover:bg-red-950/60 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer text-xs" 
            title="목록에서 제거"
          >
            ✕
          </button>
        </div>
      `;
    }).join("");
  }
}

function toggleAllMultiVideos(checked) {
  loadedMultiVideos.forEach(v => { v.selected = checked; });
  renderMultiVideoPreviewList();
}

function toggleMultiVideoItem(idx, checked) {
  if (loadedMultiVideos[idx]) {
    loadedMultiVideos[idx].selected = checked;
    renderMultiVideoPreviewList();
  }
}

function removeMultiVideoItem(idx) {
  loadedMultiVideos.splice(idx, 1);
  renderMultiVideoPreviewList();
}

function reverseMultiVideos() {
  loadedMultiVideos.reverse();
  renderMultiVideoPreviewList();
}

async function submitMultiVideos() {
  if (!isAdmin()) return;
  if (!state.currentMember) return;

  const selectedVideos = loadedMultiVideos.filter(v => v.selected !== false);
  if (selectedVideos.length === 0) {
    alert("등록할 영상을 1개 이상 선택해주세요.");
    return;
  }

  const typeRadio = document.querySelector('input[name="video-multi-type"]:checked');
  const videoType = typeRadio ? typeRadio.value : "clip";
  const skipDuplicates = document.getElementById("video-multi-skip-duplicates")?.checked ?? true;

  if (!state.currentMember.videos) state.currentMember.videos = [];

  const existingUrls = new Set(
    state.currentMember.videos.map(v => (v.url || "").trim().toLowerCase()).filter(Boolean)
  );

  let addedCount = 0;
  let skippedCount = 0;

  for (const item of selectedVideos) {
    const cleanUrl = (item.url || "").trim();
    if (skipDuplicates && cleanUrl && existingUrls.has(cleanUrl.toLowerCase())) {
      skippedCount++;
      continue;
    }

    const newVideo = {
      id: "v-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5) + "-" + addedCount,
      title: item.title || "영상",
      url: item.url,
      videoType: videoType,
      date: item.date || getTodayDateString(),
      duration: item.duration || "",
      thumbnailUrl: item.thumbnailUrl || "",
      description: ""
    };

    state.currentMember.videos.push(newVideo);
    if (cleanUrl) existingUrls.add(cleanUrl.toLowerCase());
    addedCount++;
  }

  if (addedCount === 0) {
    alert("선택된 영상들이 이미 등록되어 있어 추가할 새 영상이 없습니다.");
    return;
  }

  // 추가한 순서 그대로 맨 뒤에 쌓이도록 순차적으로 displayOrder 재부여
  state.currentMember.videos.forEach((v, idx) => {
    v.displayOrder = idx;
  });

  // DB 및 로컬스토리지 동기화
  if (typeof syncAllStreamersToDb === "function") {
    await syncAllStreamersToDb(extractAllStreamersFromKongbabData());
  }
  persistData();
  updateStats();
  closeVideoModal();

  // 해당 탭으로 자동 전환하여 방금 추가된 영상들이 바로 보이도록 설정
  state.currentVideoTab = videoType;
  const container = document.getElementById("main-content");
  if (container) renderMemberVideos(container);

  let msg = `✓ ${addedCount}개 영상이 성공적으로 일괄 등록되었습니다!`;
  if (skippedCount > 0) {
    msg += ` (${skippedCount}개 중복 건너뜀)`;
  }
  showToast(msg);
  createBackupSnapshot(`영상 다중 일괄 등록: ${state.currentMember.name} (${addedCount}개)`);
}

// ==========================================
// 단일 영상 등록/수정 저장
// ==========================================

function handleSaveVideo(e) {
  if (e) e.preventDefault();
  if (!isAdmin()) return;
  if (!state.currentMember) return;

  const url = document.getElementById("video-form-url").value.trim();
  const title = document.getElementById("video-form-title").value.trim();
  const date = document.getElementById("video-form-date").value.trim() || getTodayDateString();
  const durationInput = document.getElementById("video-form-duration");
  const duration = durationInput ? durationInput.value.trim() : "";
  const formDesc = document.getElementById("video-form-desc");
  const desc = formDesc ? formDesc.value.trim() : "";
  const typeRadio = document.querySelector('input[name="video-form-type"]:checked');
  const videoType = typeRadio ? typeRadio.value : "clip";

  if (!url || !title) {
    alert("URL과 제목을 입력해주세요.");
    return;
  }

  if (!state.currentMember.videos) state.currentMember.videos = [];

  const thumbnailUrl = (lastFetchedVideoInfo && lastFetchedVideoInfo.url === url && lastFetchedVideoInfo.thumbnailUrl)
    ? lastFetchedVideoInfo.thumbnailUrl
    : (editingVideoId ? (state.currentMember.videos.find(v => v.id === editingVideoId)?.thumbnailUrl || '') : '');

  let savedVideo = null;
  if (editingVideoId) {
    const idx = state.currentMember.videos.findIndex(v => v.id === editingVideoId);
    if (idx !== -1) {
      state.currentMember.videos[idx] = {
        ...state.currentMember.videos[idx],
        url,
        title,
        videoType,
        date,
        duration,
        description: desc,
        ...(thumbnailUrl ? { thumbnailUrl } : {})
      };
      savedVideo = state.currentMember.videos[idx];
      showToast("✓ 영상이 수정되었습니다.");
      createBackupSnapshot(`영상 수정: ${state.currentMember.name} - ${title}`);
    }
  } else {
    const newVideo = {
      id: "v-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      title,
      url,
      videoType,
      date,
      duration,
      description: desc,
      displayOrder: state.currentMember.videos.length,
      ...(thumbnailUrl ? { thumbnailUrl } : {})
    };
    state.currentMember.videos.push(newVideo);
    // 추가한 순서대로 뒤에 쌓이도록 순차적으로 displayOrder 부여 (재정렬하지 않음)
    state.currentMember.videos.forEach((v, idx) => {
      v.displayOrder = idx;
    });
    savedVideo = newVideo;
    showToast("✓ 영상이 등록되었습니다.");
    createBackupSnapshot(`영상 추가: ${state.currentMember.name} - ${title}`);
  }

  // 변경된 displayOrder 전체 동기화 및 DB 저장
  if (typeof syncAllStreamersToDb === "function") {
    syncAllStreamersToDb(extractAllStreamersFromKongbabData());
  } else if (savedVideo) {
    saveVideoToDb(state.currentMember.id, savedVideo);
  }

  persistData();
  updateStats();
  closeVideoModal();

  // 방금 추가/수정한 영상 탭으로 전환하여 즉시 확인 가능하도록 처리
  state.currentVideoTab = videoType;

  const container = document.getElementById("main-content");
  if (container) renderMemberVideos(container);
}

function deleteVideo(videoId) {
  if (!isAdmin()) return;
  if (!state.currentMember?.videos) return;

  const target = state.currentMember.videos.find(v => v.id === videoId);
  const title = target ? `"${target.title}"` : "이 영상";

  if (!confirm(`${title}을(를) 삭제하시겠습니까?`)) return;

  const deletedTitle = target ? target.title : "";
  state.currentMember.videos = state.currentMember.videos.filter(v => v.id !== videoId);
  // 남은 영상들 displayOrder 재부여
  state.currentMember.videos.forEach((v, idx) => { v.displayOrder = idx; });
  deleteVideoFromDb(videoId);

  if (typeof syncAllStreamersToDb === "function") {
    syncAllStreamersToDb(extractAllStreamersFromKongbabData());
  }

  persistData();
  updateStats();
  createBackupSnapshot(`영상 삭제: ${state.currentMember.name} - ${deletedTitle}`);
  showToast("🗑️ 영상이 삭제되었습니다.");

  const container = document.getElementById("main-content");
  if (container) renderMemberVideos(container);
}

async function sortMemberVideosByDate() {
  if (!isAdmin()) return;
  if (!state.currentMember?.videos || state.currentMember.videos.length <= 1) {
    showToast("정렬할 영상이 2개 이상 필요합니다.");
    return;
  }

  if (!confirm(`"${state.currentMember.streamer}"의 모든 영상을 게시일자가 빠른 순(1번부터)으로 재정렬하시겠습니까?`)) {
    return;
  }

  sortVideosByDateAsc(state.currentMember.videos);
  persistData();

  if (typeof syncAllStreamersToDb === "function") {
    await syncAllStreamersToDb(extractAllStreamersFromKongbabData());
  }

  createBackupSnapshot(`영상 날짜순 정렬: ${state.currentMember.name}`);
  showToast("✓ 게시일자가 빠른 순서(1번부터)로 정렬되었습니다.");

  const container = document.getElementById("main-content");
  if (container) renderMemberVideos(container);
}

function confirmDeleteAllMemberVideos() {
  if (!isAdmin()) {
    alert("어드민 전용 기능입니다.");
    return;
  }
  if (!state.currentMember || !state.currentMember.videos || state.currentMember.videos.length === 0) {
    alert("삭제할 영상이 없습니다.");
    return;
  }

  const memberName = `${state.currentMember.streamer} (${state.currentMember.name})`;
  const videoCount = state.currentMember.videos.length;
  const input = prompt(`⚠️ 경고: [${memberName}]의 모든 영상(${videoCount}개)을 일괄 삭제하시겠습니까?\n\n삭제를 진행하려면 아래에 [모두삭제] 라고 정확히 입력해주세요.`);
  
  if (input === "모두삭제") {
    deleteAllMemberVideos();
  } else if (input !== null) {
    alert("입력값이 일치하지 않아 삭제가 취소되었습니다.");
  }
}

async function deleteAllMemberVideos() {
  const memberName = `${state.currentMember.streamer} (${state.currentMember.name})`;
  const videoCount = state.currentMember.videos.length;

  state.currentMember.videos = [];
  persistData();
  updateStats();

  if (typeof syncAllStreamersToDb === "function") {
    await syncAllStreamersToDb(extractAllStreamersFromKongbabData());
  }

  createBackupSnapshot(`영상 전체 삭제: ${memberName} (${videoCount}개 삭제)`);
  showToast(`🗑️ ${memberName}의 모든 영상이 삭제되었습니다.`);

  const container = document.getElementById("main-content");
  if (container) renderMemberVideos(container);
}

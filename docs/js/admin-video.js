// ==========================================
// 관리자 - 영상 관리 모듈 (Admin Video Management)
// ==========================================

let editingVideoId = null;

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
  if (videoFetchDebounceTimer) {
    clearTimeout(videoFetchDebounceTimer);
    videoFetchDebounceTimer = null;
  }
}

let videoFetchDebounceTimer = null;
let lastFetchedVideoKey = null;
let lastFetchedVideoInfo = null;

function handleVideoUrlInput(url) {
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

  const btnText = document.getElementById("btn-fetch-youtube-text");
  const statusEl = document.getElementById("video-modal-thumb-status");
  const subtextEl = document.getElementById("video-modal-thumb-subtext");
  const titleInput = document.getElementById("video-form-title");
  const dateInput = document.getElementById("video-form-date");
  const durationInput = document.getElementById("video-form-duration");
  const thumbImg = document.getElementById("video-modal-thumb-img");
  const previewBox = document.getElementById("video-modal-thumb-preview");

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
      // 수정된 날짜에 맞춰 정렬 유지
      sortVideosByDateAsc(state.currentMember.videos);
      savedVideo = state.currentMember.videos.find(v => v.id === editingVideoId);
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
      ...(thumbnailUrl ? { thumbnailUrl } : {})
    };
    state.currentMember.videos.push(newVideo);
    // 기본 정렬: 게시일자 빠른 순(오름차순) -> 1번이 가장 빠른 날짜
    sortVideosByDateAsc(state.currentMember.videos);
    savedVideo = newVideo;
    showToast("✓ 영상이 등록되었습니다. (게시일자 빠른 순 정렬)");
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

function openLoginModal() {
  const modal = document.getElementById("login-modal");
  const err = document.getElementById("login-error");
  if (err) err.classList.add("hidden");
  const userInput = document.getElementById("login-username");
  const passInput = document.getElementById("login-password");
  if (userInput) userInput.value = "";
  if (passInput) passInput.value = "";

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
    if (userInput) setTimeout(() => userInput.focus(), 50);
  }
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
}

async function handleAdminLogin(e) {
  if (e) e.preventDefault();
  const username = document.getElementById("login-username")?.value.trim() || "";
  const password = document.getElementById("login-password")?.value || "";
  const err = document.getElementById("login-error");

  if (!username || !password) {
    if (err) {
      err.textContent = "아이디와 비밀번호를 모두 입력해주세요.";
      err.classList.remove("hidden");
    }
    return;
  }

  const res = await apiLogin(username, password);
  if (res && res.success) {
    const expireDuration = (res.expiresInSeconds || 3600) * 1000;
    const expireAt = Date.now() + expireDuration;

    state.currentUser = { role: res.role || "admin", username: res.username || "admin" };
    localStorage.setItem("kongbab_auth_user", JSON.stringify(state.currentUser));
    localStorage.setItem("kongbab_auth_expire_at", String(expireAt));

    closeLoginModal();
    renderHeaderAuth();
    renderContent();
    showToast("🛡️ 어드민 로그인 완료 (1시간 동안 로그인 유지)");
  } else if (err) {
    err.textContent = res?.message || "아이디 또는 비밀번호가 일치하지 않습니다.";
    err.classList.remove("hidden");
  }
}

async function handleGuestLogin() {
  state.currentUser = { role: "guest", username: "게스트" };
  localStorage.setItem("kongbab_auth_user", JSON.stringify(state.currentUser));
  localStorage.removeItem("kongbab_auth_expire_at");
  await apiLogout();
  closeLoginModal();
  renderHeaderAuth();
  renderContent();
  showToast("👤 게스트 모드로 계속합니다.");
}

async function logoutUser() {
  await apiLogout();
  state.currentUser = { role: "guest", username: "게스트" };
  localStorage.setItem("kongbab_auth_user", JSON.stringify(state.currentUser));
  localStorage.removeItem("kongbab_auth_expire_at");
  renderHeaderAuth();
  renderContent();
  showToast("로그아웃되었습니다.");
}

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
    previewVideoModalThumb(video.url);
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
    lastFetchedYoutubeId = null;
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
  lastFetchedYoutubeId = null;
  if (youtubeFetchDebounceTimer) {
    clearTimeout(youtubeFetchDebounceTimer);
    youtubeFetchDebounceTimer = null;
  }
}

let youtubeFetchDebounceTimer = null;
let lastFetchedYoutubeId = null;

function handleVideoUrlInput(url) {
  previewVideoModalThumb(url);

  const videoId = extractYoutubeId(url);
  if (!videoId) {
    lastFetchedYoutubeId = null;
    return;
  }

  // 같은 ID면 중복 호출 방지
  if (videoId === lastFetchedYoutubeId) return;

  clearTimeout(youtubeFetchDebounceTimer);
  youtubeFetchDebounceTimer = setTimeout(() => {
    // 신규 추가 중이거나 제목이 비어있는 경우 자동 입력
    const titleInput = document.getElementById("video-form-title");
    const isAddingNew = !editingVideoId;
    const shouldOverwrite = isAddingNew || (titleInput && !titleInput.value.trim());
    fetchAndFillYouTubeInfo(url, shouldOverwrite);
  }, 400);
}

async function triggerFetchYouTubeInfo() {
  const urlInput = document.getElementById("video-form-url");
  if (!urlInput || !urlInput.value.trim()) {
    showToast("유튜브 URL을 먼저 입력해주세요.");
    return;
  }
  await fetchAndFillYouTubeInfo(urlInput.value.trim(), true);
}

async function fetchAndFillYouTubeInfo(url, forceOverwrite = false) {
  const videoId = extractYoutubeId(url);
  if (!videoId) return;

  const btnText = document.getElementById("btn-fetch-youtube-text");
  const statusEl = document.getElementById("video-modal-thumb-status");
  const subtextEl = document.getElementById("video-modal-thumb-subtext");
  const titleInput = document.getElementById("video-form-title");
  const dateInput = document.getElementById("video-form-date");
  const durationInput = document.getElementById("video-form-duration");

  if (btnText) btnText.textContent = "조회 중...";
  if (statusEl) {
    statusEl.textContent = "⏳ 유튜브 영상 정보(제목, 날짜, 영상 길이) 불러오는 중...";
    statusEl.className = "text-xs text-amber-400 font-medium";
  }

  try {
    const info = await apiGetYouTubeInfo(url);

    if (info && info.success) {
      lastFetchedYoutubeId = videoId;

      if (titleInput && info.title && (forceOverwrite || !titleInput.value.trim())) {
        titleInput.value = info.title;
      }
      if (dateInput && info.publishedDate && (forceOverwrite || !dateInput.value.trim() || dateInput.value === getTodayDateString())) {
        dateInput.value = info.publishedDate;
      }
      if (durationInput && info.duration && (forceOverwrite || !durationInput.value.trim())) {
        durationInput.value = info.duration;
      }

      if (statusEl) {
        const durText = info.duration ? ` · 길이: ${info.duration}` : "";
        statusEl.textContent = `✓ 제목, 업로드 날짜, 영상 길이 자동 입력 완료 (${info.publishedDate || '성공'}${durText})`;
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
      showToast(`✓ 유튜브 정보(제목, 날짜${info.duration ? `, 길이 ${info.duration}` : ""})를 불러왔습니다.`);
    } else {
      lastFetchedYoutubeId = null;
      if (statusEl) {
        statusEl.textContent = "✓ 썸네일 인식 완료 (영상 정보 자동 조회 실패)";
        statusEl.className = "text-xs text-zinc-400 font-medium";
      }
    }
  } catch (err) {
    console.error("유튜브 정보 자동 완성 실패:", err);
    lastFetchedYoutubeId = null;
    if (statusEl) {
      statusEl.textContent = "✓ 썸네일 인식 완료";
      statusEl.className = "text-xs text-zinc-400 font-medium";
    }
  } finally {
    if (btnText) btnText.textContent = "정보 가져오기";
  }
}

function previewVideoModalThumb(url) {
  const previewBox = document.getElementById("video-modal-thumb-preview");
  const thumbImg = document.getElementById("video-modal-thumb-img");
  const statusEl = document.getElementById("video-modal-thumb-status");
  const subtextEl = document.getElementById("video-modal-thumb-subtext");
  const videoId = extractYoutubeId(url);

  if (videoId && previewBox && thumbImg) {
    thumbImg.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    previewBox.classList.remove("hidden");
    previewBox.classList.add("flex");
    if (statusEl && !statusEl.textContent.includes("자동")) {
      statusEl.textContent = "✓ 유튜브 썸네일 인식 성공";
      statusEl.className = "text-xs text-emerald-400 font-medium";
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
        description: desc
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
      description: desc
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


let editingMemberId = null;

function findMemberLocation(memberId) {
  for (const cat of KONGBAB_DATA.categories) {
    if (!cat.hasSubgroups) {
      const found = (cat.members || []).find(m => m.id === memberId);
      if (found) return { category: cat, group: null, member: found };
    } else {
      for (const g of (cat.groups || [])) {
        const found = (g.members || []).find(m => m.id === memberId);
        if (found) return { category: cat, group: g, member: found };
      }
    }
  }
  return null;
}

function findAllMemberLocations(memberId) {
  const locs = [];
  for (const cat of KONGBAB_DATA.categories) {
    if (!cat.hasSubgroups) {
      const found = (cat.members || []).find(m => m.id === memberId);
      if (found) locs.push({ category: cat, group: null, member: found });
    } else {
      for (const g of (cat.groups || [])) {
        const found = (g.members || []).find(m => m.id === memberId);
        if (found) locs.push({ category: cat, group: g, member: found });
      }
    }
  }
  return locs;
}

function setupAffiliationPanels() {
  const gangCat = KONGBAB_DATA.categories.find(c => c.id === "gang");
  const bizCat = KONGBAB_DATA.categories.find(c => c.id === "business");

  const gangContainer = document.getElementById("aff-gang-chips");
  if (gangContainer && gangCat?.groups) {
    gangContainer.innerHTML = gangCat.groups.map(g => `
      <label class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-red-900/60 bg-red-950/40 hover:border-red-500/60 cursor-pointer text-xs select-none truncate" title="${g.name}">
        <input type="checkbox" name="aff-gang-group" value="${g.id}" onchange="updateSelectedAffiliationCount()" class="rounded border-red-800 text-red-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer flex-shrink-0">
        <span class="truncate text-red-200 text-[11px] font-medium">${g.emoji || ''} ${g.name}</span>
      </label>
    `).join("");
  }

  const bizContainer = document.getElementById("aff-business-chips");
  if (bizContainer && bizCat?.groups) {
    bizContainer.innerHTML = bizCat.groups.map(g => `
      <label class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-amber-900/60 bg-amber-950/40 hover:border-amber-500/60 cursor-pointer text-xs select-none truncate" title="${g.name}">
        <input type="checkbox" name="aff-business-group" value="${g.id}" onchange="updateSelectedAffiliationCount()" class="rounded border-amber-800 text-amber-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer flex-shrink-0">
        <span class="truncate text-amber-200 text-[11px] font-medium">${g.emoji || ''} ${g.name}</span>
      </label>
    `).join("");
  }
}

function handleAffiliationCheckboxChange() {
  const gangChecked = document.getElementById("aff-check-gang")?.checked;
  const bizChecked = document.getElementById("aff-check-business")?.checked;

  const gangPanel = document.getElementById("aff-gang-panel");
  if (gangPanel) {
    if (gangChecked) {
      gangPanel.classList.remove("hidden");
      const gangInputs = document.querySelectorAll('input[name="aff-gang-group"]');
      const anyChecked = Array.from(gangInputs).some(i => i.checked);
      if (!anyChecked && gangInputs.length > 0) {
        gangInputs[0].checked = true;
      }
    } else {
      gangPanel.classList.add("hidden");
    }
  }

  const bizPanel = document.getElementById("aff-business-panel");
  if (bizPanel) {
    if (bizChecked) {
      bizPanel.classList.remove("hidden");
      const bizInputs = document.querySelectorAll('input[name="aff-business-group"]');
      const anyChecked = Array.from(bizInputs).some(i => i.checked);
      if (!anyChecked && bizInputs.length > 0) {
        bizInputs[0].checked = true;
      }
    } else {
      bizPanel.classList.add("hidden");
    }
  }

  updateSelectedAffiliationCount();
}

function getSelectedAffiliations() {
  const affs = [];
  const directCats = ["police", "ems", "press", "citizen"];
  directCats.forEach(catId => {
    const chk = document.getElementById(`aff-check-${catId}`);
    if (chk && chk.checked) {
      affs.push({ category: catId, subgroup: null });
    }
  });

  const gangChk = document.getElementById("aff-check-gang");
  if (gangChk && gangChk.checked) {
    const gangInputs = document.querySelectorAll('input[name="aff-gang-group"]:checked');
    if (gangInputs.length > 0) {
      gangInputs.forEach(input => {
        affs.push({ category: "gang", subgroup: input.value });
      });
    } else {
      const gangCat = KONGBAB_DATA.categories.find(c => c.id === "gang");
      const firstGroup = gangCat?.groups?.[0]?.id || "gang-nonghyup";
      affs.push({ category: "gang", subgroup: firstGroup });
    }
  }

  const bizChk = document.getElementById("aff-check-business");
  if (bizChk && bizChk.checked) {
    const bizInputs = document.querySelectorAll('input[name="aff-business-group"]:checked');
    if (bizInputs.length > 0) {
      bizInputs.forEach(input => {
        affs.push({ category: "business", subgroup: input.value });
      });
    } else {
      const bizCat = KONGBAB_DATA.categories.find(c => c.id === "business");
      const firstGroup = bizCat?.groups?.[0]?.id || "biz-yastation";
      affs.push({ category: "business", subgroup: firstGroup });
    }
  }

  return affs;
}

function updateSelectedAffiliationCount() {
  const affs = getSelectedAffiliations();
  const summaryEl = document.getElementById("member-form-selected-summary");
  if (!summaryEl) return;

  if (affs.length === 0) {
    summaryEl.textContent = "선택됨: 없음 (최소 1개 선택 필요)";
    summaryEl.className = "text-[11px] text-red-400 font-semibold truncate max-w-[220px] text-right";
    return;
  }

  const names = affs.map(a => {
    const cat = KONGBAB_DATA.categories.find(c => c.id === a.category);
    if (a.subgroup && cat?.groups) {
      const g = cat.groups.find(group => group.id === a.subgroup);
      return `${cat.emoji || ''} ${g ? g.name : cat.name}`;
    }
    return `${cat?.emoji || ''} ${cat?.name || a.category}`;
  });

  summaryEl.textContent = `선택됨(${affs.length}): ${names.join(", ")}`;
  summaryEl.className = "text-[11px] text-emerald-400 font-semibold truncate max-w-[220px] text-right";
}

function openMemberModal(mode = 'add', memberId = null, prefillCatId = null, prefillGroupId = null) {
  if (!isAdmin()) {
    alert("어드민 전용 기능입니다.");
    return;
  }

  editingMemberId = memberId;
  setupAffiliationPanels();

  const modal = document.getElementById("member-modal");
  const modalTitle = document.getElementById("member-modal-title");
  const modalSubtitle = document.getElementById("member-modal-subtitle");
  const formId = document.getElementById("member-form-id");
  const formName = document.getElementById("member-form-name");
  const formStreamer = document.getElementById("member-form-streamer");
  const formRole = document.getElementById("member-form-role");
  const formBadge = document.getElementById("member-form-badge");
  const formAvatar = document.getElementById("member-form-avatar");

  // 모든 소속 체크박스 초기화
  document.querySelectorAll('input[name="member-aff-category"], input[name="aff-gang-group"], input[name="aff-business-group"]').forEach(chk => {
    chk.checked = false;
  });
  ["aff-check-police", "aff-check-ems", "aff-check-press", "aff-check-citizen", "aff-check-gang", "aff-check-business"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  if (mode === 'edit' && memberId) {
    const allLocs = findAllMemberLocations(memberId);
    if (!allLocs || allLocs.length === 0) {
      alert("인원 정보를 찾을 수 없습니다.");
      return;
    }
    const primaryMember = allLocs[0].member;

    modalTitle.textContent = "인원 정보 수정";
    modalSubtitle.textContent = `${primaryMember.streamer} (${primaryMember.name}) - 소속 겸직 관리`;
    formId.value = primaryMember.id;
    formName.value = primaryMember.name || "";
    formStreamer.value = primaryMember.streamer || "";
    formRole.value = primaryMember.role || "";
    formBadge.value = primaryMember.badgeColor || "bg-blue-600";
    formAvatar.value = primaryMember.avatar || "";
    previewMemberAvatar(primaryMember.avatar);

    // 기존 소속 체크박스 복원
    allLocs.forEach(loc => {
      const catCheck = document.getElementById(`aff-check-${loc.category.id}`);
      if (catCheck) catCheck.checked = true;
      if (loc.category.id === "gang" && loc.group) {
        const gangInput = document.querySelector(`input[name="aff-gang-group"][value="${loc.group.id}"]`);
        if (gangInput) gangInput.checked = true;
      }
      if (loc.category.id === "business" && loc.group) {
        const bizInput = document.querySelector(`input[name="aff-business-group"][value="${loc.group.id}"]`);
        if (bizInput) bizInput.checked = true;
      }
    });

    if (Array.isArray(primaryMember.affiliations)) {
      primaryMember.affiliations.forEach(aff => {
        const catCheck = document.getElementById(`aff-check-${aff.category}`);
        if (catCheck) catCheck.checked = true;
        if (aff.category === "gang" && aff.subgroup) {
          const gangInput = document.querySelector(`input[name="aff-gang-group"][value="${aff.subgroup}"]`);
          if (gangInput) gangInput.checked = true;
        }
        if (aff.category === "business" && aff.subgroup) {
          const bizInput = document.querySelector(`input[name="aff-business-group"][value="${aff.subgroup}"]`);
          if (bizInput) bizInput.checked = true;
        }
      });
    }

    handleAffiliationCheckboxChange();
  } else {
    modalTitle.textContent = "새 인원 추가";
    modalSubtitle.textContent = "새 인원 등록 (다중 소속/겸직 가능)";
    formId.value = "";
    formName.value = "";
    formStreamer.value = "";
    formRole.value = "";
    formAvatar.value = "";
    previewMemberAvatar("");

    const targetCatId = prefillCatId || state.currentCategory || "police";
    const catCheck = document.getElementById(`aff-check-${targetCatId}`);
    if (catCheck) catCheck.checked = true;

    const targetGroupId = prefillGroupId || state.currentGroup?.id;
    if (targetCatId === "gang" && targetGroupId) {
      const gangInput = document.querySelector(`input[name="aff-gang-group"][value="${targetGroupId}"]`);
      if (gangInput) gangInput.checked = true;
    }
    if (targetCatId === "business" && targetGroupId) {
      const bizInput = document.querySelector(`input[name="aff-business-group"][value="${targetGroupId}"]`);
      if (bizInput) bizInput.checked = true;
    }

    const defaultBadges = {
      police: "bg-blue-600",
      ems: "bg-teal-600",
      gang: "bg-red-600",
      business: "bg-amber-600",
      press: "bg-sky-600",
      citizen: "bg-purple-600"
    };
    formBadge.value = defaultBadges[targetCatId] || "bg-blue-600";

    handleAffiliationCheckboxChange();
  }

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
    if (formName) setTimeout(() => formName.focus(), 50);
  }
}

function closeMemberModal() {
  const modal = document.getElementById("member-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
  editingMemberId = null;
}

function previewMemberAvatar(url) {
  const preview = document.getElementById("member-form-avatar-preview");
  if (preview) preview.src = getMemberAvatar(url);
}

function handleSaveMember(e) {
  if (e) e.preventDefault();
  if (!isAdmin()) return;

  const name = document.getElementById("member-form-name").value.trim();
  const streamer = document.getElementById("member-form-streamer").value.trim();
  const role = document.getElementById("member-form-role").value.trim();
  const badgeColor = document.getElementById("member-form-badge").value;
  let avatar = document.getElementById("member-form-avatar").value.trim();

  if (!name || !streamer) {
    alert("이름과 스트리머명을 모두 입력해주세요.");
    return;
  }

  const selectedAffiliations = getSelectedAffiliations();
  if (selectedAffiliations.length === 0) {
    alert("소속을 최소 하나 이상 선택해주세요 (경찰, EMS, 갱단 등).");
    return;
  }

  if (!avatar || avatar.includes("images.unsplash.com")) {
    avatar = DEFAULT_AVATAR;
  }

  const primaryAff = selectedAffiliations[0];

  if (editingMemberId) {
    const allLocs = findAllMemberLocations(editingMemberId);
    if (allLocs.length === 0) {
      alert("수정할 인원 정보를 찾을 수 없습니다.");
      return;
    }

    const memberObj = allLocs[0].member;
    memberObj.name = name;
    memberObj.streamer = streamer;
    memberObj.role = role;
    memberObj.badgeColor = badgeColor;
    memberObj.avatar = avatar;
    memberObj.affiliations = selectedAffiliations;

    // 1) 이전 소속 중 선택 해제된 곳에서 제거
    allLocs.forEach(loc => {
      const stillBelongs = selectedAffiliations.some(aff => {
        if (loc.category.hasSubgroups) {
          return aff.category === loc.category.id && aff.subgroup === loc.group?.id;
        } else {
          return aff.category === loc.category.id;
        }
      });

      if (!stillBelongs) {
        if (loc.category.hasSubgroups && loc.group) {
          loc.group.members = loc.group.members.filter(m => m.id !== memberObj.id);
        } else {
          loc.category.members = loc.category.members.filter(m => m.id !== memberObj.id);
        }
      }
    });

    // 2) 새로 선택된 소속에 아직 포함되지 않았으면 추가
    selectedAffiliations.forEach(aff => {
      const cat = KONGBAB_DATA.categories.find(c => c.id === aff.category);
      if (!cat) return;

      if (cat.hasSubgroups) {
        const group = (cat.groups || []).find(g => g.id === aff.subgroup) || cat.groups[0];
        if (group) {
          if (!group.members) group.members = [];
          if (!group.members.some(m => m.id === memberObj.id)) {
            group.members.push(memberObj);
          }
        }
      } else {
        if (!cat.members) cat.members = [];
        if (!cat.members.some(m => m.id === memberObj.id)) {
          cat.members.push(memberObj);
        }
      }
    });

    saveStreamerToDb({
      id: memberObj.id,
      name,
      streamer,
      role,
      category: primaryAff.category,
      subgroup: primaryAff.subgroup,
      affiliations: JSON.stringify(selectedAffiliations),
      badgeColor,
      avatar,
      displayOrder: memberObj.displayOrder ?? 0
    });

    persistData();
    updateStats();
    createBackupSnapshot(`인원 수정: ${name} (${streamer}) - 소속 ${selectedAffiliations.length}개`);
    showToast(`✓ ${name} (${streamer}) 정보 수정 완료 (${selectedAffiliations.length}개 소속)`);
  } else {
    const newMember = {
      id: "m-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      name,
      streamer,
      role,
      badgeColor,
      avatar,
      displayOrder: 0,
      affiliations: selectedAffiliations,
      videos: []
    };

    // 선택된 모든 소속에 새 멤버 추가
    selectedAffiliations.forEach(aff => {
      const cat = KONGBAB_DATA.categories.find(c => c.id === aff.category);
      if (!cat) return;

      if (cat.hasSubgroups) {
        const group = (cat.groups || []).find(g => g.id === aff.subgroup) || cat.groups[0];
        if (group) {
          if (!group.members) group.members = [];
          group.members.push(newMember);
        }
      } else {
        if (!cat.members) cat.members = [];
        cat.members.push(newMember);
      }
    });

    saveStreamerToDb({
      id: newMember.id,
      name,
      streamer,
      role,
      category: primaryAff.category,
      subgroup: primaryAff.subgroup,
      affiliations: JSON.stringify(selectedAffiliations),
      badgeColor,
      avatar,
      displayOrder: 0
    });

    persistData();
    updateStats();
    createBackupSnapshot(`인원 추가: ${name} (${streamer}) - 소속 ${selectedAffiliations.length}개`);
    showToast(`✓ 새 인원 '${name} (${streamer})' 등록 완료 (${selectedAffiliations.length}개 소속)`);
  }

  closeMemberModal();
  renderContent();
}

let pendingDeleteMemberId = null;

function deleteMember(memberId) {
  if (!isAdmin()) return;

  const allLocs = findAllMemberLocations(memberId);
  if (allLocs.length === 0) return;

  pendingDeleteMemberId = memberId;
  const targetName = `${allLocs[0].member.name} (${allLocs[0].member.streamer})`;

  const modal = document.getElementById("delete-member-modal");
  const targetNameEl = document.getElementById("delete-member-target-name");
  const passInput = document.getElementById("delete-member-password-input");
  const errorMsg = document.getElementById("delete-member-error-msg");

  if (modal) {
    if (targetNameEl) targetNameEl.textContent = `대상: ${targetName}`;
    if (passInput) {
      passInput.value = "";
      setTimeout(() => passInput.focus(), 50);
    }
    if (errorMsg) {
      errorMsg.textContent = "";
      errorMsg.classList.add("hidden");
    }
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
  } else {
    // Modal 없을 경우 fallback: prompt
    const inputPw = prompt(`⚠️ [인원 영구 삭제]\n'${targetName}' 인원을 삭제하시겠습니까?\n\n삭제를 진행하려면 비밀번호를 입력해주세요:`);
    if (inputPw === null) return;
    if (inputPw.trim() !== "kongbab1234") {
      alert("❌ 비밀번호가 올바르지 않습니다.");
      return;
    }
    executeDeleteMember(memberId, inputPw.trim());
  }
}

function closeDeleteMemberModal() {
  const modal = document.getElementById("delete-member-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
  pendingDeleteMemberId = null;
}

function handleConfirmDeleteMember(e) {
  if (e) e.preventDefault();
  if (!pendingDeleteMemberId) return;

  const passInput = document.getElementById("delete-member-password-input");
  const errorMsg = document.getElementById("delete-member-error-msg");
  const inputPw = passInput ? passInput.value.trim() : "";

  if (!inputPw) {
    if (errorMsg) {
      errorMsg.textContent = "비밀번호를 입력해주세요.";
      errorMsg.classList.remove("hidden");
    }
    return;
  }

  if (inputPw !== "kongbab1234") {
    if (errorMsg) {
      errorMsg.textContent = "❌ 비밀번호가 올바르지 않습니다.";
      errorMsg.classList.remove("hidden");
    }
    if (passInput) {
      passInput.focus();
      passInput.select();
    }
    return;
  }

  const memberIdToDelete = pendingDeleteMemberId;
  closeDeleteMemberModal();
  executeDeleteMember(memberIdToDelete, inputPw);
}

function executeDeleteMember(memberId, password = "kongbab1234") {
  const allLocs = findAllMemberLocations(memberId);
  if (allLocs.length === 0) return;

  const targetName = `${allLocs[0].member.name} (${allLocs[0].member.streamer})`;

  allLocs.forEach(loc => {
    if (!loc.category.hasSubgroups) {
      loc.category.members = loc.category.members.filter(m => m.id !== memberId);
    } else if (loc.group) {
      loc.group.members = loc.group.members.filter(m => m.id !== memberId);
    }
  });

  if (state.currentMember?.id === memberId) state.currentMember = null;

  deleteStreamerFromDb(memberId, password);

  persistData();
  updateStats();
  createBackupSnapshot(`인원 삭제: ${targetName}`);
  renderContent();
  showToast(`🗑️ '${targetName}' 인원이 삭제되었습니다.`);
}

// ==========================================
// 유튜브 재생목록 일괄 등록 관리
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



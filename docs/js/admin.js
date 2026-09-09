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
    if (isFullVideo(video)) {
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
    if (state.currentVideoTab === 'full') {
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

function deleteMember(memberId) {
  if (!isAdmin()) return;

  const allLocs = findAllMemberLocations(memberId);
  if (allLocs.length === 0) return;

  const targetName = `${allLocs[0].member.name} (${allLocs[0].member.streamer})`;
  if (!confirm(`'${targetName}' 인원을 전체 소속에서 삭제하시겠습니까?`)) return;

  allLocs.forEach(loc => {
    if (!loc.category.hasSubgroups) {
      loc.category.members = loc.category.members.filter(m => m.id !== memberId);
    } else if (loc.group) {
      loc.group.members = loc.group.members.filter(m => m.id !== memberId);
    }
  });

  if (state.currentMember?.id === memberId) state.currentMember = null;

  deleteStreamerFromDb(memberId);

  persistData();
  updateStats();
  createBackupSnapshot(`인원 삭제: ${targetName}`);
  renderContent();
  showToast(`🗑️ '${targetName}' 삭제 완료`);
}

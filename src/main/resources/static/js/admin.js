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
  const formDesc = document.getElementById("video-form-desc");
  const radioClip = document.querySelector('input[name="video-form-type"][value="clip"]');
  const radioFull = document.querySelector('input[name="video-form-type"][value="full"]');

  if (mode === 'edit' && videoId) {
    const video = (state.currentMember.videos || []).find(v => v.id === videoId);
    if (!video) return;

    modalTitle.textContent = "영상 수정";
    modalSubtitle.textContent = `${state.currentMember.name}의 영상 수정`;
    formId.value = video.id;
    formUrl.value = video.url || "";
    formTitle.value = video.title || "";
    formDate.value = video.date || getTodayDateString();
    formDesc.value = video.description || "";
    if (isFullVideo(video)) {
      if (radioFull) radioFull.checked = true;
    } else {
      if (radioClip) radioClip.checked = true;
    }
    previewVideoModalThumb(video.url);
  } else {
    modalTitle.textContent = "영상 추가";
    modalSubtitle.textContent = `${state.currentMember.name}의 새 영상 등록`;
    formId.value = "";
    formUrl.value = "";
    formTitle.value = "";
    formDate.value = getTodayDateString();
    formDesc.value = "";
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
}

function previewVideoModalThumb(url) {
  const previewBox = document.getElementById("video-modal-thumb-preview");
  const thumbImg = document.getElementById("video-modal-thumb-img");
  const videoId = extractYoutubeId(url);

  if (videoId && previewBox && thumbImg) {
    thumbImg.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    previewBox.classList.remove("hidden");
    previewBox.classList.add("flex");
  } else if (previewBox) {
    previewBox.classList.add("hidden");
    previewBox.classList.remove("flex");
  }
}

function handleSaveVideo(e) {
  if (e) e.preventDefault();
  if (!isAdmin()) return;
  if (!state.currentMember) return;

  const url = document.getElementById("video-form-url").value.trim();
  const title = document.getElementById("video-form-title").value.trim();
  const date = document.getElementById("video-form-date").value.trim() || getTodayDateString();
  const desc = document.getElementById("video-form-desc").value.trim();
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
        description: desc
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
      description: desc
    };
    state.currentMember.videos.unshift(newVideo);
    savedVideo = newVideo;
    showToast("✓ 영상이 등록되었습니다.");
    createBackupSnapshot(`영상 추가: ${state.currentMember.name} - ${title}`);
  }

  if (savedVideo) {
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
  deleteVideoFromDb(videoId);

  persistData();
  updateStats();
  createBackupSnapshot(`영상 삭제: ${state.currentMember.name} - ${deletedTitle}`);
  showToast("🗑️ 영상이 삭제되었습니다.");

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

function openMemberModal(mode = 'add', memberId = null, prefillCatId = null, prefillGroupId = null) {
  if (!isAdmin()) {
    alert("어드민 전용 기능입니다.");
    return;
  }

  editingMemberId = memberId;
  const modal = document.getElementById("member-modal");
  const modalTitle = document.getElementById("member-modal-title");
  const modalSubtitle = document.getElementById("member-modal-subtitle");
  const formId = document.getElementById("member-form-id");
  const formCat = document.getElementById("member-form-category");
  const formGroup = document.getElementById("member-form-group");
  const formName = document.getElementById("member-form-name");
  const formStreamer = document.getElementById("member-form-streamer");
  const formRole = document.getElementById("member-form-role");
  const formBadge = document.getElementById("member-form-badge");
  const formAvatar = document.getElementById("member-form-avatar");

  if (mode === 'edit' && memberId) {
    const loc = findMemberLocation(memberId);
    if (!loc) {
      alert("인원 정보를 찾을 수 없습니다.");
      return;
    }
    modalTitle.textContent = "인원 정보 수정";
    modalSubtitle.textContent = `${loc.member.name} (${loc.member.streamer}) 수정`;
    formId.value = loc.member.id;
    formCat.value = loc.category.id;
    handleMemberCategoryChange(loc.category.id);
    if (loc.group && formGroup) formGroup.value = loc.group.id;
    formName.value = loc.member.name || "";
    formStreamer.value = loc.member.streamer || "";
    formRole.value = loc.member.role || "";
    formBadge.value = loc.member.badgeColor || "bg-blue-600";
    formAvatar.value = loc.member.avatar || "";
    previewMemberAvatar(loc.member.avatar);
  } else {
    modalTitle.textContent = "새 인원 추가";
    modalSubtitle.textContent = "새 인원 등록";
    formId.value = "";
    
    const targetCatId = prefillCatId || state.currentCategory || "police";
    formCat.value = targetCatId;
    handleMemberCategoryChange(targetCatId);

    const targetGroupId = prefillGroupId || state.currentGroup?.id;
    if (targetGroupId && formGroup) formGroup.value = targetGroupId;

    formName.value = "";
    formStreamer.value = "";
    formRole.value = "";
    
    const defaultBadges = {
      police: "bg-blue-600",
      ems: "bg-teal-600",
      gang: "bg-red-600",
      business: "bg-amber-600",
      press: "bg-sky-600",
      citizen: "bg-purple-600"
    };
    formBadge.value = defaultBadges[targetCatId] || "bg-blue-600";
    formAvatar.value = "";
    previewMemberAvatar("");
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

function handleMemberCategoryChange(catId) {
  const groupContainer = document.getElementById("member-form-group-container");
  const groupSelect = document.getElementById("member-form-group");
  if (!groupContainer || !groupSelect) return;

  const cat = KONGBAB_DATA.categories.find(c => c.id === catId);
  if (cat?.hasSubgroups && Array.isArray(cat.groups) && cat.groups.length > 0) {
    groupContainer.classList.remove("hidden");
    groupSelect.innerHTML = cat.groups.map(g => `<option value="${g.id}">${g.emoji || ''} ${g.name}</option>`).join("");
  } else {
    groupContainer.classList.add("hidden");
    groupSelect.innerHTML = "";
  }
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
  const catId = document.getElementById("member-form-category").value;
  const groupSelect = document.getElementById("member-form-group");
  const groupId = groupSelect ? groupSelect.value : null;
  const badgeColor = document.getElementById("member-form-badge").value;
  let avatar = document.getElementById("member-form-avatar").value.trim();

  if (!name || !streamer) {
    alert("이름과 스트리머명을 모두 입력해주세요.");
    return;
  }

  if (!avatar || avatar.includes("images.unsplash.com")) {
    avatar = DEFAULT_AVATAR;
  }

  const cat = KONGBAB_DATA.categories.find(c => c.id === catId);
  if (!cat) return;

  let targetList = null;
  if (!cat.hasSubgroups) {
    if (!cat.members) cat.members = [];
    targetList = cat.members;
  } else {
    const group = (cat.groups || []).find(g => g.id === groupId) || cat.groups[0];
    if (!group) return;
    if (!group.members) group.members = [];
    targetList = group.members;
  }

  if (editingMemberId) {
    const loc = findMemberLocation(editingMemberId);
    if (loc) {
      loc.member.name = name;
      loc.member.streamer = streamer;
      loc.member.role = role;
      loc.member.badgeColor = badgeColor;
      loc.member.avatar = avatar;

      saveStreamerToDb({
        id: loc.member.id,
        name,
        streamer,
        role,
        category: loc.category.id,
        subgroup: loc.group ? loc.group.id : null,
        badgeColor,
        avatar,
        displayOrder: loc.member.displayOrder ?? 0
      });

      persistData();
      updateStats();
      createBackupSnapshot(`인원 수정: ${name} (${streamer})`);
      showToast(`✓ ${name} (${streamer}) 정보 수정 완료`);
    }
  } else {
    const newMember = {
      id: "m-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      name,
      streamer,
      role,
      badgeColor,
      avatar,
      videos: []
    };
    targetList.push(newMember);

    saveStreamerToDb({
      id: newMember.id,
      name,
      streamer,
      role,
      category: catId,
      subgroup: groupId || null,
      badgeColor,
      avatar,
      displayOrder: targetList.length - 1
    });

    persistData();
    updateStats();
    createBackupSnapshot(`인원 추가: ${name} (${streamer})`);
    showToast(`✓ 새 인원 '${name} (${streamer})' 등록 완료`);
  }

  closeMemberModal();
  renderContent();
}

function deleteMember(memberId) {
  if (!isAdmin()) return;

  const loc = findMemberLocation(memberId);
  if (!loc) return;

  const targetName = `${loc.member.name} (${loc.member.streamer})`;
  if (!confirm(`'${targetName}' 인원을 삭제하시겠습니까?`)) return;

  if (!loc.category.hasSubgroups) {
    loc.category.members = loc.category.members.filter(m => m.id !== memberId);
  } else if (loc.group) {
    loc.group.members = loc.group.members.filter(m => m.id !== memberId);
  }

  if (state.currentMember?.id === memberId) state.currentMember = null;

  deleteStreamerFromDb(memberId);

  persistData();
  updateStats();
  createBackupSnapshot(`인원 삭제: ${targetName}`);
  renderContent();
  showToast(`🗑️ '${targetName}' 삭제 완료`);
}

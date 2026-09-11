// ==========================================
// 관리자 - 인원 관리 모듈 (Admin Member Management)
// ==========================================

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

    const formYoutube = document.getElementById("member-form-youtube");
    if (formYoutube) {
      let yVal = primaryMember.youtubeUrl || "";
      try { yVal = decodeURIComponent(yVal); } catch(e) {}
      formYoutube.value = yVal;
    }

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

    const formYoutube = document.getElementById("member-form-youtube");
    if (formYoutube) formYoutube.value = "";

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

async function handleSaveMember(e) {
  if (e) e.preventDefault();
  if (!isAdmin()) return;

  const name = document.getElementById("member-form-name").value.trim();
  const streamer = document.getElementById("member-form-streamer").value.trim();
  const role = document.getElementById("member-form-role").value.trim();
  const badgeColor = document.getElementById("member-form-badge").value;
  let avatar = document.getElementById("member-form-avatar").value.trim();
  const youtubeUrl = document.getElementById("member-form-youtube")?.value.trim() || "";

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
    allLocs.forEach(loc => {
      loc.member.name = name;
      loc.member.streamer = streamer;
      loc.member.role = role;
      loc.member.badgeColor = badgeColor;
      loc.member.avatar = avatar;
      loc.member.youtubeUrl = youtubeUrl;
      loc.member.affiliations = selectedAffiliations;
    });

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

    await saveStreamerToDb({
      id: memberObj.id,
      name,
      streamer,
      role,
      category: primaryAff.category,
      subgroup: primaryAff.subgroup,
      affiliations: JSON.stringify(selectedAffiliations),
      badgeColor,
      avatar,
      youtubeUrl,
      subscriberCount: memberObj.subscriberCount || "",
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
      youtubeUrl,
      subscriberCount: "",
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

    await saveStreamerToDb({
      id: newMember.id,
      name,
      streamer,
      role,
      category: primaryAff.category,
      subgroup: primaryAff.subgroup,
      affiliations: JSON.stringify(selectedAffiliations),
      badgeColor,
      avatar,
      youtubeUrl,
      subscriberCount: "",
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

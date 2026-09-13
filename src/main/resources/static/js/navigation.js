// ==========================================
// 네비게이션 & 검색 모듈 (Navigation & Search)
// ==========================================

function renderSearchResults(container) {
  const q = (state.searchQuery || '').trim().toLowerCase();
  if (!q) {
    clearSearch();
    return;
  }

  const terms = q.split(/\s+/).filter(Boolean);
  const matchedMembers = [];
  const seenMemberKeys = new Set();

  (KONGBAB_DATA.categories || []).forEach(cat => {
    const processMember = (member, group) => {
      if (!member) return;
      const memberKey = member.id || `${member.streamer}_${member.name}`;
      if (seenMemberKeys.has(memberKey)) return;

      const nameStr = (member.name || '').toLowerCase();
      const streamerStr = (member.streamer || member.streamerName || '').toLowerCase();
      const catNameStr = (cat.name || '').toLowerCase();
      const groupNameStr = (group ? group.name : '').toLowerCase();
      const roleStr = (member.role || '').toLowerCase();
      const swatStr = (member.swatRole || '').toLowerCase();

      // 소속 및 겸직 텍스트 수집
      const affParts = [];
      if (Array.isArray(member.affiliations)) {
        member.affiliations.forEach(a => {
          if (!a) return;
          if (a.role) affParts.push(String(a.role).toLowerCase());
          if (a.swatRole) affParts.push(String(a.swatRole).toLowerCase());
          if (a.category) {
            const c = (KONGBAB_DATA.categories || []).find(cItem => cItem.id === a.category);
            if (c) {
              affParts.push((c.name || '').toLowerCase());
              if (c.hasSubgroups && a.subgroup) {
                const g = (c.groups || []).find(grp => grp.id === a.subgroup);
                if (g) affParts.push((g.name || '').toLowerCase());
              }
            }
          }
        });
      }

      const searchHaystack = [
        nameStr,
        streamerStr,
        catNameStr,
        groupNameStr,
        roleStr,
        swatStr,
        ...affParts
      ].join(' ');

      const isMatch = terms.every(term => searchHaystack.includes(term));
      if (isMatch) {
        seenMemberKeys.add(memberKey);
        matchedMembers.push({
          member,
          group,
          category: cat,
        });
      }
    };

    if (cat.hasSubgroups) {
      (cat.groups || []).forEach(group => {
        (group.members || []).forEach(m => processMember(m, group));
      });
    } else {
      (cat.members || []).forEach(m => processMember(m, null));
    }
  });

  if (matchedMembers.length === 0) {
    container.innerHTML = `
      <div class="py-20 text-center bg-zinc-900/40 rounded-3xl border border-zinc-800">
        <div class="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">"${state.searchQuery}"에 대한 인원 검색 결과가 없습니다</h3>
        <p class="text-zinc-400 text-sm mb-6">스트리머명, 캐릭터명, 소속(경찰, 갱단, 사업체 등), 직책으로 다시 검색해보세요.</p>
        <button onclick="clearSearch()" class="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition-colors cursor-pointer">
          검색 초기화
        </button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <span>인원 검색 결과</span>
          <span class="text-sm px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">${matchedMembers.length}명</span>
        </h3>
        <p class="text-xs text-zinc-400 mt-1">"${state.searchQuery}" 검색 조건과 일치하는 인원(스트리머) 목록입니다.</p>
      </div>
      <button onclick="clearSearch()" class="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm">
        <span>✕</span>
        <span>검색 닫기</span>
      </button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  `;

  matchedMembers.forEach(({ member: m, group, category: cat }) => {
    const allVideos = (m.videos || []).filter(v => v && ((v.url && v.url !== "undefined" && v.url.trim() !== "") || v.videoId));
    const chzzkVideos = allVideos.filter(v => {
      const u = (v.url && v.url !== "undefined") ? v.url : "";
      return typeof isChzzkUrl === "function" && isChzzkUrl(u);
    });
    const ytVideos = allVideos.filter(v => {
      const u = (v.url && v.url !== "undefined") ? v.url : "";
      return !(typeof isChzzkUrl === "function" && isChzzkUrl(u));
    });
    const ytCount = ytVideos.length;
    const chzzkCount = chzzkVideos.length;

    let videoStatHtml = '';
    if (chzzkCount > 0 && ytCount > 0) {
      videoStatHtml = `
        <span>유튜브 <strong class="text-red-400 font-bold">${ytCount}개</strong></span>
        <span class="text-zinc-600">|</span>
        <span>치지직 <strong class="text-emerald-400 font-bold">${chzzkCount}개</strong></span>
      `;
    } else if (chzzkCount > 0) {
      videoStatHtml = `
        <span>치지직 영상 <strong class="text-emerald-400 font-bold">${chzzkCount}개</strong></span>
      `;
    } else if (ytCount > 0) {
      videoStatHtml = `
        <span>유튜브 영상 <strong class="text-red-400 font-bold">${ytCount}개</strong></span>
      `;
    } else {
      videoStatHtml = `
        <span class="text-zinc-500">등록된 영상 없음</span>
      `;
    }

    const info = typeof getMemberAffiliationInfo === 'function' ? getMemberAffiliationInfo(m, cat.id, group ? group.id : null) : {};
    const effectiveRole = info.role || m.role || '';
    const effectiveSwatRole = info.swatRole || m.swatRole || '';
    const cleanSwat = (effectiveSwatRole && !effectiveSwatRole.includes('사직') && !effectiveSwatRole.includes('퇴직') && !effectiveSwatRole.includes('순직')) ? effectiveSwatRole : '';
    const martyred = info.isMartyred;
    const retired = info.isRetired;
    const resigned = info.isResigned;
    const inactive = info.isInactive;
    const avatarFilterClass = inactive 
      ? "grayscale contrast-125 opacity-70 group-hover:grayscale-0 group-hover:contrast-100 group-hover:opacity-100" 
      : "";

    let statusOverlayHtml = '';
    if (martyred) {
      statusOverlayHtml = `
        <span class="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-zinc-950/95 text-red-400 border border-red-800/90 shadow ring-1 ring-red-900/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="순직">
          <span>순직</span>
        </span>
      `;
    } else if (retired) {
      statusOverlayHtml = `
        <span class="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-zinc-950/95 text-zinc-300 border border-zinc-600/90 shadow ring-1 ring-zinc-700/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="퇴직">
          <span>퇴직</span>
        </span>
      `;
    } else if (resigned) {
      statusOverlayHtml = `
        <span class="absolute -top-1.5 -right-1.5 z-20 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-zinc-950/95 text-amber-400 border border-amber-600/90 shadow ring-1 ring-amber-900/40 rotate-12 flex items-center justify-center whitespace-nowrap tracking-tight select-none" title="사직">
          <span>사직</span>
        </span>
      `;
    }

    const roleBadgeClass = typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(m, cat.id, group ? group.id : null) : 'bg-blue-600 text-white';

    // 구독자/팔로워 뱃지
    let subBadgeHtml = '';
    if (m.subscriberCount) {
      const isChzzk = typeof isMemberChzzk === 'function' ? isMemberChzzk(m) : false;
      if (isChzzk) {
        subBadgeHtml = `
          <span class="inline-flex items-center gap-1 text-[11px] font-bold text-[#00ffa3] bg-[#00ffa3]/10 border border-[#00ffa3]/40 px-2 py-0.5 rounded-full shadow-sm flex-shrink-0" title="치지직 채널 팔로워 수: ${m.subscriberCount}">
            <svg class="w-2.5 h-2.5 text-[#00ffa3] fill-current flex-shrink-0" viewBox="105 97 300 300"><polygon points="224,101 325,101 294,144 396,144 270,318 385,318 385,393 114,393 241,217 140,217"/></svg>
            <span>${m.subscriberCount}</span>
          </span>
        `;
      } else {
        subBadgeHtml = `
          <span class="inline-flex items-center gap-1 text-[11px] font-bold text-red-300 bg-red-950/80 border border-red-700/50 px-2 py-0.5 rounded-full shadow-sm flex-shrink-0" title="유튜브 채널 구독자 수: ${m.subscriberCount}">
            <svg class="w-2.5 h-2.5 text-red-500 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            <span>${m.subscriberCount}</span>
          </span>
        `;
      }
    }

    const affTitle = `${cat.name}${group ? ` > ${group.name}` : ''}`;
    const affLabel = `${cat.emoji ? `<span class="mr-1">${cat.emoji}</span>` : ''}${cat.name}${group ? ` <span class="text-zinc-500">›</span> ${group.emoji ? `<span class="mr-0.5">${group.emoji}</span>` : ''}${group.name}` : ''}`;

    html += `
      <div 
        onclick="selectMemberFromSearch('${cat.id}', ${group ? `'${group.id}'` : 'null'}, '${m.id}')"
        class="group bg-zinc-900/80 border border-zinc-800/80 hover:border-amber-400/50 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-lg hover:shadow-2xl flex flex-col justify-between select-none"
      >
        <div>
          <!-- 소속 태그 & 구독자/팔로워 뱃지 -->
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-zinc-800/90 text-zinc-300 border border-zinc-700/50 truncate max-w-[70%]" title="${affTitle}">
              ${affLabel}
            </span>
            ${subBadgeHtml}
          </div>

          <!-- 아바타 + 인원 기본 정보 -->
          <div class="flex items-start gap-4 mb-4">
            <div class="relative flex-shrink-0">
              <img 
                src="${getMemberAvatar(m)}" 
                alt="${m.name}" 
                loading="lazy"
                referrerpolicy="no-referrer"
                onerror="this.onerror=null; this.src='assets/default-avatar.svg'"
                class="w-16 h-16 rounded-2xl object-cover border-2 border-zinc-700 group-hover:border-amber-400 transition-all duration-300 shadow-md ${avatarFilterClass}"
              />
              ${cleanSwat ? (typeof getSwatBadgeHtml === 'function' ? getSwatBadgeHtml(cleanSwat, 'md') : '') : ''}
              ${statusOverlayHtml}
              ${effectiveRole ? `<span class="absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${roleBadgeClass} shadow">${effectiveRole}</span>` : ''}
            </div>

            <div class="flex-1 min-w-0">
              <h4 class="text-lg sm:text-xl font-bold text-white group-hover:text-amber-400 transition-colors truncate" title="${m.streamer}">
                ${m.streamer}
              </h4>
              <div class="flex items-center gap-1.5 mt-1 text-sm font-medium text-amber-400/90 truncate" title="RP 캐릭터: ${m.name}">
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span class="truncate">${m.name}</span>
              </div>
              ${cleanSwat && effectiveRole ? `
                <p class="text-xs text-zinc-400 mt-1 truncate" title="${effectiveRole} · ${cleanSwat}">
                  ${effectiveRole} · <span class="text-sky-300 font-medium">${cleanSwat}</span>
                </p>
              ` : (effectiveRole ? `
                <p class="text-xs text-zinc-400 mt-1 truncate" title="${effectiveRole}">${effectiveRole}</p>
              ` : '')}
            </div>
          </div>
        </div>

        <!-- 하단 영상 통계 및 이동 버튼 -->
        <div class="pt-3.5 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 gap-2">
          <div class="font-medium text-zinc-300 flex items-center gap-1.5 flex-wrap">
            ${videoStatHtml}
          </div>
          <span class="inline-flex items-center gap-1 text-amber-400 group-hover:translate-x-0.5 transition-transform font-semibold flex-shrink-0">
            영상 보기 →
          </span>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function saveNavigationState() {
  try {
    sessionStorage.setItem("kongbab_nav_category", state.currentCategory || "police");
    if (state.currentGroup && state.currentGroup.id) {
      sessionStorage.setItem("kongbab_nav_group", state.currentGroup.id);
    } else {
      sessionStorage.removeItem("kongbab_nav_group");
    }
    if (state.currentMember && state.currentMember.id) {
      sessionStorage.setItem("kongbab_nav_member", state.currentMember.id);
    } else {
      sessionStorage.removeItem("kongbab_nav_member");
    }
  } catch (e) {}
}

function restoreNavigationState() {
  try {
    const savedCat = sessionStorage.getItem("kongbab_nav_category");
    if (savedCat && KONGBAB_DATA.categories.some(c => c.id === savedCat)) {
      state.currentCategory = savedCat;
    }

    const cat = getCurrentCategory();
    const savedGroup = sessionStorage.getItem("kongbab_nav_group");
    if (savedGroup && cat.hasSubgroups) {
      const g = (cat.groups || []).find(grp => grp.id === savedGroup);
      if (g) state.currentGroup = g;
    }

    const savedMember = sessionStorage.getItem("kongbab_nav_member");
    if (savedMember) {
      if (state.currentGroup) {
        const m = (state.currentGroup.members || []).find(mem => mem.id === savedMember);
        if (m) state.currentMember = m;
      }
      if (!state.currentMember && cat.hasSubgroups && Array.isArray(cat.groups)) {
        for (const grp of cat.groups) {
          const m = (grp.members || []).find(mem => mem.id === savedMember);
          if (m) {
            state.currentGroup = grp;
            state.currentMember = m;
            break;
          }
        }
      } else if (!state.currentMember && !cat.hasSubgroups) {
        const m = (cat.members || []).find(mem => mem.id === savedMember);
        if (m) state.currentMember = m;
      }
    }
  } catch (e) {}
}

let lastMemberScrollY = null;
let lastSelectedMemberId = null;

try {
  const savedY = sessionStorage.getItem("kongbab_member_scroll_y");
  if (savedY !== null) lastMemberScrollY = parseFloat(savedY);
  const savedMemId = sessionStorage.getItem("kongbab_last_member_id");
  if (savedMemId) lastSelectedMemberId = savedMemId;
} catch (e) {}

function recordMemberClickPosition(memberId) {
  lastMemberScrollY = window.scrollY;
  lastSelectedMemberId = memberId;
  try {
    sessionStorage.setItem("kongbab_member_scroll_y", String(window.scrollY));
    if (memberId) {
      sessionStorage.setItem("kongbab_last_member_id", memberId);
    } else {
      sessionStorage.removeItem("kongbab_last_member_id");
    }
  } catch (e) {}
}

function restoreMemberScrollPosition() {
  const targetY = lastMemberScrollY;
  const targetMemberId = lastSelectedMemberId;

  lastMemberScrollY = null;
  lastSelectedMemberId = null;
  try {
    sessionStorage.removeItem("kongbab_member_scroll_y");
    sessionStorage.removeItem("kongbab_last_member_id");
  } catch (e) {}

  const doScroll = () => {
    let scrolled = false;
    if (targetMemberId) {
      const cardEl = document.getElementById(`member-card-${targetMemberId}`);
      if (cardEl) {
        if (typeof targetY === 'number' && targetY >= 0) {
          window.scrollTo({ top: targetY, behavior: 'auto' });
          const rect = cardEl.getBoundingClientRect();
          if (rect.top < 0 || rect.bottom > window.innerHeight) {
            cardEl.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
        } else {
          cardEl.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
        cardEl.classList.add('ring-2', 'ring-amber-400', 'shadow-amber-500/30');
        setTimeout(() => {
          cardEl.classList.remove('ring-2', 'ring-amber-400', 'shadow-amber-500/30');
        }, 1500);
        scrolled = true;
      }
    }
    if (!scrolled && typeof targetY === 'number' && targetY >= 0) {
      window.scrollTo({ top: targetY, behavior: 'auto' });
    }
  };

  doScroll();
  requestAnimationFrame(doScroll);
  setTimeout(doScroll, 50);
  setTimeout(doScroll, 150);
}

function goBackFromMember(type, targetId) {
  state.currentMember = null;
  if (type === 'category') {
    state.currentCategory = targetId;
    state.currentGroup = null;
  } else if (type === 'group') {
    const cat = getCurrentCategory();
    if (cat?.hasSubgroups) {
      state.currentGroup = (cat.groups || []).find(g => g.id === targetId) || null;
    }
  }
  saveNavigationState();
  renderContent();
  restoreMemberScrollPosition();
}

function selectCategory(catId) {
  state.currentCategory = catId;
  state.currentGroup = null;
  state.currentMember = null;
  state.searchQuery = "";
  lastMemberScrollY = null;
  lastSelectedMemberId = null;
  try {
    sessionStorage.removeItem("kongbab_member_scroll_y");
    sessionStorage.removeItem("kongbab_last_member_id");
  } catch (e) {}
  clearSearchInput();
  saveNavigationState();
  renderContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetToCategory(catId) {
  const wasOnMember = !!state.currentMember;
  state.currentCategory = catId;
  state.currentGroup = null;
  state.currentMember = null;
  saveNavigationState();
  renderContent();

  if (wasOnMember && (lastSelectedMemberId || typeof lastMemberScrollY === 'number')) {
    restoreMemberScrollPosition();
  } else {
    lastMemberScrollY = null;
    lastSelectedMemberId = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function selectGroup(groupId) {
  if (isDraggingCard) return;
  const cat = getCurrentCategory();
  if (!cat.hasSubgroups) return;
  const group = cat.groups.find(g => g.id === groupId);
  if (group) {
    const wasOnMember = !!state.currentMember;
    state.currentGroup = group;
    state.currentMember = null;
    state.searchQuery = "";
    clearSearchInput();
    saveNavigationState();
    renderContent();

    if (wasOnMember && (lastSelectedMemberId || typeof lastMemberScrollY === 'number')) {
      restoreMemberScrollPosition();
    } else {
      lastMemberScrollY = null;
      lastSelectedMemberId = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

function selectDirectMember(memberId) {
  if (isDraggingCard) return;
  recordMemberClickPosition(memberId);
  const cat = getCurrentCategory();
  const member = (cat.members || []).find(m => m.id === memberId);
  if (member) {
    state.currentGroup = null;
    state.currentMember = member;
    state.searchQuery = "";
    clearSearchInput();
    const allV = member.videos || [];
    state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
    saveNavigationState();
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function selectGroupMember(memberId) {
  if (isDraggingCard) return;
  if (!state.currentGroup) return;
  recordMemberClickPosition(memberId);
  const member = state.currentGroup.members.find(m => m.id === memberId);
  if (member) {
    state.currentMember = member;
    state.searchQuery = "";
    clearSearchInput();
    const allV = member.videos || [];
    state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
    saveNavigationState();
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function selectGroupFromSearch(catId, groupId) {
  state.currentCategory = catId;
  const cat = KONGBAB_DATA.categories.find(c => c.id === catId);
  if (cat?.hasSubgroups) {
    state.currentGroup = cat.groups.find(g => g.id === groupId);
    state.currentMember = null;
    state.searchQuery = "";
    clearSearchInput();
    saveNavigationState();
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function selectMemberFromSearch(catId, groupId, memberId) {
  recordMemberClickPosition(memberId);
  state.currentCategory = catId;
  const cat = KONGBAB_DATA.categories.find(c => c.id === catId);
  if (!cat) return;

  if (cat.hasSubgroups && groupId) {
    state.currentGroup = cat.groups.find(g => g.id === groupId);
    if (state.currentGroup) {
      state.currentMember = state.currentGroup.members.find(m => m.id === memberId);
    }
  } else {
    state.currentGroup = null;
    state.currentMember = (cat.members || []).find(m => m.id === memberId);
  }

  if (state.currentMember) {
    const allV = state.currentMember.videos || [];
    state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
  }

  state.searchQuery = "";
  clearSearchInput();
  saveNavigationState();
  renderContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearSearch() {
  state.searchQuery = "";
  clearSearchInput();
  renderContent();
}

function clearSearchInput() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  const mobileInput = document.getElementById("search-input-mobile");
  if (mobileInput) mobileInput.value = "";
}

function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      const mobileInput = document.getElementById("search-input-mobile");
      if (mobileInput && mobileInput.value !== e.target.value) {
        mobileInput.value = e.target.value;
      }
      renderContent();
    });
  }

  const mobileInput = document.getElementById("search-input-mobile");
  if (mobileInput) {
    mobileInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      const desktopInput = document.getElementById("search-input");
      if (desktopInput && desktopInput.value !== e.target.value) {
        desktopInput.value = e.target.value;
      }
      renderContent();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLoginModal();
      closeVideoModal();
      if (typeof closePlaylistModal === "function") {
        closePlaylistModal();
      }
      closeMemberModal();
      if (typeof closeBackupModal === "function") {
        closeBackupModal();
      }
      if (typeof closeLeaderboardModal === "function") {
        closeLeaderboardModal();
      }
    }
  });

  window.addEventListener("scroll", () => {
    if (typeof updateFloatingCategoryNavVisibility === "function") {
      updateFloatingCategoryNavVisibility();
    }
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (typeof updateFloatingCategoryNavVisibility === "function") {
      updateFloatingCategoryNavVisibility();
    }
  }, { passive: true });
}

window.goBackFromMember = goBackFromMember;
window.recordMemberClickPosition = recordMemberClickPosition;
window.restoreMemberScrollPosition = restoreMemberScrollPosition;


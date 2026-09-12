// ==========================================
// 네비게이션 & 검색 모듈 (Navigation & Search)
// ==========================================

function renderSearchResults(container) {
  const q = state.searchQuery;
  const results = [];

  KONGBAB_DATA.categories.forEach(cat => {
    if (cat.hasSubgroups) {
      cat.groups.forEach(group => {
        if (group.name.toLowerCase().includes(q)) {
          results.push({ type: 'group', data: group, category: cat });
        }
        (group.members || []).forEach(member => {
          if (
            member.name.toLowerCase().includes(q) ||
            member.streamer.toLowerCase().includes(q) ||
            (member.role && member.role.toLowerCase().includes(q)) ||
            (member.swatRole && member.swatRole.toLowerCase().includes(q))
          ) {
            results.push({ type: 'member', data: member, group, category: cat });
          }
          (member.videos || []).forEach(video => {
            if (video.title.toLowerCase().includes(q) || (video.description && video.description.toLowerCase().includes(q))) {
              results.push({ type: 'video', data: video, member, group, category: cat });
            }
          });
        });
      });
    } else {
      (cat.members || []).forEach(member => {
        if (
          member.name.toLowerCase().includes(q) ||
          member.streamer.toLowerCase().includes(q) ||
          (member.role && member.role.toLowerCase().includes(q)) ||
          (member.swatRole && member.swatRole.toLowerCase().includes(q))
        ) {
          results.push({ type: 'member', data: member, group: null, category: cat });
        }
        (member.videos || []).forEach(video => {
          if (video.title.toLowerCase().includes(q) || (video.description && video.description.toLowerCase().includes(q))) {
            results.push({ type: 'video', data: video, member, group: null, category: cat });
          }
        });
      });
    }
  });

  if (results.length === 0) {
    container.innerHTML = `
      <div class="py-20 text-center bg-zinc-900/40 rounded-3xl border border-zinc-800">
        <div class="w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 mb-4">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">"${q}"에 대한 검색 결과가 없습니다</h3>
        <p class="text-zinc-400 text-sm mb-6">인원명, 스트리머명, 갱단/사업체 이름, 영상 제목으로 다시 검색해보세요.</p>
        <button onclick="clearSearch()" class="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm transition-colors cursor-pointer">
          검색 초기화
        </button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="mb-6 flex items-center justify-between">
      <h3 class="text-xl font-bold text-white">
        검색 결과 <span class="text-red-400">${results.length}</span>건
      </h3>
      <button onclick="clearSearch()" class="text-xs text-zinc-400 hover:text-white underline cursor-pointer">
        검색 닫기
      </button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  `;

  results.forEach(item => {
    if (item.type === 'video') {
      const v = item.data;
      const thumb = getYoutubeThumbnail(v.url);
      const vType = getVideoType(v);
      let searchBadgeClass = 'bg-red-950 text-red-300 border-red-700/50';
      let searchBadgeText = '🎬 편집 영상';
      if (vType === 'binge') {
        searchBadgeClass = 'bg-amber-950 text-amber-300 border-amber-600/50';
        searchBadgeText = '🍿 몰아보기';
      } else if (vType === 'full') {
        searchBadgeClass = 'bg-indigo-950 text-indigo-300 border-indigo-700/50';
        searchBadgeText = '📹 풀 영상';
      }
      const groupLabel = item.group ? `${item.group.name} > ` : '';
      html += `
        <div class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden p-4 flex flex-col justify-between">
          <div>
            <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="relative block aspect-video rounded-xl overflow-hidden bg-black mb-3 group cursor-pointer">
              <img src="${thumb}" alt="${v.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span class="text-xs font-bold text-white bg-red-600 px-3 py-1 rounded-lg flex items-center gap-1">
                  유튜브에서 보기 ${SVG_ICONS.external}
                </span>
              </div>
            </a>
            <div class="flex items-center gap-1.5 text-xs text-amber-400 mb-1 font-semibold flex-wrap">
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${searchBadgeClass} whitespace-nowrap flex-shrink-0">
                ${searchBadgeText}
              </span>
              <span class="truncate min-w-0">${item.category.name} > ${groupLabel}${item.member.name}</span>
            </div>
            <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="text-sm font-bold text-white hover:text-red-400 line-clamp-2 block mb-2">
              ${v.title}
            </a>
          </div>
          <div class="mt-4 pt-3 border-t border-zinc-800 flex justify-between items-center text-xs gap-2">
            <button onclick="selectMemberFromSearch('${item.category.id}', ${item.group ? `'${item.group.id}'` : 'null'}, '${item.member.id}')" class="text-zinc-400 hover:text-white cursor-pointer whitespace-nowrap flex-shrink-0">
              인원 페이지 이동 →
            </button>
            <a href="${v.url}" target="_blank" rel="noopener noreferrer" class="text-red-400 hover:underline flex items-center gap-1 font-semibold whitespace-nowrap flex-shrink-0">
              유튜브 새 탭 ${SVG_ICONS.external}
            </a>
          </div>
        </div>
      `;
    } else if (item.type === 'member') {
      const m = item.data;
      const groupName = item.group ? item.group.name : item.category.name;
      const cleanSwat = (m.swatRole && !m.swatRole.includes('사직') && !m.swatRole.includes('퇴직')) ? m.swatRole : '';
      const roleText = [m.role, cleanSwat].filter(Boolean).join(' · ');
      html += `
        <div onclick="selectMemberFromSearch('${item.category.id}', ${item.group ? `'${item.group.id}'` : 'null'}, '${m.id}')" class="bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1">
          <div class="flex items-center gap-3.5 mb-3">
            <div class="relative flex-shrink-0">
              <img src="${getMemberAvatar(m)}" class="w-14 h-14 rounded-2xl object-cover border border-zinc-700" />
              ${(typeof getSwatBadgeHtml === 'function' && cleanSwat) ? getSwatBadgeHtml(cleanSwat, 'sm') : ''}
            </div>
            <div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">[인원] ${groupName}</span>
              <h4 class="text-lg font-bold text-white mt-1">${m.streamer}</h4>
              <p class="text-xs text-amber-400 font-medium">${m.name}${roleText ? ` (${roleText})` : ''}</p>
            </div>
          </div>
          <div class="pt-3 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
            <span>영상 ${(m.videos || []).length}개</span>
            <span class="text-amber-400 font-semibold">인원 보기 →</span>
          </div>
        </div>
      `;
    } else if (item.type === 'group') {
      const g = item.data;
      html += `
        <div onclick="selectGroupFromSearch('${item.category.id}', '${g.id}')" class="bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">[조직] ${item.category.name}</span>
          <h4 class="text-xl font-bold text-white mt-2 mb-3 flex items-center gap-1.5">
            <span>${g.emoji || ''}</span>
            <span>${g.name}</span>
          </h4>
          <div class="pt-3 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
            <span>소속 인원 ${g.members.length}명</span>
            <span class="text-amber-400 font-semibold">상세 보기 →</span>
          </div>
        </div>
      `;
    }
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
      } else if (!cat.hasSubgroups) {
        const m = (cat.members || []).find(mem => mem.id === savedMember);
        if (m) state.currentMember = m;
      }
    }
  } catch (e) {}
}

function selectCategory(catId) {
  state.currentCategory = catId;
  state.currentGroup = null;
  state.currentMember = null;
  state.searchQuery = "";
  clearSearchInput();
  saveNavigationState();
  renderContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetToCategory(catId) {
  state.currentCategory = catId;
  state.currentGroup = null;
  state.currentMember = null;
  saveNavigationState();
  renderContent();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectGroup(groupId) {
  if (isDraggingCard) return;
  const cat = getCurrentCategory();
  if (!cat.hasSubgroups) return;
  const group = cat.groups.find(g => g.id === groupId);
  if (group) {
    state.currentGroup = group;
    state.currentMember = null;
    state.searchQuery = "";
    clearSearchInput();
    saveNavigationState();
    renderContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function selectDirectMember(memberId) {
  if (isDraggingCard) return;
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
}

function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
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

function renderHeaderAuth() {
  const container = document.getElementById("header-auth");
  if (!container) return;

  if (isAdmin()) {
    container.innerHTML = `
      <div class="flex items-center gap-2">
        <button onclick="openAdminSettingsModal()" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 text-xs font-bold shadow-sm transition-all cursor-pointer group" title="어드민 설정 (유튜브 구독자 갱신 등)">
          <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <span>🛡️ 어드민</span>
        </button>
        <button onclick="openBackupModal()" class="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer" title="DB / 백업 관리 센터 (즉시 저장, 백업 기록, 불러오기)">
          <span>💾 백업 관리</span>
        </button>
        <button onclick="logoutUser()" class="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold border border-zinc-800 transition-colors cursor-pointer">
          로그아웃
        </button>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-medium">
          <span class="w-2 h-2 rounded-full bg-zinc-500"></span>
          게스트 (시청 전용)
        </span>
        <button onclick="openLoginModal()" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold transition-all shadow-md shadow-red-600/25 cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
          <span>로그인</span>
        </button>
      </div>
    `;
  }
}

function setVideoTab(tab) {
  state.currentVideoTab = tab;
  const container = document.getElementById("main-content");
  if (container && state.currentMember) renderMemberVideos(container);
}

function renderCategoryTabs() {
  const tabContainer = document.getElementById("category-tabs");
  if (!tabContainer) return;

  tabContainer.innerHTML = KONGBAB_DATA.categories.map(cat => {
    const isActive = state.currentCategory === cat.id && !state.searchQuery;
    const theme = COLOR_THEMES[cat.color] || COLOR_THEMES.blue;
    const activeClass = isActive 
      ? theme.activeTab 
      : "bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-zinc-800";

    const memberCount = getCategoryMembers(cat).length;
    const countLabel = `${memberCount}명`;

    return `
      <button onclick="selectCategory('${cat.id}')" class="flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer ${activeClass}">
        <span>${cat.emoji || ''}</span>
        <span>${cat.name}</span>
        <span class="text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-black/30 text-white font-bold' : 'bg-zinc-800 text-zinc-400'}">
          ${countLabel}
        </span>
      </button>
    `;
  }).join("");
}

function getCurrentCategory() {
  return KONGBAB_DATA.categories.find(c => c.id === state.currentCategory) || KONGBAB_DATA.categories[0];
}

function renderContent() {
  const mainContent = document.getElementById("main-content");
  if (!mainContent) return;

  renderCategoryTabs();

  if (state.searchQuery) {
    renderSearchResults(mainContent);
    return;
  }

  if (state.currentMember) {
    renderMemberVideos(mainContent);
    return;
  }

  const cat = getCurrentCategory();
  if (!cat.hasSubgroups) {
    renderDirectCategoryMembers(mainContent, cat);
    return;
  }

  if (state.currentGroup) {
    renderGroupMembers(mainContent);
    return;
  }

  renderSubgroupList(mainContent, cat);
}

function renderEmptyState(emoji, title) {
  return `
    <div class="col-span-full py-16 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/50">
      <div class="w-12 h-12 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 mb-3 text-2xl">
        ${emoji}
      </div>
      <h4 class="text-lg font-bold text-zinc-300">${title}</h4>
    </div>
  `;
}

function renderMemberCard(member, dragType, clickFn) {
  const allVideos = (member.videos || []).filter(v => v && ((v.url && v.url !== "undefined" && v.url.trim() !== "") || v.videoId));
  const videoCount = allVideos.length;
  const isDualRole = Array.isArray(member.affiliations) && member.affiliations.length > 1;
  const admin = isAdmin();
  const cachedSub = typeof getCachedSubscriber === "function" ? getCachedSubscriber(member.id) : null;

  // 유튜브 vs 치지직 영상 개수 분리
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
  } else {
    videoStatHtml = `
      <span>유튜브 영상 <strong class="text-red-400 font-bold">${ytCount}개</strong></span>
    `;
  }

  const dragAttrs = admin ? `
      draggable="true"
      data-drag-type="${dragType}"
      data-drag-id="${member.id}"
      ondragstart="handleCardDragStart(event, '${dragType}', '${member.id}')"
      ondragover="handleCardDragOver(event)"
      ondragleave="handleCardDragLeave(event)"
      ondrop="handleCardDrop(event, '${dragType}', '${member.id}')"
      ondragend="handleCardDragEnd(event)"
  ` : `draggable="false"`;
  const cursorClass = admin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer";

  return `
    <div 
      ${dragAttrs}
      onclick="${clickFn}('${member.id}')"
      class="group bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1.5 ${cursorClass} shadow-lg hover:shadow-2xl flex flex-col justify-between select-none"
    >
      <div>
        <div class="flex items-start gap-4 mb-4">
          <div class="relative">
            <img 
              src="${getMemberAvatar(member)}" 
              alt="${member.name}" 
              draggable="false"
              class="w-16 h-16 rounded-2xl object-cover border-2 border-zinc-700 group-hover:border-amber-400 transition-colors shadow-md"
            />
            ${member.role ? `<span class="absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${member.badgeColor || 'bg-zinc-800'} text-white shadow">${member.role}</span>` : ''}
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                <h4 class="text-xl font-bold text-white group-hover:text-amber-400 transition-colors truncate" title="${member.streamer}">
                  ${member.streamer}
                </h4>
                ${member.subscriberCount ? `
                  <span class="inline-flex items-center gap-1 text-[11px] font-bold text-red-300 bg-red-950/80 border border-red-700/50 px-2 py-0.5 rounded-full shadow-sm flex-shrink-0" title="유튜브 채널 구독자 수">
                    <svg class="w-3 h-3 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    <span>${member.subscriberCount}</span>
                  </span>
                ` : ''}
              </div>
              ${isAdmin() ? `
                <div class="flex items-center gap-1.5 ml-2 flex-shrink-0 card-header-actions" onclick="event.stopPropagation()">
                  <button onclick="openMemberModal('edit', '${member.id}')" title="수정" class="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs cursor-pointer flex-shrink-0">✏️</button>
                  <button onclick="deleteMember('${member.id}')" title="삭제" class="p-1 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 hover:text-white text-xs border border-red-800/40 cursor-pointer flex-shrink-0">🗑️</button>
                </div>
              ` : ''}
            </div>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <p class="text-sm font-medium text-amber-400/90 flex items-center gap-1.5" title="RP 캐릭터: ${member.name}">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                <span>${member.name}</span>
              </p>
              ${isDualRole ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300 shadow-sm" title="겸직 (${member.affiliations.length}개 소속)">겸직</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      <div class="pt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400 gap-2">
        <div class="font-medium text-zinc-300 flex items-center gap-1.5 flex-wrap">
          ${videoStatHtml}
        </div>
        <span class="inline-flex items-center gap-1 text-amber-400 group-hover:translate-x-0.5 transition-transform font-semibold flex-shrink-0">
          영상 목록 보기 →
        </span>
      </div>
    </div>
  `;
}

function renderGroupVideoStats(members) {
  const memberList = members || [];
  const allVideos = memberList.flatMap(m => (m.videos || []).filter(v => v && v.url && v.url !== "undefined" && v.url.trim() !== ""));
  
  const clipVideos = allVideos.filter(v => getVideoType(v) === 'clip');
  const fullVideos = allVideos.filter(v => getVideoType(v) === 'full');
  const bingeVideos = allVideos.filter(v => getVideoType(v) === 'binge');

  const clipCount = clipVideos.length;
  const fullCount = fullVideos.length;
  const bingeCount = bingeVideos.length;
  const totalVideoCount = allVideos.length;

  const clipSec = clipVideos.reduce((sum, v) => sum + (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0), 0);
  const fullSec = fullVideos.reduce((sum, v) => sum + (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0), 0);
  const bingeSec = bingeVideos.reduce((sum, v) => sum + (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0), 0);
  const totalSec = clipSec + fullSec + bingeSec;

  const clipDur = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(clipSec) : "0분";
  const fullDur = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(fullSec) : "0분";
  const bingeDur = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(bingeSec) : "0분";
  const totalDur = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalSec) : "0분";

  return `
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-2 sm:p-2.5 flex items-center gap-1.5 sm:gap-2 flex-wrap self-start md:self-auto shadow-xl select-none">
      <!-- 편집 영상 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[76px] sm:min-w-[84px] px-2.5 py-1">
        <p class="text-[11px] text-zinc-400 flex items-center justify-center gap-1.5 font-medium mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span>
          <span>편집 영상</span>
        </p>
        <p class="text-sm sm:text-[15px] font-bold text-red-400 tracking-tight leading-snug my-0.5">${clipDur}</p>
        <p class="text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">${clipCount}개</p>
      </div>

      <div class="w-px h-8 bg-zinc-800 self-center"></div>

      <!-- 풀 영상 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[76px] sm:min-w-[84px] px-2.5 py-1">
        <p class="text-[11px] text-zinc-400 flex items-center justify-center gap-1.5 font-medium mb-1">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-sm shadow-indigo-400/50"></span>
          <span>풀 영상</span>
        </p>
        <p class="text-sm sm:text-[15px] font-bold text-indigo-400 tracking-tight leading-snug my-0.5">${fullDur}</p>
        <p class="text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">${fullCount}개</p>
      </div>

      ${bingeCount > 0 ? `
        <div class="w-px h-8 bg-zinc-800 self-center"></div>
        <!-- 몰아보기 -->
        <div class="flex flex-col items-center justify-center text-center min-w-[76px] sm:min-w-[84px] px-2.5 py-1">
          <p class="text-[11px] text-zinc-400 flex items-center justify-center gap-1.5 font-medium mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50"></span>
            <span>몰아보기</span>
          </p>
          <p class="text-sm sm:text-[15px] font-bold text-amber-400 tracking-tight leading-snug my-0.5">${bingeDur}</p>
          <p class="text-xs text-zinc-400 font-medium whitespace-nowrap mt-0.5 leading-none">${bingeCount}개</p>
        </div>
      ` : ''}

      <div class="w-px h-8 bg-zinc-800 self-center"></div>

      <!-- 소속 인원 -->
      <div class="flex flex-col items-center justify-center text-center min-w-[76px] sm:min-w-[84px] px-2.5 py-1">
        <p class="text-[11px] text-zinc-400 flex items-center justify-center gap-1 font-medium mb-1">
          <svg class="w-3 h-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span>소속 인원</span>
        </p>
        <p class="text-sm sm:text-[15px] font-bold text-white tracking-tight leading-snug my-0.5">${memberList.length}명</p>
        <p class="text-xs text-zinc-500 font-medium whitespace-nowrap mt-0.5 leading-none">활동 중</p>
      </div>
    </div>
  `;
}

function renderDirectCategoryMembers(container, cat) {
  const members = cat.members || [];
  const membersHtml = members.length > 0
    ? members.map(m => renderMemberCard(m, 'direct-member', 'selectDirectMember')).join("")
    : renderEmptyState(cat.emoji || '👥', "등록된 인원이 없습니다.");

  container.innerHTML = `
    <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 flex-wrap">
          <span class="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">${cat.badge}</span>
          <h2 class="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>${cat.emoji || ''}</span>
            <span>${cat.name} 인원 목록</span>
          </h2>
          ${isAdmin() ? `
            <button onclick="openMemberModal('add', null, '${cat.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span>인원 추가</span>
            </button>
          ` : ''}
        </div>
      </div>

      ${renderGroupVideoStats(members)}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${membersHtml}
    </div>
  `;
}

function renderSubgroupList(container, cat) {
  const theme = COLOR_THEMES[cat.color] || COLOR_THEMES.blue;
  const admin = isAdmin();

  const cardsHtml = cat.groups.map(group => {
    const totalVideos = group.members.reduce((sum, m) => sum + (m.videos || []).length, 0);
    const dragAttrs = admin ? `
        draggable="true"
        data-drag-type="group"
        data-drag-id="${group.id}"
        ondragstart="handleCardDragStart(event, 'group', '${group.id}')"
        ondragover="handleCardDragOver(event)"
        ondragleave="handleCardDragLeave(event)"
        ondrop="handleCardDrop(event, 'group', '${group.id}')"
        ondragend="handleCardDragEnd(event)"
    ` : `draggable="false"`;
    const cursorClass = admin ? "cursor-grab active:cursor-grabbing" : "cursor-pointer";
    const bgImage = typeof getGroupBgImage === "function" ? getGroupBgImage(group) : (group.bgImage || (group.id === "gang-bigdick" || group.name === "빅딕" ? "assets/bigdick.webp" : null));

    if (bgImage) {
      return `
        <div 
          ${dragAttrs}
          onclick="selectGroup('${group.id}')"
          class="group relative overflow-hidden bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1.5 ${cursorClass} shadow-xl ${theme.glow} select-none min-h-[140px] flex flex-col justify-between"
        >
          <div class="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div 
              class="w-full h-full bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-110 opacity-40"
              style="background-image: url('${bgImage}');"
            ></div>
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/70 to-zinc-950/40"></div>
          </div>

          <div class="relative z-10 flex items-center justify-between gap-2 mb-4">
            <h3 class="text-2xl font-black text-white group-hover:text-amber-400 transition-colors flex items-center gap-2 truncate min-w-0 flex-1 drop-shadow-md" title="${group.name}">
              <span class="flex-shrink-0">${group.emoji || ''}</span>
              <span class="truncate">${group.name}</span>
            </h3>
            <div class="w-8 h-8 rounded-xl bg-black/60 backdrop-blur-md border border-zinc-700/60 flex items-center justify-center text-zinc-300 group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-500 transition-all flex-shrink-0 shadow">
              ${SVG_ICONS.chevronRight}
            </div>
          </div>

          <div class="relative z-10 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
            <span class="font-medium text-zinc-300">
              소속 인원 <strong class="text-white font-bold">${group.members.length}</strong>명
            </span>
            <span class="flex items-center gap-1.5 text-red-400 font-semibold bg-black/60 px-2 py-0.5 rounded-lg border border-white/5 shadow-inner">
              ${SVG_ICONS.youtube}
              <span>영상 ${totalVideos}개</span>
            </span>
          </div>
        </div>
      `;
    }

    return `
      <div 
        ${dragAttrs}
        onclick="selectGroup('${group.id}')"
        class="group relative bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1.5 ${cursorClass} shadow-xl ${theme.glow} select-none"
      >
        <div class="flex items-center justify-between gap-2 mb-4">
          <h3 class="text-2xl font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-2 truncate min-w-0 flex-1" title="${group.name}">
            <span class="flex-shrink-0">${group.emoji || ''}</span>
            <span class="truncate">${group.name}</span>
          </h3>
          <div class="w-8 h-8 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-400 group-hover:bg-amber-500 group-hover:text-black transition-all flex-shrink-0">
            ${SVG_ICONS.chevronRight}
          </div>
        </div>

        <div class="pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
          <span class="font-medium text-zinc-300">
            소속 인원 <strong class="text-white font-bold">${group.members.length}</strong>명
          </span>
          <span class="flex items-center gap-1.5 text-red-400 font-semibold">
            ${SVG_ICONS.youtube}
            <span>영상 ${totalVideos}개</span>
          </span>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="mb-6">
      <div class="flex items-center gap-2.5 flex-wrap">
        <span class="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">${cat.badge}</span>
        <h2 class="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span>${cat.emoji || ''}</span>
          <span>${cat.name} 목록 (${cat.groups.length}개)</span>
        </h2>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${cardsHtml}
    </div>
  `;
}

function renderGroupMembers(container) {
  const cat = getCurrentCategory();
  const group = state.currentGroup;
  const members = group.members || [];
  const bgImage = typeof getGroupBgImage === "function" ? getGroupBgImage(group) : (group.bgImage || (group.id === "gang-bigdick" || group.name === "빅딕" ? "assets/bigdick.webp" : null));
  const membersHtml = members.length > 0
    ? members.map(m => renderMemberCard(m, 'group-member', 'selectGroupMember')).join("")
    : renderEmptyState(group.emoji || '👥', "등록된 인원이 없습니다.");

  // 갱단('gang') 및 사업체('business') 카테고리인 경우에만 소속 인원 구독자 수 총합 계산
  const isTargetCategory = cat && (cat.id === "gang" || cat.id === "business");
  const totalSubscribers = isTargetCategory && typeof calculateGroupTotalSubscribers === "function"
    ? calculateGroupTotalSubscribers(members)
    : null;

  container.innerHTML = `
    <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <button onclick="resetToCategory('${cat.id}')" class="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors mb-3 cursor-pointer">
          ${SVG_ICONS.back}
          <span>${cat.name} 목록으로 돌아가기</span>
        </button>
        <div class="flex items-center gap-3 flex-wrap">
          ${bgImage ? `<img src="${bgImage}" alt="${group.name}" class="w-10 h-10 rounded-xl object-cover border-2 border-amber-500/60 shadow-lg shadow-amber-500/20" />` : ''}
          <h2 class="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>${group.emoji || ''}</span>
            <span>${group.name}</span>
          </h2>
          ${totalSubscribers ? `
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/80 border border-red-700/50 text-red-300 text-sm font-bold shadow-md shadow-red-950/30" title="${group.name} 소속 인원 유튜브 총 구독자 수 합계">
              <svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              <span>총 구독자 ${totalSubscribers}</span>
            </span>
          ` : ''}
          ${isAdmin() ? `
            <button onclick="openMemberModal('add', null, '${cat.id}', '${group.id}')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span>인원 추가</span>
            </button>
          ` : ''}
        </div>
      </div>

      ${renderGroupVideoStats(members)}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${membersHtml}
    </div>
  `;
}

function renderMemberVideos(container) {
  const member = state.currentMember;
  const group = state.currentGroup;
  const cat = getCurrentCategory();

  // 유효한 영상만 필터링 (잘못 등록된 undefined/빈 링크 영상 자동 제거)
  const allVideos = (member.videos || []).filter(v => v && v.url && v.url !== "undefined" && v.url.trim() !== "");
  const clipVideos = allVideos.filter(v => getVideoType(v) === 'clip');
  const fullVideos = allVideos.filter(v => getVideoType(v) === 'full');
  const bingeVideos = allVideos.filter(v => getVideoType(v) === 'binge');
  const clipCount = clipVideos.length;
  const fullCount = fullVideos.length;
  const bingeCount = bingeVideos.length;

  const clipTotalSeconds = clipVideos.reduce((sum, v) => sum + (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0), 0);
  const fullTotalSeconds = fullVideos.reduce((sum, v) => sum + (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0), 0);
  const bingeTotalSeconds = bingeVideos.reduce((sum, v) => sum + (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0), 0);
  const clipTotalDuration = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(clipTotalSeconds) : "0분";
  const fullTotalDuration = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(fullTotalSeconds) : "0분";
  const bingeTotalDuration = typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(bingeTotalSeconds) : "0분";

  const currentTab = state.currentVideoTab === "binge" ? "binge" : (state.currentVideoTab === "full" ? "full" : "clip");

  let displayedVideos = clipVideos;
  if (currentTab === "binge") {
    displayedVideos = bingeVideos;
  } else if (currentTab === "full") {
    displayedVideos = fullVideos;
  }

  const backButtonHtml = !cat.hasSubgroups ? `
    <button onclick="resetToCategory('${cat.id}')" class="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors mb-4 cursor-pointer">
      ${SVG_ICONS.back}
      <span>${cat.name} 인원 목록으로 돌아가기</span>
    </button>
  ` : `
    <button onclick="selectGroup('${group.id}')" class="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors mb-4 cursor-pointer">
      ${SVG_ICONS.back}
      <span>${group.emoji || ''} ${group.name} 인원 목록으로 돌아가기</span>
    </button>
  `;

  const admin = isAdmin();
  let videosHtml = displayedVideos.map((video, vIndex) => {
    const videoNum = vIndex + 1;
    const vUrl = (video.url && video.url !== "undefined") ? video.url : (video.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : "");
    const isChzzk = typeof isChzzkUrl === "function" && isChzzkUrl(vUrl);
    const platformLabel = isChzzk ? '치지직' : '유튜브';
    const thumbUrl = video.thumbnailUrl || getYoutubeThumbnail(vUrl);
    const vType = getVideoType(video);
    let typeBadgeClass = 'bg-red-950/90 text-red-300 border-red-700/60';
    let typeBadgeText = '🎬 편집 영상';
    if (vType === 'binge') {
      typeBadgeClass = 'bg-amber-950/90 text-amber-300 border-amber-600/60';
      typeBadgeText = '🍿 몰아보기';
    } else if (vType === 'full') {
      typeBadgeClass = 'bg-indigo-950/90 text-indigo-300 border-indigo-700/60';
      typeBadgeText = '📹 풀 영상';
    }
    const dragAttrs = admin ? `
        draggable="true"
        data-drag-type="video"
        data-drag-id="${video.id}"
        ondragstart="handleCardDragStart(event, 'video', '${video.id}')"
        ondragover="handleCardDragOver(event)"
        ondragleave="handleCardDragLeave(event)"
        ondrop="handleCardDrop(event, 'video', '${video.id}')"
        ondragend="handleCardDragEnd(event)"
    ` : `draggable="false"`;
    const cursorClass = admin ? "cursor-grab active:cursor-grabbing" : "";

    return `
      <div 
        ${dragAttrs}
        class="group bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 shadow-xl flex flex-col justify-between ${cursorClass} select-none"
      >
        <div>
          <a 
            href="${vUrl || '#'}" 
            target="_blank" 
            rel="noopener noreferrer" 
            draggable="false"
            onclick="if (isDraggingCard || !this.getAttribute('href') || this.getAttribute('href') === '#') { event.preventDefault(); return false; }"
            class="relative block aspect-video bg-black overflow-hidden group cursor-pointer"
            title="${platformLabel}에서 영상 보기 (새 탭)"
          >
            <img src="${thumbUrl}" alt="${video.title}" draggable="false" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            
            <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 select-none">
              <div class="${typeBadgeClass} border backdrop-blur-md text-[11px] font-bold px-2.5 py-1 rounded-lg shadow flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                <span>${typeBadgeText}</span>
              </div>
              ${isChzzk ? `
                <div class="bg-[#00ffa3]/20 border border-[#00ffa3]/60 backdrop-blur-md text-[10px] font-extrabold text-[#00ffa3] px-2 py-0.5 rounded-lg shadow flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                  <span>CHZZK</span>
                </div>
              ` : ''}
            </div>

            <div class="absolute top-2.5 right-2.5 min-w-[28px] h-7 px-2 ${isChzzk ? 'bg-emerald-600 border-emerald-500/80 shadow-[0_2px_12px_rgba(5,150,105,0.5)]' : 'bg-red-600 border-red-500/80 shadow-[0_2px_12px_rgba(220,38,38,0.5)]'} text-white font-black text-sm rounded-xl border flex items-center justify-center select-none font-mono tracking-tighter z-10 group-hover:scale-110 transition-transform duration-200" title="${videoNum}번째 영상">
              <span>${videoNum}</span>
            </div>

            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-10">
              <div class="w-14 h-14 rounded-2xl ${isChzzk ? 'bg-[#00ffa3] text-zinc-950' : 'bg-red-600 text-white'} flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform flex-shrink-0">
                <svg class="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
              </div>
              <span class="text-xs font-bold text-white bg-black/80 px-2.5 py-1 rounded-md flex items-center gap-1 whitespace-nowrap select-none">
                <span>${platformLabel}으로 이동</span>
                ${SVG_ICONS.external}
              </span>
            </div>

            ${video.date ? `
              <div class="absolute bottom-2 left-2 bg-black/85 backdrop-blur-sm text-[11px] font-medium text-zinc-300 px-2 py-0.5 rounded-md z-10 flex items-center gap-1 select-none shadow-sm">
                <svg class="w-3 h-3 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span>${video.date}</span>
              </div>
            ` : `
              <div class="absolute bottom-2 left-2 bg-black/85 backdrop-blur-sm text-[11px] font-medium text-zinc-400 px-2 py-0.5 rounded-md z-10 flex items-center gap-1 select-none shadow-sm">
                <span>날짜 미지정</span>
              </div>
            `}

            <div class="absolute bottom-2 right-2 bg-black/90 backdrop-blur-sm text-[11px] font-bold font-mono text-zinc-100 px-2 py-0.5 rounded-md z-10 shadow-sm flex items-center gap-1 select-none">
              ${video.duration ? `<span>${video.duration}</span>` : `<span>영상</span>`}
            </div>
          </a>

          <div class="px-5 pt-5 pb-2.5 flex-1 flex flex-col justify-between">
            <div>
              <a 
                href="${vUrl || '#'}" 
                target="_blank" 
                rel="noopener noreferrer" 
                draggable="false"
                onclick="if (isDraggingCard || !this.getAttribute('href') || this.getAttribute('href') === '#') { event.preventDefault(); return false; }"
                class="block text-base font-bold text-white ${isChzzk ? 'hover:text-emerald-400' : 'hover:text-red-400'} transition-colors line-clamp-2 leading-snug cursor-pointer ${video.description ? 'mb-2' : ''}"
                title="${video.title}"
              >
                ${video.title}
              </a>
              ${video.description ? `
                <p class="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  ${video.description}
                </p>
              ` : ''}
            </div>
          </div>
        </div>


        ${isAdmin() ? `
          <div class="px-5 py-2.5 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between">
            <span class="text-[11px] text-amber-400 font-bold flex items-center gap-1">🛡️ 어드민 관리</span>
            <div class="flex items-center gap-1.5">
              <button onclick="openVideoModal('edit', '${video.id}')" class="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer">✏️ 수정</button>
              <button onclick="deleteVideo('${video.id}')" class="px-2.5 py-1 rounded-lg bg-red-950/70 hover:bg-red-900 text-red-300 text-xs font-semibold border border-red-800/50 transition-colors cursor-pointer">🗑️ 삭제</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");

  if (displayedVideos.length === 0) {
    if (allVideos.length === 0) {
      videosHtml = renderEmptyState(SVG_ICONS.youtube, "등록된 유튜브 영상이 없습니다.");
    } else if (currentTab === "clip") {
      videosHtml = `
        <div class="col-span-full py-16 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/50">
          <div class="w-14 h-14 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3 text-2xl">🎬</div>
          <h4 class="text-lg font-bold text-zinc-300">등록된 편집 영상이 없습니다.</h4>
          <div class="mt-4 flex items-center justify-center gap-2 flex-wrap">
            ${fullCount > 0 ? `<button onclick="setVideoTab('full')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"><span>📹 풀 영상 (${fullCount}개) 보러가기</span></button>` : ''}
            ${bingeCount > 0 ? `<button onclick="setVideoTab('binge')" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-amber-600/30"><span>🍿 몰아보기 (${bingeCount}개) 보러가기</span></button>` : ''}
          </div>
        </div>
      `;
    } else if (currentTab === "full") {
      videosHtml = `
        <div class="col-span-full py-16 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/50">
          <div class="w-14 h-14 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3 text-2xl">📹</div>
          <h4 class="text-lg font-bold text-zinc-300">등록된 풀 영상이 없습니다.</h4>
          <div class="mt-4 flex items-center justify-center gap-2 flex-wrap">
            ${clipCount > 0 ? `<button onclick="setVideoTab('clip')" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-red-600/30"><span>🎬 편집 영상 (${clipCount}개) 보러가기</span></button>` : ''}
            ${bingeCount > 0 ? `<button onclick="setVideoTab('binge')" class="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-amber-600/30"><span>🍿 몰아보기 (${bingeCount}개) 보러가기</span></button>` : ''}
          </div>
        </div>
      `;
    } else {
      videosHtml = `
        <div class="col-span-full py-16 text-center bg-zinc-900/40 rounded-2xl border border-zinc-800/50">
          <div class="w-14 h-14 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mb-3 text-2xl">🍿</div>
          <h4 class="text-lg font-bold text-zinc-300">등록된 몰아보기 영상이 없습니다.</h4>
          <div class="mt-4 flex items-center justify-center gap-2 flex-wrap">
            ${clipCount > 0 ? `<button onclick="setVideoTab('clip')" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-red-600/30"><span>🎬 편집 영상 (${clipCount}개) 보러가기</span></button>` : ''}
            ${fullCount > 0 ? `<button onclick="setVideoTab('full')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"><span>📹 풀 영상 (${fullCount}개) 보러가기</span></button>` : ''}
          </div>
        </div>
      `;
    }
  }

  const baseAffiliation = cat.hasSubgroups ? `${group.emoji || ''} ${group.name}` : `${cat.emoji || ''} ${cat.name}`;
  let affiliationsText = baseAffiliation;
  if (Array.isArray(member.affiliations) && member.affiliations.length > 1) {
    const allNames = member.affiliations.map(a => {
      const c = KONGBAB_DATA.categories.find(catItem => catItem.id === a.category);
      if (a.subgroup && c?.groups) {
        const g = c.groups.find(grp => grp.id === a.subgroup);
        return `${c?.emoji || ''} ${g ? g.name : c?.name}`;
      }
      return `${c?.emoji || ''} ${c?.name || a.category}`;
    });
    affiliationsText = allNames.join(" · ");
  }

  container.innerHTML = `
    <div class="mb-8">
      ${backButtonHtml}
      <div class="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div class="flex items-center gap-6 relative z-10">
          <img src="${getMemberAvatar(member)}" alt="${member.name}" class="w-24 h-24 md:w-28 md:h-28 rounded-3xl object-cover border-4 border-zinc-800 shadow-2xl" />
          <div>
            <div class="flex items-center gap-2.5 mb-1.5 flex-wrap">
              ${member.role ? `<span class="text-xs font-bold px-2.5 py-1 rounded-md ${member.badgeColor || 'bg-red-700'} text-white">${member.role}</span>` : ''}
              <span class="text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-800 text-zinc-300">소속: ${affiliationsText}</span>
              ${Array.isArray(member.affiliations) && member.affiliations.length > 1 ? `<span class="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/50 text-amber-300">겸직 중</span>` : ''}
            </div>
            <div class="flex items-center gap-3 flex-wrap">
              <h2 class="text-3xl md:text-4xl font-extrabold text-white tracking-tight">${member.streamer}</h2>
              ${member.subscriberCount ? `
                <span class="inline-flex items-center gap-1.5 text-xs font-bold text-red-300 bg-red-950/80 border border-red-700/50 px-2.5 py-1 rounded-lg shadow-sm" title="유튜브 채널 구독자 수">
                  <svg class="w-3.5 h-3.5 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  <span>${member.subscriberCount}</span>
                </span>
              ` : ''}
            </div>
            <p class="text-amber-400 text-base font-semibold mt-1">RP 캐릭터: ${member.name}</p>
            ${isAdmin() ? `
              <div class="flex items-center gap-2 mt-3">
                <button onclick="openMemberModal('edit', '${member.id}')" class="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1">✏️ 정보 수정</button>
                <button onclick="deleteMember('${member.id}')" class="px-3 py-1.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white text-xs font-semibold border border-red-800/50 transition-colors cursor-pointer inline-flex items-center gap-1">🗑️ 인원 삭제</button>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="flex items-center gap-3 self-start md:self-auto border-t md:border-t-0 border-zinc-800/80 pt-4 md:pt-0 flex-wrap">
          <button onclick="setVideoTab('clip')" title="편집 영상만 보기" class="bg-zinc-950/80 hover:bg-zinc-800/90 border ${currentTab === 'clip' ? 'border-red-500 ring-2 ring-red-500/30 bg-red-950/20' : 'border-zinc-800'} rounded-2xl px-4 sm:px-5 py-3 text-center min-w-[115px] sm:min-w-[130px] transition-all cursor-pointer shadow-lg group">
            <span class="text-xs sm:text-sm text-zinc-300 block font-bold group-hover:text-white transition-colors">🎬 편집 영상</span>
            <span class="text-2xl sm:text-3xl font-black text-red-400 my-0.5 block tracking-tight">${clipCount}<span class="text-xs sm:text-sm font-semibold text-zinc-300 ml-1">개</span></span>
            <span class="text-xs sm:text-sm text-amber-300 font-extrabold font-mono block bg-black/60 px-2.5 py-1 rounded-lg border border-amber-500/30 shadow-inner mt-1">${clipTotalDuration}</span>
          </button>
          <button onclick="setVideoTab('full')" title="풀 영상만 보기" class="bg-zinc-950/80 hover:bg-zinc-800/90 border ${currentTab === 'full' ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-950/20' : 'border-zinc-800'} rounded-2xl px-4 sm:px-5 py-3 text-center min-w-[115px] sm:min-w-[130px] transition-all cursor-pointer shadow-lg group">
            <span class="text-xs sm:text-sm text-zinc-300 block font-bold group-hover:text-white transition-colors">📹 풀 영상</span>
            <span class="text-2xl sm:text-3xl font-black text-indigo-400 my-0.5 block tracking-tight">${fullCount}<span class="text-xs sm:text-sm font-semibold text-zinc-300 ml-1">개</span></span>
            <span class="text-xs sm:text-sm text-amber-300 font-extrabold font-mono block bg-black/60 px-2.5 py-1 rounded-lg border border-amber-500/30 shadow-inner mt-1">${fullTotalDuration}</span>
          </button>
          ${bingeCount > 0 ? `
            <button onclick="setVideoTab('binge')" title="몰아보기 영상만 보기" class="bg-zinc-950/80 hover:bg-zinc-800/90 border ${currentTab === 'binge' ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-950/20' : 'border-zinc-800'} rounded-2xl px-4 sm:px-5 py-3 text-center min-w-[115px] sm:min-w-[130px] transition-all cursor-pointer shadow-lg group">
              <span class="text-xs sm:text-sm text-zinc-300 block font-bold group-hover:text-white transition-colors">🍿 몰아보기</span>
              <span class="text-2xl sm:text-3xl font-black text-amber-400 my-0.5 block tracking-tight">${bingeCount}<span class="text-xs sm:text-sm font-semibold text-zinc-300 ml-1">개</span></span>
              <span class="text-xs sm:text-sm text-amber-300 font-extrabold font-mono block bg-black/60 px-2.5 py-1 rounded-lg border border-amber-500/30 shadow-inner mt-1">${bingeTotalDuration}</span>
            </button>
          ` : ''}
        </div>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl w-fit">
          <button onclick="setVideoTab('clip')" class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${currentTab === 'clip' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'}">
            <span>🎬 편집 영상</span>
            <span class="text-[11px] px-1.5 py-0.5 rounded-full ${currentTab === 'clip' ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'}">${clipCount}</span>
          </button>
          <button onclick="setVideoTab('full')" class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${currentTab === 'full' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'}">
            <span>📹 풀 영상</span>
            <span class="text-[11px] px-1.5 py-0.5 rounded-full ${currentTab === 'full' ? 'bg-black/30 text-white' : 'bg-zinc-800 text-zinc-400'}">${fullCount}</span>
          </button>
          <button onclick="setVideoTab('binge')" class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${currentTab === 'binge' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'}">
            <span>🍿 몰아보기</span>
            <span class="text-[11px] px-1.5 py-0.5 rounded-full ${currentTab === 'binge' ? 'bg-black/20 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'}">${bingeCount}</span>
          </button>
        </div>

        ${isAdmin() ? `
          <button onclick="openVideoModal('add')" class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer" title="새 영상 등록">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            <span>영상 추가</span>
          </button>
          <button onclick="openPlaylistModal()" class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 text-xs font-bold transition-all border border-amber-500/40 hover:border-amber-400 shadow-lg cursor-pointer" title="유튜브 재생목록에서 영상 일괄 등록">
            <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <span>📑 재생목록 일괄 등록</span>
          </button>
        ` : ''}
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${videosHtml}
    </div>
  `;
}

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
            (member.role && member.role.toLowerCase().includes(q))
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
          (member.role && member.role.toLowerCase().includes(q))
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
      html += `
        <div onclick="selectMemberFromSearch('${item.category.id}', ${item.group ? `'${item.group.id}'` : 'null'}, '${m.id}')" class="bg-zinc-900 border border-zinc-800 hover:border-amber-400/50 rounded-2xl p-5 cursor-pointer transition-all hover:-translate-y-1">
          <div class="flex items-center gap-3.5 mb-3">
            <img src="${getMemberAvatar(m)}" class="w-14 h-14 rounded-2xl object-cover border border-zinc-700" />
            <div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">[인원] ${groupName}</span>
              <h4 class="text-lg font-bold text-white mt-1">${m.streamer}</h4>
              <p class="text-xs text-amber-400 font-medium">${m.name}${m.role ? ` (${m.role})` : ''}</p>
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
}

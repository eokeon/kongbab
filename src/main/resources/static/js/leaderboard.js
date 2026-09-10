/**
 * leaderboard.js
 * 콩밥 아카이브 명예의 전당 & 전체 통계
 */

let currentLeaderboardTab = 'total'; // 'total' | 'clip' | 'full' | 'binge' | 'count'
let leaderboardSearchQuery = '';

// 전체 멤버 목록 및 통계 데이터 추출
function getAllMembersWithLeaderboardStats() {
  const list = [];
  if (!KONGBAB_DATA || !KONGBAB_DATA.categories) return list;

  KONGBAB_DATA.categories.forEach(cat => {
    if (!cat.hasSubgroups) {
      (cat.members || []).forEach(m => {
        list.push(computeMemberLeaderboardStats(m, cat, null));
      });
    } else {
      (cat.groups || []).forEach(g => {
        (g.members || []).forEach(m => {
          list.push(computeMemberLeaderboardStats(m, cat, g));
        });
      });
    }
  });

  return list;
}

function computeMemberLeaderboardStats(m, cat, group) {
  const videos = (m.videos || []).filter(v => v && v.url && v.url !== "undefined" && v.url.trim() !== "");
  
  const clipVideos = videos.filter(v => typeof getVideoType === "function" ? getVideoType(v) === 'clip' : true);
  const fullVideos = videos.filter(v => typeof getVideoType === "function" ? getVideoType(v) === 'full' : false);
  const bingeVideos = videos.filter(v => typeof getVideoType === "function" ? getVideoType(v) === 'binge' : false);

  const clipCount = clipVideos.length;
  const fullCount = fullVideos.length;
  const bingeCount = bingeVideos.length;
  const totalCount = videos.length;

  const clipSec = clipVideos.reduce((sum, v) => sum + (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0), 0);
  const fullSec = fullVideos.reduce((sum, v) => sum + (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0), 0);
  const bingeSec = bingeVideos.reduce((sum, v) => sum + (typeof parseDurationToSeconds === "function" ? parseDurationToSeconds(v.duration) : 0), 0);
  const totalSec = clipSec + fullSec + bingeSec;

  return {
    ...m,
    catId: cat.id,
    catName: cat.name,
    catColor: cat.color || 'blue',
    catEmoji: cat.emoji || '',
    catBadge: cat.badge || cat.name,
    groupId: group ? group.id : null,
    groupName: group ? group.name : null,
    groupEmoji: group ? (group.emoji || '') : '',
    totalCount,
    clipCount,
    fullCount,
    bingeCount,
    totalSec,
    clipSec,
    fullSec,
    bingeSec,
    totalDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalSec) : "0분",
    clipDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(clipSec) : "0분",
    fullDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(fullSec) : "0분",
    bingeDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(bingeSec) : "0분",
  };
}

// 전체 종합 메트릭 계산
function computeGlobalMetrics(members) {
  const totalMembers = members.length;
  const totalVideos = members.reduce((sum, m) => sum + m.totalCount, 0);
  const totalSec = members.reduce((sum, m) => sum + m.totalSec, 0);

  const totalClipCount = members.reduce((sum, m) => sum + m.clipCount, 0);
  const totalClipSec = members.reduce((sum, m) => sum + m.clipSec, 0);

  const totalFullCount = members.reduce((sum, m) => sum + m.fullCount, 0);
  const totalFullSec = members.reduce((sum, m) => sum + m.fullSec, 0);

  const totalBingeCount = members.reduce((sum, m) => sum + m.bingeCount, 0);
  const totalBingeSec = members.reduce((sum, m) => sum + m.bingeSec, 0);

  return {
    totalMembers,
    totalVideos,
    totalSec,
    totalDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalSec) : "0분",
    totalClipCount,
    totalClipSec,
    totalClipDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalClipSec) : "0분",
    totalFullCount,
    totalFullSec,
    totalFullDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalFullSec) : "0분",
    totalBingeCount,
    totalBingeSec,
    totalBingeDurStr: typeof formatSecondsToHangul === "function" ? formatSecondsToHangul(totalBingeSec) : "0분",
  };
}

// 모달 열기
function openLeaderboardModal() {
  const modal = document.getElementById("leaderboard-modal");
  if (!modal) return;

  leaderboardSearchQuery = '';

  // 모달 뼈대 초기화/업데이트
  initOrUpdateLeaderboardModal();

  // 검색 인풋 초기화
  const searchInput = document.getElementById("leaderboard-search-input");
  if (searchInput) {
    searchInput.value = '';
  }
  const clearBtn = document.getElementById("leaderboard-search-clear");
  if (clearBtn) {
    clearBtn.classList.add("hidden");
  }

  // 동적 컨텐츠 렌더링
  renderLeaderboardDynamicContent();

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.style.overflow = "hidden";
}

// 모달 닫기
function closeLeaderboardModal() {
  const modal = document.getElementById("leaderboard-modal");
  if (!modal) return;

  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.style.overflow = "";
}

// 탭 변경
function setLeaderboardTab(tab) {
  if (currentLeaderboardTab === tab) return;
  currentLeaderboardTab = tab;
  renderLeaderboardTabButtons();
  renderLeaderboardDynamicContent();
}

// 검색어 입력
function handleLeaderboardSearch(query) {
  leaderboardSearchQuery = (query || '').trim().toLowerCase();
  
  const clearBtn = document.getElementById("leaderboard-search-clear");
  if (clearBtn) {
    if (leaderboardSearchQuery) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }

  renderLeaderboardDynamicContent();
}

// 검색어 비우기
function clearLeaderboardSearch() {
  leaderboardSearchQuery = '';
  const searchInput = document.getElementById("leaderboard-search-input");
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  const clearBtn = document.getElementById("leaderboard-search-clear");
  if (clearBtn) {
    clearBtn.classList.add("hidden");
  }
  renderLeaderboardDynamicContent();
}

// 탭 버튼 목록 렌더링
function renderLeaderboardTabButtons() {
  const container = document.getElementById("leaderboard-tab-buttons");
  if (!container) return;

  const tabDefs = [
    { key: 'total', label: '전체 시간순', emoji: '👑' },
    { key: 'clip', label: '편집 영상', emoji: '✂️' },
    { key: 'full', label: '풀 영상', emoji: '🎥' },
    { key: 'binge', label: '몰아보기', emoji: '🍿' },
    { key: 'count', label: '영상 개수순', emoji: '🎬' },
  ];

  container.innerHTML = tabDefs.map(t => {
    const isActive = currentLeaderboardTab === t.key;
    const activeClass = isActive 
      ? "bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20" 
      : "bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800";
    return `
      <button 
        type="button"
        onclick="setLeaderboardTab('${t.key}')" 
        class="flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeClass}"
      >
        <span>${t.emoji}</span>
        <span>${t.label}</span>
      </button>
    `;
  }).join("");
}

// 상단 글로벌 통계 요약 카드 렌더링
function renderGlobalStatsCards(globalStats) {
  return `
    <!-- 총 소속 인원 -->
    <div class="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-2">
        <span class="font-medium">총 소속 인원</span>
        <span class="text-zinc-500">👥</span>
      </div>
      <div>
        <div class="text-xl sm:text-2xl font-bold text-white tracking-tight">${globalStats.totalMembers}명</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">활동 스트리머</div>
      </div>
    </div>

    <!-- 총 영상 개수 -->
    <div class="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-2">
        <span class="font-medium">등록된 총 영상</span>
        <span class="text-zinc-500">🎬</span>
      </div>
      <div>
        <div class="text-xl sm:text-2xl font-bold text-amber-400 tracking-tight">${globalStats.totalVideos}개</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">누적 아카이브</div>
      </div>
    </div>

    <!-- 총 누적 시간 -->
    <div class="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-2">
        <span class="font-medium">총 누적 시간</span>
        <span class="text-amber-400">⏱️</span>
      </div>
      <div>
        <div class="text-base sm:text-lg font-bold text-amber-400 tracking-tight leading-tight">${globalStats.totalDurStr}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">전체 플레이타임</div>
      </div>
    </div>

    <!-- 편집 영상 합산 -->
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-2">
        <span class="font-medium flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          <span>편집 영상</span>
        </span>
        <span class="text-zinc-500 text-[10px]">${globalStats.totalClipCount}개</span>
      </div>
      <div>
        <div class="text-sm sm:text-base font-bold text-red-400 tracking-tight leading-tight">${globalStats.totalClipDurStr}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">총 ${globalStats.totalClipCount}개 등록됨</div>
      </div>
    </div>

    <!-- 풀 영상 합산 -->
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-2">
        <span class="font-medium flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
          <span>풀 영상</span>
        </span>
        <span class="text-zinc-500 text-[10px]">${globalStats.totalFullCount}개</span>
      </div>
      <div>
        <div class="text-sm sm:text-base font-bold text-indigo-400 tracking-tight leading-tight">${globalStats.totalFullDurStr}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">총 ${globalStats.totalFullCount}개 등록됨</div>
      </div>
    </div>

    <!-- 몰아보기 합산 -->
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-2">
        <span class="font-medium flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span>몰아보기</span>
        </span>
        <span class="text-zinc-500 text-[10px]">${globalStats.totalBingeCount}개</span>
      </div>
      <div>
        <div class="text-sm sm:text-base font-bold text-amber-300 tracking-tight leading-tight">${globalStats.totalBingeDurStr}</div>
        <div class="text-[11px] text-zinc-500 mt-0.5">총 ${globalStats.totalBingeCount}개 등록됨</div>
      </div>
    </div>
  `;
}

// 모달 뼈대 초기화/업데이트
function initOrUpdateLeaderboardModal() {
  const container = document.getElementById("leaderboard-modal-content");
  if (!container) return;

  const allMembers = getAllMembersWithLeaderboardStats();
  const globalStats = computeGlobalMetrics(allMembers);

  let statsEl = document.getElementById("leaderboard-global-stats");
  if (!statsEl || !document.getElementById("leaderboard-dynamic-content")) {
    container.innerHTML = `
      <!-- 1. 상단 글로벌 통계 요약 카드들 -->
      <div id="leaderboard-global-stats" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 mb-6 flex-shrink-0">
        ${renderGlobalStatsCards(globalStats)}
      </div>

      <!-- 2. 통계 탭 컨트롤 & 검색 바 -->
      <div id="leaderboard-controls" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-zinc-800/80 pb-4 flex-shrink-0">
        <!-- 탭 목록 -->
        <div id="leaderboard-tab-buttons" class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        </div>

        <!-- 검색 인풋 -->
        <div class="relative min-w-[200px] sm:w-64">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input 
            type="text" 
            id="leaderboard-search-input"
            value=""
            oninput="handleLeaderboardSearch(this.value)"
            placeholder="인원, 스트리머, 그룹 검색..." 
            autocomplete="off"
            class="w-full pl-9 pr-8 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all"
          />
          <button 
            id="leaderboard-search-clear"
            type="button" 
            onclick="clearLeaderboardSearch()" 
            class="hidden absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer text-xs"
            title="검색어 지우기"
          >✕</button>
        </div>
      </div>

      <!-- 3. 동적 컨텐츠 (포디움 + 순위 목록) -->
      <div id="leaderboard-dynamic-content"></div>
    `;
    renderLeaderboardTabButtons();
  } else {
    statsEl.innerHTML = renderGlobalStatsCards(globalStats);
    renderLeaderboardTabButtons();
  }
}

// 동적 컨텐츠 (포디움 + 순위 목록) 렌더링
function renderLeaderboardDynamicContent() {
  const dynamicContainer = document.getElementById("leaderboard-dynamic-content");
  if (!dynamicContainer) return;

  const allMembers = getAllMembersWithLeaderboardStats();

  // 탭 정렬 로직
  let sortedMembers = [...allMembers];
  if (currentLeaderboardTab === 'total') {
    sortedMembers.sort((a, b) => b.totalSec - a.totalSec || b.totalCount - a.totalCount);
  } else if (currentLeaderboardTab === 'clip') {
    sortedMembers.sort((a, b) => b.clipSec - a.clipSec || b.clipCount - a.clipCount);
  } else if (currentLeaderboardTab === 'full') {
    sortedMembers.sort((a, b) => b.fullSec - a.fullSec || b.fullCount - a.fullCount);
  } else if (currentLeaderboardTab === 'binge') {
    sortedMembers.sort((a, b) => b.bingeSec - a.bingeSec || b.bingeCount - a.bingeCount);
  } else if (currentLeaderboardTab === 'count') {
    sortedMembers.sort((a, b) => b.totalCount - a.totalCount || b.totalSec - a.totalSec);
  }

  // 검색 필터링
  if (leaderboardSearchQuery) {
    sortedMembers = sortedMembers.filter(m => {
      const nameMatch = (m.name || '').toLowerCase().includes(leaderboardSearchQuery);
      const roleMatch = (m.role || '').toLowerCase().includes(leaderboardSearchQuery);
      const streamerMatch = (m.streamerName || '').toLowerCase().includes(leaderboardSearchQuery);
      const catMatch = (m.catName || '').toLowerCase().includes(leaderboardSearchQuery);
      const groupMatch = (m.groupName || '').toLowerCase().includes(leaderboardSearchQuery);
      return nameMatch || roleMatch || streamerMatch || catMatch || groupMatch;
    });
  }

  // 1위 값 (프로그레스 바 백분율 기준)
  let maxVal = 1;
  if (sortedMembers.length > 0) {
    if (currentLeaderboardTab === 'total') maxVal = Math.max(1, sortedMembers[0].totalSec);
    else if (currentLeaderboardTab === 'clip') maxVal = Math.max(1, sortedMembers[0].clipSec);
    else if (currentLeaderboardTab === 'full') maxVal = Math.max(1, sortedMembers[0].fullSec);
    else if (currentLeaderboardTab === 'binge') maxVal = Math.max(1, sortedMembers[0].bingeSec);
    else if (currentLeaderboardTab === 'count') maxVal = Math.max(1, sortedMembers[0].totalCount);
  }

  // 상위 TOP 3 (검색 중이 아니고 3명 이상일 때)
  const showPodium = !leaderboardSearchQuery && sortedMembers.length >= 3;
  const top1 = showPodium ? sortedMembers[0] : null;
  const top2 = showPodium ? sortedMembers[1] : null;
  const top3 = showPodium ? sortedMembers[2] : null;

  // 값 포맷 헬퍼
  const getTabMetric = (m) => {
    if (currentLeaderboardTab === 'total') {
      return { valStr: m.totalDurStr, subStr: `${m.totalCount}개 영상`, sec: m.totalSec };
    } else if (currentLeaderboardTab === 'clip') {
      return { valStr: m.clipDurStr, subStr: `${m.clipCount}개 영상`, sec: m.clipSec };
    } else if (currentLeaderboardTab === 'full') {
      return { valStr: m.fullDurStr, subStr: `${m.fullCount}개 영상`, sec: m.fullSec };
    } else if (currentLeaderboardTab === 'binge') {
      return { valStr: m.bingeDurStr, subStr: `${m.bingeCount}개 영상`, sec: m.bingeSec };
    } else {
      return { valStr: `${m.totalCount}개`, subStr: m.totalDurStr, sec: m.totalCount };
    }
  };

  let html = '';

  // 포디움 렌더링
  if (showPodium) {
    html += `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 pt-2">
        <!-- 2위 🥈 -->
        <div 
          onclick="selectMemberFromLeaderboard('${top2.catId}', '${top2.groupId || ''}', '${top2.name}')"
          class="order-2 md:order-1 bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800/90 hover:border-zinc-600 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-lg group relative"
        >
          <div class="absolute -top-3 w-7 h-7 rounded-full bg-zinc-400/20 border border-zinc-400 flex items-center justify-center text-sm shadow">🥈</div>
          <div class="relative w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-400/40 my-2 group-hover:scale-105 transition-transform bg-zinc-800">
            <img src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(top2) : (top2.profileImage || 'assets/default-avatar.png')}" onerror="this.src='assets/default-avatar.png'" class="w-full h-full object-cover" />
          </div>
          <h4 class="text-base font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-1">
            <span>${top2.name}</span>
          </h4>
          <p class="text-xs text-zinc-400 mb-2">${top2.role || top2.streamerName || '-'}</p>
          <div class="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 mb-3 border border-zinc-700/50">
            ${top2.groupName ? `${top2.groupEmoji || ''} ${top2.groupName}` : `${top2.catEmoji || ''} ${top2.catBadge}`}
          </div>
          <div class="w-full pt-2 border-t border-zinc-800 flex flex-col items-center">
            <span class="text-base font-bold text-white">${getTabMetric(top2).valStr}</span>
            <span class="text-[11px] text-zinc-400">${getTabMetric(top2).subStr}</span>
          </div>
        </div>

        <!-- 1위 🥇 -->
        <div 
          onclick="selectMemberFromLeaderboard('${top1.catId}', '${top1.groupId || ''}', '${top1.name}')"
          class="order-1 md:order-2 bg-gradient-to-b from-amber-950/30 via-zinc-900 to-zinc-950 border-2 border-amber-500/60 hover:border-amber-400 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:-translate-y-1.5 shadow-xl shadow-amber-500/10 group relative"
        >
          <div class="absolute -top-4 w-9 h-9 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center text-base shadow-lg shadow-amber-500/40">👑</div>
          <div class="relative w-20 h-20 rounded-full overflow-hidden border-2 border-amber-400 my-2 group-hover:scale-105 transition-transform bg-zinc-800 shadow-md">
            <img src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(top1) : (top1.profileImage || 'assets/default-avatar.png')}" onerror="this.src='assets/default-avatar.png'" class="w-full h-full object-cover" />
          </div>
          <h4 class="text-lg font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-1.5 mt-1">
            <span>${top1.name}</span>
          </h4>
          <p class="text-xs text-amber-200/80 font-medium mb-2">${top1.role || top1.streamerName || '-'}</p>
          <div class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 mb-3 border border-amber-500/30">
            ${top1.groupName ? `${top1.groupEmoji || ''} ${top1.groupName}` : `${top1.catEmoji || ''} ${top1.catBadge}`}
          </div>
          <div class="w-full pt-2.5 border-t border-zinc-800 flex flex-col items-center">
            <span class="text-xl font-bold text-amber-400 tracking-tight">${getTabMetric(top1).valStr}</span>
            <span class="text-xs text-zinc-300">${getTabMetric(top1).subStr}</span>
          </div>
        </div>

        <!-- 3위 🥉 -->
        <div 
          onclick="selectMemberFromLeaderboard('${top3.catId}', '${top3.groupId || ''}', '${top3.name}')"
          class="order-3 bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800/90 hover:border-zinc-600 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:-translate-y-1 shadow-lg group relative"
        >
          <div class="absolute -top-3 w-7 h-7 rounded-full bg-amber-700/20 border border-amber-700 flex items-center justify-center text-sm shadow">🥉</div>
          <div class="relative w-16 h-16 rounded-full overflow-hidden border-2 border-amber-700/40 my-2 group-hover:scale-105 transition-transform bg-zinc-800">
            <img src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(top3) : (top3.profileImage || 'assets/default-avatar.png')}" onerror="this.src='assets/default-avatar.png'" class="w-full h-full object-cover" />
          </div>
          <h4 class="text-base font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-1 mt-1">
            <span>${top3.name}</span>
          </h4>
          <p class="text-xs text-zinc-400 mb-2">${top3.role || top3.streamerName || '-'}</p>
          <div class="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 mb-3 border border-zinc-700/50">
            ${top3.groupName ? `${top3.groupEmoji || ''} ${top3.groupName}` : `${top3.catEmoji || ''} ${top3.catBadge}`}
          </div>
          <div class="w-full pt-2 border-t border-zinc-800 flex flex-col items-center">
            <span class="text-base font-bold text-white">${getTabMetric(top3).valStr}</span>
            <span class="text-[11px] text-zinc-400">${getTabMetric(top3).subStr}</span>
          </div>
        </div>
      </div>
    `;
  }

  // 순위 목록 테이블
  html += `
    <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-md">
      <div class="px-4 py-3 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-400 font-semibold bg-zinc-900/90">
        <div class="w-12 text-center">순위</div>
        <div class="flex-1 px-3">스트리머 / 인원</div>
        <div class="hidden sm:block w-36 px-2 text-left">소속</div>
        <div class="w-36 sm:w-56 px-2 text-right">플레이타임 / 개수</div>
        <div class="w-8"></div>
      </div>

      <div class="divide-y divide-zinc-800/60 max-h-[460px] overflow-y-auto">
        ${sortedMembers.length === 0 ? `
          <div class="py-16 text-center text-zinc-500">
            <div class="text-3xl mb-2">🔍</div>
            <p class="text-sm font-bold text-zinc-400 mb-1">검색 결과가 없습니다</p>
            <p class="text-xs text-zinc-500">'${leaderboardSearchQuery}' 검색어와 일치하는 스트리머 또는 그룹이 없습니다.</p>
          </div>
        ` : sortedMembers.map((m, idx) => {
          const rank = idx + 1;
          const metric = getTabMetric(m);
          const percent = maxVal > 0 ? Math.min(100, Math.round((metric.sec / maxVal) * 100)) : 0;

          // 메달 뱃지
          let medalBadge = `<span class="text-zinc-400 font-bold text-xs">#${rank}</span>`;
          if (rank === 1) medalBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/40">🥇</span>`;
          else if (rank === 2) medalBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-400/20 text-zinc-300 font-bold text-xs border border-zinc-400/40">🥈</span>`;
          else if (rank === 3) medalBadge = `<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-800/20 text-amber-500 font-bold text-xs border border-amber-700/40">🥉</span>`;

          const groupLabel = m.groupName 
            ? `${m.groupEmoji || ''} ${m.groupName}` 
            : `${m.catEmoji || ''} ${m.catBadge}`;

          return `
            <div 
              onclick="selectMemberFromLeaderboard('${m.catId}', '${m.groupId || ''}', '${m.name}')"
              class="px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer group"
            >
              <!-- 순위 -->
              <div class="w-12 text-center flex-shrink-0 flex items-center justify-center">
                ${medalBadge}
              </div>

              <!-- 프로필 및 인원 정보 -->
              <div class="flex-1 px-3 flex items-center gap-3 min-w-0">
                <img 
                  src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(m) : (m.profileImage || 'assets/default-avatar.png')}" 
                  onerror="this.src='assets/default-avatar.png'" 
                  class="w-10 h-10 rounded-full object-cover border border-zinc-700 bg-zinc-800 flex-shrink-0 group-hover:scale-105 transition-transform"
                />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-white group-hover:text-amber-400 transition-colors truncate">${m.name}</span>
                    ${m.streamerName && m.streamerName !== m.name ? `<span class="text-[11px] text-zinc-500 truncate">(${m.streamerName})</span>` : ''}
                  </div>
                  <div class="text-xs text-zinc-400 truncate">
                    ${m.role || '-'}
                  </div>
                </div>
              </div>

              <!-- 소속 그룹 / 카테고리 -->
              <div class="hidden sm:block w-36 px-2 text-left truncate flex-shrink-0">
                <span class="inline-block text-xs text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-md border border-zinc-700/40 truncate max-w-full">
                  ${groupLabel}
                </span>
              </div>

              <!-- 메트릭 바 & 수치 -->
              <div class="w-36 sm:w-56 px-2 text-right flex-shrink-0">
                <div class="font-bold text-sm text-white tracking-tight leading-tight">
                  ${metric.valStr}
                </div>
                <div class="flex items-center justify-end gap-2 mt-1">
                  <span class="text-[11px] text-zinc-500">${metric.subStr}</span>
                  <div class="w-16 sm:w-20 bg-zinc-800 rounded-full h-1.5 overflow-hidden hidden sm:block">
                    <div class="bg-amber-400 h-full rounded-full transition-all duration-300" style="width: ${percent}%;"></div>
                  </div>
                </div>
              </div>

              <!-- 이동 화살표 -->
              <div class="w-8 flex-shrink-0 text-right text-zinc-600 group-hover:text-amber-400 transition-colors flex justify-end">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  dynamicContainer.innerHTML = html;
}

// 순위 리스트에서 멤버 클릭 시 해당 페이지로 바로 이동
function selectMemberFromLeaderboard(catId, groupId, memberName) {
  closeLeaderboardModal();

  // 1. 카테고리 설정
  state.currentCategory = catId;
  state.currentGroup = null;
  state.currentMember = null;
  state.searchQuery = "";

  const cat = (KONGBAB_DATA.categories || []).find(c => c.id === catId);
  if (!cat) return;

  // 2. 그룹 설정
  if (groupId && cat.hasSubgroups) {
    const grp = (cat.groups || []).find(g => g.id === groupId);
    if (grp) {
      state.currentGroup = grp;
      const mem = (grp.members || []).find(m => m.name === memberName);
      if (mem) {
        state.currentMember = mem;
      }
    }
  } else {
    const mem = (cat.members || []).find(m => m.name === memberName);
    if (mem) {
      state.currentMember = mem;
    }
  }

  // 3. 네비게이션 렌더링
  if (typeof renderCategoryTabs === "function") renderCategoryTabs();
  if (typeof renderContent === "function") renderContent();

  window.scrollTo({ top: 0, behavior: "smooth" });
}


// 전역 노출
window.openLeaderboardModal = openLeaderboardModal;
window.closeLeaderboardModal = closeLeaderboardModal;
window.setLeaderboardTab = setLeaderboardTab;
window.handleLeaderboardSearch = handleLeaderboardSearch;
window.clearLeaderboardSearch = clearLeaderboardSearch;
window.selectMemberFromLeaderboard = selectMemberFromLeaderboard;



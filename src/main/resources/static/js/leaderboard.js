/**
 * leaderboard.js
 * 콩밥 아카이브 명예의 전당 & 전체 통계
 */

let currentLeaderboardTab = 'total'; // 'total' | 'clip' | 'full' | 'binge' | 'count'
let leaderboardSearchQuery = '';

// 전체 멤버 목록 및 통계 데이터 추출
// 전체 멤버 목록 및 통계 데이터 추출 (고유 스트리머 기준 중복 제거 및 겸직 소속 병합)
function getAllMembersWithLeaderboardStats() {
  if (!KONGBAB_DATA || !KONGBAB_DATA.categories) return [];

  const memberMap = new Map();

  KONGBAB_DATA.categories.forEach(cat => {
    const processMember = (m, group) => {
      if (!m) return;
      const key = m.id || (m.streamer && m.name ? `${m.streamer}_${m.name}` : m.name);
      if (!key) return;

      if (!memberMap.has(key)) {
        memberMap.set(key, computeMemberLeaderboardStats(m, cat, group));
      } else {
        // 이미 등록된 멤버인 경우 (겸직 등으로 여러 카테고리에 속한 경우)
        // 통계 수치는 중복 합산하지 않고, 소속 명칭만 보강 병합
        const existing = memberMap.get(key);
        const currentAffName = group ? `${group.emoji || ''} ${group.name}`.trim() : `${cat.emoji || ''} ${cat.name}`.trim();
        if (currentAffName && existing.displayAffiliation && !existing.displayAffiliation.includes(currentAffName)) {
          existing.displayAffiliation = `${existing.displayAffiliation} · ${currentAffName}`;
        }
        // 직책(role)이 기존에 비어있고 현재 m에 있다면 보강 병합
        if (!existing.role) {
          let r = (m.role && String(m.role).trim() !== "") ? m.role : "";
          if (!r && Array.isArray(m.affiliations)) {
            const fa = m.affiliations.find(a => a && a.role && String(a.role).trim() !== "");
            if (fa) r = fa.role;
          }
          if (r) {
            existing.role = r;
          }
        }
        // 추가 직책(swatRole)이 기존에 비어있고 현재 m에 있다면 보강 병합
        if (!existing.swatRole) {
          let sRole = (m.swatRole && String(m.swatRole).trim() !== "") ? m.swatRole : "";
          if (!sRole && Array.isArray(m.affiliations)) {
            const fa = m.affiliations.find(a => a && a.swatRole && String(a.swatRole).trim() !== "");
            if (fa) sRole = fa.swatRole;
          }
          if (sRole) {
            existing.swatRole = sRole.replace(/순직|사직|퇴직|은퇴/g, "").replace(/\s*·\s*/g, "").replace(/^\s*,\s*|\s*,\s*$/g, "").trim();
          }
        }
      }
    };

    if (!cat.hasSubgroups) {
      (cat.members || []).forEach(m => processMember(m, null));
    } else {
      (cat.groups || []).forEach(g => {
        (g.members || []).forEach(m => processMember(m, g));
      });
    }
  });

  return Array.from(memberMap.values());
}

function computeMemberLeaderboardStats(m, cat, group) {
  // 유효한 비디오 필터링 (동일 URL 중복 등록 방지)
  const seenUrls = new Set();
  const rawVideos = (m.videos || []).filter(v => v && v.url && v.url !== "undefined" && v.url.trim() !== "");
  const videos = [];
  rawVideos.forEach(v => {
    const vKey = (v.url || v.id || '').trim().toLowerCase();
    if (vKey && !seenUrls.has(vKey)) {
      seenUrls.add(vKey);
      videos.push(v);
    } else if (!vKey) {
      videos.push(v);
    }
  });
  
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

  // 소속 텍스트 생성 (겸직 다중 소속 반영)
  let displayAffiliation = group ? `${group.emoji || ''} ${group.name}`.trim() : `${cat.emoji || ''} ${cat.name}`.trim();
  if (Array.isArray(m.affiliations) && m.affiliations.length > 1 && KONGBAB_DATA && Array.isArray(KONGBAB_DATA.categories)) {
    const allNames = m.affiliations.map(a => {
      const c = KONGBAB_DATA.categories.find(cItem => cItem.id === a.category);
      if (!c) return a.category;
      if (c.hasSubgroups) {
        const g = (c.groups || []).find(grp => grp.id === a.subgroup);
        return g ? `${g.emoji || ''} ${g.name}`.trim() : `${c.emoji || ''} ${c.name}`.trim();
      }
      return `${c.emoji || ''} ${c.name}`.trim();
    });
    const uniqueAffs = Array.from(new Set(allNames.filter(Boolean)));
    if (uniqueAffs.length > 0) {
      displayAffiliation = uniqueAffs.join(' · ');
    }
  }

  // role 보강 (m.role 또는 m.affiliations 내 role 확인)
  let memberRole = (m.role && String(m.role).trim() !== "") ? m.role : "";
  if (!memberRole && Array.isArray(m.affiliations)) {
    const currentAff = m.affiliations.find(a => a.category === cat.id && (!group || a.subgroup === group.id));
    if (currentAff && currentAff.role && String(currentAff.role).trim() !== "") {
      memberRole = currentAff.role;
    } else {
      const foundRoleAff = m.affiliations.find(a => a && a.role && String(a.role).trim() !== "");
      if (foundRoleAff) memberRole = foundRoleAff.role;
    }
  }

  // swatRole 보강 (m.swatRole 또는 m.affiliations 내 swatRole 확인)
  let memberSwatRole = (m.swatRole && String(m.swatRole).trim() !== "") ? m.swatRole : "";
  if (!memberSwatRole && Array.isArray(m.affiliations)) {
    const foundAff = m.affiliations.find(a => a && a.swatRole && String(a.swatRole).trim() !== "");
    if (foundAff) memberSwatRole = foundAff.swatRole;
  }
  if (memberSwatRole) {
    memberSwatRole = memberSwatRole.replace(/순직|사직|퇴직|은퇴/g, "").replace(/\s*·\s*/g, "").replace(/^\s*,\s*|\s*,\s*$/g, "").trim();
  }

  return {
    ...m,
    role: memberRole,
    swatRole: memberSwatRole,
    catId: cat.id,
    catName: cat.name,
    catColor: cat.color || 'blue',
    catEmoji: cat.emoji || '',
    catBadge: cat.badge || cat.name,
    groupId: group ? group.id : null,
    groupName: group ? group.name : null,
    groupEmoji: group ? (group.emoji || '') : '',
    displayAffiliation,
    streamerName: m.streamer || m.streamerName || '',
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

// 전체 종합 메트릭 계산 (고유 스트리머 및 고유 비디오 기준 중복 집계 방지)
function computeGlobalMetrics(members) {
  // 1. 혹시 모를 멤버 중복 방지 (동일 ID 또는 고유 스트리머 식별자 기준)
  const uniqueMembers = [];
  const seenMemberKeys = new Set();
  (members || []).forEach(m => {
    if (!m) return;
    const key = m.id || (m.streamer && m.name ? `${m.streamer}_${m.name}` : m.name);
    if (key && !seenMemberKeys.has(key)) {
      seenMemberKeys.add(key);
      uniqueMembers.push(m);
    } else if (!key) {
      uniqueMembers.push(m);
    }
  });

  const totalMembers = uniqueMembers.length;
  const totalVideos = uniqueMembers.reduce((sum, m) => sum + (m.totalCount || 0), 0);
  const totalSec = uniqueMembers.reduce((sum, m) => sum + (m.totalSec || 0), 0);

  const totalClipCount = uniqueMembers.reduce((sum, m) => sum + (m.clipCount || 0), 0);
  const totalClipSec = uniqueMembers.reduce((sum, m) => sum + (m.clipSec || 0), 0);

  const totalFullCount = uniqueMembers.reduce((sum, m) => sum + (m.fullCount || 0), 0);
  const totalFullSec = uniqueMembers.reduce((sum, m) => sum + (m.fullSec || 0), 0);

  const totalBingeCount = uniqueMembers.reduce((sum, m) => sum + (m.bingeCount || 0), 0);
  const totalBingeSec = uniqueMembers.reduce((sum, m) => sum + (m.bingeSec || 0), 0);

  // 전체 소속 인원 총합 구독자수 계산 (중복 스트리머/유튜브 채널 중복 집계 방지)
  const seenSubKeys = new Set();
  let totalSubCount = 0;
  uniqueMembers.forEach(m => {
    const ytKey = (m.youtubeUrl && typeof m.youtubeUrl === 'string' && m.youtubeUrl.trim())
      ? m.youtubeUrl.trim().toLowerCase().replace(/\/+$/, '')
      : null;
    const streamerKey = (m.streamer && typeof m.streamer === 'string' && m.streamer.trim())
      ? m.streamer.trim().toLowerCase()
      : null;
    const key = ytKey || streamerKey || m.id || m.name;
    if (key && !seenSubKeys.has(key)) {
      seenSubKeys.add(key);
      const count = typeof parseSubscriberCount === "function" ? parseSubscriberCount(m.subscriberCount) : 0;
      if (count > 0) {
        totalSubCount += count;
      }
    }
  });

  const totalSubStr = typeof formatSubscriberCount === "function" && totalSubCount > 0
    ? formatSubscriberCount(totalSubCount)
    : (totalSubCount > 0 ? `${totalSubCount.toLocaleString()}명` : "0명");

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
    totalSubCount,
    totalSubStr,
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
        <div class="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-1 truncate" title="전체 스트리머 총합 구독자 수: ${globalStats.totalSubStr}">
          <svg class="w-3 h-3 text-red-500 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          <span class="truncate">총 구독자 <span class="text-white font-bold">${globalStats.totalSubStr}</span></span>
        </div>
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
        <span class="text-white font-semibold text-[10px]">${globalStats.totalClipCount}개</span>
      </div>
      <div>
        <div class="text-sm sm:text-base font-bold text-red-400 tracking-tight leading-tight">${globalStats.totalClipDurStr}</div>
        <div class="text-[11px] text-white mt-0.5 font-medium">총 ${globalStats.totalClipCount}개 등록됨</div>
      </div>
    </div>

    <!-- 풀 영상 합산 -->
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-2">
        <span class="font-medium flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
          <span>풀 영상</span>
        </span>
        <span class="text-white font-semibold text-[10px]">${globalStats.totalFullCount}개</span>
      </div>
      <div>
        <div class="text-sm sm:text-base font-bold text-indigo-400 tracking-tight leading-tight">${globalStats.totalFullDurStr}</div>
        <div class="text-[11px] text-white mt-0.5 font-medium">총 ${globalStats.totalFullCount}개 등록됨</div>
      </div>
    </div>

    <!-- 몰아보기 합산 -->
    <div class="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3 flex flex-col justify-between shadow-sm">
      <div class="flex items-center justify-between text-zinc-400 text-xs mb-2">
        <span class="font-medium flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span>몰아보기</span>
        </span>
        <span class="text-white font-semibold text-[10px]">${globalStats.totalBingeCount}개</span>
      </div>
      <div>
        <div class="text-sm sm:text-base font-bold text-amber-300 tracking-tight leading-tight">${globalStats.totalBingeDurStr}</div>
        <div class="text-[11px] text-white mt-0.5 font-medium">총 ${globalStats.totalBingeCount}개 등록됨</div>
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
      const swatRoleMatch = (m.swatRole || '').toLowerCase().includes(leaderboardSearchQuery);
      const streamerMatch = (m.streamerName || '').toLowerCase().includes(leaderboardSearchQuery);
      const catMatch = (m.catName || '').toLowerCase().includes(leaderboardSearchQuery);
      const groupMatch = (m.groupName || '').toLowerCase().includes(leaderboardSearchQuery);
      const affMatch = (m.displayAffiliation || '').toLowerCase().includes(leaderboardSearchQuery);
      return nameMatch || roleMatch || swatRoleMatch || streamerMatch || catMatch || groupMatch || affMatch;
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
    const top2Role = [top2.role, top2.swatRole].filter(Boolean).join(' · ');
    const top1Role = [top1.role, top1.swatRole].filter(Boolean).join(' · ');
    const top3Role = [top3.role, top3.swatRole].filter(Boolean).join(' · ');

    const top2Aff = top2.displayAffiliation || (top2.groupName ? `${top2.groupEmoji || ''} ${top2.groupName}` : `${top2.catEmoji || ''} ${top2.catBadge}`);
    const top1Aff = top1.displayAffiliation || (top1.groupName ? `${top1.groupEmoji || ''} ${top1.groupName}` : `${top1.catEmoji || ''} ${top1.catBadge}`);
    const top3Aff = top3.displayAffiliation || (top3.groupName ? `${top3.groupEmoji || ''} ${top3.groupName}` : `${top3.catEmoji || ''} ${top3.catBadge}`);

    html += `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-6 pt-3">
        <!-- 2위 🥈 -->
        <div 
          onclick="selectMemberFromLeaderboard('${top2.catId}', '${top2.groupId || ''}', '${top2.name}', '${top2.id || ''}')"
          class="podium-card order-2 md:order-1 w-full bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800/90 hover:border-zinc-500 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer shadow-lg hover:shadow-zinc-500/15 group relative"
        >
          <div class="podium-badge -top-3 w-7 h-7 rounded-full bg-zinc-400/20 border border-zinc-400 flex items-center justify-center text-sm shadow">🥈</div>
          <div class="relative my-2">
            <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-zinc-400/60 group-hover:border-zinc-300 transition-colors duration-300 ease-out bg-zinc-800 shadow-md" style="mask-image: -webkit-radial-gradient(white, black); -webkit-mask-image: -webkit-radial-gradient(white, black);">
              <img src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(top2) : (top2.avatar || 'assets/default-avatar.svg')}" onerror="this.src='assets/default-avatar.svg'" class="podium-avatar-img w-full h-full object-cover" />
            </div>
            ${(typeof getSwatBadgeHtml === 'function' && top2.swatRole) ? getSwatBadgeHtml(top2.swatRole, 'sm') : ''}
            ${top2.role ? `
              <span class="absolute -bottom-1 -right-1 z-20 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(top2, top2.catId) : 'bg-zinc-800 text-white'} shadow-md">
                ${top2.role}
              </span>
            ` : ''}
          </div>
          <h4 class="text-base font-bold text-white group-hover:text-amber-400 transition-colors flex items-center justify-center gap-1.5 mt-1 truncate max-w-full flex-wrap">
            <span>${top2.streamerName || top2.name}</span>
            ${top2.role ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(top2, top2.catId) : 'bg-zinc-800 text-white'} shadow-sm whitespace-nowrap">${top2.role}</span>` : ''}
          </h4>
          <p class="text-xs text-zinc-300 mb-2 truncate max-w-full" title="${top2.name}">
            <span>${top2.name}</span>${top2Role ? ` <span class="text-zinc-500 text-[11px]">(${top2Role})</span>` : ''}
          </p>
          <div class="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 mb-3 border border-zinc-700/50 truncate max-w-[90%]" title="${top2Aff}">
            ${top2Aff}
          </div>
          <div class="w-full pt-2 border-t border-zinc-800 flex flex-col items-center">
            <span class="text-base font-bold text-white">${getTabMetric(top2).valStr}</span>
            <span class="text-[11px] text-zinc-400">${getTabMetric(top2).subStr}</span>
          </div>
        </div>

        <!-- 1위 🥇 -->
        <div 
          onclick="selectMemberFromLeaderboard('${top1.catId}', '${top1.groupId || ''}', '${top1.name}', '${top1.id || ''}')"
          class="podium-card order-1 md:order-2 w-full bg-gradient-to-b from-amber-950/30 via-zinc-900 to-zinc-950 border-2 border-amber-500/60 hover:border-amber-400 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer shadow-xl shadow-amber-500/10 hover:shadow-amber-500/25 group relative"
        >
          <div class="podium-badge -top-4 w-9 h-9 rounded-full bg-amber-500 text-black font-bold flex items-center justify-center text-base shadow-lg shadow-amber-500/40">👑</div>
          <div class="relative my-2">
            <div class="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-400 group-hover:border-amber-300 transition-colors duration-300 ease-out bg-zinc-800 shadow-md" style="mask-image: -webkit-radial-gradient(white, black); -webkit-mask-image: -webkit-radial-gradient(white, black);">
              <img src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(top1) : (top1.avatar || 'assets/default-avatar.svg')}" onerror="this.src='assets/default-avatar.svg'" class="podium-avatar-img w-full h-full object-cover" />
            </div>
            ${(typeof getSwatBadgeHtml === 'function' && top1.swatRole) ? getSwatBadgeHtml(top1.swatRole, 'sm') : ''}
            ${top1.role ? `
              <span class="absolute -bottom-1 -right-1 z-20 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(top1, top1.catId) : 'bg-zinc-800 text-white'} shadow-md">
                ${top1.role}
              </span>
            ` : ''}
          </div>
          <h4 class="text-lg font-bold text-white group-hover:text-amber-400 transition-colors flex items-center justify-center gap-1.5 mt-1 truncate max-w-full flex-wrap">
            <span>${top1.streamerName || top1.name}</span>
            ${top1.role ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(top1, top1.catId) : 'bg-zinc-800 text-white'} shadow-sm whitespace-nowrap">${top1.role}</span>` : ''}
          </h4>
          <p class="text-xs text-amber-200/90 font-medium mb-2 truncate max-w-full" title="${top1.name}">
            <span>${top1.name}</span>${top1Role ? ` <span class="text-amber-400/80 text-[11px]">(${top1Role})</span>` : ''}
          </p>
          <div class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 mb-3 border border-amber-500/50 truncate max-w-[90%]" title="${top1Aff}">
            ${top1Aff}
          </div>
          <div class="w-full pt-2 border-t border-zinc-800 flex flex-col items-center">
            <span class="text-lg font-black text-amber-400">${getTabMetric(top1).valStr}</span>
            <span class="text-xs text-zinc-400">${getTabMetric(top1).subStr}</span>
          </div>
        </div>

        <!-- 3위 🥉 -->
        <div 
          onclick="selectMemberFromLeaderboard('${top3.catId}', '${top3.groupId || ''}', '${top3.name}', '${top3.id || ''}')"
          class="podium-card order-3 w-full bg-gradient-to-b from-zinc-900/90 to-zinc-950 border border-zinc-800/90 hover:border-amber-700/60 rounded-2xl p-4 flex flex-col items-center text-center cursor-pointer shadow-lg hover:shadow-amber-700/15 group relative"
        >
          <div class="podium-badge -top-3 w-7 h-7 rounded-full bg-amber-800/30 border border-amber-700 flex items-center justify-center text-sm shadow">🥉</div>
          <div class="relative my-2">
            <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-700/60 group-hover:border-amber-600 transition-colors duration-300 ease-out bg-zinc-800 shadow-md" style="mask-image: -webkit-radial-gradient(white, black); -webkit-mask-image: -webkit-radial-gradient(white, black);">
              <img src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(top3) : (top3.avatar || 'assets/default-avatar.svg')}" onerror="this.src='assets/default-avatar.svg'" class="podium-avatar-img w-full h-full object-cover" />
            </div>
            ${(typeof getSwatBadgeHtml === 'function' && top3.swatRole) ? getSwatBadgeHtml(top3.swatRole, 'sm') : ''}
            ${top3.role ? `
              <span class="absolute -bottom-1 -right-1 z-20 text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(top3, top3.catId) : 'bg-zinc-800 text-white'} shadow-md">
                ${top3.role}
              </span>
            ` : ''}
          </div>
          <h4 class="text-base font-bold text-white group-hover:text-amber-400 transition-colors flex items-center justify-center gap-1.5 mt-1 truncate max-w-full flex-wrap">
            <span>${top3.streamerName || top3.name}</span>
            ${top3.role ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(top3, top3.catId) : 'bg-zinc-800 text-white'} shadow-sm whitespace-nowrap">${top3.role}</span>` : ''}
          </h4>
          <p class="text-xs text-zinc-300 mb-2 truncate max-w-full" title="${top3.name}">
            <span>${top3.name}</span>${top3Role ? ` <span class="text-zinc-500 text-[11px]">(${top3Role})</span>` : ''}
          </p>
          <div class="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 mb-3 border border-zinc-700/50 truncate max-w-[90%]" title="${top3Aff}">
            ${top3Aff}
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

          const groupLabel = m.displayAffiliation || (m.groupName 
            ? `${m.groupEmoji || ''} ${m.groupName}` 
            : `${m.catEmoji || ''} ${m.catBadge}`);

          const mRole = [m.role, m.swatRole].filter(Boolean).join(' · ');

          return `
            <div 
              onclick="selectMemberFromLeaderboard('${m.catId}', '${m.groupId || ''}', '${m.name}', '${m.id || ''}')"
              class="px-4 py-3 flex items-center justify-between hover:bg-zinc-800/50 transition-colors cursor-pointer group"
            >
              <!-- 순위 -->
              <div class="w-12 text-center flex-shrink-0 flex items-center justify-center">
                ${medalBadge}
              </div>

              <!-- 프로필 및 인원 정보 -->
              <div class="flex-1 px-3 flex items-center gap-3 min-w-0">
                <div class="relative flex-shrink-0">
                  <img 
                    src="${typeof getMemberAvatar === 'function' ? getMemberAvatar(m) : (m.avatar || 'assets/default-avatar.svg')}" 
                    onerror="this.src='assets/default-avatar.svg'" 
                    class="w-10 h-10 rounded-full object-cover border border-zinc-700 bg-zinc-800 flex-shrink-0 group-hover:scale-105 transition-transform duration-300"
                  />
                  ${(typeof getSwatBadgeHtml === 'function' && m.swatRole) ? getSwatBadgeHtml(m.swatRole, 'sm') : ''}
                  ${m.role ? `
                    <span class="absolute -bottom-1 -right-1 z-20 text-[8.5px] font-bold px-1 py-0.2 rounded ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(m, m.catId) : 'bg-zinc-800 text-white'} shadow">
                      ${m.role}
                    </span>
                  ` : ''}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-sm text-white group-hover:text-amber-400 transition-colors truncate">${m.streamerName || m.name}</span>
                    ${m.role ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md ${typeof getMemberRoleBadgeClass === 'function' ? getMemberRoleBadgeClass(m, m.catId) : 'bg-zinc-800 text-white'} shadow-sm whitespace-nowrap">${m.role}</span>` : ''}
                  </div>
                  <div class="text-xs text-zinc-400 truncate">
                    <span class="text-amber-400/90 font-medium">${m.name}</span>${mRole ? ` <span class="text-zinc-500 text-[11px]">(${mRole})</span>` : ''}
                  </div>
                </div>
              </div>

              <!-- 소속 그룹 / 카테고리 -->
              <div class="hidden sm:block w-36 px-2 text-left truncate flex-shrink-0" title="${groupLabel}">
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
                  <span class="text-[11px] text-zinc-300 font-medium">${metric.subStr}</span>
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
function selectMemberFromLeaderboard(catId, groupId, memberName, memberId = null) {
  closeLeaderboardModal();

  // 1. 카테고리 설정
  state.currentCategory = catId;
  state.currentGroup = null;
  state.currentMember = null;
  state.searchQuery = "";

  const cat = (KONGBAB_DATA.categories || []).find(c => c.id === catId);
  if (!cat) return;

  const matchFn = m => (memberId && m.id === memberId) || m.name === memberName || m.streamer === memberName;

  // 2. 그룹 설정
  if (groupId && cat.hasSubgroups) {
    const grp = (cat.groups || []).find(g => g.id === groupId);
    if (grp) {
      state.currentGroup = grp;
      const mem = (grp.members || []).find(matchFn);
      if (mem) {
        state.currentMember = mem;
      }
    }
  } else {
    const mem = (cat.members || []).find(matchFn);
    if (mem) {
      state.currentMember = mem;
    }
  }

  if (state.currentMember) {
    const allV = state.currentMember.videos || [];
    state.currentVideoTab = typeof getDefaultVideoTab === "function" ? getDefaultVideoTab(allV) : "clip";
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



/**
 * 콩밥특별시 GTA RP 아카이브 - 상태 및 공통 유틸리티 (state.js)
 * 
 * - 앱 상태 관리 (state)
 * - 로컬 스토리지 인증 및 커스텀 데이터 영구 보존
 * - 테마 스타일 및 SVG 아이콘
 * - 유튜브 URL 파싱 및 공통 알림(토스트)
 */

// 앱 상태 관리
const state = {
  currentCategory: "police", // 기본 선택 카테고리
  currentGroup: null,        // 선택된 하위 조직 (갱단, 사업체일 때)
  currentMember: null,       // 선택된 멤버
  currentVideoTab: "clip",   // 영상 종류 탭 ('clip': 편집 영상 | 'full': 풀 영상)
  searchQuery: "",           // 검색어
  currentUser: { role: "guest", username: "게스트" } // 'admin' | 'guest'
};

// 어드민 여부 확인
function isAdmin() {
  return !!(state.currentUser && state.currentUser.role === "admin");
}

// 로컬 스토리지 인증 정보 불러오기
function loadStoredAuth() {
  try {
    const saved = localStorage.getItem("kongbab_auth_user");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.role === "admin" || parsed.role === "guest")) {
        state.currentUser = parsed;
      }
    }
  } catch (e) {
    state.currentUser = { role: "guest", username: "게스트" };
  }
}

// 기본 사람 모양 실루엣 아바타
const DEFAULT_AVATAR = "assets/default-avatar.svg";

function getMemberAvatar(member) {
  if (!member) return DEFAULT_AVATAR;
  const av = typeof member === "string" ? member : (member.avatar || "");
  if (!av || av.includes("images.unsplash.com")) {
    return DEFAULT_AVATAR;
  }
  return av;
}

// 로컬 스토리지 커스텀 영상 데이터 동기화 (경찰 35명 유지 & 비경찰 더미 인원 제거 & 실루엣 아이콘)
const DATA_SYNC_VERSION = "2026.09.08-clean-dummies-v2";

function loadStoredData() {
  try {
    const saved = localStorage.getItem("kongbab_custom_data");
    const savedVersion = localStorage.getItem("kongbab_police_version");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.categories)) {
        const policeCat = parsed.categories.find(c => c.id === "police");
        const defaultPoliceCat = KONGBAB_DATA.categories.find(c => c.id === "police");
        
        // 이전 더미 경찰이거나 경찰 인원이 35명 미만인 경우 최신 명단으로 자동 동기화
        if (savedVersion !== DATA_SYNC_VERSION || !policeCat || policeCat.members?.some(m => m.name === "강철수") || (policeCat.members?.length || 0) < 30) {
          if (defaultPoliceCat) {
            const catIdx = parsed.categories.findIndex(c => c.id === "police");
            if (catIdx >= 0) {
              parsed.categories[catIdx] = JSON.parse(JSON.stringify(defaultPoliceCat));
            } else {
              parsed.categories.unshift(JSON.parse(JSON.stringify(defaultPoliceCat)));
            }
          }

          // 경찰을 제외한 모든 비경찰 카테고리의 초기 더미 인원(나천사, 김조합장 등) 제거 (조직/사업체 틀은 유지)
          parsed.categories.forEach(cat => {
            if (cat.id !== "police") {
              if (cat.hasSubgroups) {
                // 갱단 및 사업체: 그룹 목록은 유지하고 내부 인원만 비움
                (cat.groups || []).forEach(group => {
                  group.members = [];
                });
              } else {
                // EMS, 기자, 시민: 인원 목록 비움
                cat.members = [];
              }
            }
          });

          localStorage.setItem("kongbab_police_version", DATA_SYNC_VERSION);
        }

        // 실제 인물 사진(unsplash 등)을 사람 모양 실루엣 아이콘으로 일괄 정리 및 bio 속성 제거
        parsed.categories.forEach(cat => {
          const list = cat.hasSubgroups ? (cat.groups || []).flatMap(g => g.members || []) : (cat.members || []);
          list.forEach(m => {
            if (!m.avatar || m.avatar.includes("images.unsplash.com")) {
              m.avatar = DEFAULT_AVATAR;
            }
            if ('bio' in m) {
              delete m.bio;
            }
          });
        });

        localStorage.setItem("kongbab_custom_data", JSON.stringify(parsed));
        KONGBAB_DATA.categories = parsed.categories;
      }
    } else {
      localStorage.setItem("kongbab_police_version", DATA_SYNC_VERSION);
    }
  } catch (e) {
    console.error("Failed to load stored custom data", e);
  }
}

function persistData() {
  try {
    localStorage.setItem("kongbab_custom_data", JSON.stringify(KONGBAB_DATA));
  } catch (e) {
    console.error("Failed to persist data", e);
  }
}

// 6개 카테고리별 테마 스타일
const COLOR_THEMES = {
  blue: { // 경찰
    badge: "bg-blue-950/80 text-blue-300 border-blue-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.25)]",
    activeTab: "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
  },
  teal: { // EMS
    badge: "bg-teal-950/80 text-teal-300 border-teal-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(20,184,166,0.25)]",
    activeTab: "bg-teal-600 text-white shadow-lg shadow-teal-600/30"
  },
  red: { // 갱단
    badge: "bg-red-950/80 text-red-300 border-red-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]",
    activeTab: "bg-red-600 text-white shadow-lg shadow-red-600/30"
  },
  amber: { // 사업체
    badge: "bg-amber-950/80 text-amber-300 border-amber-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]",
    activeTab: "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
  },
  sky: { // 기자
    badge: "bg-sky-950/80 text-sky-300 border-sky-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(14,165,233,0.25)]",
    activeTab: "bg-sky-600 text-white shadow-lg shadow-sky-600/30"
  },
  purple: { // 시민
    badge: "bg-purple-950/80 text-purple-300 border-purple-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]",
    activeTab: "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
  }
};

// SVG 아이콘 모음
const SVG_ICONS = {
  shield: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3l8 4.5v5c0 5-3.5 9-8 10.5C7.5 21.5 4 17.5 4 12.5v-5L12 3z"></path></svg>`,
  cross: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`,
  skull: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 5.5V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.5c1.5-1 3-3 3-5.5a7 7 0 0 0-7-7zM9 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-5 11v-1m4 1v-1"></path></svg>`,
  building: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4"></path></svg>`,
  camera: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,
  users: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 0 0-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 0 1 5.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 0 1 9.288 0M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"></path></svg>`,
  youtube: `<svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
  external: `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>`,
  chevronRight: `<svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`,
  back: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>`
};

// 영상 종류 판별 (기본값: 편집 영상 'clip')
function isFullVideo(video) {
  return !!(video && (video.videoType === 'full' || video.type === 'full'));
}

// 유튜브 ID 추출 유틸
function extractYoutubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// 유튜브 고화질 썸네일 URL 생성
function getYoutubeThumbnail(url) {
  const id = extractYoutubeId(url);
  if (!id) return "assets/default-thumbnail.svg";
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

// 오늘 날짜 포맷 (YYYY.MM.DD)
function getTodayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// 토스트 메시지 알림 유틸
function showToast(msg) {
  let toast = document.getElementById("toast-msg");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-msg";
    toast.className = "fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-700 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl transition-all duration-300 opacity-0 translate-y-4 pointer-events-none flex items-center gap-2";
    document.body.appendChild(toast);
  }
  toast.innerHTML = msg;
  toast.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
  toast.classList.add("opacity-100", "translate-y-0");

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-4", "pointer-events-none");
  }, 2500);
}

// 카테고리별 인원 목록 가져오기 도우미
function getCategoryMembers(cat) {
  if (!cat) return [];
  if (!cat.hasSubgroups) {
    return cat.members || [];
  }
  let list = [];
  (cat.groups || []).forEach(g => {
    (g.members || []).forEach(m => list.push(m));
  });
  return list;
}

// 상단 통계 바 갱신
function updateStats() {
  let totalMembers = 0;
  let totalVideos = 0;

  KONGBAB_DATA.categories.forEach(cat => {
    const members = getCategoryMembers(cat);
    totalMembers += members.length;
    members.forEach(m => {
      totalVideos += (m.videos || []).length;
    });
  });

  const statEl = document.getElementById("header-stats");
  if (statEl) {
    statEl.innerHTML = `
      <span class="inline-flex items-center gap-1.5"><strong class="text-white">${totalMembers}</strong>명 인원</span>
      <span class="text-zinc-700">|</span>
      <span class="inline-flex items-center gap-1.5"><strong class="text-red-400">${totalVideos}</strong>개 영상</span>
    `;
  }
}

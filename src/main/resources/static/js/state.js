const DEFAULT_CATEGORIES = [
  { id: "police", name: "경찰", emoji: "👮‍♂️", badge: "POLICE", icon: "shield", color: "blue", hasSubgroups: false, members: [] },
  { id: "ems", name: "EMS", emoji: "🚑", badge: "중증외상센터", icon: "cross", color: "teal", hasSubgroups: false, members: [] },
  {
    id: "gang", name: "갱단", emoji: "💀", badge: "GANG", icon: "skull", color: "red", hasSubgroups: true,
    groups: [
      { id: "gang-nonghyup", name: "농협", emoji: "🌾", members: [] },
      { id: "gang-goldmoon", name: "골드문", emoji: "🌙", members: [] },
      { id: "gang-blackrose", name: "흑장미", emoji: "🌹", members: [] },
      { id: "gang-oompa", name: "움파룸파", emoji: "😜", members: [] },
      { id: "gang-sangryeon", name: "상련", emoji: "👠", members: [] },
      { id: "gang-bigdick", name: "빅딕", emoji: "🍌", members: [] },
      { id: "gang-doremifa", name: "도레미파", emoji: "🎹", members: [] },
      { id: "gang-adventure", name: "어드벤처", emoji: "🐯", members: [] },
      { id: "gang-kgaeng", name: "깨갱", emoji: "🐶", members: [] },
      { id: "gang-metalunion", name: "금속노조", emoji: "⛏️", members: [] },
      { id: "gang-girlbang", name: "GIRL BANG", emoji: "🐷", members: [] },
      { id: "gang-streetcat", name: "길고양이 연합", emoji: "😺", members: [] }
    ]
  },
  {
    id: "business", name: "사업체", emoji: "🏢", badge: "BUSINESS", icon: "building", color: "amber", hasSubgroups: true,
    groups: [
      { id: "biz-yastation", name: "야스테이션", emoji: "🔧", members: [] },
      { id: "biz-lux", name: "LUX 클럽", emoji: "🎭", members: [] },
      { id: "biz-young31", name: "영써티원", emoji: "🍔", members: [] },
      { id: "biz-koi", name: "KOI 레스토랑", emoji: "💌", members: [] }
    ]
  },
  { id: "press", name: "기자", emoji: "📰", badge: "KBTBS", icon: "camera", color: "sky", hasSubgroups: false, members: [] },
  { id: "citizen", name: "시민", emoji: "👥", badge: "CITIZEN", icon: "users", color: "purple", hasSubgroups: false, members: [] }
];

const KONGBAB_DATA = {
  serverName: "콩밥특별시 GTA RP",
  categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES))
};

const state = {
  currentCategory: "police",
  currentGroup: null,
  currentMember: null,
  currentVideoTab: "clip",
  searchQuery: "",
  currentUser: { role: "guest", username: "게스트" }
};

function isAdmin() {
  return !!(state.currentUser && state.currentUser.role === "admin");
}

function loadStoredAuth() {
  try {
    const saved = localStorage.getItem("kongbab_auth_user");
    const expireAt = localStorage.getItem("kongbab_auth_expire_at");
    const now = Date.now();

    if (saved && expireAt && now < Number(expireAt)) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.role === "admin") {
        state.currentUser = parsed;
        return;
      }
    }
  } catch (e) {}
  state.currentUser = { role: "guest", username: "게스트" };
}

const DEFAULT_AVATAR = "assets/default-avatar.svg";

function getMemberAvatar(member) {
  if (!member) return DEFAULT_AVATAR;
  const av = typeof member === "string" ? member : (member.avatar || "");
  return (!av || av.includes("images.unsplash.com")) ? DEFAULT_AVATAR : av;
}

function applyCategoryStructure(structureCategories) {
  if (!Array.isArray(structureCategories) || structureCategories.length === 0) return;

  const catMap = new Map();
  KONGBAB_DATA.categories.forEach(c => catMap.set(c.id, c));

  const reorderedCats = [];
  structureCategories.forEach(savedCat => {
    if (catMap.has(savedCat.id)) {
      const liveCat = catMap.get(savedCat.id);

      if (liveCat.hasSubgroups && Array.isArray(savedCat.groups)) {
        const groupMap = new Map();
        (liveCat.groups || []).forEach(g => groupMap.set(g.id, g));

        const reorderedGroups = [];
        savedCat.groups.forEach(savedG => {
          if (groupMap.has(savedG.id)) {
            const liveG = groupMap.get(savedG.id);
            if (savedG.name) liveG.name = savedG.name;
            if (savedG.emoji) liveG.emoji = savedG.emoji;
            reorderedGroups.push(liveG);
            groupMap.delete(savedG.id);
          } else {
            reorderedGroups.push({
              id: savedG.id,
              name: savedG.name || savedG.id,
              emoji: savedG.emoji || "📁",
              members: []
            });
          }
        });

        groupMap.forEach(remainingG => {
          reorderedGroups.push(remainingG);
        });

        liveCat.groups = reorderedGroups;
      }

      reorderedCats.push(liveCat);
      catMap.delete(savedCat.id);
    }
  });

  catMap.forEach(remainingCat => {
    reorderedCats.push(remainingCat);
  });

  KONGBAB_DATA.categories = reorderedCats;
}

function loadStoredData() {
  try {
    const saved = localStorage.getItem("kongbab_custom_data");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.categories)) {
        applyCategoryStructure(parsed.categories);

        parsed.categories.forEach(savedCat => {
          const liveCat = KONGBAB_DATA.categories.find(c => c.id === savedCat.id);
          if (!liveCat) return;
          if (liveCat.hasSubgroups && Array.isArray(savedCat.groups)) {
            savedCat.groups.forEach(savedG => {
              const liveG = (liveCat.groups || []).find(g => g.id === savedG.id);
              if (liveG && Array.isArray(savedG.members) && savedG.members.length > 0) {
                liveG.members = savedG.members;
              }
            });
          } else if (Array.isArray(savedCat.members) && savedCat.members.length > 0) {
            liveCat.members = savedCat.members;
          }
        });
      }
    }
  } catch (e) {
    console.warn("로컬 캐시 로드 실패", e);
  }
}

function persistData() {
  try {
    localStorage.setItem("kongbab_custom_data", JSON.stringify(KONGBAB_DATA));
  } catch (e) {
    console.error("로컬 캐시 저장 실패", e);
  }
}

const COLOR_THEMES = {
  blue: {
    badge: "bg-blue-950/80 text-blue-300 border-blue-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(59,130,246,0.25)]",
    activeTab: "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
  },
  teal: {
    badge: "bg-teal-950/80 text-teal-300 border-teal-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(20,184,166,0.25)]",
    activeTab: "bg-teal-600 text-white shadow-lg shadow-teal-600/30"
  },
  red: {
    badge: "bg-red-950/80 text-red-300 border-red-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(239,68,68,0.25)]",
    activeTab: "bg-red-600 text-white shadow-lg shadow-red-600/30"
  },
  amber: {
    badge: "bg-amber-950/80 text-amber-300 border-amber-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.25)]",
    activeTab: "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
  },
  sky: {
    badge: "bg-sky-950/80 text-sky-300 border-sky-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(14,165,233,0.25)]",
    activeTab: "bg-sky-600 text-white shadow-lg shadow-sky-600/30"
  },
  purple: {
    badge: "bg-purple-950/80 text-purple-300 border-purple-700/50",
    glow: "hover:shadow-[0_0_20px_rgba(168,85,247,0.25)]",
    activeTab: "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
  }
};

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

function isFullVideo(video) {
  return !!(video && (video.videoType === 'full' || video.type === 'full'));
}

function extractYoutubeId(url) {
  if (!url) return null;
  const str = String(url).trim();
  if (str.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }
  const match = str.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/|live\/)([^#&?]*).*/);
  return (match && match[2] && match[2].length === 11) ? match[2] : null;
}

function getYoutubeThumbnail(url) {
  const id = extractYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "assets/default-thumbnail.svg";
}

function getTodayDateString() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

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

function getCategoryMembers(cat) {
  if (!cat) return [];
  if (!cat.hasSubgroups) return cat.members || [];
  return (cat.groups || []).flatMap(g => g.members || []);
}

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

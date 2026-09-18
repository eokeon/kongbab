const API_BASE = (
  window.location.protocol === "file:" || 
  window.location.port === "63342" || 
  (window.location.hostname === "localhost" && window.location.port !== "8080") ||
  (window.location.hostname === "127.0.0.1" && window.location.port !== "8080")
) ? "http://localhost:8080" : "";

function getAuthHeaders() {
  const headers = {};
  const token = localStorage.getItem("kongbab_admin_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function apiLogin(username, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data && data.success && data.token) {
      localStorage.setItem("kongbab_admin_token", data.token);
    }
    return data;
  } catch (e) {
    console.error("로그인 요청 실패:", e);
    return { success: false, message: "백엔드 서버와 통신할 수 없습니다." };
  }
}

async function apiLogout() {
  try {
    localStorage.removeItem("kongbab_admin_token");
    const res = await fetch(`${API_BASE}/api/auth/logout`, { 
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders()
    });
    return await res.json();
  } catch (e) {
    console.error("로그아웃 요청 실패:", e);
    return { success: false };
  }
}

async function apiGetMe() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { 
      cache: "no-store",
      credentials: "include",
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.role === "admin" && data.token) {
        localStorage.setItem("kongbab_admin_token", data.token);
      }
      return data;
    }
  } catch (e) {
    console.warn("세션 사용자 조회 실패:", e);
  }
  return null;
}

async function apiGetLoginLogs() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/logs`, { 
      cache: "no-store",
      credentials: "include",
      headers: getAuthHeaders()
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("로그인 기록 조회 실패:", e);
  }
  return [];
}

async function fetchCategoryStructure() {
  try {
    const res = await fetch(`${API_BASE}/api/config/structure`, {
      cache: "no-store",
      credentials: "include"
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.categories) && data.categories.length > 0) {
        if (typeof applyCategoryStructure === "function") {
          applyCategoryStructure(data.categories);
        }
        persistData();
        return data.categories;
      }
    }
  } catch (e) {
    console.warn("서버 카테고리/조직 구조 조회 실패 (정적 파일 탐색):", e);
  }

  // GitHub Pages 정적 배포 fallback (streamers.json 에서 카테고리/조직 구조 동기화)
  try {
    const staticRes = await fetch(`./streamers.json?t=${Date.now()}`);
    if (staticRes.ok) {
      const staticData = await staticRes.json();
      if (staticData && Array.isArray(staticData.categories) && staticData.categories.length > 0) {
        if (typeof applyCategoryStructure === "function") {
          applyCategoryStructure(staticData.categories);
        }
        persistData();
        return staticData.categories;
      }
    }
  } catch (err) {}

  return null;
}

async function saveCategoryStructureToDb(categories) {
  if (!Array.isArray(categories)) return null;
  try {
    const cleanStructure = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji,
      hasSubgroups: cat.hasSubgroups,
      groups: cat.hasSubgroups ? (cat.groups || []).map(g => ({
        id: g.id,
        name: g.name,
        emoji: g.emoji
      })) : []
    }));

    const res = await fetch(`${API_BASE}/api/config/structure`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ categories: cleanStructure })
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("서버 카테고리/조직 구조 저장 실패:", e);
  }
  return null;
}

function countTotalVideosInCategories(categories) {
  if (!Array.isArray(categories)) return 0;
  let count = 0;
  categories.forEach(cat => {
    if (cat.hasSubgroups && Array.isArray(cat.groups)) {
      cat.groups.forEach(g => {
        if (Array.isArray(g.members)) {
          g.members.forEach(m => {
            if (Array.isArray(m.videos)) count += m.videos.length;
          });
        }
      });
    } else if (Array.isArray(cat.members)) {
      cat.members.forEach(m => {
        if (Array.isArray(m.videos)) count += m.videos.length;
      });
    }
  });
  return count;
}

function countTotalMembersInCategories(categories) {
  if (!Array.isArray(categories)) return 0;
  const memberSet = new Set();
  categories.forEach(cat => {
    if (cat.hasSubgroups && Array.isArray(cat.groups)) {
      cat.groups.forEach(g => {
        if (Array.isArray(g.members)) {
          g.members.forEach(m => { if (m && m.id) memberSet.add(m.id); });
        }
      });
    } else if (Array.isArray(cat.members)) {
      cat.members.forEach(m => { if (m && m.id) memberSet.add(m.id); });
    }
  });
  return memberSet.size;
}

function mergeStaticStreamersWithLocalVideos(staticStreamers) {
  const localVideoMap = new Map();
  if (KONGBAB_DATA && Array.isArray(KONGBAB_DATA.categories)) {
    KONGBAB_DATA.categories.forEach(cat => {
      const mems = cat.hasSubgroups ? (cat.groups || []).flatMap(g => g.members || []) : (cat.members || []);
      mems.forEach(m => {
        if (m && m.id && Array.isArray(m.videos) && m.videos.length > 0) {
          if (!localVideoMap.has(m.id) || localVideoMap.get(m.id).length < m.videos.length) {
            localVideoMap.set(m.id, m.videos);
          }
        }
      });
    });
  }

  return staticStreamers.map(s => {
    const localVideos = localVideoMap.get(s.id);
    if (localVideos && localVideos.length > (s.videos ? s.videos.length : 0)) {
      return { ...s, videos: localVideos };
    }
    return s;
  });
}

async function fetchStreamersFromDb() {
  try {
    const res = await fetch(`${API_BASE}/api/streamers`, { cache: "no-store" });
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (e) {
    console.warn("백엔드 API 미연결 (정적 배포 모드 탐색):", e);
  }

  // GitHub Pages 정적 배포 fallback (streamers.json 로드)
  try {
    const staticRes = await fetch(`./streamers.json?t=${Date.now()}`);
    if (staticRes.ok) {
      const staticData = await staticRes.json();
      if (staticData) {
        if (Array.isArray(staticData.categories) && staticData.categories.length > 0) {
          const localVideosCount = countTotalVideosInCategories(KONGBAB_DATA?.categories);
          const staticVideosCount = countTotalVideosInCategories(staticData.categories);
          const localMembersCount = countTotalMembersInCategories(KONGBAB_DATA?.categories);
          const staticMembersCount = countTotalMembersInCategories(staticData.categories);

          // 새 인원이 추가되었거나 멤버 수가 증가했으면 즉시 스마트 병합 로드
          const hasNewMembers = staticMembersCount > localMembersCount;
          const needsStaticReload = !localVideosCount || staticVideosCount > localVideosCount || hasNewMembers;

          if (!needsStaticReload && localVideosCount > 0) {
            console.log(`[데이터 보호] 로컬 캐시 데이터(영상 ${localVideosCount}개, 인원 ${localMembersCount}명)가 최신 상태입니다.`);
            return "STATIC_CATEGORIES_LOADED";
          }

          if (typeof applyCategoryStructure === "function") {
            applyCategoryStructure(staticData.categories);
          }
          const rawStaticList = extractAllStreamersFromStatic(staticData);
          const mergedList = mergeStaticStreamersWithLocalVideos(rawStaticList);
          applyStreamersToKongbabData(mergedList);
          persistData(true);
          console.log(`[데이터 동기화] 최신 인원(${staticMembersCount}명) 및 데이터 갱신 완료.`);

          if (typeof renderCategoryTabs === "function") renderCategoryTabs();
          if (typeof renderContent === "function") renderContent();
          if (typeof updateStats === "function") updateStats();

          return "STATIC_CATEGORIES_LOADED";
        } else if (Array.isArray(staticData)) {
          return staticData;
        }
      }
    }
  } catch (err) {
    console.warn("정적 streamers.json 로드 실패:", err);
  }

  return null;
}

function extractAllStreamersFromStatic(staticData) {
  const result = [];
  if (!staticData || !Array.isArray(staticData.categories)) return result;

  staticData.categories.forEach(cat => {
    if (cat.hasSubgroups && Array.isArray(cat.groups)) {
      cat.groups.forEach(g => {
        if (Array.isArray(g.members)) {
          g.members.forEach(m => {
            result.push({
              ...m,
              category: cat.id,
              subgroup: g.id
            });
          });
        }
      });
    } else if (Array.isArray(cat.members)) {
      cat.members.forEach(m => {
        result.push({
          ...m,
          category: cat.id,
          subgroup: null
        });
      });
    }
  });
  return result;
}

async function saveStreamerToDb(dto) {
  try {
    const res = await fetch(`${API_BASE}/api/streamers`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(dto)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("DB 스트리머 저장 실패:", e);
  }
  return null;
}

async function deleteStreamerFromDb(streamerId, password = "") {
  try {
    const headers = { ...getAuthHeaders() };
    if (password) {
      headers["X-Delete-Password"] = password;
    }
    const res = await fetch(`${API_BASE}/api/streamers/${encodeURIComponent(streamerId)}`, {
      method: "DELETE",
      credentials: "include",
      headers
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("DB 스트리머 삭제 실패:", e);
  }
  return null;
}

async function saveVideoToDb(streamerId, videoDto) {
  try {
    const res = await fetch(`${API_BASE}/api/streamers/${encodeURIComponent(streamerId)}/videos`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(videoDto)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("DB 영상 저장 실패:", e);
  }
  return null;
}

async function deleteVideoFromDb(videoId) {
  try {
    const res = await fetch(`${API_BASE}/api/videos/${encodeURIComponent(videoId)}`, {
      method: "DELETE",
      credentials: "include",
      headers: getAuthHeaders()
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("DB 영상 삭제 실패:", e);
  }
  return null;
}

async function syncAllStreamersToDb(streamersList) {
  if (!Array.isArray(streamersList) || streamersList.length < 140) {
    console.warn(`[DB 동기화 차단] 전달된 인원 수가 비정상적으로 적습니다 (${streamersList ? streamersList.length : 0}명 < 146명). 데이터 유실 방지를 위해 DB 동기화를 차단합니다.`);
    return null;
  }
  try {
    const res = await fetch(`${API_BASE}/api/streamers/sync`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(streamersList)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("DB 일괄 동기화 실패:", e);
  }
  return null;
}

function formatIsoDuration(iso) {
  if (!iso) return "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  const secStr = String(seconds).padStart(2, '0');
  if (hours > 0) {
    const minStr = String(minutes).padStart(2, '0');
    return `${hours}:${minStr}:${secStr}`;
  } else {
    return `${minutes}:${secStr}`;
  }
}

async function apiGetChzzkInfo(url) {
  if (!url) return { success: false, message: "URL이 없습니다." };
  const videoNo = typeof extractChzzkVideoNo === "function" ? extractChzzkVideoNo(url) : null;
  if (!videoNo) return { success: false, message: "유효한 치지직 영상 링크 또는 번호가 아닙니다." };

  // 1. 백엔드 Spring Boot API 호출
  try {
    const res = await fetch(`${API_BASE}/api/chzzk/info?url=${encodeURIComponent(url)}`, {
      cache: "no-store"
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return data;
      }
      return { success: false, message: (data && data.message) || "치지직 영상 정보 조회 실패" };
    } else if (res.status === 404) {
      return { 
        success: false, 
        message: "치지직 API(404)를 찾을 수 없습니다. IntelliJ에서 Spring Boot 서버를 '재시작(Rerun)'해주세요!" 
      };
    }
  } catch (e) {
    console.warn("백엔드 Chzzk API 조회 실패:", e);
  }

  return { success: false, message: "치지직 영상 정보를 불러올 수 없습니다. 스프링 부트 서버 상태를 확인해주세요." };
}

async function apiGetChzzkChannelInfo(urlOrId) {
  if (!urlOrId) return { success: false, message: "URL 또는 채널 ID가 없습니다." };

  // 1. 백엔드 Spring Boot API 호출
  try {
    const res = await fetch(`${API_BASE}/api/chzzk/channel?url=${encodeURIComponent(urlOrId)}`, {
      cache: "no-store"
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return data;
      }
    }
  } catch (e) {
    console.warn("백엔드 Chzzk 채널 API 조회 실패, 프론트 대체 시도:", e);
  }

  // 2. 프론트 대체: direct fetch or public proxy
  const channelId = typeof extractChzzkChannelId === "function" ? extractChzzkChannelId(urlOrId) : null;
  if (!channelId) {
    return { success: false, message: "유효한 치지직 채널 ID를 추출할 수 없습니다." };
  }

  try {
    const res = await fetch(`https://api.chzzk.naver.com/service/v1/channels/${channelId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.code === 200 && data.content) {
        const followerCount = data.content.followerCount || 0;
        return {
          success: true,
          channelId: channelId,
          channelTitle: data.content.channelName || "",
          followerCount: followerCount,
          followerCountFormatted: typeof formatSubscriberCount === "function" ? formatSubscriberCount(followerCount) : `${followerCount}명`,
          url: `https://chzzk.naver.com/${channelId}`,
          thumbnailUrl: data.content.channelImageUrl || ""
        };
      }
    }
  } catch (err) {
    // 3. CORS fallback 프록시 시도
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.chzzk.naver.com/service/v1/channels/${channelId}`)}`;
      const pRes = await fetch(proxyUrl);
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.code === 200 && pData.content) {
          const followerCount = pData.content.followerCount || 0;
          return {
            success: true,
            channelId: channelId,
            channelTitle: pData.content.channelName || "",
            followerCount: followerCount,
            followerCountFormatted: typeof formatSubscriberCount === "function" ? formatSubscriberCount(followerCount) : `${followerCount}명`,
            url: `https://chzzk.naver.com/${channelId}`,
            thumbnailUrl: pData.content.channelImageUrl || ""
          };
        }
      }
    } catch (proxyErr) {
      console.warn("치지직 CORS 프록시 조회 실패:", proxyErr);
    }
  }

  return { success: false, message: "치지직 채널 정보를 불러올 수 없습니다." };
}

async function apiGetVideoInfo(url) {
  if (!url) return { success: false, message: "URL이 없습니다." };
  if (typeof isChzzkUrl === "function" && isChzzkUrl(url)) {
    return await apiGetChzzkInfo(url);
  } else {
    return await apiGetYouTubeInfo(url);
  }
}

async function apiGetYouTubeInfo(url) {
  if (!url) return { success: false, message: "URL이 없습니다." };

  // 1. 백엔드 Spring Boot API 호출 시도
  try {
    const res = await fetch(`${API_BASE}/api/youtube/info?url=${encodeURIComponent(url)}`, {
      cache: "no-store"
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        return data;
      }
    }
  } catch (e) {
    console.warn("백엔드 YouTube API 조회 실패, 프론트 대체 조회 진행:", e);
  }

const YOUTUBE_DEFAULT_API_KEY = "AIzaSyCaWTqIMqfGvXE8-Wg4FpYxvAW-qRWYDYA";

function getEffectiveYouTubeApiKey() {
  try {
    const stored = localStorage.getItem("youtube_api_key");
    if (stored && stored.trim() && stored.trim() !== "AIzaSyAyY4g9-iwjwQNXb5F9Xx0LLGtLUEpowl8") {
      return stored.trim();
    }
  } catch (e) {}
  return YOUTUBE_DEFAULT_API_KEY;
}
window.getEffectiveYouTubeApiKey = getEffectiveYouTubeApiKey;

  // 2. 백엔드 오프라인 시 프론트엔드 직접 대체 조회
  const videoId = typeof extractYoutubeId === "function" ? extractYoutubeId(url) : null;
  if (!videoId) return { success: false, message: "유효한 유튜브 ID가 아닙니다." };

  // 사용자 로컬 API 키 또는 기본 등록 키 사용
  const localKey = getEffectiveYouTubeApiKey();
  if (localKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${localKey.trim()}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const snip = data.items[0].snippet;
          const cd = data.items[0].contentDetails;
          let pubDate = "";
          if (snip.publishedAt) {
            pubDate = typeof formatIsoDateToKst === "function" ? formatIsoDateToKst(snip.publishedAt) : snip.publishedAt.substring(0, 10).replace(/-/g, ".");
          }
          const duration = cd ? formatIsoDuration(cd.duration) : "";
          return {
            success: true,
            videoId: videoId,
            title: snip.title || "",
            publishedDate: pubDate,
            duration: duration,
            channelTitle: snip.channelTitle || "",
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            source: "api_client"
          };
        }
      }
    } catch (e) {
      console.warn("프론트엔드 YouTube API 직접 호출 실패:", e);
    }
  }

  // 3. oEmbed 공개 API 직접 호출 (API 키 없이 제목 추출)
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      return {
        success: true,
        videoId: videoId,
        title: oembedData.title || "",
        publishedDate: typeof getTodayDateString === "function" ? getTodayDateString() : "",
        channelTitle: oembedData.author_name || "",
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        source: "oembed_client"
      };
    }
  } catch (e) {
    console.error("oEmbed 직접 조회 실패:", e);
  }

  return { success: false, message: "유튜브 정보를 불러올 수 없습니다." };
}

function getAffiliationDisplayOrder(member, categoryId, subgroupId = null) {
  if (!member) return 999999;
  if (Array.isArray(member.affiliations)) {
    const aff = member.affiliations.find(a => {
      if (a.category !== categoryId) return false;
      if (subgroupId) return a.subgroup === subgroupId;
      return !a.subgroup;
    });
    if (aff && aff.displayOrder !== undefined && aff.displayOrder !== null) {
      return Number(aff.displayOrder);
    }
  }
  // fallback 1: 만약 해당 소속이 멤버의 주 소속인 경우 member.displayOrder 사용
  if (member.category === categoryId && (!subgroupId || member.subgroup === subgroupId)) {
    if (member.displayOrder !== undefined && member.displayOrder !== null) {
      return Number(member.displayOrder);
    }
  }
  // fallback 2: 단일 소속인 경우 member.displayOrder 사용
  if (Array.isArray(member.affiliations) && member.affiliations.length === 1) {
    if (member.displayOrder !== undefined && member.displayOrder !== null) {
      return Number(member.displayOrder);
    }
  }
  return 999999;
}

function sortAllMembersByAffiliationOrder() {
  KONGBAB_DATA.categories.forEach(cat => {
    if (cat.hasSubgroups) {
      (cat.groups || []).forEach(g => {
        if (g.members && g.members.length > 1) {
          const orderMap = new Map();
          for (let i = 0; i < g.members.length; i++) {
            orderMap.set(g.members[i], getAffiliationDisplayOrder(g.members[i], cat.id, g.id));
          }
          g.members.sort((a, b) => {
            const orderA = orderMap.get(a) ?? 999999;
            const orderB = orderMap.get(b) ?? 999999;
            if (orderA !== orderB) return orderA - orderB;
            return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
          });
        }
      });
    } else if (cat.members && cat.members.length > 1) {
      const orderMap = new Map();
      for (let i = 0; i < cat.members.length; i++) {
        orderMap.set(cat.members[i], getAffiliationDisplayOrder(cat.members[i], cat.id, null));
      }
      cat.members.sort((a, b) => {
        const orderA = orderMap.get(a) ?? 999999;
        const orderB = orderMap.get(b) ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
      });
    }
  });
}
window.getAffiliationDisplayOrder = getAffiliationDisplayOrder;
window.sortAllMembersByAffiliationOrder = sortAllMembersByAffiliationOrder;

function applyStreamersToKongbabData(dbStreamers) {
  if (!Array.isArray(dbStreamers)) return;

  KONGBAB_DATA.categories.forEach(cat => {
    if (cat.hasSubgroups) {
      (cat.groups || []).forEach(g => { g.members = []; });
    } else {
      cat.members = [];
    }
  });

  dbStreamers.forEach(s => {
    // affiliations 파싱 (배열 또는 JSON 문자열)
    let affs = [];
    if (Array.isArray(s.affiliations)) {
      affs = s.affiliations;
    } else if (typeof s.affiliations === "string" && s.affiliations.trim().startsWith("[")) {
      try {
        affs = JSON.parse(s.affiliations);
      } catch (e) {}
    }

    // affiliations가 없으면 기본 category & subgroup을 1개짜리 affiliation으로 취급
    if (!Array.isArray(affs) || affs.length === 0) {
      if (s.category) {
        affs = [{ category: s.category, subgroup: s.subgroup || null }];
      }
    }

    const videosList = Array.isArray(s.videos) ? [...s.videos] : [];
    videosList.sort((a, b) => {
      const orderA = a.displayOrder != null ? a.displayOrder : 999999;
      const orderB = b.displayOrder != null ? b.displayOrder : 999999;
      if (orderA !== orderB) return orderA - orderB;
      const timeA = typeof parseDateToTimestamp === "function" ? parseDateToTimestamp(a.date) : 0;
      const timeB = typeof parseDateToTimestamp === "function" ? parseDateToTimestamp(b.date) : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.id || "").localeCompare(b.id || "");
    });

    const memberObj = {
      id: s.id,
      name: s.name,
      streamer: s.streamer,
      role: s.role || "",
      swatRole: s.swatRole || "",
      status: s.status || "active",
      badgeColor: s.badgeColor || "bg-blue-600",
      avatar: s.avatar || "assets/default-avatar.svg",
      displayOrder: s.displayOrder ?? 0,
      subscriberCount: s.subscriberCount || s.subscriberCountFormatted || "",
      youtubeUrl: s.youtubeUrl || "",
      videos: videosList,
      affiliations: affs,
      category: s.category || (affs[0] ? affs[0].category : ""),
      subgroup: s.subgroup !== undefined ? s.subgroup : (affs[0] ? affs[0].subgroup || null : null)
    };

    // 소속된 모든 위치(카테고리/조직)에 동일한 memberObj 인스턴스를 추가 (겸직 반영)
    affs.forEach(aff => {
      const cat = KONGBAB_DATA.categories.find(c => c.id === aff.category);
      if (!cat) return;

      if (cat.hasSubgroups) {
        let group = (cat.groups || []).find(g => g.id === aff.subgroup);
        if (!group && (cat.groups || []).length > 0) {
          group = cat.groups[0];
        }
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
  });

  sortAllMembersByAffiliationOrder();
  persistData();
}

function extractAllStreamersFromKongbabData() {
  const memberMap = new Map();
  let fallbackGlobalOrder = 0;

  const processMemberItem = (m, mIdx, catId, subgroupId) => {
    if (!m || !m.id) return;

    // 1. 해당 소속의 affiliation.displayOrder 동기화
    if (Array.isArray(m.affiliations)) {
      let aff = m.affiliations.find(a => a.category === catId && (subgroupId ? a.subgroup === subgroupId : !a.subgroup));
      if (!aff) {
        aff = { category: catId, subgroup: subgroupId };
        m.affiliations.push(aff);
      }
      aff.displayOrder = mIdx;
    }
    if (m.category === catId && (subgroupId ? m.subgroup === subgroupId : !m.subgroup)) {
      m.displayOrder = mIdx;
    }

    // 2. 고유 멤버 맵에 등록 (없으면 새로 등록, 있으면 소속 보강)
    if (!memberMap.has(m.id)) {
      const currentAff = { category: catId, subgroup: subgroupId };
      const initialAffs = Array.isArray(m.affiliations) && m.affiliations.length > 0
        ? [...m.affiliations]
        : [currentAff];
      if (!initialAffs.some(a => a.category === currentAff.category && (currentAff.subgroup ? a.subgroup === currentAff.subgroup : !a.subgroup))) {
        initialAffs.push(currentAff);
      }

      const videoList = (m.videos || []).map((v, vIdx) => ({
        ...v,
        displayOrder: vIdx
      }));

      const primaryAff = initialAffs.find(a => a.category === m.category && (m.subgroup ? a.subgroup === m.subgroup : !a.subgroup)) || initialAffs[0];

      memberMap.set(m.id, {
        id: m.id,
        name: m.name,
        streamer: m.streamer,
        category: primaryAff.category,
        subgroup: primaryAff.subgroup || null,
        role: primaryAff.role !== undefined ? primaryAff.role : (m.role || ""),
        swatRole: primaryAff.swatRole !== undefined ? primaryAff.swatRole : (m.swatRole || ""),
        status: primaryAff.status !== undefined ? primaryAff.status : (m.status || "active"),
        badgeColor: primaryAff.badgeColor !== undefined ? primaryAff.badgeColor : (m.badgeColor || "bg-blue-600"),
        avatar: m.avatar || "assets/default-avatar.svg",
        displayOrder: primaryAff.displayOrder != null ? primaryAff.displayOrder : (m.displayOrder != null ? m.displayOrder : fallbackGlobalOrder++),
        subscriberCount: m.subscriberCount || "",
        youtubeUrl: m.youtubeUrl || "",
        videos: videoList,
        affiliations: initialAffs
      });
    } else {
      const existing = memberMap.get(m.id);
      if (Array.isArray(m.affiliations)) {
        m.affiliations.forEach(aff => {
          const alreadyHas = existing.affiliations.some(a => a.category === aff.category && (aff.subgroup ? a.subgroup === aff.subgroup : !a.subgroup));
          if (!alreadyHas) {
            existing.affiliations.push(aff);
          }
        });
      }
    }
  };

  (KONGBAB_DATA.categories || []).forEach(cat => {
    if (cat.hasSubgroups) {
      (cat.groups || []).forEach(g => {
        const mems = g.members || [];
        for (let i = 0; i < mems.length; i++) {
          processMemberItem(mems[i], i, cat.id, g.id);
        }
      });
    } else {
      const mems = cat.members || [];
      for (let i = 0; i < mems.length; i++) {
        processMemberItem(mems[i], i, cat.id, null);
      }
    }
  });

  const list = Array.from(memberMap.values());
  for (let i = 0; i < list.length; i++) {
    list[i].affiliations = JSON.stringify(list[i].affiliations);
  }
  return list;
}

// ==========================================
// 유튜브 구독자 수 관리 및 수동 일괄 갱신 로직은
// ./js/subscriber-sync.js 모듈로 분리되었습니다.
// ==========================================


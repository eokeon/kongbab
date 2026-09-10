const API_BASE = (window.location.protocol === "file:" || window.location.port === "63342") 
  ? "http://localhost:8080" 
  : "";

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
          if (typeof applyCategoryStructure === "function") {
            applyCategoryStructure(staticData.categories);
          }
          applyStreamersToKongbabData(extractAllStreamersFromStatic(staticData));
          persistData();
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

async function deleteStreamerFromDb(streamerId, password = "kongbab1234") {
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

  // 2. 백엔드 오프라인 시 프론트엔드 직접 대체 조회
  const videoId = typeof extractYoutubeId === "function" ? extractYoutubeId(url) : null;
  if (!videoId) return { success: false, message: "유효한 유튜브 ID가 아닙니다." };

  // 사용자 로컬 API 키 또는 기본 등록 키 사용
  const localKey = localStorage.getItem("youtube_api_key") || "AIzaSyAyY4g9-iwjwQNXb5F9Xx0LLGtLUEpowl8";
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
            pubDate = snip.publishedAt.substring(0, 10).replace(/-/g, ".");
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
      badgeColor: s.badgeColor || "bg-blue-600",
      avatar: s.avatar || "assets/default-avatar.svg",
      displayOrder: s.displayOrder ?? 0,
      subscriberCount: s.subscriberCount || s.subscriberCountFormatted || "",
      youtubeUrl: s.youtubeUrl || "",
      videos: videosList,
      affiliations: affs
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

  KONGBAB_DATA.categories.forEach(cat => {
    if (cat.hasSubgroups) {
      (cat.groups || []).forEach(g => {
        if (g.members) {
          g.members.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        }
      });
    } else if (cat.members) {
      cat.members.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    }
  });

  persistData();
}

function extractAllStreamersFromKongbabData() {
  const memberMap = new Map();
  let globalOrder = 0;

  KONGBAB_DATA.categories.forEach(cat => {
    if (cat.hasSubgroups) {
      (cat.groups || []).forEach(g => {
        (g.members || []).forEach(m => {
          const currentAff = { category: cat.id, subgroup: g.id };
          if (!memberMap.has(m.id)) {
            const initialAffs = Array.isArray(m.affiliations) && m.affiliations.length > 0
              ? [...m.affiliations]
              : [currentAff];
            if (!initialAffs.some(a => a.category === currentAff.category && a.subgroup === currentAff.subgroup)) {
              initialAffs.push(currentAff);
            }

            const videoList = (m.videos || []).map((v, vIdx) => ({
              ...v,
              displayOrder: vIdx
            }));

            memberMap.set(m.id, {
              id: m.id,
              name: m.name,
              streamer: m.streamer,
              category: cat.id,
              subgroup: g.id,
              role: m.role || "",
              badgeColor: m.badgeColor || "bg-blue-600",
              avatar: m.avatar || "assets/default-avatar.svg",
              displayOrder: globalOrder++,
              subscriberCount: m.subscriberCount || "",
              youtubeUrl: m.youtubeUrl || "",
              videos: videoList,
              affiliations: initialAffs
            });
          } else {
            const existing = memberMap.get(m.id);
            if (!existing.affiliations.some(a => a.category === currentAff.category && a.subgroup === currentAff.subgroup)) {
              existing.affiliations.push(currentAff);
            }
          }
        });
      });
    } else {
      (cat.members || []).forEach(m => {
        const currentAff = { category: cat.id, subgroup: null };
        if (!memberMap.has(m.id)) {
          const initialAffs = Array.isArray(m.affiliations) && m.affiliations.length > 0
            ? [...m.affiliations]
            : [currentAff];
          if (!initialAffs.some(a => a.category === currentAff.category && a.subgroup === currentAff.subgroup)) {
            initialAffs.push(currentAff);
          }

          const videoList = (m.videos || []).map((v, vIdx) => ({
            ...v,
            displayOrder: vIdx
          }));

          memberMap.set(m.id, {
            id: m.id,
            name: m.name,
            streamer: m.streamer,
            category: cat.id,
            subgroup: null,
            role: m.role || "",
            badgeColor: m.badgeColor || "bg-blue-600",
            avatar: m.avatar || "assets/default-avatar.svg",
            displayOrder: globalOrder++,
            subscriberCount: m.subscriberCount || "",
            youtubeUrl: m.youtubeUrl || "",
            videos: videoList,
            affiliations: initialAffs
          });
        } else {
          const existing = memberMap.get(m.id);
          if (!existing.affiliations.some(a => a.category === currentAff.category && a.subgroup === currentAff.subgroup)) {
            existing.affiliations.push(currentAff);
          }
        }
      });
    }
  });

  const list = Array.from(memberMap.values());
  list.forEach(item => {
    item.affiliations = JSON.stringify(item.affiliations);
  });
  return list;
}

// ==========================================
// 유튜브 구독자 수 관리 및 수동 일괄 갱신
// ==========================================

// 구독자 조회 기준 영상 선정:
// 1순위: 편집 영상 1번 ➔ 2순위: 몰아보기 1번 ➔ 3순위: 풀 영상 1번 ➔ 4순위: 첫 영상
function getRepresentativeVideoForSubscriber(member) {
  if (!member || !Array.isArray(member.videos) || member.videos.length === 0) return null;
  const videos = member.videos;

  const clip = videos.find(v => (typeof getVideoType === "function" ? getVideoType(v) : (v.videoType || v.type)) === 'clip');
  if (clip && (clip.url || clip.videoId)) return clip;

  const binge = videos.find(v => (typeof getVideoType === "function" ? getVideoType(v) : (v.videoType || v.type)) === 'binge');
  if (binge && (binge.url || binge.videoId)) return binge;

  const full = videos.find(v => (typeof getVideoType === "function" ? getVideoType(v) : (v.videoType || v.type)) === 'full');
  if (full && (full.url || full.videoId)) return full;

  return videos[0];
}

function formatSubscriberCount(countStr) {
  if (!countStr) return null;
  const num = parseInt(countStr, 10);
  if (isNaN(num)) return null;
  if (num >= 100000000) {
    const eok = (num / 100000000).toFixed(1);
    return `${eok.endsWith(".0") ? eok.slice(0, -2) : eok}억 명`;
  }
  if (num >= 10000) {
    const man = (num / 10000).toFixed(1);
    return `${man.endsWith(".0") ? man.slice(0, -2) : man}만 명`;
  }
  return `${num.toLocaleString()}명`;
}

// 구독자 수 문자열(예: "121만 명", "57.8만 명", "1,200명")을 정수(숫자)로 변환
function parseSubscriberCount(countStr) {
  if (!countStr) return 0;
  if (typeof countStr === "number") return countStr;
  const str = String(countStr).trim();
  if (!str) return 0;

  if (str.includes("억")) {
    const numPart = str.replace(/[^0-9.]/g, "");
    const val = parseFloat(numPart);
    return isNaN(val) ? 0 : Math.round(val * 100000000);
  }

  if (str.includes("만")) {
    const numPart = str.replace(/[^0-9.]/g, "");
    const val = parseFloat(numPart);
    return isNaN(val) ? 0 : Math.round(val * 10000);
  }

  const clean = str.replace(/[^0-9]/g, "");
  const val = parseInt(clean, 10);
  return isNaN(val) ? 0 : val;
}

// 그룹(갱단/사업체) 내 모든 멤버의 구독자 수 총합 계산
function calculateGroupTotalSubscribers(members) {
  if (!Array.isArray(members) || members.length === 0) return null;
  let total = 0;

  for (const m of members) {
    const count = parseSubscriberCount(m.subscriberCount);
    if (count > 0) {
      total += count;
    }
  }

  if (total === 0) return null;
  return formatSubscriberCount(total);
}

// 유튜브 URL/문자열에서 채널 식별 정보(channelId, handle, videoId, username, search) 추출
function parseYouTubeTarget(urlOrStr) {
  if (!urlOrStr || typeof urlOrStr !== "string") return null;
  let str = urlOrStr.trim();
  if (!str) return null;

  // URL 디코딩 처리 (한글 주소창 복사값 %EA%B5... 대응)
  try {
    str = decodeURIComponent(str);
  } catch (e) {}

  // 1) 채널 ID 직접 매칭: UC로 시작하는 24자리 ID (예: /channel/UC... 또는 UC...)
  const channelMatch = str.match(/channel\/(UC[a-zA-Z0-9_-]{22})/i) || str.match(/^(UC[a-zA-Z0-9_-]{22})$/i);
  if (channelMatch) {
    return { type: "channelId", value: channelMatch[1] };
  }

  // 2) 영상 링크인 경우 videoId 추출
  const videoId = typeof extractYoutubeId === "function" ? extractYoutubeId(str) : null;
  if (videoId) {
    return { type: "videoId", value: videoId };
  }

  // 3) 핸들(@handle): /@something 또는 @something (한글, 영문, 특수문자 지원)
  const handleMatch = str.match(/@([^\/\s?#&]+)/);
  if (handleMatch) {
    return { type: "handle", value: handleMatch[1].trim() };
  }

  // 4) 사용자명 (/user/username 또는 /c/username)
  const userMatch = str.match(/(?:user|c)\/([^\/\s?#&]+)/i);
  if (userMatch) {
    return { type: "username", value: userMatch[1].trim() };
  }

  // 5) 일반 검색어(단순 채널명 텍스트 등)
  if (!str.startsWith("http://") && !str.startsWith("https://") && !str.includes("/")) {
    return { type: "search", value: str };
  }

  return null;
}

// 구독자 조회를 위한 타깃 식별자 (⭐ 1순위: 정보 수정의 member.youtubeUrl ➔ 2순위: 등록된 영상 1번)
function getSubscriberLookupTarget(member) {
  if (!member) return null;

  // ⭐ 1순위: 정보 수정 모달에 입력된 스트리머 유튜브 링크
  if (member.youtubeUrl && member.youtubeUrl.trim()) {
    const parsed = parseYouTubeTarget(member.youtubeUrl);
    if (parsed) return parsed;
  }

  // 2순위: 등록된 영상 목록 (편집 1번 ➔ 몰아보기 1번 ➔ 풀영상 1번 ➔ 첫 영상)
  const targetVideo = getRepresentativeVideoForSubscriber(member);
  if (targetVideo) {
    const url = targetVideo.url || (targetVideo.videoId ? `https://www.youtube.com/watch?v=${targetVideo.videoId}` : "");
    const vId = typeof extractYoutubeId === "function" ? extractYoutubeId(url) : null;
    if (vId) return { type: "videoId", value: vId };
  }

  return null;
}

async function fetchMemberSubscriberFromYouTube(member) {
  const target = getSubscriberLookupTarget(member);
  if (!target) return null;

  const apiKey = localStorage.getItem("youtube_api_key") || "AIzaSyAyY4g9-iwjwQNXb5F9Xx0LLGtLUEpowl8";
  if (!apiKey) return null;

  try {
    let channelId = null;

    if (target.type === "channelId") {
      channelId = target.value;
    } else if (target.type === "videoId") {
      const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${target.value}&key=${apiKey.trim()}`);
      if (vRes.ok) {
        const vData = await vRes.json();
        channelId = vData.items?.[0]?.snippet?.channelId;
      }
    } else if (target.type === "handle") {
      const cleanHandle = target.value.replace(/^@+/, "");
      // 1) 공식 forHandle API 시도
      try {
        const hRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent('@' + cleanHandle)}&key=${apiKey.trim()}`);
        if (hRes.ok) {
          const hData = await hRes.json();
          const stats = hData.items?.[0]?.statistics;
          if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
            return formatSubscriberCount(stats.subscriberCount);
          }
        }
      } catch (e) {}

      // 2) 한글 핸들이거나 forHandle 실패 시 search API fallback
      try {
        const sRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(cleanHandle)}&key=${apiKey.trim()}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          channelId = sData.items?.[0]?.id?.channelId || sData.items?.[0]?.snippet?.channelId;
        }
      } catch (e) {}
    } else if (target.type === "username" || target.type === "search") {
      const query = target.value;
      try {
        const sRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&key=${apiKey.trim()}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          channelId = sData.items?.[0]?.id?.channelId || sData.items?.[0]?.snippet?.channelId;
        }
      } catch (e) {}
    }

    if (channelId) {
      const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey.trim()}`);
      if (cRes.ok) {
        const cData = await cRes.json();
        const stats = cData.items?.[0]?.statistics;
        if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
          return formatSubscriberCount(stats.subscriberCount);
        }
      }
    }
  } catch (e) {
    console.warn(`[YouTube] ${member.streamer} 구독자 조회 오류:`, e);
  }
  return null;
}

// 관리자가 모달에서 수동으로 실행하는 유튜브 구독자 수 일괄 갱신 (유튜브 링크 최우선 + 50개 단위 배치 초고속 처리)
async function executeSubscriberSync(onProgress) {
  const allMembers = extractAllStreamersFromKongbabData();
  // 대상: 유튜브 링크가 있거나 등록된 영상이 있는 인원 전체
  const targets = allMembers.filter(m => (m.youtubeUrl && m.youtubeUrl.trim()) || (m.videos && m.videos.length > 0));
  if (targets.length === 0) return 0;

  const apiKey = localStorage.getItem("youtube_api_key") || "AIzaSyAyY4g9-iwjwQNXb5F9Xx0LLGtLUEpowl8";
  if (!apiKey) {
    throw new Error("유튜브 API 키가 설정되지 않았습니다.");
  }

  // 1단계: 각 멤버별 최우선 타깃(1순위: youtubeUrl, 2순위: 영상) 결정
  const targetItems = [];
  for (const m of targets) {
    const target = getSubscriberLookupTarget(m);
    targetItems.push({ member: m, target });
  }

  let updatedCount = 0;
  let processedCount = 0;

  // 2단계: 50개씩 청크(배치)로 묶어 일괄 요청
  const CHUNK_SIZE = 50;
  for (let i = 0; i < targetItems.length; i += CHUNK_SIZE) {
    const chunk = targetItems.slice(i, i + CHUNK_SIZE);
    
    // videoId 수집 (영상에서 channelId 조회용)
    const videoTargets = chunk.filter(item => item.target && item.target.type === "videoId");
    const videoIds = Array.from(new Set(videoTargets.map(item => item.target.value)));
    const videoToChannelMap = new Map();

    if (videoIds.length > 0) {
      try {
        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoIds.join(",")}&key=${apiKey.trim()}`);
        if (vRes.ok) {
          const vData = await vRes.json();
          (vData.items || []).forEach(vItem => {
            if (vItem.id && vItem.snippet?.channelId) {
              videoToChannelMap.set(vItem.id, vItem.snippet.channelId);
            }
          });
        }
      } catch (err) {
        console.warn("[YouTube Batch] 영상 정보 일괄 조회 오류:", err);
      }
    }

    // channelToSubMap 생성
    const channelToSubMap = new Map();
    // 직접 channelId를 가진 것들과, videoId로부터 얻은 channelId 수집
    const directChannelIds = chunk
      .filter(item => item.target && item.target.type === "channelId")
      .map(item => item.target.value);
    
    const resolvedChannelIds = Array.from(videoToChannelMap.values());
    const allChannelIds = Array.from(new Set([...directChannelIds, ...resolvedChannelIds]));

    if (allChannelIds.length > 0) {
      try {
        const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${allChannelIds.join(",")}&key=${apiKey.trim()}`);
        if (cRes.ok) {
          const cData = await cRes.json();
          (cData.items || []).forEach(cItem => {
            const stats = cItem.statistics;
            if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
              const formatted = formatSubscriberCount(stats.subscriberCount);
              if (formatted) channelToSubMap.set(cItem.id, formatted);
            }
          });
        }
      } catch (err) {
        console.warn("[YouTube Batch] 채널 구독자 일괄 조회 오류:", err);
      }
    }

    // handle(@handle) 및 search/username 타입 처리 (한글 핸들 & 채널명 검색 fallback 지원)
    const specialTargets = chunk.filter(item => item.target && (item.target.type === "handle" || item.target.type === "username" || item.target.type === "search"));
    for (const sItem of specialTargets) {
      const t = sItem.target;
      const cleanVal = t.value.replace(/^@+/, "");
      let foundSub = null;

      if (t.type === "handle") {
        // 1) 공식 forHandle API 시도
        try {
          const hRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent('@' + cleanVal)}&key=${apiKey.trim()}`);
          if (hRes.ok) {
            const hData = await hRes.json();
            const stats = hData.items?.[0]?.statistics;
            if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
              foundSub = formatSubscriberCount(stats.subscriberCount);
            }
          }
        } catch (err) {}
      }

      // 2) forHandle 실패 시 또는 search/username인 경우 채널 검색 fallback
      if (!foundSub) {
        try {
          const sRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(cleanVal)}&key=${apiKey.trim()}`);
          if (sRes.ok) {
            const sData = await sRes.json();
            const chId = sData.items?.[0]?.id?.channelId || sData.items?.[0]?.snippet?.channelId;
            if (chId) {
              // 이미 조회된 채널 캐시 확인
              if (channelToSubMap.has(chId)) {
                foundSub = channelToSubMap.get(chId);
              } else {
                const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${chId}&key=${apiKey.trim()}`);
                if (cRes.ok) {
                  const cData = await cRes.json();
                  const stats = cData.items?.[0]?.statistics;
                  if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
                    foundSub = formatSubscriberCount(stats.subscriberCount);
                    channelToSubMap.set(chId, foundSub);
                  }
                }
              }
            }
          }
        } catch (err) {}
      }

      if (foundSub) {
        if (t.type === "handle") {
          channelToSubMap.set(`@${cleanVal}`, foundSub);
        } else {
          channelToSubMap.set(t.value, foundSub);
        }
      }
    }

    // 3단계: 결과 반영 및 실시간 알림
    for (const item of chunk) {
      processedCount++;
      const m = item.member;
      const t = item.target;
      let subStr = null;

      if (t) {
        if (t.type === "channelId") {
          subStr = channelToSubMap.get(t.value);
        } else if (t.type === "videoId") {
          const chId = videoToChannelMap.get(t.value);
          if (chId) subStr = channelToSubMap.get(chId);
        } else if (t.type === "handle") {
          const cleanVal = t.value.replace(/^@+/, "");
          subStr = channelToSubMap.get(`@${cleanVal}`);
        } else if (t.type === "search" || t.type === "username") {
          subStr = channelToSubMap.get(t.value);
        }
      }

      if (subStr) {
        m.subscriberCount = subStr;
        KONGBAB_DATA.categories.forEach(cat => {
          if (cat.hasSubgroups) {
            (cat.groups || []).forEach(g => {
              (g.members || []).forEach(mem => {
                if (mem.id === m.id) mem.subscriberCount = subStr;
              });
            });
          } else {
            (cat.members || []).forEach(mem => {
              if (mem.id === m.id) mem.subscriberCount = subStr;
            });
          }
        });
        updatedCount++;
        if (onProgress) onProgress(processedCount, targetItems.length, m.streamer, `성공 (${subStr})`);
      } else {
        if (onProgress) onProgress(processedCount, targetItems.length, m.streamer, "조회 실패/비공개");
      }
    }
  }

  persistData();
  if (typeof renderContent === "function") renderContent();

  const syncPromises = [];
  if (typeof syncAllStreamersToDb === "function") {
    syncPromises.push(syncAllStreamersToDb(extractAllStreamersFromKongbabData()));
  }
  if (typeof createBackupSnapshot === "function") {
    createBackupSnapshot(`유튜브 구독자 수 일괄 갱신 (${updatedCount}명)`, true);
  }

  try {
    await Promise.all(syncPromises);
  } catch (e) {}

  return updatedCount;
}


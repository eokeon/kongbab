const API_BASE = "";

async function apiLogin(username, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    return await res.json();
  } catch (e) {
    console.error("로그인 요청 실패:", e);
    return { success: false, message: "백엔드 서버와 통신할 수 없습니다." };
  }
}

async function apiLogout() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/logout`, { method: "POST" });
    return await res.json();
  } catch (e) {
    console.error("로그아웃 요청 실패:", e);
    return { success: false };
  }
}

async function apiGetMe() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("세션 사용자 조회 실패:", e);
  }
  return null;
}

async function apiGetLoginLogs() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/logs`, { cache: "no-store" });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error("로그인 기록 조회 실패:", e);
  }
  return [];
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
          KONGBAB_DATA.categories = staticData.categories;
          persistData();
          console.log("GitHub Pages 백업 포맷 데이터 로드 성공");
          return "STATIC_CATEGORIES_LOADED";
        }
        if (Array.isArray(staticData.streamers) && staticData.streamers.length > 0) {
          return staticData.streamers;
        }
        if (Array.isArray(staticData) && staticData.length > 0) {
          return staticData;
        }
      }
    }
  } catch (err) {
    console.warn("정적 streamers.json 로드 실패:", err);
  }

  return null;
}

async function saveStreamerToDb(dto) {
  try {
    const res = await fetch(`${API_BASE}/api/streamers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

async function deleteStreamerFromDb(streamerId) {
  try {
    const res = await fetch(`${API_BASE}/api/streamers/${encodeURIComponent(streamerId)}`, {
      method: "DELETE"
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
      headers: { "Content-Type": "application/json" },
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
      method: "DELETE"
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
      headers: { "Content-Type": "application/json" },
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

  // 사용자 로컬 API 키가 있다면 사용
  const localKey = localStorage.getItem("youtube_api_key");
  if (localKey) {
    try {
      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${localKey.trim()}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.items && data.items.length > 0) {
          const snip = data.items[0].snippet;
          let pubDate = "";
          if (snip.publishedAt) {
            pubDate = snip.publishedAt.substring(0, 10).replace(/-/g, ".");
          }
          return {
            success: true,
            videoId: videoId,
            title: snip.title || "",
            publishedDate: pubDate,
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
    const cat = KONGBAB_DATA.categories.find(c => c.id === s.category);
    if (!cat) return;

    const memberObj = {
      id: s.id,
      name: s.name,
      streamer: s.streamer,
      role: s.role || "",
      badgeColor: s.badgeColor || "bg-blue-600",
      avatar: s.avatar || "assets/default-avatar.svg",
      displayOrder: s.displayOrder ?? 0,
      videos: Array.isArray(s.videos) ? s.videos : []
    };

    if (cat.hasSubgroups) {
      let group = (cat.groups || []).find(g => g.id === s.subgroup);
      if (!group && (cat.groups || []).length > 0) {
        group = cat.groups[0];
      }
      if (group) {
        if (!group.members) group.members = [];
        group.members.push(memberObj);
      }
    } else {
      if (!cat.members) cat.members = [];
      cat.members.push(memberObj);
    }
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
  const result = [];
  let globalOrder = 0;

  KONGBAB_DATA.categories.forEach(cat => {
    if (cat.hasSubgroups) {
      (cat.groups || []).forEach(g => {
        (g.members || []).forEach(m => {
          result.push({
            id: m.id,
            name: m.name,
            streamer: m.streamer,
            category: cat.id,
            subgroup: g.id,
            role: m.role || "",
            badgeColor: m.badgeColor || "bg-blue-600",
            avatar: m.avatar || "assets/default-avatar.svg",
            displayOrder: globalOrder++,
            videos: m.videos || []
          });
        });
      });
    } else {
      (cat.members || []).forEach(m => {
        result.push({
          id: m.id,
          name: m.name,
          streamer: m.streamer,
          category: cat.id,
          subgroup: null,
          role: m.role || "",
          badgeColor: m.badgeColor || "bg-blue-600",
          avatar: m.avatar || "assets/default-avatar.svg",
          displayOrder: globalOrder++,
          videos: m.videos || []
        });
      });
    }
  });

  return result;
}

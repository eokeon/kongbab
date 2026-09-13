// ==========================================
// 유튜브 구독자 수 관리 및 수동 일괄 갱신 모듈
// (오직 인원 정보의 유튜브 링크(youtubeUrl)만 기준)
// ==========================================

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

// 그룹(갱단/사업체) 및 카테고리 내 모든 멤버의 구독자 수 총합 계산 (동일 스트리머 중복 합산 방지)
function calculateGroupTotalSubscribers(members) {
  if (!Array.isArray(members) || members.length === 0) return null;
  const seen = new Set();
  let total = 0;

  for (const m of members) {
    if (!m) continue;
    const key = m.id || (m.streamer ? m.streamer : m.name);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    const count = parseSubscriberCount(m.subscriberCount);
    if (count > 0) {
      total += count;
    }
  }

  if (total === 0) return null;
  return formatSubscriberCount(total);
}

// 플랫폼별(유튜브 구독자 / 치지직 팔로워) 총합 계산
function calculateGroupPlatformSubscribers(members) {
  if (!Array.isArray(members) || members.length === 0) {
    return {
      ytTotal: 0,
      ytStr: null,
      chzzkTotal: 0,
      chzzkStr: null,
      grandTotal: 0,
      grandStr: null,
    };
  }

  const seen = new Set();
  let ytTotal = 0;
  let chzzkTotal = 0;

  for (const m of members) {
    if (!m) continue;
    const key = m.id || (m.streamer ? m.streamer : m.name);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    const count = parseSubscriberCount(m.subscriberCount);
    if (count > 0) {
      const isChzzk = typeof isMemberChzzk === "function"
        ? isMemberChzzk(m)
        : (m.youtubeUrl && (/chzzk\.naver\.com/i.test(String(m.youtubeUrl)) || /^[a-f0-9]{32}$/i.test(String(m.youtubeUrl).trim())));
      if (isChzzk) {
        chzzkTotal += count;
      } else {
        ytTotal += count;
      }
    }
  }

  const grandTotal = ytTotal + chzzkTotal;

  return {
    ytTotal,
    ytStr: ytTotal > 0 ? (typeof formatSubscriberCount === "function" ? formatSubscriberCount(ytTotal) : `${ytTotal.toLocaleString()}명`) : null,
    chzzkTotal,
    chzzkStr: chzzkTotal > 0 ? (typeof formatSubscriberCount === "function" ? formatSubscriberCount(chzzkTotal) : `${chzzkTotal.toLocaleString()}명`) : null,
    grandTotal,
    grandStr: grandTotal > 0 ? (typeof formatSubscriberCount === "function" ? formatSubscriberCount(grandTotal) : `${grandTotal.toLocaleString()}명`) : null,
  };
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

  // 2) 핸들(@handle): /@something 또는 @something (한글, 영문, 숫자, 특수기호 대응)
  const handleMatch = str.match(/@([^\/\s?#&]+)/);
  if (handleMatch) {
    return { type: "handle", value: "@" + handleMatch[1].trim() };
  }

  // 3) 사용자명 (/user/username 또는 /c/username)
  const userMatch = str.match(/(?:user|c)\/([^\/\s?#&]+)/i);
  if (userMatch) {
    return { type: "username", value: userMatch[1].trim() };
  }

  // 4) 혹시 인원 정보의 유튜브 링크란에 영상 URL(watch?v= 또는 youtu.be/)을 직접 넣은 경우
  const videoId = typeof extractYoutubeId === "function" ? extractYoutubeId(str) : null;
  if (videoId) {
    return { type: "videoId", value: videoId };
  }

  // 5) 일반 텍스트 (단순 핸들이나 채널명 텍스트)
  if (!str.startsWith("http://") && !str.startsWith("https://") && !str.includes("/")) {
    if (str.startsWith("@")) {
      return { type: "handle", value: str };
    }
    return { type: "search", value: str };
  }

  return null;
}

// 구독자 조회를 위한 타깃 식별자 (오직 인원 정보에 등록된 youtubeUrl만 사용, 영상 fallback 일절 없음)
function getSubscriberLookupTarget(member) {
  if (!member || !member.youtubeUrl || !member.youtubeUrl.trim()) return null;
  const url = member.youtubeUrl.trim();

  // 치지직 채널 식별자 추출 (치지직 URL 또는 32자리 hex 채널 ID)
  const chzzkId = typeof extractChzzkChannelId === "function" ? extractChzzkChannelId(url) : null;
  if (chzzkId) {
    return { platform: "chzzk", type: "chzzkChannelId", value: chzzkId, rawUrl: url };
  }

  const ytTarget = parseYouTubeTarget(url);
  if (ytTarget) {
    return { platform: "youtube", ...ytTarget, rawUrl: url };
  }
  return null;
}

async function fetchMemberSubscriberFromYouTube(member) {
  const target = getSubscriberLookupTarget(member);
  if (!target) return null;

  // 1) 치지직 채널 팔로워 조회
  if (target.platform === "chzzk" || target.type === "chzzkChannelId") {
    try {
      if (typeof apiGetChzzkChannelInfo === "function") {
        const cData = await apiGetChzzkChannelInfo(target.value);
        if (cData && cData.success && cData.followerCountFormatted) {
          return cData.followerCountFormatted;
        }
      }
    } catch (err) {
      console.warn(`[Chzzk] ${member.streamer || member.name} 팔로워 조회 오류:`, err);
    }
    return null;
  }

  // 2) 유튜브 채널 구독자 조회
  const apiKey = typeof getEffectiveYouTubeApiKey === "function" 
    ? getEffectiveYouTubeApiKey() 
    : (localStorage.getItem("youtube_api_key") || "AIzaSyCaWTqIMqfGvXE8-Wg4FpYxvAW-qRWYDYA");
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

// 관리자가 모달에서 수동으로 실행하는 유튜브/치지직 구독자·팔로워 수 일괄 갱신 (오직 인원 정보의 링크 기준)
async function executeSubscriberSync(onProgress) {
  const allMembers = extractAllStreamersFromKongbabData();
  // 대상: 오직 인원 정보에 유튜브 또는 치지직 링크(youtubeUrl)가 등록된 인원만 대상 (영상 기준 fallback 완전 제거)
  const targets = allMembers.filter(m => m.youtubeUrl && m.youtubeUrl.trim());
  if (targets.length === 0) return 0;

  // 1단계: 각 멤버별 인원 정보의 링크 분석
  const targetItems = [];
  for (const m of targets) {
    const target = getSubscriberLookupTarget(m);
    if (target) {
      targetItems.push({ member: m, target });
    }
  }

  let updatedCount = 0;
  let processedCount = 0;

  // 캐시 맵 (중복 요청 방지)
  const subCountCache = new Map();

  // 유튜브 타깃과 치지직 타깃 분리
  const ytItems = targetItems.filter(item => item.target && item.target.platform !== "chzzk" && item.target.type !== "chzzkChannelId");
  const chzzkItems = targetItems.filter(item => item.target && (item.target.platform === "chzzk" || item.target.type === "chzzkChannelId"));

  const apiKey = typeof getEffectiveYouTubeApiKey === "function" 
    ? getEffectiveYouTubeApiKey() 
    : (localStorage.getItem("youtube_api_key") || "AIzaSyCaWTqIMqfGvXE8-Wg4FpYxvAW-qRWYDYA");
  if (!apiKey && ytItems.length > 0) {
    throw new Error("유튜브 API 키가 설정되지 않았습니다.");
  }

  let videoToChannelMap = new Map();

  // 1-1단계: 유튜브 채널 ID 일괄 사전 조회 (YouTube API 배치 part=statistics&id=c1,c2...)
  if (apiKey && ytItems.length > 0) {
    const directChannelIds = ytItems
      .filter(item => item.target && item.target.type === "channelId")
      .map(item => item.target.value);
    
    // videoId가 있는 경우 channelId 추출
    const videoTargets = ytItems.filter(item => item.target && item.target.type === "videoId");
    const videoIds = Array.from(new Set(videoTargets.map(item => item.target.value)));

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

    const allChannelIds = Array.from(new Set([...directChannelIds, ...videoToChannelMap.values()]));
    for (let i = 0; i < allChannelIds.length; i += 50) {
      const chunk = allChannelIds.slice(i, i + 50);
      try {
        const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${chunk.join(",")}&key=${apiKey.trim()}`);
        if (cRes.ok) {
          const cData = await cRes.json();
          (cData.items || []).forEach(cItem => {
            const stats = cItem.statistics;
            if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
              const formatted = formatSubscriberCount(stats.subscriberCount);
              if (formatted) subCountCache.set(cItem.id, formatted);
            }
          });
        }
      } catch (err) {
        console.warn("[YouTube Batch] 채널 구독자 일괄 조회 오류:", err);
      }
    }
  }

  // 1-2단계: 치지직 채널 사전 조회 캐시 (동일 치지직 채널 중복 조회 방지)
  const uniqueChzzkIds = Array.from(new Set(chzzkItems.map(item => item.target.value)));
  for (const chId of uniqueChzzkIds) {
    try {
      if (typeof apiGetChzzkChannelInfo === "function") {
        const res = await apiGetChzzkChannelInfo(chId);
        if (res && res.success && res.followerCountFormatted) {
          subCountCache.set(chId, res.followerCountFormatted);
        }
      }
    } catch (err) {
      console.warn(`[Chzzk Batch] 채널(${chId}) 팔로워 조회 오류:`, err);
    }
  }

  // 2단계: 각 스트리머별 실시간 순차 조회 및 진행률 갱신 (실시간 퍼센티지 & 로그 반영)
  for (let idx = 0; idx < targetItems.length; idx++) {
    const item = targetItems[idx];
    const m = item.member;
    const t = item.target;
    let subStr = null;
    const isChzzk = t && (t.platform === "chzzk" || t.type === "chzzkChannelId");

    if (t) {
      if (isChzzk) {
        if (subCountCache.has(t.value)) {
          subStr = subCountCache.get(t.value);
        } else if (typeof apiGetChzzkChannelInfo === "function") {
          try {
            const res = await apiGetChzzkChannelInfo(t.value);
            if (res && res.success && res.followerCountFormatted) {
              subStr = res.followerCountFormatted;
              subCountCache.set(t.value, subStr);
            }
          } catch (err) {}
        }
      } else if (t.type === "channelId") {
        subStr = subCountCache.get(t.value) || null;
      } else if (t.type === "videoId") {
        const chId = videoToChannelMap.get(t.value);
        if (chId) subStr = subCountCache.get(chId) || null;
      } else if (t.type === "handle" || t.type === "username" || t.type === "search") {
        const cleanHandle = t.value.replace(/^@+/, "");
        if (subCountCache.has(t.value)) {
          subStr = subCountCache.get(t.value);
        } else if (subCountCache.has(`@${cleanHandle}`)) {
          subStr = subCountCache.get(`@${cleanHandle}`);
        } else if (subCountCache.has(cleanHandle)) {
          subStr = subCountCache.get(cleanHandle);
        } else {
          // 1) 공식 forHandle API 시도
          if (t.type === "handle") {
            try {
              const hRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent('@' + cleanHandle)}&key=${apiKey.trim()}`);
              if (hRes.ok) {
                const hData = await hRes.json();
                const stats = hData.items?.[0]?.statistics;
                if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
                  subStr = formatSubscriberCount(stats.subscriberCount);
                }
              }
            } catch (err) {}
          }

          // 2) forHandle 실패 시 또는 search/username인 경우 채널 검색 fallback
          if (!subStr) {
            try {
              const sRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(cleanHandle)}&key=${apiKey.trim()}`);
              if (sRes.ok) {
                const sData = await sRes.json();
                const chId = sData.items?.[0]?.id?.channelId || sData.items?.[0]?.snippet?.channelId;
                if (chId) {
                  if (subCountCache.has(chId)) {
                    subStr = subCountCache.get(chId);
                  } else {
                    const cRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${chId}&key=${apiKey.trim()}`);
                    if (cRes.ok) {
                      const cData = await cRes.json();
                      const stats = cData.items?.[0]?.statistics;
                      if (stats && !stats.hiddenSubscriberCount && stats.subscriberCount) {
                        subStr = formatSubscriberCount(stats.subscriberCount);
                        subCountCache.set(chId, subStr);
                      }
                    }
                  }
                }
              }
            } catch (err) {}
          }

          if (subStr) {
            subCountCache.set(t.value, subStr);
            subCountCache.set(`@${cleanHandle}`, subStr);
            subCountCache.set(cleanHandle, subStr);
          }
        }
      }
    }

    processedCount++;

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
      const platformPrefix = isChzzk ? "치지직 팔로워" : "유튜브 구독자";
      if (onProgress) onProgress(processedCount, targetItems.length, m.streamer, `성공 (${platformPrefix} ${subStr})`);
    } else {
      if (onProgress) onProgress(processedCount, targetItems.length, m.streamer, "조회 실패/비공개");
    }

    // 브라우저 렌더링 갱신을 위해 틱 양보
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  persistData();
  if (typeof renderContent === "function") renderContent();

  const syncPromises = [];
  if (typeof syncAllStreamersToDb === "function") {
    syncPromises.push(syncAllStreamersToDb(extractAllStreamersFromKongbabData()));
  }
  if (typeof createBackupSnapshot === "function") {
    createBackupSnapshot(`구독자/팔로워 수 일괄 갱신 (${updatedCount}명)`, true);
  }

  try {
    await Promise.all(syncPromises);
  } catch (e) {}

  return updatedCount;
}

// ==========================================
// 전체 영상 조회수 관리 및 수동 일괄 갱신 모듈
// (YouTube Data API v3 50개 배치 & 치지직 VOD API)
// ==========================================

// 등록된 전체 영상 목록 수집 (각 영상 객체의 레퍼런스 유지)
function extractAllVideosFromKongbabData() {
  const videoList = [];
  if (!window.KONGBAB_DATA || !Array.isArray(KONGBAB_DATA.categories)) return videoList;

  KONGBAB_DATA.categories.forEach(cat => {
    if (!cat) return;
    if (Array.isArray(cat.groups)) {
      cat.groups.forEach(grp => {
        if (!grp || !Array.isArray(grp.members)) return;
        grp.members.forEach(m => {
          if (!m || !Array.isArray(m.videos)) return;
          m.videos.forEach(v => {
            if (!v || !v.url || v.url === "undefined" || !v.url.trim()) return;
            videoList.push({ video: v, member: m, category: cat, group: grp });
          });
        });
      });
    }
    if (Array.isArray(cat.members)) {
      cat.members.forEach(m => {
        if (!m || !Array.isArray(m.videos)) return;
        m.videos.forEach(v => {
          if (!v || !v.url || v.url === "undefined" || !v.url.trim()) return;
          videoList.push({ video: v, member: m, category: cat, group: null });
        });
      });
    }
  });

  return videoList;
}

// 관리자가 어드민 모달에서 수동으로 실행하는 유튜브/치지직 전체 영상 조회수 초고속 일괄 갱신
async function executeViewCountSync(onProgress) {
  // 백엔드 연결 상태 확인 (로컬 환경에서 꺼져 있어도 브라우저 화면 갱신은 차단하지 않고 진행)
  let hasServer = false;
  if (typeof checkBackupServerHealth === "function") {
    hasServer = await checkBackupServerHealth();
  }

  const allItems = extractAllVideosFromKongbabData();
  if (allItems.length === 0) {
    return { success: true, updatedCount: 0, totalCount: 0, hasServer };
  }

  const apiKey = typeof getEffectiveYouTubeApiKey === "function"
    ? getEffectiveYouTubeApiKey()
    : (localStorage.getItem("youtube_api_key") || "AIzaSyCaWTqIMqfGvXE8-Wg4FpYxvAW-qRWYDYA");

  // 유튜브 / 치지직 분류
  const ytItems = [];
  const chzzkItems = [];
  const ytIdToVideos = new Map(); // ytId -> [videoObjects]
  const chzzkNoToVideos = new Map(); // chzzkNo -> [videoObjects]

  allItems.forEach(item => {
    const url = item.video.url || "";
    const isChzzk = typeof isChzzkUrl === "function" && isChzzkUrl(url);
    if (isChzzk) {
      const chzzkNo = typeof extractChzzkVideoNo === "function" ? extractChzzkVideoNo(url) : null;
      if (chzzkNo) {
        if (!chzzkNoToVideos.has(chzzkNo)) {
          chzzkNoToVideos.set(chzzkNo, []);
        }
        chzzkNoToVideos.get(chzzkNo).push(item.video);
        chzzkItems.push({ ...item, chzzkNo });
      }
    } else {
      const ytId = typeof extractYoutubeId === "function" ? extractYoutubeId(url) : null;
      if (ytId && ytId.length === 11) {
        if (!ytIdToVideos.has(ytId)) {
          ytIdToVideos.set(ytId, []);
        }
        ytIdToVideos.get(ytId).push(item.video);
        ytItems.push({ ...item, ytId });
      }
    }
  });

  const uniqueYtIds = Array.from(ytIdToVideos.keys());
  const uniqueChzzkNos = Array.from(chzzkNoToVideos.keys());
  const totalUniqueTargets = uniqueYtIds.length + uniqueChzzkNos.length;

  let processedCount = 0;
  let updatedCount = 0;

  // 1단계: 유튜브 50개 단위 청크 일괄 조회
  const ytChunks = [];
  for (let i = 0; i < uniqueYtIds.length; i += 50) {
    ytChunks.push(uniqueYtIds.slice(i, i + 50));
  }

  for (let cIdx = 0; cIdx < ytChunks.length; cIdx++) {
    const chunk = ytChunks[cIdx];
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(',')}&key=${apiKey.trim()}`);
      if (res.ok) {
        const data = await res.json();
        const foundMap = new Map();
        (data.items || []).forEach(it => {
          if (it.statistics && it.statistics.viewCount != null) {
            foundMap.set(it.id, Number(it.statistics.viewCount));
          }
        });

        chunk.forEach(ytId => {
          processedCount++;
          if (foundMap.has(ytId)) {
            const vCount = foundMap.get(ytId);
            const videos = ytIdToVideos.get(ytId) || [];
            videos.forEach(v => {
              v.viewCount = vCount;
              updatedCount++;
            });
          }
        });

        const startIdx = cIdx * 50 + 1;
        const endIdx = Math.min(uniqueYtIds.length, (cIdx + 1) * 50);
        if (onProgress) {
          onProgress(processedCount, totalUniqueTargets, `유튜브 ${startIdx}~${endIdx}번 영상 (${chunk.length}개)`, `성공 (+${foundMap.size}개 최신화)`);
        }
      } else {
        processedCount += chunk.length;
        let errMsg = `API 오류 (${res.status})`;
        try {
          const errData = await res.json();
          if (errData?.error?.message) {
            errMsg = errData.error.message;
          }
        } catch (_) {}
        if (onProgress) {
          onProgress(processedCount, totalUniqueTargets, `유튜브 배치 (${cIdx + 1}/${ytChunks.length})`, errMsg);
        }
      }
    } catch (e) {
      processedCount += chunk.length;
      if (onProgress) {
        onProgress(processedCount, totalUniqueTargets, `유튜브 배치 (${cIdx + 1}/${ytChunks.length})`, `네트워크 오류: ${e.message || e}`);
      }
    }

    await new Promise(r => setTimeout(r, 20));
  }

  // 2단계: 치지직 영상 비동기 조회
  for (let i = 0; i < uniqueChzzkNos.length; i++) {
    const chzzkNo = uniqueChzzkNos[i];
    processedCount++;
    try {
      let readCount = null;
      // 1) 백엔드 API 시도
      if (typeof API_BASE !== "undefined") {
        try {
          const cRes = await fetch(`${API_BASE}/api/chzzk/info?videoNo=${chzzkNo}`);
          if (cRes.ok) {
            const cData = await cRes.json();
            if (cData && cData.viewCount != null) {
              readCount = Number(cData.viewCount);
            }
          }
        } catch (err) {}
      }

      // 2) 백엔드 실패 시 직접 치지직 API 시도
      if (readCount == null) {
        try {
          const directRes = await fetch(`https://api.chzzk.naver.com/service/v2/videos/${chzzkNo}`);
          if (directRes.ok) {
            const dData = await directRes.json();
            if (dData?.content?.readCount != null) {
              readCount = Number(dData.content.readCount);
            }
          }
        } catch (err) {}
      }

      if (readCount != null) {
        const videos = chzzkNoToVideos.get(chzzkNo) || [];
        videos.forEach(v => {
          v.viewCount = readCount;
          updatedCount++;
        });
        if (onProgress) {
          onProgress(processedCount, totalUniqueTargets, `치지직 영상 (${chzzkNo})`, `성공 (${readCount.toLocaleString()}회)`);
        }
      } else {
        if (onProgress) {
          onProgress(processedCount, totalUniqueTargets, `치지직 영상 (${chzzkNo})`, `조회 실패/비공개`);
        }
      }
    } catch (e) {
      if (onProgress) {
        onProgress(processedCount, totalUniqueTargets, `치지직 영상 (${chzzkNo})`, `오류`);
      }
    }

    await new Promise(r => setTimeout(r, 25));
  }

  // 3단계: 로컬 캐시 무효화 및 데이터 저장
  if (typeof clearRenderStatsCache === "function") clearRenderStatsCache();
  if (typeof invalidateLeaderboardCache === "function") invalidateLeaderboardCache();
  if (typeof persistData === "function") persistData(true);
  if (typeof updateHeaderStats === "function") updateHeaderStats();
  if (typeof renderContent === "function") renderContent();

  // 4단계: 서버 연결되어 있는 경우 MariaDB 및 백업 스냅샷 동기화
  let dbSynced = false;
  let backupSynced = false;
  if (hasServer) {
    const syncPromises = [];
    if (typeof syncAllStreamersToDb === "function" && typeof extractAllStreamersFromKongbabData === "function") {
      syncPromises.push(
        syncAllStreamersToDb(extractAllStreamersFromKongbabData())
          .then(res => { if (res) dbSynced = true; })
          .catch(err => console.warn("DB 동기화 중 오류:", err))
      );
    }
    if (typeof createBackupSnapshot === "function") {
      syncPromises.push(
        createBackupSnapshot(`영상 조회수 일괄 갱신 (${updatedCount}개 영상)`, false)
          .then(res => { if (res) backupSynced = true; })
          .catch(err => console.warn("백업 스냅샷 저장 중 오류:", err))
      );
    }

    try {
      await Promise.all(syncPromises);
    } catch (e) {}
  }

  return { success: true, updatedCount, totalCount: allItems.length, hasServer, dbSynced, backupSynced };
}

window.extractAllVideosFromKongbabData = extractAllVideosFromKongbabData;
window.executeViewCountSync = executeViewCountSync;

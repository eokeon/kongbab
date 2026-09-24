// 타임아웃 지원 fetch 헬퍼 (네트워크 지연 및 무한 대기 완전 방지)
async function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// 등록된 전체 영상 목록 수집 (각 영상 객체의 레퍼런스 유지)
function extractAllVideosFromKongbapData() {
  const videoList = [];
  const kbData = (typeof KONGBAP_DATA !== "undefined" && KONGBAP_DATA)
    ? KONGBAP_DATA
    : (typeof window !== "undefined" && window.KONGBAP_DATA ? window.KONGBAP_DATA : null);
  if (!kbData || !Array.isArray(kbData.categories)) return videoList;

  const seenMemberSet = new Set();
  const seenMemberIds = new Set();
  const seenVideoSet = new Set();

  const processMember = (m, cat, grp) => {
    if (!m || !Array.isArray(m.videos)) return;
    if (seenMemberSet.has(m)) return;
    seenMemberSet.add(m);

    const memKey = m.id || (m.streamer && m.name ? `${m.streamer}_${m.name}` : (m.name || null));
    if (memKey && seenMemberIds.has(memKey)) return;
    if (memKey) seenMemberIds.add(memKey);

    m.videos.forEach(v => {
      if (!v || !v.url || v.url === "undefined" || !v.url.trim()) return;
      if (!seenVideoSet.has(v)) {
        seenVideoSet.add(v);
        videoList.push({ video: v, member: m, category: cat, group: grp });
      }
    });
  };

  kbData.categories.forEach(cat => {
    if (!cat) return;
    if (Array.isArray(cat.groups)) {
      cat.groups.forEach(grp => {
        if (!grp || !Array.isArray(grp.members)) return;
        grp.members.forEach(m => processMember(m, cat, grp));
      });
    }
    if (Array.isArray(cat.members)) {
      cat.members.forEach(m => processMember(m, cat, null));
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

  let allItems = extractAllVideosFromKongbapData();
  if (allItems.length === 0 && typeof loadStoredData === "function") {
    loadStoredData();
    allItems = extractAllVideosFromKongbapData();
  }
  if (allItems.length === 0) {
    return { success: false, message: "갱신 대상 영상이 없습니다. 데이터 로딩 후 다시 시도해주세요.", updatedCount: 0, totalCount: 0, totalIncrease: 0, hasServer };
  }

  // 원래 조회수 정보가 등록되어 있던 영상 기록 (원래 정보가 있었던 대상만 기존 대비 증가량 계산)
  const originalViewCountMap = new Map();
  allItems.forEach(item => {
    const v = item.video;
    if (v && !originalViewCountMap.has(v)) {
      const rawCount = v.viewCount;
      const num = (rawCount !== undefined && rawCount !== null && rawCount !== "") ? Number(rawCount) : null;
      if (num !== null && !isNaN(num) && num > 0) {
        originalViewCountMap.set(v, num);
      }
    }
  });

  let apiKey = "";
  if (typeof initYouTubeApiKeyFromBackend === "function") {
    apiKey = await initYouTubeApiKeyFromBackend(true);
  }
  if (!apiKey && typeof getEffectiveYouTubeApiKey === "function") {
    apiKey = getEffectiveYouTubeApiKey();
  }

  // 유튜브 / 치지직 / 기타 분류
  const ytItems = [];
  const chzzkItems = [];
  const ytIdToItems = new Map(); // ytId -> [itemObjects with { video, member }]
  const chzzkNoToItems = new Map(); // chzzkNo -> [itemObjects with { video, member }]
  const unparseableVideos = [];

  allItems.forEach(item => {
    const url = item.video?.url || "";
    const isChzzk = typeof isChzzkUrl === "function" && isChzzkUrl(url);
    if (isChzzk) {
      const chzzkNo = typeof extractChzzkVideoNo === "function" ? extractChzzkVideoNo(url) : null;
      if (chzzkNo) {
        if (!chzzkNoToItems.has(chzzkNo)) {
          chzzkNoToItems.set(chzzkNo, []);
        }
        chzzkNoToItems.get(chzzkNo).push(item);
        chzzkItems.push({ ...item, chzzkNo });
      } else {
        unparseableVideos.push(item);
      }
    } else {
      const ytId = typeof extractYoutubeId === "function" ? extractYoutubeId(url) : null;
      if (ytId && ytId.length === 11) {
        if (!ytIdToItems.has(ytId)) {
          ytIdToItems.set(ytId, []);
        }
        ytIdToItems.get(ytId).push(item);
        ytItems.push({ ...item, ytId });
      } else {
        unparseableVideos.push(item);
      }
    }
  });

  const uniqueYtIds = Array.from(ytIdToItems.keys());
  const uniqueChzzkNos = Array.from(chzzkNoToItems.keys());
  const totalUniqueTargets = uniqueYtIds.length + uniqueChzzkNos.length;

  let processedCount = 0;
  let updatedCount = 0;
  let unavailableCount = unparseableVideos.length;
  let failedCount = 0;
  const unavailableList = unparseableVideos.map(it => ({
    platform: "기타",
    id: it.video?.url || it.video?.id || "unknown",
    title: it.video?.title || "알 수 없는 영상",
    url: it.video?.url || "",
    streamer: it.member?.streamer || it.member?.name || "",
    reason: "URL 형식 확인 불가"
  }));

  // 1단계: 유튜브 50개 단위 청크 일괄 조회
  const ytChunks = [];
  for (let i = 0; i < uniqueYtIds.length; i += 50) {
    ytChunks.push(uniqueYtIds.slice(i, i + 50));
  }

  if (!apiKey && ytChunks.length > 0) {
    console.warn("[ViewCount Sync] 유튜브 API 키가 설정되지 않아 유튜브 조회를 건너뜁니다.");
    if (onProgress) {
      onProgress(uniqueYtIds.length, totalUniqueTargets, "유튜브 영상", "⚠️ API 키 미설정");
    }
    processedCount += uniqueYtIds.length;
    uniqueYtIds.forEach(ytId => {
      const items = ytIdToItems.get(ytId) || [];
      failedCount += items.length;
    });
  } else {
    for (let cIdx = 0; cIdx < ytChunks.length; cIdx++) {
      const chunk = ytChunks[cIdx];
      try {
        const res = await fetchWithTimeout(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(',')}&key=${apiKey.trim()}`, {}, 7000);
        if (res.ok) {
          const data = await res.json();
          const foundMap = new Map();
          (data.items || []).forEach(it => {
            if (it.statistics && it.statistics.viewCount != null) {
              foundMap.set(it.id, Number(it.statistics.viewCount));
            }
          });

          let chunkFound = 0;
          let chunkUnavail = 0;

          chunk.forEach(ytId => {
            processedCount++;
            const items = ytIdToItems.get(ytId) || [];
            if (foundMap.has(ytId)) {
              const vCount = foundMap.get(ytId);
              items.forEach(it => {
                it.video.viewCount = vCount;
                updatedCount++;
                chunkFound++;
              });
            } else {
              items.forEach(it => {
                unavailableCount++;
                chunkUnavail++;
                unavailableList.push({
                  platform: "유튜브",
                  id: ytId,
                  title: it.video?.title || ytId,
                  url: it.video?.url || `https://youtu.be/${ytId}`,
                  streamer: it.member?.streamer || it.member?.name || "",
                  reason: "비공개 또는 삭제된 동영상"
                });
              });
            }
          });

          const startIdx = cIdx * 50 + 1;
          const endIdx = Math.min((cIdx + 1) * 50, uniqueYtIds.length);
          const unavailNotice = chunkUnavail > 0 ? ` (비공개/삭제 ${chunkUnavail}개)` : "";
          if (onProgress) {
            onProgress(processedCount, totalUniqueTargets, `유튜브 ${startIdx}~${endIdx}번 영상 (${chunk.length}개)`, `성공 (+${chunkFound}개 최신화)${unavailNotice}`);
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
          chunk.forEach(ytId => {
            const items = ytIdToItems.get(ytId) || [];
            failedCount += items.length;
          });
          if (onProgress) {
            onProgress(processedCount, totalUniqueTargets, `유튜브 배치 (${cIdx + 1}/${ytChunks.length})`, errMsg);
          }
        }
      } catch (e) {
        processedCount += chunk.length;
        chunk.forEach(ytId => {
          const items = ytIdToItems.get(ytId) || [];
          failedCount += items.length;
        });
        if (onProgress) {
          onProgress(processedCount, totalUniqueTargets, `유튜브 배치 (${cIdx + 1}/${ytChunks.length})`, `네트워크 오류: ${e.message || e}`);
        }
      }

      await new Promise(r => setTimeout(r, 20));
    }
  }

  // 2단계: 치지직 영상 비동기 병렬 조회 (5개씩 안전 동시 처리)
  const chzzkBatchSize = 5;
  for (let i = 0; i < uniqueChzzkNos.length; i += chzzkBatchSize) {
    const chunk = uniqueChzzkNos.slice(i, i + chzzkBatchSize);
    let chunkFound = 0;
    let chunkUnavail = 0;

    await Promise.all(chunk.map(async (chzzkNo) => {
      processedCount++;
      const items = chzzkNoToItems.get(chzzkNo) || [];
      try {
        let readCount = null;
        let isUnavailable = false;
        let hasNetworkOrServerError = false;

        // 1) 백엔드 API 시도 (타임아웃 3.5초)
        if (typeof API_BASE !== "undefined") {
          try {
            const cRes = await fetchWithTimeout(`${API_BASE}/api/chzzk/info?videoNo=${chzzkNo}`, {}, 3500);
            if (cRes.ok) {
              const cData = await cRes.json();
              if (cData && cData.viewCount != null) {
                readCount = Number(cData.viewCount);
              } else if (cData && cData.success === false) {
                isUnavailable = true;
              }
            } else if (cRes.status === 404) {
              isUnavailable = true;
            } else if (cRes.status >= 500) {
              hasNetworkOrServerError = true;
            }
          } catch (err) {
            hasNetworkOrServerError = true;
          }
        }

        // 2) 백엔드에서 못 가져왔고 조회불가 확정이 아니면 직접 치지직 API 시도 (타임아웃 3.5초)
        if (readCount == null && !isUnavailable) {
          try {
            const directRes = await fetchWithTimeout(`https://api.chzzk.naver.com/service/v2/videos/${chzzkNo}`, {}, 3500);
            if (directRes.ok) {
              const dData = await directRes.json();
              if (dData?.content?.readCount != null) {
                readCount = Number(dData.content.readCount);
                hasNetworkOrServerError = false;
              } else if (dData?.code === 404 || dData?.code === 400 || dData?.content == null) {
                isUnavailable = true;
                hasNetworkOrServerError = false;
              } else {
                hasNetworkOrServerError = true;
              }
            } else if (directRes.status === 404) {
              isUnavailable = true;
              hasNetworkOrServerError = false;
            } else {
              hasNetworkOrServerError = true;
            }
          } catch (err) {
            hasNetworkOrServerError = true;
          }
        }

        if (readCount != null) {
          items.forEach(it => {
            it.video.viewCount = readCount;
            updatedCount++;
          });
          chunkFound++;
        } else if (isUnavailable || !hasNetworkOrServerError) {
          // 정상적으로 API 통신이 되었으나 영상이 존재하지 않거나 비공개/만료된 경우
          unavailableCount += items.length;
          chunkUnavail += items.length;
          items.forEach(it => {
            unavailableList.push({
              platform: "치지직",
              id: String(chzzkNo),
              title: it.video?.title || String(chzzkNo),
              url: it.video?.url || `https://chzzk.naver.com/video/${chzzkNo}`,
              streamer: it.member?.streamer || it.member?.name || "",
              reason: "VOD 만료 또는 비공개"
            });
          });
        } else {
          // 네트워크 단절, 5xx 서버 장애 등 실제 조회 실패
          failedCount += items.length;
        }
      } catch (e) {
        failedCount += items.length;
      }
    }));

    const startIdx = i + 1;
    const endIdx = Math.min(uniqueChzzkNos.length, i + chzzkBatchSize);
    const unavailNotice = chunkUnavail > 0 ? ` (만료/비공개 ${chunkUnavail}건)` : "";
    if (onProgress) {
      onProgress(processedCount, totalUniqueTargets, `치지직 ${startIdx}~${endIdx}번 영상 (${chunk.length}개 병렬)`, `성공 (+${chunkFound}개 최신화)${unavailNotice}`);
    }

    await new Promise(r => setTimeout(r, 20));
  }

  // 3단계: 기존 대비 총 조회수 증가량 계산 (원래 조회수 정보가 등록되어 있던 영상 기준)
  let totalViewIncrease = 0;
  let prevTotalViews = 0;
  let newTotalViews = 0;
  let increasedVideosCount = 0;

  const countedVideos = new Set();
  allItems.forEach(item => {
    const v = item.video;
    if (!v || countedVideos.has(v)) return;
    countedVideos.add(v);

    if (originalViewCountMap.has(v)) {
      const prevCount = originalViewCountMap.get(v);
      const newCount = Number(v.viewCount);
      if (!isNaN(newCount) && newCount >= 0) {
        prevTotalViews += prevCount;
        newTotalViews += newCount;
        const diff = newCount - prevCount;
        if (diff > 0) {
          totalViewIncrease += diff;
          increasedVideosCount++;
        }
      }
    }
  });

  // 조회 완료 후 백업 및 DB 저장 단계 진입 알림
  if (onProgress) {
    onProgress(allItems.length, allItems.length, "전체 영상 조회 완료", "SAVING_BACKUP");
  }

  // 로컬 캐시 무효화 및 데이터 저장
  if (typeof clearRenderStatsCache === "function") clearRenderStatsCache();
  if (typeof invalidateLeaderboardCache === "function") invalidateLeaderboardCache();
  if (typeof persistData === "function") persistData(true);
  if (typeof updateStats === "function") updateStats();
  if (typeof state !== "undefined" && state.currentCategory !== "adminpage") {
    if (typeof renderCategoryTabs === "function") renderCategoryTabs();
    if (typeof renderContent === "function") renderContent();
  }

  // 4단계: 서버 연결되어 있는 경우 MariaDB 및 백업 스냅샷 동기화
  let dbSynced = false;
  let backupSynced = false;
  if (hasServer) {
    const syncPromises = [];
    if (typeof syncAllStreamersToDb === "function" && typeof extractAllStreamersFromKongbapData === "function") {
      syncPromises.push(
        syncAllStreamersToDb(extractAllStreamersFromKongbapData())
          .then(res => { if (res) dbSynced = true; })
          .catch(err => console.warn("DB 동기화 중 오류:", err))
      );
    }
    if (typeof createBackupSnapshot === "function") {
      const backupDesc = totalViewIncrease > 0
        ? `영상 조회수 일괄 갱신 (성공: ${updatedCount}건, 증가: +${totalViewIncrease.toLocaleString()}회, 조회불가: ${unavailableCount}건, 실패: ${failedCount}건)`
        : `영상 조회수 일괄 갱신 (성공: ${updatedCount}건, 조회불가: ${unavailableCount}건, 실패: ${failedCount}건)`;
      syncPromises.push(
        createBackupSnapshot(backupDesc, false)
          .then(res => { if (res) backupSynced = true; })
          .catch(err => console.warn("백업 스냅샷 저장 중 오류:", err))
      );
    }

    try {
      await Promise.all(syncPromises);
    } catch (e) {}
  }

  return {
    success: true,
    updatedCount,
    unavailableCount,
    failedCount,
    totalCount: allItems.length,
    unavailableList,
    hasServer,
    dbSynced,
    backupSynced,
    totalIncrease: totalViewIncrease,
    increasedVideosCount,
    prevTotalViews,
    newTotalViews,
    hasPrevCount: originalViewCountMap.size
  };
}

window.extractAllVideosFromKongbapData = extractAllVideosFromKongbapData;
window.executeViewCountSync = executeViewCountSync;

let cardDragSource = null;
let isDraggingCard = false;
let hasActuallyDragged = false;
let dragStartX = null;
let dragStartY = null;

// 드래그 중 마우스 좌표 및 자동 스크롤 관리
let lastDragX = null;
let lastDragY = null;
let autoScrollRaf = null;

/**
 * 주어진 요소의 가장 가까운 스크롤 가능한 상위 컨테이너(모달, 영역 등)를 반환합니다.
 */
function getScrollableContainer(el) {
  let cur = el;
  while (cur && cur !== document.body && cur !== document.documentElement) {
    const style = window.getComputedStyle(cur);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && cur.scrollHeight > cur.clientHeight) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

/**
 * 드래그 중 마우스 좌표(x, y) 아래에 있는 드래그 타겟 카드를 감지하여 하이라이트(.card-drag-over)를 갱신합니다.
 */
function updateDragOverElementAt(x, y) {
  if (!isDraggingCard || !cardDragSource) return;
  if (x == null || y == null) return;

  const el = document.elementFromPoint(x, y);
  if (!el) return;

  const card = el.closest(`[data-drag-type="${cardDragSource.type}"]`);
  clearCardDragOverStyles();
  if (card && card.dataset.dragId !== cardDragSource.id) {
    card.classList.add("card-drag-over");
  }
}

/**
 * 드래그 중 마우스 휠 이벤트 가로채기 (브라우저가 DnD 중 네이티브 스크롤을 막는 현상 해결)
 */
function handleGlobalDragWheel(e) {
  const isDraggingAny = isDraggingCard || cardDragSource || 
    (typeof playlistDragSourceIndex !== "undefined" && playlistDragSourceIndex !== null);
  if (!isDraggingAny) return;

  let delta = e.deltaY;
  if (e.deltaMode === 1) {
    // Firefox / 일부 Windows 드라이버의 라인 단위 휠
    delta *= 33;
  } else if (e.deltaMode === 2) {
    // 페이지 단위 휠
    delta *= window.innerHeight;
  }

  if (!delta) return;

  const clientX = e.clientX || lastDragX || (window.innerWidth / 2);
  const clientY = e.clientY || lastDragY || (window.innerHeight / 2);
  const target = document.elementFromPoint(clientX, clientY) || e.target;
  const scrollContainer = getScrollableContainer(target);

  if (scrollContainer) {
    scrollContainer.scrollTop += delta;
  } else {
    window.scrollBy({
      top: delta,
      left: 0,
      behavior: "auto"
    });
  }

  // 휠 스크롤 후 마우스 아래의 카드 하이라이트 즉시 갱신
  updateDragOverElementAt(clientX, clientY);

  if (e.cancelable) {
    e.preventDefault();
  }
}

// 캡처 단계에서 마우스 휠 이벤트를 감지하여 드래그 중 스크롤 보장
window.addEventListener("wheel", handleGlobalDragWheel, { passive: false, capture: true });
document.addEventListener("wheel", handleGlobalDragWheel, { passive: false, capture: true });

/**
 * 드래그 중 화면 상/하단 가장자리에 마우스가 위치할 때 자동 스크롤(Edge Auto-Scroll)
 */
function startAutoScroll() {
  if (autoScrollRaf) return;

  function step() {
    const isDraggingAny = isDraggingCard || cardDragSource || 
      (typeof playlistDragSourceIndex !== "undefined" && playlistDragSourceIndex !== null);
    if (!isDraggingAny) {
      stopAutoScroll();
      return;
    }

    if (lastDragY !== null) {
      const topThreshold = 120; // 뷰포트 상단 120px 이내 (스티키 헤더 영역 고려)
      const bottomThreshold = 120; // 뷰포트 하단 120px 이내
      const vh = window.innerHeight;
      let scrollSpeed = 0;

      if (lastDragY >= 0 && lastDragY < topThreshold) {
        const ratio = 1 - (lastDragY / topThreshold);
        scrollSpeed = -Math.max(4, Math.round(28 * ratio));
      } else if (lastDragY > vh - bottomThreshold && lastDragY <= vh) {
        const ratio = 1 - ((vh - lastDragY) / bottomThreshold);
        scrollSpeed = Math.max(4, Math.round(28 * ratio));
      }

      if (scrollSpeed !== 0) {
        const clientX = lastDragX || (window.innerWidth / 2);
        const target = document.elementFromPoint(clientX, lastDragY);
        const scrollContainer = getScrollableContainer(target);

        if (scrollContainer) {
          scrollContainer.scrollTop += scrollSpeed;
        } else {
          window.scrollBy(0, scrollSpeed);
        }

        updateDragOverElementAt(clientX, lastDragY);
      }
    }

    autoScrollRaf = requestAnimationFrame(step);
  }

  autoScrollRaf = requestAnimationFrame(step);
}

function stopAutoScroll() {
  if (autoScrollRaf) {
    cancelAnimationFrame(autoScrollRaf);
    autoScrollRaf = null;
  }
  lastDragX = null;
  lastDragY = null;
}

// 전역 dragover 리스너로 마우스 좌표 실시간 추적
document.addEventListener("dragover", (e) => {
  const isDraggingAny = isDraggingCard || cardDragSource || 
    (typeof playlistDragSourceIndex !== "undefined" && playlistDragSourceIndex !== null);
  if (!isDraggingAny) return;

  lastDragX = e.clientX;
  lastDragY = e.clientY;
  startAutoScroll();
}, { passive: true });

// 전역 dragend 리스너로 안전한 정리
window.addEventListener("dragend", () => {
  stopAutoScroll();
  clearCardDragOverStyles();
  setTimeout(() => {
    isDraggingCard = false;
    hasActuallyDragged = false;
    cardDragSource = null;
    dragStartX = null;
    dragStartY = null;
  }, 80);
});

// 마우스 버튼을 뗐을 때도 드래그 플래그 안전 해제
window.addEventListener("mouseup", () => {
  if (isDraggingCard || cardDragSource) {
    stopAutoScroll();
    clearCardDragOverStyles();
    setTimeout(() => {
      isDraggingCard = false;
      hasActuallyDragged = false;
      cardDragSource = null;
      dragStartX = null;
      dragStartY = null;
    }, 40);
  }
});

function handleCardDragStart(e, type, id) {
  if (typeof isAdmin === "function" && !isAdmin()) {
    e.preventDefault();
    return false;
  }
  isDraggingCard = true;
  hasActuallyDragged = false;
  cardDragSource = { type, id };
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  lastDragX = e.clientX;
  lastDragY = e.clientY;

  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
  }
  const card = e.currentTarget;
  if (card) setTimeout(() => card.classList.add("card-drag-source"), 0);

  startAutoScroll();
}

function handleCardDragOver(e) {
  if (typeof isAdmin === "function" && !isAdmin()) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

  if (dragStartX !== null && dragStartY !== null) {
    if (Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY) > 6) {
      hasActuallyDragged = true;
    }
  }

  lastDragX = e.clientX;
  lastDragY = e.clientY;
  startAutoScroll();

  const card = e.currentTarget;
  if (card && !card.classList.contains("card-drag-over")) {
    card.classList.add("card-drag-over");
  }
}

function handleCardDragLeave(e) {
  const card = e.currentTarget;
  if (card) card.classList.remove("card-drag-over");
}

function handleCardDragEnd(e) {
  stopAutoScroll();
  clearCardDragOverStyles();
  const card = e.currentTarget;
  if (card) card.classList.remove("card-drag-source");
  setTimeout(() => {
    isDraggingCard = false;
    hasActuallyDragged = false;
    cardDragSource = null;
    dragStartX = null;
    dragStartY = null;
  }, 80);
}

function clearCardDragOverStyles() {
  document.querySelectorAll(".card-drag-over").forEach(el => el.classList.remove("card-drag-over"));
  document.querySelectorAll(".card-drag-source").forEach(el => el.classList.remove("card-drag-source"));
}

async function handleCardDrop(e, type, targetId) {
  e.preventDefault();
  e.stopPropagation();
  stopAutoScroll();
  clearCardDragOverStyles();
  hasActuallyDragged = true;

  if (typeof isAdmin === "function" && !isAdmin()) return;
  if (!cardDragSource || cardDragSource.type !== type || cardDragSource.id === targetId) return;
  const sourceId = cardDragSource.id;

  let list = null;
  let reasonPrefix = "";
  let getName = item => item.name;

  if (type === "direct-member") {
    const cat = getCurrentCategory();
    list = cat?.members;
    reasonPrefix = `인원 순서 변경: [${cat?.name}]`;
    getName = m => `${m.name} (${m.streamer})`;
  } else if (type === "group-member") {
    const group = state.currentGroup;
    list = group?.members;
    reasonPrefix = `인원 순서 변경: [${group?.name}]`;
    getName = m => `${m.name} (${m.streamer})`;
  } else if (type === "group") {
    const cat = getCurrentCategory();
    list = cat?.groups;
    reasonPrefix = `조직 순서 변경: [${cat?.name}]`;
    getName = g => g.name;
  } else if (type === "video") {
    const member = state.currentMember;
    list = member?.videos;
    reasonPrefix = `영상 순서 변경: [${member?.name}]`;
    getName = v => `"${v.title}"`;
  } else if (type === "loveline") {
    if (typeof getLovelineList === "function" && typeof saveLovelineList === "function") {
      let list = getLovelineList();
      const fromIdx = list.findIndex(item => item.id === sourceId);
      const toIdx = list.findIndex(item => item.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);

      const p1 = moved.person1?.name || "인원1";
      const p2 = moved.person2?.name || "인원2";
      const coupleTitle = moved.title || `${p1} 💕 ${p2}`;
      const reason = `러브라인 순서 변경: ${coupleTitle} (${fromIdx + 1}번 → ${toIdx + 1}번)`;

      saveLovelineList(list);
      const mainContent = document.getElementById("main-content");
      if (mainContent && typeof renderLovelineContent === "function") {
        renderLovelineContent(mainContent);
      }
      if (typeof showToast === "function") {
        showToast(`✓ 순서가 변경되어 저장되었습니다.<br><span class="text-[11px] text-amber-300">${reason}</span>`);
      }
      setTimeout(() => {
        isDraggingCard = false;
        hasActuallyDragged = false;
        cardDragSource = null;
        dragStartX = null;
        dragStartY = null;
      }, 50);

      scheduleCardReorderSync("loveline", reason);
      return;
    }
  }

  if (!list) return;
  const fromIdx = list.findIndex(item => item.id === sourceId);
  const toIdx = list.findIndex(item => item.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  if (fromIdx === toIdx) return;

  if (typeof isServerConnected !== "undefined" && !isServerConnected) {
    if (typeof showBackendOfflineModal === "function") {
      showBackendOfflineModal("순서 변경 저장");
    } else {
      showToast("❌ 백엔드(8080) 미연결: 순서 변경 저장이 차단되었습니다.");
    }
    renderContent();
    return;
  }

  const [moved] = list.splice(fromIdx, 1);
  list.splice(toIdx, 0, moved);

  // 변경된 순서에 맞게 해당 소속의 affiliation.displayOrder 즉시 재부여
  if (type === "direct-member") {
    const cat = getCurrentCategory();
    list.forEach((m, idx) => {
      if (Array.isArray(m.affiliations)) {
        let aff = m.affiliations.find(a => a.category === cat.id && !a.subgroup);
        if (!aff) {
          aff = { category: cat.id, subgroup: null };
          m.affiliations.push(aff);
        }
        aff.displayOrder = idx;
      }
      if (m.category === cat.id && !m.subgroup) {
        m.displayOrder = idx;
      }
    });
  } else if (type === "group-member") {
    const group = state.currentGroup;
    const cat = getCurrentCategory();
    list.forEach((m, idx) => {
      if (Array.isArray(m.affiliations)) {
        let aff = m.affiliations.find(a => a.category === cat.id && a.subgroup === group.id);
        if (!aff) {
          aff = { category: cat.id, subgroup: group.id };
          m.affiliations.push(aff);
        }
        aff.displayOrder = idx;
      }
      if (m.category === cat.id && m.subgroup === group.id) {
        m.displayOrder = idx;
      }
    });
  } else if (type === "video") {
    list.forEach((v, idx) => { v.displayOrder = idx; });
  }

  const reason = `${reasonPrefix} ${getName(moved)} (${fromIdx + 1}번 → ${toIdx + 1}번)`;
  persistData();
  renderContent();

  // 토스트 피드백 즉시 표시 (지연 0ms) 및 드래그 상태 즉각 해제
  showToast(`✓ 순서가 변경되어 저장되었습니다.<br><span class="text-[11px] text-amber-300">${reason}</span>`);
  setTimeout(() => {
    isDraggingCard = false;
    hasActuallyDragged = false;
    cardDragSource = null;
    dragStartX = null;
    dragStartY = null;
  }, 50);

  // 무거운 백엔드 DB 일괄 동기화 및 백업 스냅샷 저장은 백그라운드에서 비차단(Non-blocking)으로 안전하게 처리
  scheduleCardReorderSync(type, reason);
}

let orderSyncTimer = null;
let pendingOrderSyncList = [];

function scheduleCardReorderSync(type, reason) {
  pendingOrderSyncList.push({ type, reason });
  if (orderSyncTimer) {
    clearTimeout(orderSyncTimer);
  }
  // 디바운스 300ms: 연속 드래그 시 불필요한 중복 전체 동기화 및 백업 스냅샷 생성을 방지하고 최종 상태를 안전하게 반영
  orderSyncTimer = setTimeout(async () => {
    await flushPendingCardReorderSync();
  }, 300);
}

async function flushPendingCardReorderSync() {
  if (pendingOrderSyncList.length === 0) return;
  const items = [...pendingOrderSyncList];
  pendingOrderSyncList = [];
  if (orderSyncTimer) {
    clearTimeout(orderSyncTimer);
    orderSyncTimer = null;
  }

  const hasGroup = items.some(i => i.type === "group");
  const isLovelineOnly = items.every(i => i.type === "loveline");
  const lastReason = items[items.length - 1].reason;
  const summaryReason = items.length > 1 
    ? `${lastReason} (외 ${items.length - 1}건)` 
    : lastReason;

  const syncPromises = [];
  if (hasGroup && typeof saveCategoryStructureToDb === "function") {
    syncPromises.push(saveCategoryStructureToDb(KONGBAB_DATA.categories));
  }
  if (!isLovelineOnly && typeof syncAllStreamersToDb === "function") {
    const allStreamers = typeof extractAllStreamersFromKongbabData === "function" ? extractAllStreamersFromKongbabData() : null;
    if (allStreamers && allStreamers.length >= 140) {
      syncPromises.push(syncAllStreamersToDb(allStreamers));
    } else {
      console.warn(`[동기화 차단] 인원 누락 감지 (현재 ${allStreamers ? allStreamers.length : 0}명 < 146명). DB 데이터 보호를 위해 일괄 동기화를 건너뜁니다.`);
    }
  }
  if (typeof createBackupSnapshot === "function") {
    createBackupSnapshot(summaryReason, false);
  }

  try {
    await Promise.all(syncPromises);
  } catch (err) {
    console.error("순서 변경 백그라운드 동기화 오류:", err);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (pendingOrderSyncList.length > 0) {
      flushPendingCardReorderSync();
    }
  });
}

window.isDraggingCard = () => isDraggingCard;
try {
  Object.defineProperty(window, 'hasActuallyDragged', {
    get() { return hasActuallyDragged; },
    set(v) { hasActuallyDragged = !!v; },
    configurable: true
  });
} catch (e) {
  window.hasActuallyDragged = () => hasActuallyDragged;
}

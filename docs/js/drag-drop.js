let cardDragSource = null;
let isDraggingCard = false;

function handleCardDragStart(e, type, id) {
  if (typeof isAdmin === "function" && !isAdmin()) {
    e.preventDefault();
    return false;
  }
  isDraggingCard = true;
  cardDragSource = { type, id };
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
  }
  const card = e.currentTarget;
  if (card) setTimeout(() => card.classList.add("card-drag-source"), 0);
}

function handleCardDragOver(e) {
  if (typeof isAdmin === "function" && !isAdmin()) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
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
  clearCardDragOverStyles();
  const card = e.currentTarget;
  if (card) card.classList.remove("card-drag-source");
  setTimeout(() => {
    isDraggingCard = false;
    cardDragSource = null;
  }, 100);
}

function clearCardDragOverStyles() {
  document.querySelectorAll(".card-drag-over").forEach(el => el.classList.remove("card-drag-over"));
  document.querySelectorAll(".card-drag-source").forEach(el => el.classList.remove("card-drag-source"));
}

async function handleCardDrop(e, type, targetId) {
  e.preventDefault();
  e.stopPropagation();
  clearCardDragOverStyles();

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
  }

  if (!list) return;
  const fromIdx = list.findIndex(item => item.id === sourceId);
  const toIdx = list.findIndex(item => item.id === targetId);
  if (fromIdx === -1 || toIdx === -1) return;

  const [moved] = list.splice(fromIdx, 1);
  list.splice(toIdx, 0, moved);

  // 변경된 순서에 맞게 displayOrder 즉시 재부여
  if (type === "direct-member" || type === "group-member") {
    list.forEach((m, idx) => { m.displayOrder = idx; });
  } else if (type === "video") {
    list.forEach((v, idx) => { v.displayOrder = idx; });
  }

  const reason = `${reasonPrefix} ${getName(moved)} (${fromIdx + 1}번 → ${toIdx + 1}번)`;
  persistData();
  renderContent();

  const syncPromises = [];
  if (type === "group" && typeof saveCategoryStructureToDb === "function") {
    syncPromises.push(saveCategoryStructureToDb(KONGBAB_DATA.categories));
  }
  if (typeof syncAllStreamersToDb === "function") {
    syncPromises.push(syncAllStreamersToDb(extractAllStreamersFromKongbabData()));
  }
  createBackupSnapshot(reason, false);

  try {
    await Promise.all(syncPromises);
  } catch (err) {
    console.error("순서 변경 동기화 오류:", err);
  }

  showToast(`✓ 순서가 변경되어 저장되었습니다.<br><span class="text-[11px] text-amber-300">${reason}</span>`);
}

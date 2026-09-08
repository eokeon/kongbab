/**
 * 콩밥특별시 GTA RP 아카이브 - 카드 드래그 앤 드롭 순서 변경 엔진 (drag-drop.js)
 * 
 * - 인원 카드, 영상 카드, 조직 카드 잡고 드래그 순서 변경 (Drag & Drop Reordering)
 * - 순서 변경 시 즉시 로컬 저장 및 외부 20개 롤링 JSON 백업 동기화
 */

// ==========================================
// 카드 드래그 앤 드롭 순서 변경 & JSON 저장 (Drag & Drop Reordering)
// ==========================================
let cardDragSource = null;
let isDraggingCard = false;

function handleCardDragStart(e, type, id) {
  isDraggingCard = true;
  cardDragSource = { type, id };
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ type, id }));
  }
  const card = e.currentTarget;
  if (card) {
    setTimeout(() => {
      card.classList.add("card-drag-source");
    }, 0);
  }
}

function handleCardDragOver(e) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }
  const card = e.currentTarget;
  if (card && !card.classList.contains("card-drag-over")) {
    card.classList.add("card-drag-over");
  }
}

function handleCardDragLeave(e) {
  const card = e.currentTarget;
  if (card) {
    card.classList.remove("card-drag-over");
  }
}

function handleCardDragEnd(e) {
  clearCardDragOverStyles();
  const card = e.currentTarget;
  if (card) {
    card.classList.remove("card-drag-source");
  }
  setTimeout(() => {
    isDraggingCard = false;
    cardDragSource = null;
  }, 100);
}

function clearCardDragOverStyles() {
  document.querySelectorAll(".card-drag-over").forEach(el => {
    el.classList.remove("card-drag-over");
  });
  document.querySelectorAll(".card-drag-source").forEach(el => {
    el.classList.remove("card-drag-source");
  });
}

function handleCardDrop(e, type, targetId) {
  e.preventDefault();
  e.stopPropagation();
  clearCardDragOverStyles();

  if (!cardDragSource || cardDragSource.type !== type) {
    return;
  }

  const sourceId = cardDragSource.id;
  if (sourceId === targetId) return;

  let movedName = "";
  let reason = "";

  if (type === "direct-member") {
    const cat = getCurrentCategory();
    if (!cat || !cat.members) return;
    const fromIdx = cat.members.findIndex(m => m.id === sourceId);
    const toIdx = cat.members.findIndex(m => m.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = cat.members.splice(fromIdx, 1);
    cat.members.splice(toIdx, 0, moved);
    movedName = `${moved.name} (${moved.streamer})`;
    reason = `인원 순서 변경: [${cat.name}] ${movedName} (${fromIdx + 1}번 → ${toIdx + 1}번)`;
  } else if (type === "group-member") {
    const group = state.currentGroup;
    if (!group || !group.members) return;
    const fromIdx = group.members.findIndex(m => m.id === sourceId);
    const toIdx = group.members.findIndex(m => m.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = group.members.splice(fromIdx, 1);
    group.members.splice(toIdx, 0, moved);
    movedName = `${moved.name} (${moved.streamer})`;
    reason = `인원 순서 변경: [${group.name}] ${movedName} (${fromIdx + 1}번 → ${toIdx + 1}번)`;
  } else if (type === "group") {
    const cat = getCurrentCategory();
    if (!cat || !cat.groups) return;
    const fromIdx = cat.groups.findIndex(g => g.id === sourceId);
    const toIdx = cat.groups.findIndex(g => g.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = cat.groups.splice(fromIdx, 1);
    cat.groups.splice(toIdx, 0, moved);
    movedName = moved.name;
    reason = `조직 순서 변경: [${cat.name}] ${movedName} (${fromIdx + 1}번 → ${toIdx + 1}번)`;
  } else if (type === "video") {
    const member = state.currentMember;
    if (!member || !member.videos) return;
    const fromIdx = member.videos.findIndex(v => v.id === sourceId);
    const toIdx = member.videos.findIndex(v => v.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = member.videos.splice(fromIdx, 1);
    member.videos.splice(toIdx, 0, moved);
    movedName = moved.title;
    reason = `영상 순서 변경: [${member.name}] "${movedName}" (${fromIdx + 1}번 → ${toIdx + 1}번)`;
  }

  // 1. 로컬스토리지 및 현재 세션에 즉시 영구 저장
  persistData();
  // 2. 20개 롤링 백업 스냅샷 생성 & 외부 D:\백업 파일\KONGBAB_BACKUPS_JSON 자동 동기화
  createBackupSnapshot(reason, false);
  // 3. 사용자 알림 토스트
  showToast(`✓ 순서가 변경되어 JSON에 저장되었습니다.<br><span class="text-[11px] text-amber-300">${reason}</span>`);
  // 4. 화면 즉시 재렌더링
  renderContent();
}

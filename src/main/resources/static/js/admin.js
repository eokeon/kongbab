function openLoginModal() {
  const modal = document.getElementById("login-modal");
  const err = document.getElementById("login-error");
  if (err) err.classList.add("hidden");
  const userInput = document.getElementById("login-username");
  const passInput = document.getElementById("login-password");
  if (userInput) userInput.value = "";
  if (passInput) passInput.value = "";

  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
    if (userInput) setTimeout(() => userInput.focus(), 50);
  }
}

function closeLoginModal() {
  const modal = document.getElementById("login-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
}

async function handleAdminLogin(e) {
  if (e) e.preventDefault();
  const username = document.getElementById("login-username")?.value.trim() || "";
  const password = document.getElementById("login-password")?.value || "";
  const err = document.getElementById("login-error");

  if (!username || !password) {
    if (err) {
      err.textContent = "아이디와 비밀번호를 모두 입력해주세요.";
      err.classList.remove("hidden");
    }
    return;
  }

  const res = await apiLogin(username, password);
  if (res && res.success) {
    const expireDuration = (res.expiresInSeconds || 3600) * 1000;
    const expireAt = Date.now() + expireDuration;

    state.currentUser = { role: res.role || "admin", username: res.username || "admin" };
    localStorage.setItem("kongbab_auth_user", JSON.stringify(state.currentUser));
    localStorage.setItem("kongbab_auth_expire_at", String(expireAt));

    closeLoginModal();
    renderHeaderAuth();
    renderContent();
    showToast("🛡️ 어드민 로그인 완료 (1시간 동안 로그인 유지)");
  } else if (err) {
    err.textContent = res?.message || "아이디 또는 비밀번호가 일치하지 않습니다.";
    err.classList.remove("hidden");
  }
}

async function handleGuestLogin() {
  state.currentUser = { role: "guest", username: "게스트" };
  localStorage.setItem("kongbab_auth_user", JSON.stringify(state.currentUser));
  localStorage.removeItem("kongbab_auth_expire_at");
  await apiLogout();
  closeLoginModal();
  renderHeaderAuth();
  renderContent();
  showToast("👤 게스트 모드로 계속합니다.");
}

async function logoutUser() {
  await apiLogout();
  state.currentUser = { role: "guest", username: "게스트" };
  localStorage.setItem("kongbab_auth_user", JSON.stringify(state.currentUser));
  localStorage.removeItem("kongbab_auth_expire_at");
  renderHeaderAuth();
  renderContent();
  showToast("로그아웃되었습니다.");
}

// ==========================================
// 관리자 기능 모듈화 안내 (Modularized Admin Modules)
// 각 세부 관리 기능은 독립된 모듈 파일로 분리 관리됩니다:
// - 영상 등록/수정/삭제/정렬: js/admin-video.js
// - 인원 등록/수정/삭제/소속: js/admin-member.js
// - 유튜브 재생목록 일괄 등록: js/admin-playlist.js
// ==========================================

// ==========================================
// 어드민 설정 모달 및 유튜브 구독자 일괄 갱신
// ==========================================

let isSyncingSubscribers = false;

function openAdminSettingsModal() {
  if (!isAdmin()) {
    alert("어드민 전용 기능입니다.");
    return;
  }

  const modal = document.getElementById("admin-settings-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.style.overflow = "hidden";

  // 등록된 유튜브 링크(youtubeUrl)가 있는 대상 인원수 계산
  const allMembers = typeof extractAllStreamersFromKongbabData === "function" 
    ? extractAllStreamersFromKongbabData() 
    : [];
  const targetCount = allMembers.filter(m => m.youtubeUrl && m.youtubeUrl.trim()).length;

  const targetCountEl = document.getElementById("admin-sub-target-count");
  if (targetCountEl) {
    targetCountEl.textContent = `${targetCount}명`;
  }

  if (!isSyncingSubscribers) {
    const progressBar = document.getElementById("admin-sub-progress-bar");
    const progressText = document.getElementById("admin-sub-progress-text");
    const logBox = document.getElementById("admin-sub-log-box");
    const btn = document.getElementById("admin-sub-sync-btn");

    if (progressBar) progressBar.style.width = "0%";
    if (progressText) progressText.textContent = `대기 중 (대상: ${targetCount}명)`;
    if (logBox) {
      logBox.innerHTML = `<div class="text-zinc-500 text-xs italic">갱신 준비 완료. 아래 [구독자 수 일괄 갱신 시작] 버튼을 눌러주세요.</div>`;
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        <span>유튜브 구독자 수 일괄 갱신 시작</span>
      `;
    }
  }
}

function closeAdminSettingsModal() {
  if (isSyncingSubscribers) {
    if (!confirm("현재 유튜브 구독자 갱신이 진행 중입니다. 정말 닫으시겠습니까?")) {
      return;
    }
  }

  const modal = document.getElementById("admin-settings-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
}

async function startSubscriberSync() {
  if (isSyncingSubscribers) return;

  const btn = document.getElementById("admin-sub-sync-btn");
  const progressBar = document.getElementById("admin-sub-progress-bar");
  const progressText = document.getElementById("admin-sub-progress-text");
  const logBox = document.getElementById("admin-sub-log-box");

  isSyncingSubscribers = true;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>구독자 수 조회 및 갱신 중...</span>
    `;
  }
  if (logBox) logBox.innerHTML = "";

  try {
    const updatedCount = await executeSubscriberSync((current, total, streamerName, status) => {
      const pct = Math.round((current / total) * 100);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressText) progressText.textContent = `${pct}% (${current}/${total}명)`;

      if (logBox) {
        const line = document.createElement("div");
        line.className = "text-xs py-0.5 font-mono flex items-center justify-between gap-2";
        const isSuccess = status.startsWith("성공");
        line.innerHTML = `
          <div class="truncate">
            <span class="text-zinc-500">[${current}/${total}]</span>
            <span class="text-zinc-200 font-medium ml-1">${streamerName}</span>
          </div>
          <span class="flex-shrink-0 ${isSuccess ? 'text-emerald-400 font-bold' : 'text-zinc-400'}">${status}</span>
        `;
        logBox.appendChild(line);
        logBox.scrollTop = logBox.scrollHeight;
      }
    });

    if (logBox) {
      const finishLine = document.createElement("div");
      finishLine.className = "text-xs py-2 font-bold text-emerald-400 border-t border-zinc-800 mt-2";
      finishLine.textContent = `🎉 일괄 갱신 완료! 총 ${updatedCount}명의 구독자 수가 백업 및 DB에 저장되었습니다.`;
      logBox.appendChild(finishLine);
      logBox.scrollTop = logBox.scrollHeight;
    }

    showToast(`🎉 유튜브 구독자 수 일괄 갱신 완료 (${updatedCount}명)`);
    if (typeof renderContent === "function") renderContent();
  } catch (err) {
    console.error("구독자 갱신 오류:", err);
    if (logBox) {
      const errLine = document.createElement("div");
      errLine.className = "text-xs py-2 font-bold text-red-400 border-t border-zinc-800 mt-2";
      errLine.textContent = `❌ 오류 발생: ${err.message || err}`;
      logBox.appendChild(errLine);
    }
    showToast("⚠️ 구독자 갱신 중 오류가 발생했습니다.");
  } finally {
    isSyncingSubscribers = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-4 h-4 text-emerald-400 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <span>구독자 수 일괄 재갱신</span>
      `;
    }
  }
}

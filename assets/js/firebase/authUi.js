export function createAuthUI({
  auth,
  runtime,
  formatError,
  setText,
  signUp,
  signIn,
  logOutAndReset,
  requestLoginSync,
  consumeAuthFlag,
  sendPasswordResetEmail,
  onAuthStateChanged,
  resetSyncTracking,
}) {
  const initAuthUI = () => {
    const authStateEl = document.getElementById("auth-state");
    const offcanvasUsername = document.getElementById("offcanvasUsername");
    const userBadge = document.getElementById("userBadge");
    const authTrigger = document.getElementById("authTrigger");
    const logoutBtn = document.getElementById("logoutBtn");
    const authModal = document.getElementById("authModal");
    const authModalOverlay = document.getElementById("authModalOverlay");
    const authModalClose = document.getElementById("authModalClose");
    const authModalTitle = document.getElementById("authModalTitle");
    const tabLogin = document.getElementById("tab-login");
    const tabSignup = document.getElementById("tab-signup");
    const panelLogin = document.getElementById("panel-login");
    const panelSignup = document.getElementById("panel-signup");
    const logoutModal = document.getElementById("logoutModal");
    const logoutConfirm = document.getElementById("logoutConfirm");
    const logoutCancel = document.getElementById("logoutCancel");
    const logoutClose = document.getElementById("logoutClose");
    const resetModal = document.getElementById("resetModal");
    const resetClose = document.getElementById("resetClose");
    const resetSend = document.getElementById("resetSend");
    const resetEmail = document.getElementById("reset-email");
    const resetModalStatus = document.getElementById("reset-modal-status");
    const signupForm = document.getElementById("signup-form");
    const loginForm = document.getElementById("login-form");
    const signupError = document.getElementById("signup-error");
    const loginError = document.getElementById("login-error");
    const resetMessage = document.getElementById("reset-message");
    const resetPasswordBtn = document.getElementById("reset-password");
    const signupUsername = document.getElementById("signup-username");
    const signupEmail = document.getElementById("signup-email");
    const signupPassword = document.getElementById("signup-password");
    const loginEmail = document.getElementById("login-email");
    const loginPassword = document.getElementById("login-password");
    const devMoneyCard = document.getElementById("moneyCheatCard");

    let authResolved = false;
    let lastKnownDisplayName = null;

    const blurActiveElement = () => {
      const active = document.activeElement;
      if (active && typeof active.blur === "function") active.blur();
    };

    const setAuthStatus = (text, pending = false) => {
      setText(authStateEl, text);
      if (authStateEl) authStateEl.classList.toggle("opacity-70", pending);
    };

    const toggleModal = (open) => {
      if (!authModal) return;
      authModal.classList[open ? "remove" : "add"]("hidden");
      document.body.classList.toggle("overflow-hidden", open);
      if (!open) blurActiveElement();
    };

    const closeModal = () => toggleModal(false);
    const toggleLogoutModal = (open) => {
      if (!logoutModal) return;
      logoutModal.classList[open ? "remove" : "add"]("hidden");
      document.body.classList.toggle("overflow-hidden", open);
      if (!open) blurActiveElement();
    };
    const closeLogoutModal = () => toggleLogoutModal(false);
    const toggleResetModal = (open) => {
      if (!resetModal) return;
      resetModal.classList[open ? "remove" : "add"]("hidden");
      document.body.classList.toggle("overflow-hidden", open);
      if (!open) blurActiveElement();
    };
    const closeResetModal = () => toggleResetModal(false);

    const switchTab = (target) => {
      if (!tabLogin || !tabSignup || !panelLogin || !panelSignup) return;
      const loginActive = target === "login";
      if (authModalTitle) authModalTitle.textContent = "Log In";
      tabLogin.setAttribute("aria-selected", loginActive ? "true" : "false");
      tabSignup.setAttribute("aria-selected", loginActive ? "false" : "true");
      tabLogin.tabIndex = loginActive ? 0 : -1;
      tabSignup.tabIndex = loginActive ? -1 : 0;
      panelLogin.setAttribute("aria-hidden", loginActive ? "false" : "true");
      panelSignup.setAttribute("aria-hidden", loginActive ? "true" : "false");
      panelLogin.tabIndex = loginActive ? 0 : -1;
      panelSignup.tabIndex = loginActive ? -1 : 0;
      panelLogin.classList.toggle("hidden", !loginActive);
      panelSignup.classList.toggle("hidden", loginActive);
      tabLogin.classList.toggle("bg-neutral-800", loginActive);
      tabLogin.classList.toggle("text-white", loginActive);
      tabLogin.classList.toggle("border-neutral-700", loginActive);
      tabLogin.classList.toggle("shadow", loginActive);
      tabLogin.classList.toggle("bg-transparent", !loginActive);
      tabLogin.classList.toggle("text-neutral-400", !loginActive);
      tabLogin.classList.toggle("border-neutral-800", !loginActive);

      tabSignup.classList.toggle("bg-neutral-800", !loginActive);
      tabSignup.classList.toggle("text-white", !loginActive);
      tabSignup.classList.toggle("border-neutral-700", !loginActive);
      tabSignup.classList.toggle("shadow", !loginActive);
      tabSignup.classList.toggle("bg-transparent", loginActive);
      tabSignup.classList.toggle("text-neutral-400", loginActive);
      tabSignup.classList.toggle("border-neutral-800", loginActive);
    };

    setText(authStateEl, "Guest");
    setAuthStatus("Logging in...", true);

    onAuthStateChanged(auth, (user) => {
      console.log("[auth] state changed", user ? user.uid : "guest");
      const shouldAutoOpenAuth = !user && !runtime.isLoggingOut && consumeAuthFlag();
      const uid = user ? user.uid : null;
      const shouldReload = runtime.initialAuthHandled && uid !== runtime.lastAuthUid;
      if (user) {
        const name =
          user.displayName?.trim() ||
          lastKnownDisplayName ||
          user.email ||
          "User";
        const isAdmin = name?.trim().toLowerCase() === "admin";
        if (authStateEl) setAuthStatus(name, false);
        if (offcanvasUsername) offcanvasUsername.textContent = name;
        lastKnownDisplayName = name;
        if (authTrigger) authTrigger.classList.add("hidden");
        if (logoutBtn) logoutBtn.classList.remove("hidden");
        if (devMoneyCard) devMoneyCard.classList.toggle("hidden", !isAdmin);
        runtime.sessionConflictHandled = false;
        if (runtime.gameContext && !runtime.loginSyncPromise && runtime.lastSyncedUserId !== user.uid) {
          requestLoginSync();
        }
      } else {
        if (authStateEl) setAuthStatus("Guest", false);
        if (offcanvasUsername) offcanvasUsername.textContent = "Guest";
        if (authTrigger) authTrigger.classList.remove("hidden");
        if (logoutBtn) logoutBtn.classList.add("hidden");
        if (devMoneyCard) devMoneyCard.classList.add("hidden");
        resetSyncTracking();
        if (shouldAutoOpenAuth) {
          toggleModal(true);
          switchTab("login");
        }
      }
      runtime.lastAuthUid = uid;
      if (!runtime.initialAuthHandled) runtime.initialAuthHandled = true;
      if (shouldReload) {
        setTimeout(() => window.location.reload(), 120);
        return;
      }
      authResolved = true;
    });

    if (authTrigger) {
      authTrigger.addEventListener("click", () => {
        console.log("[ui] open auth modal");
        toggleModal(true);
        switchTab("login");
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        toggleLogoutModal(true);
      });
    }

    authModalOverlay?.addEventListener("click", () => {
      console.log("[ui] close auth modal overlay");
      closeModal();
    });
    authModalClose?.addEventListener("click", () => {
      console.log("[ui] close auth modal button");
      closeModal();
    });

    tabLogin?.addEventListener("click", () => switchTab("login"));
    tabSignup?.addEventListener("click", () => switchTab("signup"));

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal();
        closeLogoutModal();
        closeResetModal();
      }
    });

    if (userBadge) {
      userBadge.addEventListener("click", async () => {
        const user = auth.currentUser;
        console.log("[ui] userBadge click", user ? "authed" : "guest");
        if (!user) {
          toggleModal(true);
          return;
        }
        toggleLogoutModal(true);
      });
    }

    if (signupForm) {
      signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setText(signupError, "");
        const email = signupEmail?.value.trim() || "";
        const password = signupPassword?.value || "";
        const username = signupUsername?.value.trim() || "";
        try {
          await signUp(email, password, username);
          if (auth.currentUser && username) auth.currentUser.displayName = username;
          if (username) lastKnownDisplayName = username;
          setAuthStatus(username || email, true);
          signupForm.reset();
          await requestLoginSync(true);
          closeModal();
        } catch (error) {
          setText(signupError, formatError(error));
          console.error("[auth] signup failed", error);
        }
      });
    }

    if (loginForm) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setText(loginError, "");
        setText(resetMessage, "");
        const email = loginEmail?.value.trim() || "";
        const password = loginPassword?.value || "";
        try {
          await signIn(email, password);
          loginForm.reset();
          await requestLoginSync(true);
          closeModal();
        } catch (error) {
          setText(loginError, formatError(error));
          console.error("[auth] login failed", error);
        }
      });
    }

    if (resetPasswordBtn) {
      resetPasswordBtn.addEventListener("click", () => {
        setText(resetMessage, "");
        if (resetEmail && loginEmail?.value) resetEmail.value = loginEmail.value;
        setText(resetModalStatus, "");
        toggleResetModal(true);
      });
    }

    resetClose?.addEventListener("click", closeResetModal);

    if (resetSend) {
      resetSend.addEventListener("click", async () => {
        const targetEmail = resetEmail?.value.trim();
        setText(resetModalStatus, "");
        if (!targetEmail) {
          setText(resetModalStatus, "Please enter your email.");
          return;
        }
        try {
          await sendPasswordResetEmail(auth, targetEmail);
          setText(
            resetModalStatus,
            "If the account exists, a reset email has been sent. Check spam if needed."
          );
        } catch (error) {
          setText(resetModalStatus, formatError(error));
          console.error("[auth] reset failed", error);
        }
      });
    }

    logoutConfirm?.addEventListener("click", async () => {
      closeLogoutModal();
      await logOutAndReset();
    });
    logoutCancel?.addEventListener("click", closeLogoutModal);
    logoutClose?.addEventListener("click", closeLogoutModal);
  };

  return {
    initAuthUI,
  };
}

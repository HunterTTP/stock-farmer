import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import {
  buildSaveData,
  applyLoadedData,
  recalcPlacedCounts,
} from "./state/state.js";

const firebaseConfig = {
  apiKey: "AIzaSyAMKAFtLXJyvGsZSI6ToK3AxsTVftsuKvg",
  authDomain: "stock-farmer.firebaseapp.com",
  projectId: "stock-farmer",
  storageBucket: "stock-farmer.firebasestorage.app",
  messagingSenderId: "35338327974",
  appId: "1:35338327974:web:4d7abba95a360684972167",
  measurementId: "G-MN00H2SG93",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CLOUD_SAVE_DEBOUNCE_MS = 400;

let gameContext = null;
let queuedCloudState = null;
let cloudSaveTimerId = null;
let cloudSaveInFlight = false;
let loginSyncPromise = null;
let loginSyncQueued = false;
let lastSyncedUserId = null;
let sessionUnsub = null;
let sessionPromptOpen = false;
let hasSessionOwnership = false;
let lastActiveSessionId = null;
let isLoggingOut = false;
let shouldAutoClaimOnNextSnapshot = false;
const SESSION_STORAGE_KEY = "stock-farmer-session-id";
let lastAuthUid = null;
let initialAuthHandled = false;

const sessionId = (() => {
  try {
    const existing = localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "sess-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch (error) {
    console.error("Session id persistence failed", error);
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "sess-" + Math.random().toString(36).slice(2, 10);
  }
})();
const AUTH_MODAL_FLAG = "stockFarmer.authModalOpen";

const errorMessages = {
  "auth/invalid-email": "Please enter a valid email.",
  "auth/email-already-in-use": "That email is already registered.",
  "auth/weak-password": "Password must be stronger.",
  "auth/user-not-found": "Account not found. Please create an account first.",
  "auth/wrong-password": "Incorrect password. Please try again.",
};

const formatError = (error) =>
  errorMessages[error?.code] ||
  error?.message ||
  "Something went wrong, please try again.";

const setText = (el, value) => {
  if (el) el.textContent = value;
};

const signUp = async (email, password, username) => {
  console.log("[auth] signUp start", email);
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );
  if (username) {
    await updateProfile(auth.currentUser, { displayName: username });
  }
  console.log("[auth] signUp success", credential.user?.uid);
  return credential;
};

const signIn = (email, password) => {
  console.log("[auth] signIn start", email);
  return signInWithEmailAndPassword(auth, email, password);
};

const logOut = () => {
  console.log("[auth] logOut start");
  return signOut(auth);
};

const registerGameContext = (context) => {
  gameContext = context;
  console.log("[sync] registerGameContext");
  if (auth.currentUser) requestLoginSync();
};

let remoteFnsPromise = null;
const getRemoteFns = () => {
  if (!remoteFnsPromise) remoteFnsPromise = import("./firebase-store.js");
  return remoteFnsPromise;
};

const normalizeTimestamp = (value) => (Number.isFinite(value) ? value : 0);

const stripViewFields = (data) => {
  if (!data || typeof data !== "object") return data;
  const clone = { ...data };
  delete clone.scale;
  delete clone.offsetX;
  delete clone.offsetY;
  delete clone.savedScaleFromState;
  delete clone.savedOffsetX;
  delete clone.savedOffsetY;
  return clone;
};

const injectCurrentViewForLocal = (data) => {
  if (!data || !gameContext?.state) return data;
  const view = {
    scale:
      data.scale ??
      gameContext.state.savedScaleFromState ??
      gameContext.state.scale,
    offsetX:
      data.offsetX ??
      gameContext.state.savedOffsetX ??
      gameContext.state.offsetX,
    offsetY:
      data.offsetY ??
      gameContext.state.savedOffsetY ??
      gameContext.state.offsetY,
    savedScaleFromState:
      data.savedScaleFromState ??
      gameContext.state.savedScaleFromState ??
      gameContext.state.scale,
    savedOffsetX:
      data.savedOffsetX ??
      gameContext.state.savedOffsetX ??
      gameContext.state.offsetX,
    savedOffsetY:
      data.savedOffsetY ??
      gameContext.state.savedOffsetY ??
      gameContext.state.offsetY,
  };
  return { ...data, ...view };
};

const persistLocalSnapshot = (data) => {
  if (!gameContext?.config?.saveKey || !data) return;
  try {
    const withView = injectCurrentViewForLocal(data);
    localStorage.setItem(gameContext.config.saveKey, JSON.stringify(withView));
  } catch (error) {
    console.error("Local overwrite failed", error);
  }
};

const applyStateFromSource = (data, overrideUpdatedAt = null) => {
  if (!gameContext || !data) return;
  const resolvedUpdatedAt =
    normalizeTimestamp(overrideUpdatedAt ?? data.updatedAt) || Date.now();
  const payload = {
    ...injectCurrentViewForLocal(data),
    updatedAt: resolvedUpdatedAt,
  };
  applyLoadedData(payload, gameContext);
  try {
    recalcPlacedCounts(gameContext.world, gameContext.crops);
  } catch (error) {
    console.error("Recalc after load failed", error);
  }
  persistLocalSnapshot(payload);
  if (gameContext.refreshUI) gameContext.refreshUI();
};

const runCloudSave = async () => {
  if (cloudSaveInFlight) return;
  if (cloudSaveTimerId) {
    clearTimeout(cloudSaveTimerId);
    cloudSaveTimerId = null;
  }
  if (!auth.currentUser || !queuedCloudState || !hasSessionOwnership) return;
  cloudSaveInFlight = true;
  try {
    const { saveRemoteState } = await getRemoteFns();
    while (auth.currentUser && queuedCloudState) {
      const payload = stripViewFields(queuedCloudState);
      queuedCloudState = null;
      await saveRemoteState(payload);
    }
  } catch (error) {
    console.error("Queued remote save failed", error);
  } finally {
    cloudSaveInFlight = false;
    if (auth.currentUser && queuedCloudState) runCloudSave();
  }
};

const queueCloudSave = (stateData, immediate = false) => {
  if (!auth.currentUser || !stateData) return;
  queuedCloudState = stripViewFields(stateData);
  if (immediate) {
    runCloudSave();
    return;
  }
  if (cloudSaveTimerId) clearTimeout(cloudSaveTimerId);
  if (cloudSaveInFlight) return;
  cloudSaveTimerId = setTimeout(runCloudSave, CLOUD_SAVE_DEBOUNCE_MS);
};

const flushCloudSaveQueue = async () => {
  if (cloudSaveTimerId) {
    clearTimeout(cloudSaveTimerId);
    cloudSaveTimerId = null;
  }
  await runCloudSave();
};

const resetSyncTracking = () => {
  queuedCloudState = null;
  if (cloudSaveTimerId) {
    clearTimeout(cloudSaveTimerId);
    cloudSaveTimerId = null;
  }
  cloudSaveInFlight = false;
  loginSyncPromise = null;
  loginSyncQueued = false;
  lastSyncedUserId = null;
  sessionPromptOpen = false;
  hasSessionOwnership = false;
  lastActiveSessionId = null;
  shouldAutoClaimOnNextSnapshot = false;
};

const getLocalUpdatedAt = () =>
  normalizeTimestamp(gameContext?.state?.lastSavedAt);

const summarizeState = (data) => {
  const target =
    data?.state && typeof data.state === "object" ? data.state : data;
  if (!target || typeof target !== "object")
    return { filled: 0, plots: 0, sample: null, updatedAt: null };
  const plots = Array.isArray(target.plots) ? target.plots : [];
  const sample = plots.length ? plots[0]?.[0] || null : null;
  const updatedAt = normalizeTimestamp(
    Number.isFinite(data?.remoteUpdatedAt)
      ? data.remoteUpdatedAt
      : target.updatedAt
  );
  return {
    filled: Array.isArray(target.filled) ? target.filled.length : 0,
    plots: plots.length,
    sample,
    updatedAt: updatedAt || null,
  };
};

const syncOnLogin = async () => {
  if (!gameContext) return;
  const localUpdatedAt = getLocalUpdatedAt();
  const user = auth.currentUser;
  if (!user) return;
  try {
    console.log("[sync] syncOnLogin start", {
      uid: user ? user.uid : "guest",
      localUpdatedAt,
    });
    const { loadRemoteState, saveRemoteState } = await getRemoteFns();
    const remote = await loadRemoteState();
    const remoteState = remote?.state || null;
    if (remoteState) {
      const summary = summarizeState(remote);
      console.log("[sync] applying remote state", {
        ...summary,
        localUpdatedAt,
      });
      const preparedRemote = {
        ...stripViewFields(remoteState),
        updatedAt:
          remote.remoteUpdatedAt ?? remoteState.updatedAt ?? Date.now(),
      };
      applyStateFromSource(preparedRemote, preparedRemote.updatedAt);
    } else {
      const localData = buildSaveData(gameContext);
      const summary = summarizeState(localData);
      console.log("[sync] no remote state; pushing local", summary);
      persistLocalSnapshot(localData);
      await saveRemoteState(stripViewFields(localData));
    }
    await claimSession(user);
    hasSessionOwnership = true;
    sessionPromptOpen = false;
    shouldAutoClaimOnNextSnapshot = false;
    runCloudSave();
    console.log("[sync] syncOnLogin complete");
  } catch (error) {
    console.error("Sync on login failed", error);
  }
};

const requestLoginSync = (force = false) => {
  const user = auth.currentUser;
  if (!user || !gameContext) return null;
  if (
    !force &&
    lastSyncedUserId === user.uid &&
    !loginSyncQueued &&
    !loginSyncPromise
  ) {
    return loginSyncPromise;
  }
  if (loginSyncPromise) {
    loginSyncQueued = true;
    return loginSyncPromise;
  }
  loginSyncPromise = syncOnLogin().finally(() => {
    lastSyncedUserId = user.uid;
    const shouldRunAgain = loginSyncQueued;
    loginSyncQueued = false;
    loginSyncPromise = null;
    if (shouldRunAgain) requestLoginSync(force);
  });
  return loginSyncPromise;
};

const cleanupSessionWatch = () => {
  if (sessionUnsub) sessionUnsub();
  sessionUnsub = null;
  sessionPromptOpen = false;
  lastActiveSessionId = null;
};

const claimSession = async (user) => {
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  await setDoc(
    ref,
    {
      activeSessionId: sessionId,
      activeSessionAt: serverTimestamp(),
      activeSessionClient: navigator.userAgent || "unknown",
    },
    { merge: true }
  );
};

const handleForeignSession = (user) => {
  if (sessionPromptOpen) return;
  sessionPromptOpen = true;
  hasSessionOwnership = false;
  const message = "You're playing on another device. Take over here? This will sign out other sessions.";
  const takeover = async () => {
    await claimSession(user);
    hasSessionOwnership = true;
    sessionPromptOpen = false;
    if (gameContext) {
      const localData = buildSaveData(gameContext);
      persistLocalSnapshot(localData);
      queueCloudSave(localData, true);
    }
  };
  const abandon = async () => {
    sessionPromptOpen = false;
    await logOutAndReset();
  };
  if (gameContext?.openConfirmModal) {
    gameContext.openConfirmModal(message, takeover, "Another Device", abandon, {
      hideClose: true,
    });
  } else if (window.confirm(message)) {
    takeover();
  } else {
    abandon();
  }
};

const handleSessionMoved = () => {
  if (sessionPromptOpen) return;
  sessionPromptOpen = true;
  hasSessionOwnership = false;
  const message = "You've logged in from a different device.";
  const confirm = async () => {
    sessionPromptOpen = false;
    await logOutAndReset({ showAuthOnReload: true });
  };
  if (gameContext?.openConfirmModal) {
    gameContext.openConfirmModal(message, confirm, "Session Moved", null, {
      showCancel: false,
      confirmText: "OK",
      confirmVariant: "blue",
      hideClose: true,
    });
  } else if (window.confirm(message)) {
    confirm();
  } else {
    confirm();
  }
};

const ensureSessionWatch = (user) => {
  cleanupSessionWatch();
  hasSessionOwnership = false;
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  sessionUnsub = onSnapshot(ref, async (snap) => {
    const data = snap.data() || {};
    const activeId = data.activeSessionId || null;
    const prevActiveId = lastActiveSessionId;
    lastActiveSessionId = activeId;

    if (!activeId) {
      await claimSession(user);
      hasSessionOwnership = true;
      sessionPromptOpen = false;
      shouldAutoClaimOnNextSnapshot = false;
      runCloudSave();
      return;
    }

    if (activeId === sessionId) {
      hasSessionOwnership = true;
      sessionPromptOpen = false;
      shouldAutoClaimOnNextSnapshot = false;
      runCloudSave();
      return;
    }

    hasSessionOwnership = false;

    if (prevActiveId === sessionId) {
      handleSessionMoved();
      shouldAutoClaimOnNextSnapshot = false;
      return;
    }

    if (shouldAutoClaimOnNextSnapshot) {
      shouldAutoClaimOnNextSnapshot = false;
      await claimSession(user);
      hasSessionOwnership = true;
      sessionPromptOpen = false;
      if (gameContext) {
        const localData = buildSaveData(gameContext);
        persistLocalSnapshot(localData);
        queueCloudSave(localData, true);
      }
      return;
    }

    handleForeignSession(user);
  });
};

const deleteDatabase = (name) =>
  new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch (error) {
      console.error("Delete database failed", error);
      resolve();
    }
  });

const clearClientCaches = async () => {
  try {
    if (typeof caches !== "undefined" && typeof caches.keys === "function") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.error("Cache clear failed", error);
  }
  try {
    if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
      const dbs = (await indexedDB.databases()) || [];
      await Promise.all(
        dbs.map((db) => (db && db.name ? deleteDatabase(db.name) : Promise.resolve()))
      );
    }
  } catch (error) {
    console.error("IndexedDB clear failed", error);
  }
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch (error) {
    console.error("Service worker unregister failed", error);
  }
};

const clearWebStorage = (clearAll = false) => {
  try {
    if (clearAll) {
      localStorage.clear();
      sessionStorage.clear();
    } else {
      if (gameContext?.config?.saveKey)
        localStorage.removeItem(gameContext.config.saveKey);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_MODAL_FLAG);
    }
  } catch (error) {
    console.error("Local clear failed", error);
  }
};

const logOutAndReset = async (options = {}) => {
  const { clearCaches = false, showAuthOnReload = false } = options || {};
  console.log("[sync] logOutAndReset start", clearCaches ? "(clear caches)" : "");
  isLoggingOut = true;
  try {
    if (auth.currentUser && gameContext) {
      const localData = buildSaveData(gameContext);
      persistLocalSnapshot(localData);
      console.log("[sync] final remote save", summarizeState(localData));
      queueCloudSave(localData, true);
      await flushCloudSaveQueue();
    }
  } catch (error) {
    console.error("Final remote save failed", error);
  }

  clearWebStorage(clearCaches);

  if (showAuthOnReload) {
    try {
      sessionStorage.setItem(AUTH_MODAL_FLAG, "1");
    } catch (error) {
      console.error("Failed to mark auth modal flag", error);
    }
  }

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign out failed", error);
  }

  cleanupSessionWatch();
  resetSyncTracking();

  if (clearCaches) {
    await clearClientCaches();
  }

  window.location.reload();
};

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
  let authResolved = false;
  let lastKnownDisplayName = null;

  const blurActiveElement = () => {
    const active = document.activeElement;
    if (active && typeof active.blur === "function") active.blur();
  };

  const consumeAuthFlag = () => {
    try {
      const shouldOpen = sessionStorage.getItem(AUTH_MODAL_FLAG) === "1";
      if (shouldOpen) sessionStorage.removeItem(AUTH_MODAL_FLAG);
      return shouldOpen;
    } catch (error) {
      console.error("Auth modal flag read failed", error);
      return false;
    }
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
    const shouldAutoOpenAuth = !user && !isLoggingOut && consumeAuthFlag();
    const uid = user ? user.uid : null;
    const shouldReload = initialAuthHandled && uid !== lastAuthUid;
    if (user) {
      const name =
        user.displayName?.trim() ||
        lastKnownDisplayName ||
        user.email ||
        "User";
      if (authStateEl) setAuthStatus(name, false);
      if (offcanvasUsername) offcanvasUsername.textContent = name;
      lastKnownDisplayName = name;
      if (authTrigger) authTrigger.classList.add("hidden");
      if (logoutBtn) logoutBtn.classList.remove("hidden");
      shouldAutoClaimOnNextSnapshot = true;
      ensureSessionWatch(user);
      if (gameContext && !loginSyncPromise && lastSyncedUserId !== user.uid)
        requestLoginSync();
    } else {
      if (authStateEl) setAuthStatus("Guest", false);
      if (offcanvasUsername) offcanvasUsername.textContent = "Guest";
      if (authTrigger) authTrigger.classList.remove("hidden");
      if (logoutBtn) logoutBtn.classList.add("hidden");
      cleanupSessionWatch();
      resetSyncTracking();
      if (shouldAutoOpenAuth) {
        toggleModal(true);
        switchTab("login");
      }
    }
    lastAuthUid = uid;
    if (!initialAuthHandled) initialAuthHandled = true;
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

  if (authModalOverlay) {
    authModalOverlay.addEventListener("click", () => {
      console.log("[ui] close auth modal overlay");
      closeModal();
    });
  }

  if (authModalClose) {
    authModalClose.addEventListener("click", () => {
      console.log("[ui] close auth modal button");
      closeModal();
    });
  }

  if (tabLogin) {
    tabLogin.addEventListener("click", () => switchTab("login"));
  }

  if (tabSignup) {
    tabSignup.addEventListener("click", () => switchTab("signup"));
  }

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
        if (auth.currentUser && username)
          auth.currentUser.displayName = username;
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

  if (resetClose) resetClose.addEventListener("click", closeResetModal);

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

  if (logoutConfirm) {
    logoutConfirm.addEventListener("click", async () => {
      closeLogoutModal();
      await logOutAndReset();
    });
  }

  if (logoutCancel) {
    logoutCancel.addEventListener("click", closeLogoutModal);
  }

  if (logoutClose) {
    logoutClose.addEventListener("click", closeLogoutModal);
  }
};

initAuthUI();

export {
  auth,
  initAuthUI,
  signUp,
  signIn,
  logOut,
  registerGameContext,
  logOutAndReset,
  queueCloudSave,
};

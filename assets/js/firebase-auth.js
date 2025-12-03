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
import { buildSaveData, applyLoadedData, recalcPlacedCounts } from "./state/state.js";

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

const CLOUD_SAVE_DEBOUNCE_MS = 400;

let gameContext = null;
let queuedCloudState = null;
let cloudSaveTimerId = null;
let cloudSaveInFlight = false;
let loginSyncPromise = null;
let loginSyncQueued = false;
let lastSyncedUserId = null;

const errorMessages = {
  "auth/invalid-email": "Please enter a valid email.",
  "auth/email-already-in-use": "That email is already registered.",
  "auth/weak-password": "Password must be stronger.",
  "auth/user-not-found": "Account not found. Please sign up first.",
  "auth/wrong-password": "Incorrect password. Please try again.",
};

const formatError = (error) => errorMessages[error?.code] || error?.message || "Something went wrong, please try again.";

const setText = (el, value) => {
  if (el) el.textContent = value;
};

const signUp = async (email, password, username) => {
  console.log("[auth] signUp start", email);
  const credential = await createUserWithEmailAndPassword(auth, email, password);
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

const persistLocalSnapshot = (data) => {
  if (!gameContext?.config?.saveKey || !data) return;
  try {
    localStorage.setItem(gameContext.config.saveKey, JSON.stringify(data));
  } catch (error) {
    console.error("Local overwrite failed", error);
  }
};

const applyStateFromSource = (data, overrideUpdatedAt = null) => {
  if (!gameContext || !data) return;
  const resolvedUpdatedAt = normalizeTimestamp(overrideUpdatedAt ?? data.updatedAt) || Date.now();
  const payload = { ...data, updatedAt: resolvedUpdatedAt };
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
  if (!auth.currentUser || !queuedCloudState) return;
  cloudSaveInFlight = true;
  try {
    const { saveRemoteState, loadRemoteState } = await getRemoteFns();
    while (auth.currentUser && queuedCloudState) {
      const payload = queuedCloudState;
      queuedCloudState = null;
      const localBaseline = normalizeTimestamp(payload?.previousUpdatedAt ?? payload?.updatedAt);
      let remote = null;
      try {
        remote = await loadRemoteState();
      } catch (error) {
        console.error("Remote fetch during save failed", error);
      }
      const remoteState = remote?.state || null;
      const remoteUpdatedAt = normalizeTimestamp(
        remote?.remoteUpdatedAt ?? remoteState?.updatedAt
      );
      if (remoteState && remoteUpdatedAt > localBaseline) {
        console.log("[cloud] remote newer than local, applying remote instead of saving", {
          remoteUpdatedAt,
          localBaseline,
        });
        applyStateFromSource({ ...remoteState, updatedAt: remoteUpdatedAt }, remoteUpdatedAt);
        continue;
      }
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
  queuedCloudState = stateData;
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
};

const getLocalUpdatedAt = () => normalizeTimestamp(gameContext?.state?.lastSavedAt);

const summarizeState = (data) => {
  const target = data?.state && typeof data.state === "object" ? data.state : data;
  if (!target || typeof target !== "object") return { filled: 0, plots: 0, sample: null, updatedAt: null };
  const plots = Array.isArray(target.plots) ? target.plots : [];
  const sample = plots.length ? plots[0]?.[0] || null : null;
  const updatedAt = normalizeTimestamp(
    Number.isFinite(data?.remoteUpdatedAt) ? data.remoteUpdatedAt : target.updatedAt
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
  try {
    const user = auth.currentUser;
    console.log("[sync] syncOnLogin start", { uid: user ? user.uid : "guest", localUpdatedAt });
    const { loadRemoteState, saveRemoteState } = await getRemoteFns();
    const remote = await loadRemoteState();
    const remoteState = remote?.state || null;
    const remoteUpdatedAt = normalizeTimestamp(
      remote?.remoteUpdatedAt ?? (remoteState ? remoteState.updatedAt : null)
    );
    if (remoteState && remoteUpdatedAt >= localUpdatedAt) {
      const summary = summarizeState(remote);
      console.log("[sync] applying remote state", { ...summary, localUpdatedAt });
      const preparedRemote = { ...remoteState, updatedAt: remoteUpdatedAt || remoteState.updatedAt || Date.now() };
      applyStateFromSource(preparedRemote, preparedRemote.updatedAt);
    } else {
      const localData = buildSaveData(gameContext);
      const summary = summarizeState(localData);
      console.log("[sync] pushing local to cloud", { ...summary, remoteUpdatedAt });
      persistLocalSnapshot(localData);
      await saveRemoteState(localData);
    }
    console.log("[sync] syncOnLogin complete");
  } catch (error) {
    console.error("Sync on login failed", error);
  }
};

const requestLoginSync = (force = false) => {
  const user = auth.currentUser;
  if (!user || !gameContext) return null;
  if (!force && lastSyncedUserId === user.uid && !loginSyncQueued && !loginSyncPromise) {
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

const logOutAndReset = async () => {
  console.log("[sync] logOutAndReset start");
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

  try {
    if (gameContext?.config?.saveKey) localStorage.removeItem(gameContext.config.saveKey);
  } catch (error) {
    console.error("Local clear failed", error);
  }

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign out failed", error);
  }

  resetSyncTracking();
  window.location.reload();
};

const initAuthUI = () => {
  const authStateEl = document.getElementById("auth-state");
  const userBadge = document.getElementById("userBadge");
  const authTrigger = document.getElementById("authTrigger");
  const authModal = document.getElementById("authModal");
  const authModalOverlay = document.getElementById("authModalOverlay");
  const authModalClose = document.getElementById("authModalClose");
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

  const setAuthStatus = (text, pending = false) => {
    setText(authStateEl, text);
    if (authStateEl) authStateEl.classList.toggle("opacity-70", pending);
  };

  const toggleModal = (open) => {
    if (!authModal) return;
    authModal.classList[open ? "remove" : "add"]("hidden");
    document.body.classList.toggle("overflow-hidden", open);
  };

  const closeModal = () => toggleModal(false);
  const toggleLogoutModal = (open) => {
    if (!logoutModal) return;
    logoutModal.classList[open ? "remove" : "add"]("hidden");
    document.body.classList.toggle("overflow-hidden", open);
  };
  const closeLogoutModal = () => toggleLogoutModal(false);
  const toggleResetModal = (open) => {
    if (!resetModal) return;
    resetModal.classList[open ? "remove" : "add"]("hidden");
    document.body.classList.toggle("overflow-hidden", open);
  };
  const closeResetModal = () => toggleResetModal(false);

  const switchTab = (target) => {
    if (!tabLogin || !tabSignup || !panelLogin || !panelSignup) return;
    const loginActive = target === "login";
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
    if (user) {
      const name = user.displayName?.trim() || lastKnownDisplayName || user.email || "User";
      if (authStateEl) setAuthStatus(name, false);
      lastKnownDisplayName = name;
      if (authTrigger) authTrigger.classList.add("hidden");
      if (gameContext && !loginSyncPromise && lastSyncedUserId !== user.uid) requestLoginSync();
    } else {
      if (authStateEl) setAuthStatus("Guest", false);
      if (authTrigger) authTrigger.classList.remove("hidden");
      resetSyncTracking();
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
        setText(resetModalStatus, "If the account exists, a reset email has been sent. Check spam if needed.");
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

export { auth, initAuthUI, signUp, signIn, logOut, registerGameContext, logOutAndReset, queueCloudSave };

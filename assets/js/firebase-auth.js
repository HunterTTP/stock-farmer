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
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  if (username) {
    await updateProfile(auth.currentUser, { displayName: username });
  }
  return credential;
};

const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);

const logOut = () => signOut(auth);

let gameContext = null;

const registerGameContext = (context) => {
  gameContext = context;
};

let remoteFnsPromise = null;
const getRemoteFns = () => {
  if (!remoteFnsPromise) remoteFnsPromise = import("./firebase-store.js");
  return remoteFnsPromise;
};

const syncOnLogin = async () => {
  if (!gameContext) return;
  try {
    const { loadRemoteState, saveRemoteState } = await getRemoteFns();
    const remote = await loadRemoteState();
    if (remote) {
      applyLoadedData(remote, gameContext);
      try {
        recalcPlacedCounts(gameContext.world, gameContext.crops);
      } catch (error) {
        console.error("Recalc after remote load failed", error);
      }
      try {
        localStorage.setItem(gameContext.config.saveKey, JSON.stringify(remote));
      } catch (error) {
        console.error("Local overwrite failed", error);
      }
      if (gameContext.refreshUI) gameContext.refreshUI();
    } else {
      const localData = buildSaveData(gameContext);
      await saveRemoteState(localData);
    }
  } catch (error) {
    console.error("Sync on login failed", error);
  }
};

const logOutAndReset = async () => {
  try {
    if (auth.currentUser && gameContext) {
      const localData = buildSaveData(gameContext);
      const { saveRemoteState } = await getRemoteFns();
      await saveRemoteState(localData);
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

  window.location.reload();
};

const initAuthUI = () => {
  const authStateEl = document.getElementById("auth-state");
  const userBadge = document.getElementById("userBadge");
  const authTrigger = document.getElementById("authTrigger");
  const authModal = document.getElementById("authModal");
  const authModalOverlay = document.getElementById("authModalOverlay");
  const authModalClose = document.getElementById("authModalClose");
  const logoutModal = document.getElementById("logoutModal");
  const logoutConfirm = document.getElementById("logoutConfirm");
  const logoutCancel = document.getElementById("logoutCancel");
  const logoutClose = document.getElementById("logoutClose");
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

  setText(authStateEl, "Guest");

  onAuthStateChanged(auth, (user) => {
    if (!authStateEl) return;
    if (user) {
      const name = user.displayName?.trim() || user.email || "User";
      setText(authStateEl, name);
      if (authTrigger) authTrigger.classList.add("hidden");
    } else {
      setText(authStateEl, "Guest");
      if (authTrigger) authTrigger.classList.remove("hidden");
    }
  });

  if (authTrigger) {
    authTrigger.addEventListener("click", () => toggleModal(true));
  }

  if (authModalOverlay) {
    authModalOverlay.addEventListener("click", closeModal);
  }

  if (authModalClose) {
    authModalClose.addEventListener("click", closeModal);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      closeLogoutModal();
    }
  });

  if (userBadge) {
    userBadge.addEventListener("click", async () => {
      const user = auth.currentUser;
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
        signupForm.reset();
        await syncOnLogin();
        closeModal();
      } catch (error) {
        setText(signupError, formatError(error));
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
        await syncOnLogin();
        closeModal();
      } catch (error) {
        setText(loginError, formatError(error));
      }
    });
  }

  if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener("click", async () => {
      setText(loginError, "");
      setText(resetMessage, "");
      const email = loginEmail?.value.trim();
      const targetEmail = email || window.prompt("Enter your account email to reset password");
      if (!targetEmail) return;
      try {
        await sendPasswordResetEmail(auth, targetEmail);
        setText(resetMessage, "Reset email sent.");
      } catch (error) {
        setText(loginError, formatError(error));
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

export { auth, initAuthUI, signUp, signIn, logOut, registerGameContext, logOutAndReset };

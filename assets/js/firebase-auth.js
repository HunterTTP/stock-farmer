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
import { buildSaveData } from "./state/state.js";
import { createAuthHelpers, buildLocalSaveSnapshot } from "./firebase/authHelpers.js";
import { createCloudSaveManager } from "./firebase/cloudSaveManager.js";
import { createLoginSyncManager } from "./firebase/loginSyncManager.js";
import { createResetManager } from "./firebase/resetManager.js";
import { createAuthUI } from "./firebase/authUi.js";

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

const runtime = {
  gameContext: null,
  queuedCloudState: null,
  cloudSaveTimerId: null,
  cloudSaveInFlight: false,
  loginSyncPromise: null,
  loginSyncQueued: false,
  lastSyncedUserId: null,
  isLoggingOut: false,
  sessionConflictHandled: false,
  saveFailurePromptOpen: false,
  consecutiveSaveFailures: 0,
  lastAuthUid: null,
  initialAuthHandled: false,
};

let remoteFnsPromise = null;
const getRemoteFns = () => {
  if (!remoteFnsPromise) remoteFnsPromise = import("./firebase-store.js");
  return remoteFnsPromise;
};

const helpers = createAuthHelpers({ auth, runtime });

const cloudSave = createCloudSaveManager({
  auth,
  runtime,
  getRemoteFns,
  getCurrentUsername: helpers.getCurrentUsername,
  stripViewFields: helpers.stripViewFields,
  sessionId: helpers.sessionId,
});

const loginSync = createLoginSyncManager({
  auth,
  runtime,
  buildSaveData,
  getRemoteFns,
  applyStateFromSource: helpers.applyStateFromSource,
  persistLocalSnapshot: helpers.persistLocalSnapshot,
  stripViewFields: helpers.stripViewFields,
  normalizeTimestamp: helpers.normalizeTimestamp,
  getCurrentUsername: helpers.getCurrentUsername,
  sessionId: helpers.sessionId,
  handleSessionConflict: cloudSave.handleSessionConflict,
});

const resetManager = createResetManager({
  auth,
  runtime,
  buildLocalSaveSnapshot,
  persistLocalSnapshot: helpers.persistLocalSnapshot,
  queueCloudSave: cloudSave.queueCloudSave,
  flushCloudSaveQueue: cloudSave.flushCloudSaveQueue,
  resetSyncTracking: cloudSave.resetSyncTracking,
});

cloudSave.setOnSaveFailureLogout(() =>
  resetManager.logOutAndReset({ showAuthOnReload: true, skipRemoteSave: true })
);

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

const authUi = createAuthUI({
  auth,
  runtime,
  formatError: helpers.formatError,
  setText: helpers.setText,
  signUp,
  signIn,
  logOutAndReset: resetManager.logOutAndReset,
  requestLoginSync: (force) => loginSync.requestLoginSync(force),
  consumeAuthFlag: helpers.consumeAuthFlag,
  sendPasswordResetEmail,
  onAuthStateChanged,
  resetSyncTracking: cloudSave.resetSyncTracking,
});

const registerGameContext = (context) => {
  runtime.gameContext = context;
  console.log("[sync] registerGameContext");
  if (auth.currentUser) loginSync.requestLoginSync();
};

const initAuthUI = authUi.initAuthUI;
const logOutAndReset = resetManager.logOutAndReset;
const queueCloudSave = cloudSave.queueCloudSave;

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

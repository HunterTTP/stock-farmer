import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { auth } from "./firebase-auth.js";

const db = getFirestore();

const normalizeForRemote = (stateObject) => {
  if (!stateObject || typeof stateObject !== "object") return stateObject;
  const clone = { ...stateObject };
  delete clone.scale;
  delete clone.offsetX;
  delete clone.offsetY;
  delete clone.savedScaleFromState;
  delete clone.savedOffsetX;
  delete clone.savedOffsetY;
  if (Array.isArray(clone.plots)) {
    clone.plots = clone.plots.map(([key, value]) => ({
      key,
      data: value,
    }));
  }
  return clone;
};

const denormalizeFromRemote = (stateObject) => {
  if (!stateObject || typeof stateObject !== "object") return stateObject;
  const clone = { ...stateObject };
  if (Array.isArray(clone.plots) && clone.plots.length && clone.plots[0] && !Array.isArray(clone.plots[0])) {
    clone.plots = clone.plots.map((entry) => [entry.key, entry.data]);
  }
  return clone;
};

const getUserDocRef = (userId) => doc(db, "users", userId);

const extractRemoteUpdatedAt = (data, state) => {
  if (typeof data?.updatedAt?.toMillis === "function") return data.updatedAt.toMillis();
  if (Number.isFinite(state?.updatedAt)) return state.updatedAt;
  if (Number.isFinite(data?.state?.updatedAt)) return data.state.updatedAt;
  return null;
};

const summarizeState = (state) => ({
  filled: Array.isArray(state?.filled) ? state.filled.length : 0,
  plots: Array.isArray(state?.plots) ? state.plots.length : 0,
  sample: Array.isArray(state?.plots) && state.plots.length ? state.plots[0]?.[0] : null,
  updatedAt: state?.updatedAt,
});

export const loadRemoteState = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    console.log("[cloud] loadRemoteState start", user.uid);
    const ref = getUserDocRef(user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    const state = denormalizeFromRemote(data.state || null);
    const remoteUpdatedAt = extractRemoteUpdatedAt(data, state);
    console.log("[cloud] loadRemoteState success", !!data?.state, summarizeState(state));
    return {
      state: state || null,
      remoteUpdatedAt,
      activeSessionId: data.activeSessionId || null,
      username: typeof data.username === "string" ? data.username : null,
    };
  } catch (error) {
    console.error("Remote load failed", error);
    return null;
  }
};

export const saveRemoteState = async (stateObject, { sessionId, username, force = false } = {}) => {
  const user = auth.currentUser;
  if (!user || !stateObject) return { ok: false, reason: "unauthenticated" };
  try {
    const ref = getUserDocRef(user.uid);
    const snap = await getDoc(ref);
    const existing = snap.exists() ? snap.data() : null;
    const currentActiveId = existing?.activeSessionId || null;

    if (!force && currentActiveId && sessionId && currentActiveId !== sessionId) {
      console.warn("[cloud] saveRemoteState blocked by active session mismatch", {
        currentActiveId,
        sessionId,
      });
      return { ok: false, reason: "session_conflict", activeSessionId: currentActiveId };
    }

    const normalized = normalizeForRemote(stateObject);
    const resolvedUsername =
      (typeof username === "string" && username.trim()) ||
      (typeof user.displayName === "string" && user.displayName.trim()) ||
      user.email ||
      "Player";

    const payload = {
      username: resolvedUsername,
      state: normalized,
      updatedAt: serverTimestamp(),
      activeSessionId: sessionId || currentActiveId || null,
      activeSessionAt: serverTimestamp(),
      lastSavedBySessionId: sessionId || currentActiveId || null,
    };

    console.log("[cloud] saveRemoteState start", user.uid, summarizeState(stateObject));
    await setDoc(ref, payload, { merge: true });
    console.log("[cloud] saveRemoteState success", user.uid);
    return { ok: true, activeSessionId: payload.activeSessionId };
  } catch (error) {
    console.error("Remote save failed", error);
    return { ok: false, reason: "error", error };
  }
};

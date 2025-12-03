import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { auth } from "./firebase-auth.js";

const db = getFirestore();

const normalizeForRemote = (stateObject) => {
  if (!stateObject || typeof stateObject !== "object") return stateObject;
  const clone = { ...stateObject };
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

export const loadRemoteState = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    console.log("[cloud] loadRemoteState start", user.uid);
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    const state = denormalizeFromRemote(data?.state);
    const remoteUpdatedAt =
      typeof data?.updatedAt?.toMillis === "function"
        ? data.updatedAt.toMillis()
        : Number.isFinite(data?.state?.updatedAt)
        ? data.state.updatedAt
        : null;
    const summary = {
      filled: Array.isArray(state?.filled) ? state.filled.length : 0,
      plots: Array.isArray(state?.plots) ? state.plots.length : 0,
      sample: Array.isArray(state?.plots) && state.plots.length ? state.plots[0]?.[0] : null,
      updatedAt: remoteUpdatedAt,
    };
    console.log("[cloud] loadRemoteState success", !!data?.state, summary);
    return { state: state || null, remoteUpdatedAt };
  } catch (error) {
    console.error("Remote load failed", error);
    return null;
  }
};

export const saveRemoteState = async (stateObject) => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const summary = {
      filled: Array.isArray(stateObject?.filled) ? stateObject.filled.length : 0,
      plots: Array.isArray(stateObject?.plots) ? stateObject.plots.length : 0,
      sample: Array.isArray(stateObject?.plots) && stateObject.plots.length ? stateObject.plots[0]?.[0] : null,
      updatedAt: stateObject?.updatedAt,
    };
    console.log("[cloud] saveRemoteState start", user.uid, summary);
    const ref = doc(db, "users", user.uid);
    const normalized = normalizeForRemote(stateObject);
    await setDoc(ref, { state: normalized, updatedAt: serverTimestamp() }, { merge: true });
    console.log("[cloud] saveRemoteState success", user.uid);
  } catch (error) {
    console.error("Remote save failed", error);
  }
};

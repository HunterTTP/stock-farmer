import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { auth } from "./firebase-auth.js";

const db = getFirestore();

export const loadRemoteState = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    console.log("[cloud] loadRemoteState start", user.uid);
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    const summary = {
      filled: Array.isArray(data?.state?.filled) ? data.state.filled.length : 0,
      plots: Array.isArray(data?.state?.plots) ? data.state.plots.length : 0,
    };
    console.log("[cloud] loadRemoteState success", !!data?.state, summary);
    return data?.state || null;
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
    };
    console.log("[cloud] saveRemoteState start", user.uid, summary);
    const ref = doc(db, "users", user.uid);
    await setDoc(ref, { state: stateObject, updatedAt: serverTimestamp() }, { merge: true });
    console.log("[cloud] saveRemoteState success", user.uid);
  } catch (error) {
    console.error("Remote save failed", error);
  }
};

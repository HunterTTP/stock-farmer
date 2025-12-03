import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { auth } from "./firebase-auth.js";

const db = getFirestore();

export const loadRemoteState = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
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
    const ref = doc(db, "users", user.uid);
    await setDoc(ref, { state: stateObject, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Remote save failed", error);
  }
};

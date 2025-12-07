import { buildSaveData, applyLoadedData, recalcPlacedCounts } from "../state/state.js";
import { setAccentColor, DEFAULT_ACCENT } from "../ui/theme.js";

export const SESSION_STORAGE_KEY = "stock-farmer-session-id";
export const AUTH_MODAL_FLAG = "stockFarmer.authModalOpen";

export function createAuthHelpers({ auth, runtime }) {
  const errorMessages = {
    "auth/invalid-email": "Please enter a valid email.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password": "Password must be stronger.",
    "auth/user-not-found": "Account not found. Please create an account first.",
    "auth/wrong-password": "Incorrect password. Please try again.",
  };

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

  const formatError = (error) =>
    errorMessages[error?.code] ||
    error?.message ||
    "Something went wrong, please try again.";

  const getCurrentUsername = (user = auth.currentUser) => {
    if (!user) return "Guest";
    if (typeof user.displayName === "string" && user.displayName.trim()) return user.displayName.trim();
    if (typeof user.email === "string" && user.email.trim()) return user.email.trim();
    return "Player";
  };

  const setText = (el, value) => {
    if (el) el.textContent = value;
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
    if (!data || !runtime?.gameContext?.state) return data;
    const view = {
      scale:
        data.scale ??
        runtime.gameContext.state.savedScaleFromState ??
        runtime.gameContext.state.scale,
      offsetX:
        data.offsetX ??
        runtime.gameContext.state.savedOffsetX ??
        runtime.gameContext.state.offsetX,
      offsetY:
        data.offsetY ??
        runtime.gameContext.state.savedOffsetY ??
        runtime.gameContext.state.offsetY,
      savedScaleFromState:
        data.savedScaleFromState ??
        runtime.gameContext.state.savedScaleFromState ??
        runtime.gameContext.state.scale,
      savedOffsetX:
        data.savedOffsetX ??
        runtime.gameContext.state.savedOffsetX ??
        runtime.gameContext.state.offsetX,
      savedOffsetY:
        data.savedOffsetY ??
        runtime.gameContext.state.savedOffsetY ??
        runtime.gameContext.state.offsetY,
    };
    return { ...data, ...view };
  };

  const persistLocalSnapshot = (data) => {
    if (!runtime?.gameContext?.config?.saveKey || !data) return;
    try {
      const withView = injectCurrentViewForLocal(data);
      localStorage.setItem(runtime.gameContext.config.saveKey, JSON.stringify(withView));
    } catch (error) {
      console.error("Local overwrite failed", error);
    }
  };

  const applyStateFromSource = (data, overrideUpdatedAt = null) => {
    if (!runtime?.gameContext || !data) return;
    const resolvedUpdatedAt =
      normalizeTimestamp(overrideUpdatedAt ?? data.updatedAt) || Date.now();
    const payload = {
      ...injectCurrentViewForLocal(data),
      updatedAt: resolvedUpdatedAt,
    };
    applyLoadedData(payload, runtime.gameContext);
    try {
      const accent = runtime.gameContext.state?.accentColor || DEFAULT_ACCENT;
      setAccentColor(accent);
    } catch (error) {
      console.error("Failed to apply accent after load", error);
    }
    try {
      recalcPlacedCounts(runtime.gameContext.world, runtime.gameContext.crops, runtime.gameContext.state);
    } catch (error) {
      console.error("Recalc after load failed", error);
    }
    persistLocalSnapshot(payload);
    if (runtime.gameContext.refreshUI) runtime.gameContext.refreshUI();
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

  return {
    sessionId,
    formatError,
    getCurrentUsername,
    setText,
    normalizeTimestamp,
    stripViewFields,
    injectCurrentViewForLocal,
    persistLocalSnapshot,
    applyStateFromSource,
    consumeAuthFlag,
  };
}

export function buildLocalSaveSnapshot(runtime) {
  if (!runtime?.gameContext) return null;
  return buildSaveData(runtime.gameContext);
}

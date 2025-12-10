import { AUTH_MODAL_FLAG, SESSION_STORAGE_KEY } from "./authHelpers.js";

export function createResetManager({
  auth,
  runtime,
  buildLocalSaveSnapshot,
  persistLocalSnapshot,
  queueCloudSave,
  flushCloudSaveQueue,
  resetSyncTracking,
}) {
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
        if (runtime?.gameContext?.config?.saveKey)
          localStorage.removeItem(runtime.gameContext.config.saveKey);
        localStorage.removeItem(SESSION_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_MODAL_FLAG);
      }
    } catch (error) {
      console.error("Local clear failed", error);
    }
  };

  const logOutAndReset = async (options = {}) => {
    const { clearCaches = false, showAuthOnReload = false, skipRemoteSave = false } = options || {};
    console.log("[sync] logOutAndReset start", clearCaches ? "(clear caches)" : "");
    runtime.isLoggingOut = true;
    try {
      if (!skipRemoteSave && auth.currentUser && runtime.gameContext) {
        const localData = buildLocalSaveSnapshot(runtime);
        persistLocalSnapshot(localData);
        console.log("[sync] final remote save", localData);
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
      await auth.signOut();
    } catch (error) {
      console.error("Sign out failed", error);
    }

    resetSyncTracking();

    if (clearCaches) {
      await clearClientCaches();
    }

    if (clearCaches) {
      const url = new URL(window.location.href);
      url.searchParams.set("cachebust", Date.now().toString());
      window.location.replace(url.toString());
      return;
    }

    window.location.reload();
  };

  return {
    logOutAndReset,
    clearClientCaches,
  };
}

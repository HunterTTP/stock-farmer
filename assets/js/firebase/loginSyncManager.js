export function createLoginSyncManager({
  auth,
  runtime,
  buildSaveData,
  getRemoteFns,
  applyStateFromSource,
  persistLocalSnapshot,
  stripViewFields,
  normalizeTimestamp,
  getCurrentUsername,
  sessionId,
  handleSessionConflict,
}) {
  const getLocalUpdatedAt = () =>
    normalizeTimestamp(runtime?.gameContext?.state?.lastSavedAt);

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
    if (!runtime?.gameContext) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      const localUpdatedAt = getLocalUpdatedAt();
      const localData = buildSaveData(runtime.gameContext);
      console.log("[sync] syncOnLogin start", { uid: user.uid, localUpdatedAt });

      const { loadRemoteState, saveRemoteState } = await getRemoteFns();
      const remote = await loadRemoteState();
      const remoteState = remote?.state || null;

      if (remoteState) {
        console.log("[sync] applying remote state", {
          ...summarizeState(remote),
          localUpdatedAt,
        });
        const preparedRemote = {
          ...stripViewFields(remoteState),
          updatedAt: remote.remoteUpdatedAt ?? remoteState.updatedAt ?? Date.now(),
        };
        applyStateFromSource(preparedRemote, preparedRemote.updatedAt);
      } else {
        console.log("[sync] no remote state; keeping local", summarizeState(localData));
        persistLocalSnapshot(localData);
      }

      const freshState = stripViewFields(buildSaveData(runtime.gameContext));
      const claimResult = await saveRemoteState(freshState, {
        sessionId,
        username: getCurrentUsername(user),
        force: true,
      });

      if (!claimResult?.ok && claimResult?.reason === "session_conflict") {
        await handleSessionConflict();
        return;
      }

      console.log("[sync] syncOnLogin complete");
    } catch (error) {
      console.error("Sync on login failed", error);
    }
  };

  const requestLoginSync = (force = false) => {
    const user = auth.currentUser;
    if (!user || !runtime?.gameContext) return null;
    if (
      !force &&
      runtime.lastSyncedUserId === user.uid &&
      !runtime.loginSyncQueued &&
      !runtime.loginSyncPromise
    ) {
      return runtime.loginSyncPromise;
    }
    if (runtime.loginSyncPromise) {
      runtime.loginSyncQueued = true;
      return runtime.loginSyncPromise;
    }
    runtime.loginSyncPromise = syncOnLogin().finally(() => {
      runtime.lastSyncedUserId = user.uid;
      const shouldRunAgain = runtime.loginSyncQueued;
      runtime.loginSyncQueued = false;
      runtime.loginSyncPromise = null;
      if (shouldRunAgain) requestLoginSync(force);
    });
    return runtime.loginSyncPromise;
  };

  return {
    requestLoginSync,
    getLocalUpdatedAt,
  };
}

const CLOUD_SAVE_DEBOUNCE_MS = 400;
const SAVE_RETRY_BASE_MS = 600;
const SAVE_RETRY_MAX_MS = 8000;
const SAVE_RETRY_LIMIT = 3;
const SESSION_CONFLICT_MESSAGE = "You've logged in from another device.";

export function createCloudSaveManager({ auth, runtime, getRemoteFns, getCurrentUsername, stripViewFields, sessionId }) {
  let onSaveFailureLogout = null;

  const scheduleCloudSave = (delayMs) => {
    if (runtime.cloudSaveTimerId) clearTimeout(runtime.cloudSaveTimerId);
    runtime.cloudSaveTimerId = setTimeout(runCloudSave, delayMs);
  };

  const formatDevInfo = (data) => {
    if (!data) return "";
    if (typeof data === "string") return data;
    try {
      return JSON.stringify(data, Object.keys(data).slice(0, 10));
    } catch (error) {
      return String(data);
    }
  };

  const showSaveFailureAndLogout = async (message, devDetails = null) => {
    if (runtime.saveFailurePromptOpen) return;
    runtime.saveFailurePromptOpen = true;
    const logout = async () => {
      if (typeof onSaveFailureLogout === "function") {
        await onSaveFailureLogout();
      }
    };
    const devInfo = formatDevInfo(devDetails);
    const details =
      (message || "We could not save your game to the cloud. Please log in again.") +
      (devInfo ? `\n\nDev info: ${devInfo}` : "");
    if (runtime.gameContext?.openConfirmModal) {
      runtime.gameContext.openConfirmModal(
        details,
        logout,
        "Save Failed",
        null,
        { showCancel: false, confirmText: "OK", confirmVariant: "blue", hideClose: true }
      );
      return;
    }
    window.alert(details);
    await logout();
  };

  const clearCloudSaveQueue = () => {
    runtime.queuedCloudState = null;
    if (runtime.cloudSaveTimerId) {
      clearTimeout(runtime.cloudSaveTimerId);
      runtime.cloudSaveTimerId = null;
    }
  };

  const handleSessionConflict = async () => {
    if (runtime.sessionConflictHandled) return;
    runtime.sessionConflictHandled = true;
    clearCloudSaveQueue();
    runtime.cloudSaveInFlight = false;

    const doLogout = async () => {
      if (typeof onSaveFailureLogout === "function") {
        await onSaveFailureLogout();
      }
    };

    if (runtime.gameContext?.openConfirmModal) {
      runtime.gameContext.openConfirmModal(
        SESSION_CONFLICT_MESSAGE,
        doLogout,
        "Session Ended",
        null,
        { showCancel: false, confirmText: "OK", confirmVariant: "blue", hideClose: true }
      );
      return;
    }

    window.alert(SESSION_CONFLICT_MESSAGE);
    await doLogout();
  };

  const runCloudSave = async () => {
    if (runtime.cloudSaveInFlight) return;
    if (runtime.cloudSaveTimerId) {
      clearTimeout(runtime.cloudSaveTimerId);
      runtime.cloudSaveTimerId = null;
    }
    if (!auth.currentUser || !runtime.queuedCloudState) return;
    runtime.cloudSaveInFlight = true;
    let shouldReschedule = false;
    let rescheduleDelay = 0;
    let shouldBail = false;
    try {
      const { saveRemoteState } = await getRemoteFns();
      while (auth.currentUser && runtime.queuedCloudState) {
        const payload = stripViewFields(runtime.queuedCloudState);
        runtime.queuedCloudState = null;
        try {
          const result = await saveRemoteState(payload, {
            sessionId,
            username: getCurrentUsername(),
          });
          if (!result?.ok) {
            if (result?.reason === "session_conflict") {
              await handleSessionConflict();
              shouldBail = true;
              break;
            }
            runtime.consecutiveSaveFailures += 1;
            if (!runtime.queuedCloudState) runtime.queuedCloudState = payload;
            if (runtime.consecutiveSaveFailures >= SAVE_RETRY_LIMIT) {
              await showSaveFailureAndLogout(
                result?.error?.message || result?.reason || "Failed to save to cloud.",
                { reason: result?.reason, code: result?.error?.code, message: result?.error?.message }
              );
              shouldBail = true;
              break;
            }
            rescheduleDelay = Math.min(
              SAVE_RETRY_BASE_MS * Math.pow(2, Math.max(0, runtime.consecutiveSaveFailures - 1)),
              SAVE_RETRY_MAX_MS
            );
            shouldReschedule = true;
            break;
          }
          runtime.consecutiveSaveFailures = 0;
        } catch (error) {
          runtime.consecutiveSaveFailures += 1;
          if (!runtime.queuedCloudState) runtime.queuedCloudState = payload;
          if (runtime.consecutiveSaveFailures >= SAVE_RETRY_LIMIT) {
            await showSaveFailureAndLogout(error?.message || "Failed to save to cloud.", { message: error?.message, stack: error?.stack });
            shouldBail = true;
            break;
          }
          rescheduleDelay = Math.min(
            SAVE_RETRY_BASE_MS * Math.pow(2, Math.max(0, runtime.consecutiveSaveFailures - 1)),
            SAVE_RETRY_MAX_MS
          );
          shouldReschedule = true;
          break;
        }
      }
    } catch (error) {
      runtime.consecutiveSaveFailures += 1;
      if (runtime.consecutiveSaveFailures >= SAVE_RETRY_LIMIT) {
        await showSaveFailureAndLogout(error?.message || "Failed to save to cloud.", { message: error?.message, stack: error?.stack });
        shouldBail = true;
      } else {
        rescheduleDelay = Math.min(
          SAVE_RETRY_BASE_MS * Math.pow(2, Math.max(0, runtime.consecutiveSaveFailures - 1)),
          SAVE_RETRY_MAX_MS
        );
        shouldReschedule = true;
      }
    } finally {
      runtime.cloudSaveInFlight = false;
      if (shouldBail) return;
      if (shouldReschedule && rescheduleDelay > 0) {
        scheduleCloudSave(rescheduleDelay);
        return;
      }
      if (auth.currentUser && runtime.queuedCloudState) runCloudSave();
    }
  };

  const queueCloudSave = (stateData, immediate = false) => {
    if (!auth.currentUser || !stateData) return;
    runtime.queuedCloudState = stripViewFields(stateData);
    if (immediate) {
      runCloudSave();
      return;
    }
    if (runtime.cloudSaveTimerId) clearTimeout(runtime.cloudSaveTimerId);
    if (runtime.cloudSaveInFlight) return;
    runtime.cloudSaveTimerId = setTimeout(runCloudSave, CLOUD_SAVE_DEBOUNCE_MS);
  };

  const flushCloudSaveQueue = async () => {
    if (runtime.cloudSaveTimerId) {
      clearTimeout(runtime.cloudSaveTimerId);
      runtime.cloudSaveTimerId = null;
    }
    await runCloudSave();
  };

  const resetSyncTracking = () => {
    clearCloudSaveQueue();
    runtime.cloudSaveInFlight = false;
    runtime.loginSyncPromise = null;
    runtime.loginSyncQueued = false;
    runtime.lastSyncedUserId = null;
    runtime.sessionConflictHandled = false;
    runtime.consecutiveSaveFailures = 0;
    runtime.saveFailurePromptOpen = false;
  };

  const setOnSaveFailureLogout = (handler) => {
    onSaveFailureLogout = handler;
  };

  return {
    queueCloudSave,
    flushCloudSaveQueue,
    resetSyncTracking,
    handleSessionConflict,
    setOnSaveFailureLogout,
  };
}

import { clampScale } from "../utils/helpers.js";

export function createPointerControls({ canvas, state, config, viewport, actions, openConfirmModal, saveState, saveViewState, gameHud }) {
  let hudHandlingPointer = false;

  function cancelHoeHold() {
    if (state.hoeHoldTimeoutId) {
      clearTimeout(state.hoeHoldTimeoutId);
      state.hoeHoldTimeoutId = null;
    }
  }

  function cancelBuildingHold() {
    if (state.buildingHoldTimeoutId) {
      clearTimeout(state.buildingHoldTimeoutId);
      state.buildingHoldTimeoutId = null;
    }
  }

  const persistView = saveViewState || saveState;

  let viewSaveTimerId = null;
  function queueViewSave() {
    if (!persistView) return;
    if (viewSaveTimerId) clearTimeout(viewSaveTimerId);
    viewSaveTimerId = setTimeout(() => {
      viewSaveTimerId = null;
      persistView();
    }, 250);
  }

  function updatePointer(e) {
    state.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function getTwoPointers() {
    const vals = Array.from(state.activePointers.values());
    return vals.length >= 2 ? [vals[0], vals[1]] : null;
  }

  function setHoverTile(tile) {
    const same = state.hoverTile && tile && state.hoverTile.row === tile.row && state.hoverTile.col === tile.col;
    if (same) return;
    if (!state.hoverTile && !tile) return;
    state.hoverTile = tile;
    state.needsRender = true;
  }

  function updateHoverFromEvent(e) {
    if (state.isDragging || state.isPinching) {
      setHoverTile(null);
      return;
    }
    const tile = viewport.tileFromClient(e.clientX, e.clientY);
    setHoverTile(tile ? { row: tile.row, col: tile.col } : null);
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e) {
    if (gameHud) {
      const coords = getCanvasCoords(e);
      const handled = gameHud.handlePointerDown(coords.x, coords.y);
      if (handled) {
        hudHandlingPointer = true;
        e.preventDefault();
        return;
      }
    }

    hudHandlingPointer = false;
    canvas.setPointerCapture(e.pointerId);
    updatePointer(e);
    if (state.activePointers.size === 2) {
      state.isDragging = false;
      state.isPinching = true;
      const [p1, p2] = getTwoPointers();
      state.pinchStartDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      state.pinchStartScale = state.scale;
      state.pinchCenter = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      state.tapStart = null;
      cancelHoeHold();
      cancelBuildingHold();
    } else if (state.activePointers.size === 1) {
      state.isPinching = false;
      state.isDragging = true;
      state.dragStart = { x: e.clientX, y: e.clientY };
      state.dragOffsetStart = { x: state.offsetX, y: state.offsetY };
      state.tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now() };
      if (state.activeMode === "harvest") {
        const tile = viewport.tileFromClient(e.clientX, e.clientY);
        if (tile) {
          const targets = actions.collectHoeDestroyTargets(tile.row, tile.col);
          if (targets.length > 0) {
            const destroyTargets = targets.slice();
            state.hoeHoldTimeoutId = setTimeout(() => {
              state.hoeHoldTimeoutId = null;
              state.hoeHoldTriggered = true;
              const count = destroyTargets.length;
              const label = count === 1 ? "crop" : "crops";
              openConfirmModal(`Destroy ${count} ${label}? No money will be earned.`, () => destroyTargets.forEach((k) => actions.destroyPlot(k)), count === 1 ? "Destroy Crop" : "Destroy Crops");
            }, config.hoeDestroyWindowMs);
          }
        }
      } else if (state.activeMode === "build" || state.activeMode === "landscape") {
        const tile = viewport.tileFromClient(e.clientX, e.clientY);
        if (tile) {
          const kind = state.activeMode === "landscape" ? "landscape" : "building";
          const targets = actions.collectStructureSellTargets(tile.row, tile.col, kind);
          if (targets.length > 0) {
            const sellTargets = targets.slice();
            state.buildingHoldTimeoutId = setTimeout(() => {
              state.buildingHoldTimeoutId = null;
              state.buildingHoldTriggered = true;
              actions.promptSellStructures(sellTargets, kind);
            }, config.hoeDestroyWindowMs);
          }
        }
      }
    }
  }

  function onPointerMove(e) {
    if (gameHud) {
      const coords = getCanvasCoords(e);
      gameHud.handlePointerMove(coords.x, coords.y);
    }

    if (hudHandlingPointer) return;

    updatePointer(e);
    if (state.isPinching && state.activePointers.size === 2) {
      e.preventDefault();
      const [p1, p2] = getTwoPointers();
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (state.pinchStartDistance > 0) {
        const newScale = clampScale(state.pinchStartScale * (d / state.pinchStartDistance), config.minScale, config.maxScale);
        const k = newScale / state.scale;
        state.offsetX = state.pinchCenter.x - (state.pinchCenter.x - state.offsetX) * k;
        state.offsetY = state.pinchCenter.y - (state.pinchCenter.y - state.offsetY) * k;
        state.scale = newScale;
        viewport.clampToBounds();
        state.needsRender = true;
        queueViewSave();
      }
    } else if (state.isDragging) {
      e.preventDefault();
      state.offsetX = state.dragOffsetStart.x + (e.clientX - state.dragStart.x);
      state.offsetY = state.dragOffsetStart.y + (e.clientY - state.dragStart.y);
      viewport.clampToBounds();
      state.needsRender = true;
      queueViewSave();
      if (state.tapStart) {
        const dx = e.clientX - state.tapStart.x;
        const dy = e.clientY - state.tapStart.y;
        if (dx * dx + dy * dy > 25) {
          state.tapStart = null;
          cancelHoeHold();
          cancelBuildingHold();
        }
      }
    }
    updateHoverFromEvent(e);
  }

  function onPointerUp(e) {
    if (hudHandlingPointer && gameHud) {
      const coords = getCanvasCoords(e);
      gameHud.handlePointerUp(coords.x, coords.y);
      hudHandlingPointer = false;
      return;
    }

    cancelHoeHold();
    cancelBuildingHold();
    state.activePointers.delete(e.pointerId);
    canvas.releasePointerCapture(e.pointerId);
    if (state.activePointers.size < 2) state.isPinching = false;
    if (state.activePointers.size === 0) state.isDragging = false;

    if (state.hoeHoldTriggered || state.buildingHoldTriggered) {
      state.hoeHoldTriggered = false;
      state.buildingHoldTriggered = false;
      state.tapStart = null;
    } else if (state.tapStart && state.tapStart.id === e.pointerId) {
      const dt = performance.now() - state.tapStart.time;
      const dx = e.clientX - state.tapStart.x;
      const dy = e.clientY - state.tapStart.y;
      if (dt < 300 && dx * dx + dy * dy <= 25) actions.handleTap(e.clientX, e.clientY);
    }
    state.tapStart = null;

    if (e.type === "pointerleave" || e.type === "pointercancel") setHoverTile(null);
    else updateHoverFromEvent(e);

    queueViewSave();
  }

  function onWheel(e) {
    if (gameHud) {
      const coords = getCanvasCoords(e);
      if (gameHud.isPointerOverHud(coords.x, coords.y)) {
        if (gameHud.handleMenuScroll && gameHud.handleMenuScroll(e.deltaY)) {
          e.preventDefault();
        }
        return;
      }
    }

    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    viewport.zoomAt(factor, cx, cy);
    queueViewSave();
  }

  function bind() {
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    document.addEventListener("pointerleave", () => {
      cancelHoeHold();
      cancelBuildingHold();
    });
  }

  return { bind, updateHoverFromEvent };
}


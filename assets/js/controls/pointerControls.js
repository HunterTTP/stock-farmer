import { clampScale } from "../utils/helpers.js";

export function createPointerControls({ canvas, state, config, viewport, actions, openConfirmModal, saveState }) {
  function cancelHoeHold() {
    if (state.hoeHoldTimeoutId) {
      clearTimeout(state.hoeHoldTimeoutId);
      state.hoeHoldTimeoutId = null;
    }
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

  function onPointerDown(e) {
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
    } else if (state.activePointers.size === 1) {
      state.isPinching = false;
      state.isDragging = true;
      state.dragStart = { x: e.clientX, y: e.clientY };
      state.dragOffsetStart = { x: state.offsetX, y: state.offsetY };
      state.tapStart = { id: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now() };
      if (state.hoeSelected) {
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
              openConfirmModal(
                `Destroy ${count} ${label}? No money will be earned.`,
                () => destroyTargets.forEach((k) => actions.destroyPlot(k)),
                count === 1 ? "Destroy Crop" : "Destroy Crops"
              );
            }, config.hoeDestroyWindowMs);
          }
        }
      }
    }
  }

  function onPointerMove(e) {
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
        state.viewDirty = true;
        state.needsRender = true;
      }
    } else if (state.isDragging) {
      e.preventDefault();
      state.offsetX = state.dragOffsetStart.x + (e.clientX - state.dragStart.x);
      state.offsetY = state.dragOffsetStart.y + (e.clientY - state.dragStart.y);
      viewport.clampToBounds();
      state.viewDirty = true;
      state.needsRender = true;
      if (state.tapStart) {
        const dx = e.clientX - state.tapStart.x;
        const dy = e.clientY - state.tapStart.y;
        if (dx * dx + dy * dy > 25) {
          state.tapStart = null;
          cancelHoeHold();
        }
      }
    }
    updateHoverFromEvent(e);
  }

  function onPointerUp(e) {
    cancelHoeHold();
    state.activePointers.delete(e.pointerId);
    canvas.releasePointerCapture(e.pointerId);
    if (state.activePointers.size < 2) state.isPinching = false;
    if (state.activePointers.size === 0) state.isDragging = false;

    if (state.hoeHoldTriggered) {
      state.hoeHoldTriggered = false;
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

    if (state.viewDirty && state.activePointers.size === 0) {
      saveState();
      state.viewDirty = false;
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    viewport.zoomAt(factor, cx, cy);
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
    });
  }

  return { bind, updateHoverFromEvent };
}

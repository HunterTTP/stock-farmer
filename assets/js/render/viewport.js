import { clampScale } from "../utils/helpers.js";

export function createViewport({ canvas, ctx, state, config }) {
  function clampToBounds() {
    const rect = canvas.getBoundingClientRect();
    const worldWidth = config.gridCols * state.tileSize * state.scale;
    const worldHeight = config.gridRows * state.tileSize * state.scale;
    const paddingX = rect.width * 0.5;
    const paddingY = rect.height * 0.5;
    const minOffsetX = rect.width - worldWidth - paddingX;
    const maxOffsetX = paddingX;
    const minOffsetY = rect.height - worldHeight - paddingY;
    const maxOffsetY = paddingY;
    state.offsetX = Math.min(maxOffsetX, Math.max(minOffsetX, state.offsetX));
    state.offsetY = Math.min(maxOffsetY, Math.max(minOffsetY, state.offsetY));
  }

  function centerView() {
    const rect = canvas.getBoundingClientRect();
    const worldWidth = config.gridCols * state.tileSize;
    const worldHeight = config.gridRows * state.tileSize;
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    const worldCenterX = worldWidth / 2;
    const worldCenterY = worldHeight / 2;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    state.offsetX = canvasCenterX - worldCenterX * state.scale;
    state.offsetY = canvasCenterY - worldCenterY * state.scale;
    clampToBounds();
    state.needsRender = true;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const prevWidth = canvas.width / dpr || 0;
    const prevHeight = canvas.height / dpr || 0;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scaleFromHeight = rect.height / (config.visibleRowsAtStart * state.tileSize);
    const scaleFromWidth = rect.width / (config.visibleRowsAtStart * state.tileSize);
    const initialScale = Math.min(scaleFromHeight, scaleFromWidth);

    if (!state.firstResizeDone) {
      const targetScale = state.savedScaleFromState != null ? clampScale(state.savedScaleFromState, config.minScale, config.maxScale) : initialScale;
      state.scale = targetScale;
      state.defaultScale = targetScale;
      if (typeof state.savedOffsetX === "number" && typeof state.savedOffsetY === "number") {
        state.offsetX = state.savedOffsetX;
        state.offsetY = state.savedOffsetY;
      } else {
        centerView();
      }
      state.firstResizeDone = true;
    } else {
      state.offsetX += (rect.width - prevWidth) / 2;
      state.offsetY += (rect.height - prevHeight) / 2;
    }
    clampToBounds();
    state.needsRender = true;
  }

  function zoomAt(factor, cx, cy) {
    const newScale = clampScale(state.scale * factor, config.minScale, config.maxScale);
    const k = newScale / state.scale;
    state.offsetX = cx - (cx - state.offsetX) * k;
    state.offsetY = cy - (cy - state.offsetY) * k;
    state.scale = newScale;
    clampToBounds();
    state.needsRender = true;
  }

  function worldFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const worldX = (x - state.offsetX) / state.scale;
    const worldY = (y - state.offsetY) / state.scale;
    return { worldX, worldY };
  }

  function tileFromClient(clientX, clientY) {
    const { worldX, worldY } = worldFromClient(clientX, clientY);
    const col = Math.floor(worldX / state.tileSize);
    const row = Math.floor(worldY / state.tileSize);
    if (row < 0 || row >= config.gridRows || col < 0 || col >= config.gridCols) return null;
    return { row, col, key: row + "," + col };
  }

  return {
    centerView,
    resizeCanvas,
    zoomAt,
    worldFromClient,
    tileFromClient,
    clampToBounds,
  };
}

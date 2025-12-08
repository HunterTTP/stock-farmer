import { getStageBreakpoints } from "../utils/helpers.js";

export function createRenderer({ canvas, ctx, state, world, config, crops, assets, landscapes, landscapeAssets, currentSizeOption, computeHoverPreview, gameHud }) {
  const buildingImageCache = new Map();
  const getLandscapeAsset = (id) => (id && landscapeAssets ? landscapeAssets[id] : null);

  const getBuildingImage = (src) => {
    if (!src) return null;
    if (buildingImageCache.has(src)) return buildingImageCache.get(src);
    const img = new Image();
    img.src = src;
    buildingImageCache.set(src, img);
    return img;
  };

  const updateLandscapeAssets = (nowPerf) => {
    if (!landscapeAssets) return;
    Object.values(landscapeAssets).forEach((asset) => {
      if (asset && typeof asset.update === "function") {
        asset.update(nowPerf);
      }
    });
  };
  function renderFloatingValue(anim, nowPerf, startRow, endRow, startCol, endCol) {
    const visibleDuration = 1000;
    const fadeDuration = 500;
    const totalDuration = visibleDuration + fadeDuration;
    const elapsed = nowPerf - anim.start;
    if (elapsed >= totalDuration) return true;

    const [rowStr, colStr] = anim.key.split(",");
    const row = parseInt(rowStr, 10);
    const col = parseInt(colStr, 10);
    if (Number.isNaN(row) || Number.isNaN(col)) return false;
    if (row < startRow || row >= endRow || col < startCol || col >= endCol) return false;

    const cellX = state.offsetX + col * state.tileSize * state.scale;
    const cellY = state.offsetY + row * state.tileSize * state.scale;
    const cx = cellX + (state.tileSize * state.scale) / 2;
    const cy = cellY + (state.tileSize * state.scale) / 2;

    let alpha;
    if (elapsed <= visibleDuration) alpha = 1;
    else {
      const fadeT = (elapsed - visibleDuration) / fadeDuration;
      alpha = 1 - Math.min(1, Math.max(0, fadeT));
    }

    const value = anim.value;
    const isPositiveOrZero = value >= 0;
    const absValue = Math.abs(value);
    const prefix = isPositiveOrZero ? "+$" : "-$";
    const cellScreenSize = state.tileSize * state.scale;
    const fontSize = cellScreenSize * 0.22;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${fontSize}px system-ui`;
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = cellScreenSize * 0.05;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = cellScreenSize * 0.015;
    ctx.fillStyle = isPositiveOrZero ? "#22c55e" : "#ef4444";
    ctx.fillText(prefix + absValue.toFixed(2), cx, cy);
    ctx.restore();
    return false;
  }

  function render() {
    const landscapeInWorld =
      world.structures && typeof world.structures.values === "function"
        ? Array.from(world.structures.values()).some(
          (struct) => struct && struct.kind === "landscape"
        )
        : false;
    const hasLandscapeAnimation =
      landscapeInWorld && landscapeAssets
        ? Object.values(landscapeAssets).some((asset) => asset && asset.animated)
        : false;
    const hasAnimations =
      world.harvestAnimations.length > 0 ||
      world.costAnimations.length > 0 ||
      hasLandscapeAnimation;
    if (!state.needsRender && !hasAnimations) return;
    state.needsRender = false;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    if (!assets.farmland.loaded || !assets.grass.loaded) return;

    const worldLeft = -state.offsetX / state.scale;
    const worldRight = (width - state.offsetX) / state.scale;
    const worldTop = -state.offsetY / state.scale;
    const worldBottom = (height - state.offsetY) / state.scale;

    const startCol = Math.max(0, Math.floor(worldLeft / state.tileSize));
    const endCol = Math.min(config.gridCols, Math.ceil(worldRight / state.tileSize));
    const startRow = Math.max(0, Math.floor(worldTop / state.tileSize));
    const endRow = Math.min(config.gridRows, Math.ceil(worldBottom / state.tileSize));

    const tileScreenSize = state.tileSize * state.scale;
    const now = Date.now();
    const nowPerf = performance.now();
    if (landscapeInWorld) updateLandscapeAssets(nowPerf);

    const landscapeDrawn = new Set();
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const key = row + "," + col;
        const x = state.offsetX + col * state.tileSize * state.scale;
        const y = state.offsetY + row * state.tileSize * state.scale;

        if (world.filled.has(key)) ctx.drawImage(assets.farmland.img, x, y, tileScreenSize, tileScreenSize);
        else ctx.drawImage(assets.grass.img, x, y, tileScreenSize, tileScreenSize);

        const structKey = world.structureTiles.get(key);
        if (structKey && !landscapeDrawn.has(structKey)) {
          const struct = world.structures.get(structKey);
          if (struct && struct.kind === "landscape") {
            const asset = getLandscapeAsset(struct.id);
            const targetW = struct.width * state.tileSize * state.scale;
            const targetH = struct.height * state.tileSize * state.scale;
            const drawX = state.offsetX + struct.col * state.tileSize * state.scale;
            const drawY = state.offsetY + struct.row * state.tileSize * state.scale;
            if (asset?.canvas) {
              ctx.drawImage(asset.canvas, drawX, drawY, targetW, targetH);
            } else {
              ctx.fillStyle = "#0ea5e9";
              ctx.fillRect(drawX, drawY, targetW, targetH);
            }
            landscapeDrawn.add(structKey);
          }
        }

        const plot = world.plots.get(key);
        if (!plot) continue;
        const crop = crops[plot.cropKey];
        if (!crop || !crop.images.length) continue;

        const elapsed = now - plot.plantedAt;
        const progress = Math.min(1, elapsed / crop.growTimeMs);
        const isReady = progress >= 1;

        const breakpoints = getStageBreakpoints(key, plot.cropKey, plot.plantedAt, crop.growTimeMs);
        let phaseIndex = 0;
        if (isReady) phaseIndex = 3;
        else if (progress >= breakpoints[1]) phaseIndex = 2;
        else if (progress >= breakpoints[0]) phaseIndex = 1;

        const img = crop.images[phaseIndex] || crop.images[crop.images.length - 1];
        const remainingMs = Math.max(0, crop.growTimeMs - elapsed);
        const secs = Math.ceil(remainingMs / 1000);
        const mins = Math.floor(secs / 60);
        const secPart = secs % 60;
        const timerText = mins + ":" + secPart.toString().padStart(2, "0");

        ctx.drawImage(img, x, y, tileScreenSize, tileScreenSize);


      }
    }

    for (let i = world.harvestAnimations.length - 1; i >= 0; i--) {
      const done = renderFloatingValue(world.harvestAnimations[i], nowPerf, startRow, endRow, startCol, endCol);
      if (done) world.harvestAnimations.splice(i, 1);
    }
    for (let i = world.costAnimations.length - 1; i >= 0; i--) {
      const done = renderFloatingValue(world.costAnimations[i], nowPerf, startRow, endRow, startCol, endCol);
      if (done) world.costAnimations.splice(i, 1);
    }
    if (world.harvestAnimations.length || world.costAnimations.length) state.needsRender = true;

    ctx.strokeStyle = "rgba(30,30,30,0.9)";
    ctx.lineWidth = Math.max(0.5, state.scale * 0.4);
    ctx.beginPath();
    for (let col = startCol; col <= endCol; col++) {
      const x = state.offsetX + col * state.tileSize * state.scale;
      ctx.moveTo(x, state.offsetY + startRow * state.tileSize * state.scale);
      ctx.lineTo(x, state.offsetY + endRow * state.tileSize * state.scale);
    }
    for (let row = startRow; row <= endRow; row++) {
      const y = state.offsetY + row * state.tileSize * state.scale;
      ctx.moveTo(state.offsetX + startCol * state.tileSize * state.scale, y);
      ctx.lineTo(state.offsetX + endCol * state.tileSize * state.scale, y);
    }
    ctx.stroke();

    if (world.structures && typeof world.structures.forEach === "function") {
      world.structures.forEach((struct) => {
        if (!struct || struct.kind === "landscape") return;
        const left = struct.col;
        const top = struct.row;
        const right = struct.col + struct.width;
        const bottom = struct.row + struct.height;
        if (right < startCol || left > endCol || bottom < startRow || top > endRow) return;
        const x = state.offsetX + left * state.tileSize * state.scale;
        const y = state.offsetY + top * state.tileSize * state.scale;
        const targetW = struct.width * state.tileSize * state.scale;
        const targetH = struct.height * state.tileSize * state.scale;
        const img = getBuildingImage(struct.image);
        if (img && img.complete) {
          const naturalW = img.naturalWidth || targetW;
          const naturalH = img.naturalHeight || targetH;
          const scale = Math.min(targetW / naturalW, targetH / naturalH);
          const drawW = naturalW * scale;
          const drawH = naturalH * scale;
          const drawX = x + (targetW - drawW) / 2;
          const drawY = y + (targetH - drawH) / 2;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        } else if (img) {
          img.onload = () => {
            state.needsRender = true;
          };
        }
      });
    }

    if (state.hoverTile) {
      const sizeOption = currentSizeOption();
      const size = Math.max(1, sizeOption.size || 1);
      const preview = computeHoverPreview(state.hoverTile.row, state.hoverTile.col, size, now);
      const allowedColor = "rgba(34,197,94,0.75)";
      const blockedColor = "rgba(239,68,68,0.75)";
      ctx.lineWidth = Math.max(1.2, state.scale * 0.9);
      for (const cell of preview) {
        const { row, col, allowed } = cell;
        if (row < startRow || row >= endRow || col < startCol || col >= endCol) continue;
        const x = state.offsetX + col * state.tileSize * state.scale;
        const y = state.offsetY + row * state.tileSize * state.scale;
        ctx.strokeStyle = allowed ? allowedColor : blockedColor;
        ctx.strokeRect(x, y, state.tileSize * state.scale, state.tileSize * state.scale);
      }
    }

    if (gameHud) {
      const moneyAnimating = gameHud.updateMoneyChangeAnimation();
      const momentumAnimating = gameHud.updateMenuMomentum ? gameHud.updateMenuMomentum() : false;
      if (moneyAnimating || momentumAnimating) state.needsRender = true;
      gameHud.render();
    }
  }

  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  return { render, loop };
}

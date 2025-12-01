export function createRenderer({ canvas, ctx, state, world, config, crops, stocks, assets, currentSizeOption, computeHoverPreview, saveState }) {
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
    if (elapsed <= visibleDuration) {
      alpha = 1;
    } else {
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
    const hasAnimations = world.harvestAnimations.length > 0 || world.costAnimations.length > 0;
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
    const isZoomedOut = tileScreenSize < 72;
    const now = Date.now();
    const nowPerf = performance.now();

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const key = row + "," + col;
        const x = state.offsetX + col * state.tileSize * state.scale;
        const y = state.offsetY + row * state.tileSize * state.scale;

        if (world.filled.has(key)) ctx.drawImage(assets.farmland.img, x, y, tileScreenSize, tileScreenSize);
        else ctx.drawImage(assets.grass.img, x, y, tileScreenSize, tileScreenSize);

        const plot = world.plots.get(key);
        if (!plot) continue;
        const crop = crops[plot.cropKey];
        const stock = stocks[plot.stockKey];
        if (!crop || !stock || !crop.images.length) continue;

        const elapsed = now - plot.plantedAt;
        const progress = Math.min(1, elapsed / crop.growTimeMs);
        const isReady = progress >= 1;
        if (isReady && plot.lockedStockPrice == null) {
          plot.lockedStockPrice = stock.price;
          saveState();
        }

        const breakpoints = Array.isArray(plot.stageBreakpoints) && plot.stageBreakpoints.length === 2 ? plot.stageBreakpoints : [1 / 3, 2 / 3];
        let phaseIndex = 0;
        if (isReady) phaseIndex = 3;
        else if (progress >= breakpoints[1]) phaseIndex = 2;
        else if (progress >= breakpoints[0]) phaseIndex = 1;

        const img = crop.images[phaseIndex] || crop.images[crop.images.length - 1];
        const effectivePrice = isReady && plot.lockedStockPrice != null ? plot.lockedStockPrice : stock.price;
        const pctChange = (effectivePrice - plot.stockPriceAtPlant) / plot.stockPriceAtPlant;
        const value = Math.max(0, crop.baseValue * (1 + pctChange));
        const pctText = `${pctChange >= 0 ? "+" : ""}${(pctChange * 100).toFixed(1)}%`;
        const valueText = "$" + value.toFixed(2);

        const remainingMs = Math.max(0, crop.growTimeMs - elapsed);
        const secs = Math.ceil(remainingMs / 1000);
        const mins = Math.floor(secs / 60);
        const secPart = secs % 60;
        const timerText = mins + ":" + secPart.toString().padStart(2, "0");

        let arrow = "";
        if (pctChange > 0) arrow = "^";
        else if (pctChange < 0) arrow = "v";

        let stockColor = "white";
        if (pctChange > 0) stockColor = "#22c55e";
        else if (pctChange < 0) stockColor = "#ef4444";

        ctx.drawImage(img, x, y, tileScreenSize, tileScreenSize);

        if (isZoomedOut) {
          if (state.showStats && !isReady) {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(x, y, tileScreenSize, tileScreenSize);

            ctx.save();
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            const pad = tileScreenSize * 0.08;
            let lineY = y + pad;
            const baseX = x + pad;
            ctx.font = `${tileScreenSize * 0.22}px system-ui`;
            ctx.fillStyle = stockColor;
            ctx.fillText(`${plot.stockKey} ${arrow}`, baseX, lineY);
            lineY += tileScreenSize * 0.24;
            ctx.font = `${tileScreenSize * 0.2}px system-ui`;
            ctx.fillStyle = "white";
            ctx.fillText(pctText, baseX, lineY);
            lineY += tileScreenSize * 0.2;
            ctx.fillText(valueText, baseX, lineY);
            lineY += tileScreenSize * 0.2;
            ctx.fillText(timerText, baseX, lineY);
            ctx.restore();
          }
          continue;
        }

        const pad = 3 * state.scale;
        const infoHeight = 32 * state.scale;
        if (state.showStats && !isReady) {
          ctx.fillStyle = "rgba(0,0,0,0.65)";
          ctx.fillRect(x, y, tileScreenSize, infoHeight);
          ctx.textBaseline = "top";
          ctx.font = `${9 * state.scale}px system-ui`;
          const baseX = x + pad;
          const baseY = y + pad;
          const tickerText = `${plot.stockKey} ${arrow}`;
          ctx.fillStyle = stockColor;
          ctx.fillText(tickerText, baseX, baseY);
          const tickerWidth = ctx.measureText(tickerText + " ").width;
          ctx.fillStyle = "white";
          ctx.fillText(pctText, baseX + tickerWidth, baseY);
          ctx.fillText(valueText, baseX, baseY + 10 * state.scale);
          ctx.fillText(timerText, baseX, baseY + 20 * state.scale);
        }
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
  }

  function loop() {
    render();
    requestAnimationFrame(loop);
  }

  return { render, loop };
}

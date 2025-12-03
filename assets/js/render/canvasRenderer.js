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
        if (pctChange > 0) arrow = "▲";
        else if (pctChange < 0) arrow = "▼";

        let stockColor = "white";
        if (pctChange > 0) stockColor = "#22c55e";
        else if (pctChange < 0) stockColor = "#ef4444";

        ctx.drawImage(img, x, y, tileScreenSize, tileScreenSize);

        if (isZoomedOut) {
        const statsEnabled = state.showStats && (state.showTickerInfo || state.showPctInfo || state.showTimerInfo || state.showSellInfo);
        if (statsEnabled && !isReady) {
          ctx.save();
          const padTop = Math.max(3 * state.scale, tileScreenSize * 0.05);
          const padBottom = Math.max(2, padTop * 0.5);
          const baseFont = Math.min(Math.max(tileScreenSize * 0.14, 8), Math.min(16, tileScreenSize * 0.24));
          const userScale = Math.max(0.5, Math.min(2, (state.statBaseSize || 14) / 14));
          let fontSize = Math.min(28, Math.max(6, baseFont * userScale));
          let spacing = Math.max(2, fontSize * 0.15);
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.font = `${fontSize}px system-ui`;

          const availableWidth = tileScreenSize - padTop * 2;
          const lines = [];
          if (state.showTickerInfo) {
            const base = `${plot.stockKey} ${arrow}`;
            const pctLine = `${pctText}`;
            const combined = state.showPctInfo ? `${base} ${pctLine}` : base;
            const fitsCombined = ctx.measureText(combined).width <= availableWidth * 0.95;
            if (fitsCombined) {
              lines.push({ text: combined, color: stockColor });
            } else {
              lines.push({ text: base, color: stockColor });
              if (state.showPctInfo) lines.push({ text: pctLine, color: stockColor });
            }
          } else if (state.showPctInfo) {
            lines.push({ text: pctText, color: stockColor });
          }
          if (state.showSellInfo) lines.push({ text: valueText, color: "white" });
          if (state.showTimerInfo) lines.push({ text: timerText, color: "white" });

          if (lines.length) {
            const availableHeight = Math.max(0, tileScreenSize - padTop - padBottom);
            const maxFontToFit =
              (availableHeight - spacing * Math.max(0, lines.length - 1)) / Math.max(1, lines.length);
            if (maxFontToFit < fontSize) {
              fontSize = Math.max(6, maxFontToFit);
              spacing = Math.max(2, fontSize * 0.15);
              ctx.font = `${fontSize}px system-ui`;
            }
          }

          const contentHeight = lines.length ? fontSize * lines.length + spacing * (lines.length - 1) : 0;
          const bgHeight = Math.min(tileScreenSize, padTop + padBottom + contentHeight);
          const bgAlpha = Math.min(1, Math.max(0, state.statBgAlpha ?? 1));
          ctx.fillStyle = `rgba(0,0,0,${0.65 * bgAlpha})`;
          ctx.fillRect(x, y, tileScreenSize, bgHeight);

          const textAlpha = Math.min(1, Math.max(0, state.statTextAlpha ?? 1));
          ctx.globalAlpha = textAlpha;
          let lineY = y + padTop;
          const baseX = x + padTop;
          lines.forEach((line, idx) => {
            ctx.fillStyle = line.color;
            ctx.fillText(line.text, baseX, lineY);
            if (idx < lines.length - 1) lineY += fontSize + spacing;
          });
          ctx.restore();
        }
        continue;
      }

      const statsEnabled = state.showStats && (state.showTickerInfo || state.showPctInfo || state.showTimerInfo || state.showSellInfo);
      if (statsEnabled && !isReady) {
        ctx.save();
        const padTop = Math.max(3 * state.scale, tileScreenSize * 0.05);
        const padBottom = Math.max(2, padTop * 0.5);
        const baseFont = Math.min(Math.max(tileScreenSize * 0.14, 8), Math.min(16, tileScreenSize * 0.24));
        const userScale = Math.max(0.5, Math.min(2, (state.statBaseSize || 14) / 14));
        let fontSize = Math.min(28, Math.max(6, baseFont * userScale));
        let spacing = Math.max(2, fontSize * 0.15);
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = `${fontSize}px system-ui`;
        const availableWidth = tileScreenSize - padTop * 2;
        const lines = [];
        if (state.showTickerInfo) {
          const base = `${plot.stockKey} ${arrow}`;
          const pctLine = `${pctText}`;
          const combined = state.showPctInfo ? `${base} ${pctLine}` : base;
          const fitsCombined = ctx.measureText(combined).width <= availableWidth * 0.95;
          if (fitsCombined) {
            lines.push({ text: combined, color: stockColor });
          } else {
            lines.push({ text: base, color: stockColor });
            if (state.showPctInfo) lines.push({ text: pctLine, color: stockColor });
          }
        } else if (state.showPctInfo) {
          lines.push({ text: pctText, color: stockColor });
        }
        if (state.showSellInfo) lines.push({ text: valueText, color: "white" });
        if (state.showTimerInfo) lines.push({ text: timerText, color: "white" });
        if (lines.length) {
          const availableHeight = Math.max(0, tileScreenSize - padTop - padBottom);
          const maxFontToFit =
            (availableHeight - spacing * Math.max(0, lines.length - 1)) / Math.max(1, lines.length);
          if (maxFontToFit < fontSize) {
            fontSize = Math.max(6, maxFontToFit);
            spacing = Math.max(2, fontSize * 0.15);
            ctx.font = `${fontSize}px system-ui`;
          }
        }
        const contentHeight = lines.length ? fontSize * lines.length + spacing * (lines.length - 1) : 0;
        const bgHeight = Math.min(tileScreenSize, padTop + padBottom + contentHeight);

        const bgAlpha = Math.min(1, Math.max(0, state.statBgAlpha ?? 1));
        ctx.fillStyle = `rgba(0,0,0,${0.65 * bgAlpha})`;
        ctx.fillRect(x, y, tileScreenSize, bgHeight);
        ctx.textBaseline = "top";
        let lineY = y + padTop;
        const baseX = x + padTop;
        const textAlpha = Math.min(1, Math.max(0, state.statTextAlpha ?? 1));
        ctx.globalAlpha = textAlpha;
        lines.forEach((line, idx) => {
          ctx.fillStyle = line.color;
          ctx.fillText(line.text, baseX, lineY);
          if (idx < lines.length - 1) lineY += fontSize + spacing;
        });
        ctx.restore();
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

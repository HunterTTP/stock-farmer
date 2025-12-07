export function buildCropOperations(context) {
  const { state, world, crops, config, onMoneyChanged, renderCropOptions, saveState, currentSizeOption } = context;
  const getCropGrowTimeMs = (crop) => {
    if (!crop) return 0;
    if (Number.isFinite(crop.growTimeMs)) return crop.growTimeMs;
    if (Number.isFinite(crop.growMinutes)) return crop.growMinutes * 60 * 1000;
    return 0;
  };

  function recomputeLastPlantedForCrop(cropKey) {
    const crop = crops[cropKey];
    if (!crop) return;
    let latest = null;
    world.plots.forEach((plot) => {
      if (plot?.cropKey !== cropKey) return;
      const plantedAt = Number(plot?.plantedAt);
      if (Number.isFinite(plantedAt) && (latest === null || plantedAt > latest)) latest = plantedAt;
    });
    crop.lastPlantedAt = latest;
  }

  function harvestPlot(key) {
    const plot = world.plots.get(key);
    if (!plot) return;
    const crop = crops[plot.cropKey];
    if (!crop) return;
    const value = Math.max(0, crop.baseValue);
    world.harvestAnimations.push({ key, value, start: performance.now() });
    if (typeof crop.placed === "number" && crop.placed > 0) crop.placed -= 1;
    state.totalMoney += value;
    onMoneyChanged();
    world.plots.delete(key);
    state.needsRender = true;
    recomputeLastPlantedForCrop(crop.id);
    saveState();
  }

  function destroyPlot(key) {
    const plot = world.plots.get(key);
    if (!plot) return;
    const crop = crops[plot.cropKey];
    if (crop && typeof crop.placed === "number" && crop.placed > 0) crop.placed -= 1;
    world.plots.delete(key);
    state.needsRender = true;
    if (crop) recomputeLastPlantedForCrop(crop.id);
    renderCropOptions();
    saveState();
  }

  function collectHoeDestroyTargets(baseRow, baseCol) {
    const targets = [];
    const sizeOption = currentSizeOption();
    const size = Math.max(1, sizeOption.size || 1);
    const now = performance.now();
    for (let dr = 0; dr < size; dr++) {
      for (let dc = 0; dc < size; dc++) {
        const row = baseRow + dr;
        const col = baseCol + dc;
        if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) continue;
        const key = row + "," + col;
        const plot = world.plots.get(key);
        const crop = plot ? crops[plot.cropKey] : null;
        const plantedAt = Number(plot?.plantedAt);
        const growMs = getCropGrowTimeMs(crop);
        if (plot && crop && Number.isFinite(plantedAt) && now - plantedAt < growMs) targets.push(key);
      }
    }
    return targets;
  }

  return {
    collectHoeDestroyTargets,
    destroyPlot,
    harvestPlot,
    recomputeLastPlantedForCrop,
  };
}

import { getPlotGrowTimeMs } from "../../utils/helpers.js";
import { clampMoney } from "../../state/stateUtils.js";

export function buildCropOperations(context) {
  const { state, world, crops, config, onMoneyChanged, renderCropOptions, saveState, currentSizeOption, openConfirmModal } = context;

  function recomputeLastPlantedForCrop(cropKey) {
    const crop = crops[cropKey];
    if (!crop) return;
    let latest = null;
    let latestGrowMs = null;
    world.plots.forEach((plot) => {
      if (plot?.cropKey !== cropKey) return;
      const plantedAt = Number(plot?.plantedAt);
      if (!Number.isFinite(plantedAt)) return;
      if (latest === null || plantedAt > latest) {
        latest = plantedAt;
        latestGrowMs = getPlotGrowTimeMs(plot, crop);
      }
    });
    crop.lastPlantedAt = latest;
    crop.lastPlantedGrowMs = Number.isFinite(latestGrowMs) ? latestGrowMs : null;
  }

  function harvestPlot(key) {
    const plot = world.plots.get(key);
    if (!plot) return;
    const crop = crops[plot.cropKey];
    if (!crop) return;
    const value = Math.max(0, crop.baseValue);
    world.harvestAnimations.push({ key, value, start: performance.now() });
    if (typeof crop.placed === "number" && crop.placed > 0) crop.placed -= 1;
    state.totalMoney = clampMoney(state.totalMoney + value);
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

  function collectCropDestroyTargets(baseRow, baseCol) {
    const targets = [];
    const sizeOption = currentSizeOption();
    const size = Math.max(1, sizeOption.size || 1);
    for (let dr = 0; dr < size; dr++) {
      for (let dc = 0; dc < size; dc++) {
        const row = baseRow + dr;
        const col = baseCol + dc;
        if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) continue;
        const key = row + "," + col;
        if (world.plots.has(key)) targets.push(key);
      }
    }
    return targets;
  }

  function promptDestroyCrops(keys) {
    const uniqueKeys = Array.from(new Set(keys || []));
    if (!uniqueKeys.length) return;
    const count = uniqueKeys.length;
    const label = count === 1 ? "crop" : "crops";
    openConfirmModal(
      `Destroy ${count} ${label}? No money will be earned.`,
      () => {
        uniqueKeys.forEach((key) => destroyPlot(key));
      },
      "Destroy Crops",
      null,
      { confirmVariant: "danger", confirmText: "Destroy" }
    );
  }

  return {
    collectCropDestroyTargets,
    destroyPlot,
    harvestPlot,
    recomputeLastPlantedForCrop,
    promptDestroyCrops,
  };
}

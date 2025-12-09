import { getPlotGrowTimeMs } from "../../utils/helpers.js";

export function buildPreview(context, determineActionForTile) {
  const { state, world, config, crops } = context;

  function simulateTileActionForPreview(action, key, previewState, nowMs, getFilled, getPlot) {
    if (!action || action.type === "none") return false;
    switch (action.type) {
      case "harvest": {
        const existingPlot = getPlot(key);
        const plotCrop = existingPlot ? crops[existingPlot.cropKey] : null;
        if (!existingPlot || !plotCrop) return false;
        const plantedAt = Number(existingPlot.plantedAt);
        const growMs = getPlotGrowTimeMs(existingPlot, plotCrop);
        const ready = Number.isFinite(plantedAt) && (growMs <= 0 || nowMs - plantedAt >= growMs);
        if (!ready) return false;
        const value = Math.max(0, plotCrop.baseValue);
        previewState.money += value;
        if (typeof previewState.placed[plotCrop.id] === "number" && previewState.placed[plotCrop.id] > 0) previewState.placed[plotCrop.id] -= 1;
        previewState.plotsRemoved.add(key);
        return true;
      }
      case "removeFarmland": {
        if (getFilled(key)) {
          previewState.filledRemovals.add(key);
          if (typeof previewState.farmlandPlaced === "number" && previewState.farmlandPlaced > 0) previewState.farmlandPlaced -= 1;
          return true;
        }
        return false;
      }
      case "placeFarmland": {
        if (getFilled(key) || getPlot(key)) return false;
        const farmlandPlaced = typeof previewState.farmlandPlaced === "number" ? previewState.farmlandPlaced : 0;
        const farmlandCost = farmlandPlaced < 4 ? 0 : 25;
        if (previewState.money < farmlandCost) return false;
        previewState.money -= farmlandCost;
        previewState.filledAdds.add(key);
        previewState.farmlandPlaced = farmlandPlaced + 1;
        return true;
      }
      case "plantCrop": {
        const crop = crops[action.cropKey];
        if (!crop || !crop.unlocked) return false;
        if (getPlot(key) || !getFilled(key)) return false;
        if (world.structureTiles && world.structureTiles.has(key)) return false;
        if (typeof crop.limit === "number" && crop.limit >= 0 && previewState.placed[crop.id] >= crop.limit) return false;
        const plantCost = typeof crop.placeCost === "number" ? crop.placeCost : 0;
        if (previewState.money < plantCost) return false;
        previewState.money -= plantCost;
        previewState.placed[crop.id] += 1;
        return true;
      }
      default:
        return false;
    }
  }

  function computeHoverPreview(baseRow, baseCol, size, nowMs) {
    const results = [];
    const mode = state.activeMode || "plant";

    if (mode === "build" || mode === "landscape") {
      const kind = mode === "landscape" ? "landscape" : "building";
      const selectedKey = kind === "landscape" ? state.selectedLandscapeKey : state.selectedBuildKey;
      const selection = selectedKey && selectedKey !== "sell" ? context.getPlacementSource(kind, selectedKey) : null;
      const fallbackSize = selectedKey === "sell" ? 1 : Math.max(1, size || 1);
      const width = Number.isInteger(selection?.width) && selection.width > 0 ? selection.width : fallbackSize;
      const height = Number.isInteger(selection?.height) && selection.height > 0 ? selection.height : fallbackSize;
      const action = determineActionForTile(baseRow, baseCol, nowMs);
      const allowed = action?.type === "placeStructure" || action?.type === "destroyStructure" || action?.type === "placeFarmland" || action?.type === "removeFarmland" || action?.type === "placeStructureOverFarmland" || action?.type === "replaceLandscape" || action?.type === "replaceLandscapeWithFarmland" || action?.type === "replaceLandscapeWithGrass";
      for (let dr = 0; dr < height; dr++) {
        for (let dc = 0; dc < width; dc++) {
          results.push({ row: baseRow + dr, col: baseCol + dc, allowed });
        }
      }
      return results;
    }

    const sizeClamped = Math.max(1, size || 1);
    const baseAction = determineActionForTile(baseRow, baseCol, nowMs);
    if (!baseAction || baseAction.type === "none") {
      for (let dr = 0; dr < sizeClamped; dr++) {
        for (let dc = 0; dc < sizeClamped; dc++) {
          results.push({ row: baseRow + dr, col: baseCol + dc, allowed: false });
        }
      }
      return results;
    }

    const placed = {};
    Object.values(crops).forEach((c) => {
      placed[c.id] = typeof c.placed === "number" ? Math.max(0, c.placed) : 0;
    });
    const previewState = { money: state.totalMoney, placed, farmlandPlaced: state.farmlandPlaced || 0, filledAdds: new Set(), filledRemovals: new Set(), plotsRemoved: new Set() };
    const getFilled = (key) => {
      if (previewState.filledAdds.has(key)) return true;
      if (previewState.filledRemovals.has(key)) return false;
      return world.filled.has(key);
    };
    const getPlot = (key) => {
      if (previewState.plotsRemoved.has(key)) return null;
      return world.plots.get(key) || null;
    };
    for (let dr = 0; dr < sizeClamped; dr++) {
      for (let dc = 0; dc < sizeClamped; dc++) {
        const row = baseRow + dr;
        const col = baseCol + dc;
        const key = row + "," + col;
        let allowed = false;
        if (row < 0 || row >= config.gridRows || col < 0 || col >= config.gridCols) {
          results.push({ row, col, allowed });
          continue;
        }
        allowed = simulateTileActionForPreview(baseAction, key, previewState, nowMs, getFilled, getPlot);
        results.push({ row, col, allowed });
      }
    }
    return results;
  }

  return { computeHoverPreview };
}

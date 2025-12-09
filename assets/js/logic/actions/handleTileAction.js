import { FARMLAND, FARMLAND_SATURATED, clearFarmlandType, ensureFarmlandStates, getFarmlandType, getPlotGrowTimeMs, setFarmlandType } from "../../utils/helpers.js";

export function buildActionHandler(context, helpers, determineActionForTile, cropOps) {
  const { state, world, config, crops, formatCurrency, onMoneyChanged, renderCropOptions, renderLandscapeOptions, saveState } = context;
  const { harvestPlot, destroyPlot, recomputeLastPlantedForCrop } = cropOps;
  const { removeStructure, getStructureAtKey, getPlacementSource, canPlaceStructure } = helpers;

  ensureFarmlandStates(world);
  const hydrationTimers = world.hydrationTimers || new Map();
  world.hydrationTimers = hydrationTimers;

  const cancelHydrationTimer = (targetKey) => {
    if (!targetKey) return;
    const existing = hydrationTimers.get(targetKey);
    if (existing) clearTimeout(existing);
    hydrationTimers.delete(targetKey);
  };

  const applySaturationToFarmland = (targetKey) => {
    if (!targetKey || !world.filled.has(targetKey)) {
      clearFarmlandType(world, targetKey);
      cancelHydrationTimer(targetKey);
      return;
    }
    cancelHydrationTimer(targetKey);
    if (getFarmlandType(world, targetKey) === FARMLAND_SATURATED) return;
    setFarmlandType(world, targetKey, FARMLAND_SATURATED);
    const plot = world.plots.get(targetKey);
    if (plot) {
      const crop = crops[plot.cropKey];
      const growMs = getPlotGrowTimeMs(plot, crop);
      const totalGrow = Number.isFinite(growMs) ? Math.max(0, growMs) : 0;
      if (totalGrow > 0) {
        const now = Date.now();
        const elapsed = Math.max(0, now - plot.plantedAt);
        const remaining = Math.max(0, totalGrow - elapsed);
        const boost = totalGrow * 0.25;
        const newRemaining = Math.max(0, remaining - boost);
        const newElapsed = totalGrow - newRemaining;
        plot.plantedAt = now - newElapsed;
      }
      plot.growTimeMs = Number.isFinite(growMs) ? growMs : undefined;
      recomputeLastPlantedForCrop(plot.cropKey);
      renderCropOptions();
    }
    state.needsRender = true;
    saveState();
  };

  const scheduleHydration = (targetKey) => {
    if (!targetKey || !world.filled.has(targetKey)) {
      cancelHydrationTimer(targetKey);
      return;
    }
    if (getFarmlandType(world, targetKey) === FARMLAND_SATURATED) {
      cancelHydrationTimer(targetKey);
      return;
    }
    if (hydrationTimers.has(targetKey)) return;
    const delayMs = Math.random() * 4000;
    const timeoutId = setTimeout(() => {
      hydrationTimers.delete(targetKey);
      applySaturationToFarmland(targetKey);
    }, delayMs);
    hydrationTimers.set(targetKey, timeoutId);
  };

  const triggerHydrationAroundStructure = (struct) => {
    if (!struct || struct.kind !== "landscape" || typeof struct.id !== "string") return;
    if (!struct.id.startsWith("water")) return;
    const range = 5;
    const height = Math.max(1, struct.height || 1);
    const width = Math.max(1, struct.width || 1);
    const startRow = Math.max(0, struct.row - range);
    const endRow = Math.min(config.gridRows - 1, struct.row + height - 1 + range);
    const startCol = Math.max(0, struct.col - range);
    const endCol = Math.min(config.gridCols - 1, struct.col + width - 1 + range);
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const farmlandKey = `${r},${c}`;
        if (!world.filled.has(farmlandKey)) continue;
        if (getFarmlandType(world, farmlandKey) === FARMLAND_SATURATED) continue;
        scheduleHydration(farmlandKey);
      }
    }
  };

  const clearFarmlandTracking = (farmlandKey) => {
    cancelHydrationTimer(farmlandKey);
    clearFarmlandType(world, farmlandKey);
  };

  function handleTileAction(row, col, action) {
    if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) return { success: false, reason: "Out of bounds" };
    ensureFarmlandStates(world);
    const key = row + "," + col;
    const resolvedAction = action || determineActionForTile(row, col);
    if (!resolvedAction || resolvedAction.type === "none") return { success: false, reason: resolvedAction ? resolvedAction.reason : undefined };

    switch (resolvedAction.type) {
      case "harvest": {
        const existingPlot = world.plots.get(key);
        if (!existingPlot) return { success: false, reason: "Nothing to harvest" };
        const crop = crops[existingPlot.cropKey];
        if (!crop) return { success: false, reason: "Unknown crop" };
        const plantedAt = Number(existingPlot.plantedAt);
        const growMs = getPlotGrowTimeMs(existingPlot, crop);
        const elapsed = Number.isFinite(plantedAt) ? Date.now() - plantedAt : 0;
        if (growMs <= 0 || elapsed >= growMs) {
          harvestPlot(key);
          return { success: true };
        }
        return { success: false, reason: "Not ready to harvest" };
      }
      case "confirmDestroy": {
        const existingPlot = world.plots.get(key);
        if (!existingPlot) return { success: false, reason: "Nothing to remove" };
        context.openConfirmModal("Are you sure you want to destroy this crop? No money will be earned.", () => destroyPlot(key), "Destroy Crop");
        return { success: true };
      }
      case "removeFarmland": {
        const hadFarmland = world.filled.delete(key);
        if (hadFarmland) {
          clearFarmlandTracking(key);
          const previousPlaced = state.farmlandPlaced || 0;
          if (previousPlaced > 0) state.farmlandPlaced = previousPlaced - 1;
          if (previousPlaced > 4) {
            state.totalMoney += 25;
            onMoneyChanged();
            world.costAnimations.push({ key, value: 25, start: performance.now() });
          }
        }
        state.needsRender = true;
        renderCropOptions();
        renderLandscapeOptions();
        saveState();
        return { success: hadFarmland, reason: hadFarmland ? undefined : "No farmland here" };
      }
      case "placeFarmland": {
        if (world.plots.has(key) || world.filled.has(key)) return { success: false, reason: "Tile occupied" };
        if (world.structureTiles.has(key)) return { success: false, reason: "Structure here" };
        const farmlandPlaced = state.farmlandPlaced || 0;
        const cost = farmlandPlaced < 4 ? 0 : 25;
        if (cost > 0) {
          if (state.totalMoney < cost) return { success: false, reason: `Need ${formatCurrency(cost)} to place` };
          state.totalMoney -= cost;
          onMoneyChanged();
          world.costAnimations.push({ key, value: -cost, start: performance.now() });
        }
        world.filled.add(key);
        setFarmlandType(world, key, FARMLAND);
        cancelHydrationTimer(key);
        state.farmlandPlaced = farmlandPlaced + 1;
        state.needsRender = true;
        renderCropOptions();
        renderLandscapeOptions();
        saveState();
        return { success: true };
      }
      case "plantCrop": {
        const cropKey = resolvedAction && resolvedAction.cropKey ? resolvedAction.cropKey : state.selectedCropKey;
        const crop = crops[cropKey];
        if (!crop || !crop.unlocked) return { success: false, reason: "Crop locked" };
        const structHere = getStructureAtKey(key) || (world.structureTiles && world.structureTiles.has(key));
        if (structHere) return { success: false, reason: "Structure here" };
        if (world.plots.has(key)) return { success: false, reason: "Already planted" };
        if (!world.filled.has(key)) return { success: false, reason: "Need farmland first" };
        if (typeof crop.limit === "number" && crop.limit >= 0 && crop.placed >= crop.limit) return { success: false, reason: "Crop limit reached" };
        const plantCost = typeof crop.placeCost === "number" ? crop.placeCost : 0;
        if (plantCost > 0) {
          if (state.totalMoney < plantCost) return { success: false, reason: `Need ${formatCurrency(plantCost)} to plant ${crop.name}` };
          state.totalMoney -= plantCost;
          onMoneyChanged();
          world.costAnimations.push({ key, value: -plantCost, start: performance.now() });
        }
        const plantedAt = Date.now();
        const farmlandType = getFarmlandType(world, key);
        const baseGrowMs = getPlotGrowTimeMs(null, crop);
        const growTimeMs =
          farmlandType === FARMLAND_SATURATED && baseGrowMs > 0 ? Math.round(baseGrowMs * 0.75) : baseGrowMs;
        world.plots.set(key, {
          cropKey,
          plantedAt,
          growTimeMs,
        });
        crop.placed += 1;
        crop.lastPlantedAt = plantedAt;
        crop.lastPlantedGrowMs = growTimeMs;
        renderCropOptions();
        state.needsRender = true;
        saveState();
        return { success: true };
      }
      case "placeStructure":
      case "placeStructureOverFarmland": {
        const isOverFarmland = resolvedAction.type === "placeStructureOverFarmland";
        const kind = resolvedAction?.kind === "landscape" ? "landscape" : "building";
        const selectionId =
          resolvedAction && resolvedAction.structureId
            ? resolvedAction.structureId
            : kind === "landscape"
              ? state.selectedLandscapeKey
              : state.selectedBuildKey;
        const selection = selectionId ? getPlacementSource(kind, selectionId) : null;
        if (!selection) return { success: false, reason: `Select a ${kind}` };
        if (!selection.unlocked) return { success: false, reason: `${kind === "landscape" ? "Landscape" : "Building"} locked` };
        const allowFilled = isOverFarmland || (kind === "landscape" && (selection.lowColor || selection.highColor));
        if (!canPlaceStructure(row, col, selection, { allowFilled })) return { success: false, reason: "Not enough space" };
        const cost = Number.isFinite(selection.cost) ? selection.cost : 0;
        if (state.totalMoney < cost) return { success: false, reason: `Need ${formatCurrency(cost)}` };

        if (isOverFarmland && world.filled.has(key)) {
          world.filled.delete(key);
          clearFarmlandTracking(key);
          const previousPlaced = state.farmlandPlaced || 0;
          if (previousPlaced > 0) state.farmlandPlaced = previousPlaced - 1;
          if (previousPlaced > 4) {
            state.totalMoney += 25;
            onMoneyChanged();
            world.costAnimations.push({ key, value: 25, start: performance.now() });
          }
          renderLandscapeOptions();
        }

        const structKey = `${row},${col}`;
        const stored = {
          id: selection.id,
          kind,
          name: selection.name,
          row,
          col,
          width: selection.width,
          height: selection.height,
          cost,
          image: kind === "landscape" ? "" : selection.image,
        };
        world.structures.set(structKey, stored);
        for (let r = 0; r < selection.height; r++) {
          for (let c = 0; c < selection.width; c++) {
            world.structureTiles.set(`${row + r},${col + c}`, structKey);
          }
        }
        triggerHydrationAroundStructure(stored);
        state.totalMoney -= cost;
        onMoneyChanged();
        state.needsRender = true;
        saveState();
        return { success: true };
      }
      case "destroyStructure": {
        const kind = resolvedAction?.kind === "landscape" ? "landscape" : "building";
        const structKey = resolvedAction?.structKey || getStructureAtKey(key);
        if (!structKey) return { success: false, reason: kind === "landscape" ? "No landscape here" : "No building here" };
        const { success, refund } = removeStructure(structKey, kind);
        if (!success) return { success: false, reason: kind === "landscape" ? "No landscape here" : "No building here" };
        if (refund > 0) {
          state.totalMoney += refund;
          onMoneyChanged();
        }
        state.needsRender = true;
        saveState();
        return { success: true };
      }
      case "replaceLandscape": {
        const kind = "landscape";
        const oldStructKey = resolvedAction?.oldStructKey;
        const oldStruct = oldStructKey ? world.structures.get(oldStructKey) : null;
        const selectionId = resolvedAction?.structureId || state.selectedLandscapeKey;
        const selection = selectionId ? getPlacementSource(kind, selectionId) : null;
        if (!selection) return { success: false, reason: "Select a landscape" };
        if (!selection.unlocked) return { success: false, reason: "Landscape locked" };
        const cost = Number.isFinite(selection.cost) ? selection.cost : 0;
        if (state.totalMoney < cost) return { success: false, reason: `Need ${formatCurrency(cost)}` };

        let farmlandRefund = 0;
        if (oldStruct) {
          const wasFarmlandId = oldStruct.id === "farmland";
          if (wasFarmlandId) {
            const previousPlaced = state.farmlandPlaced || 0;
            if (previousPlaced > 4) farmlandRefund = 25;
          }
          removeStructure(oldStructKey, kind);
        }

        const structKey = `${row},${col}`;
        const stored = {
          id: selection.id,
          kind,
          name: selection.name,
          row,
          col,
          width: selection.width,
          height: selection.height,
          cost,
          image: "",
        };
        world.structures.set(structKey, stored);
        for (let r = 0; r < selection.height; r++) {
          for (let c = 0; c < selection.width; c++) {
            world.structureTiles.set(`${row + r},${col + c}`, structKey);
          }
        }
        triggerHydrationAroundStructure(stored);
        state.totalMoney -= cost;
        if (farmlandRefund > 0) {
          state.totalMoney += farmlandRefund;
          onMoneyChanged();
          world.costAnimations.push({ key, value: farmlandRefund, start: performance.now() });
        } else {
          onMoneyChanged();
        }
        state.needsRender = true;
        renderLandscapeOptions();
        saveState();
        return { success: true };
      }
      case "replaceLandscapeWithFarmland": {
        const oldStructKey = resolvedAction?.oldStructKey;
        const oldStruct = oldStructKey ? world.structures.get(oldStructKey) : null;
        if (!oldStruct) return { success: false, reason: "No landscape here" };
        const farmlandPlaced = state.farmlandPlaced || 0;
        const cost = farmlandPlaced < 4 ? 0 : 25;
        if (cost > state.totalMoney) return { success: false, reason: `Need ${formatCurrency(cost)}` };
        if (cost > 0) {
          state.totalMoney -= cost;
          onMoneyChanged();
          world.costAnimations.push({ key, value: -cost, start: performance.now() });
        }
        removeStructure(oldStructKey, "landscape");
        world.filled.add(key);
        setFarmlandType(world, key, FARMLAND);
        cancelHydrationTimer(key);
        state.farmlandPlaced = farmlandPlaced + 1;
        state.needsRender = true;
        renderCropOptions();
        renderLandscapeOptions();
        saveState();
        return { success: true };
      }
      case "replaceLandscapeWithGrass": {
        const oldStructKey = resolvedAction?.oldStructKey;
        const oldStruct = oldStructKey ? world.structures.get(oldStructKey) : null;
        if (!oldStruct) return { success: false, reason: "No landscape here" };

        let farmlandRefund = 0;
        const wasFarmlandId = oldStruct.id === "farmland";
        if (wasFarmlandId) {
          clearFarmlandTracking(key);
          const previousPlaced = state.farmlandPlaced || 0;
          if (previousPlaced > 4) farmlandRefund = 25;
          if (previousPlaced > 0) state.farmlandPlaced = previousPlaced - 1;
        }
        removeStructure(oldStructKey, "landscape");

        if (farmlandRefund > 0) {
          state.totalMoney += farmlandRefund;
          onMoneyChanged();
          world.costAnimations.push({ key, value: farmlandRefund, start: performance.now() });
        }
        state.needsRender = true;
        renderLandscapeOptions();
        saveState();
        return { success: true };
      }
      default:
        return { success: false };
    }
  }

  return { handleTileAction };
}

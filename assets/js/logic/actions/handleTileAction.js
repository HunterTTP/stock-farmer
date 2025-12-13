import { FARMLAND, FARMLAND_SATURATED, clearFarmlandType, ensureFarmlandStates, getCropGrowTimeMs, getFarmlandType, getPlotGrowTimeMs, setFarmlandType } from "../../utils/helpers.js";
import { checkRemovalWouldBreakLimit, formatFarmlandLimitError, getFarmlandUsage } from "../farmlandLimits.js";
import { clampMoney } from "../../state/stateUtils.js";

export function buildActionHandler(context, helpers, determineActionForTile, cropOps) {
  const { state, world, config, crops, formatCurrency, onMoneyChanged, renderCropOptions, renderLandscapeOptions, saveState } = context;
  const { harvestPlot, destroyPlot, recomputeLastPlantedForCrop } = cropOps;
  const { removeStructure, getStructureAtKey, getPlacementSource, canPlaceStructure } = helpers;

  ensureFarmlandStates(world);
  const hydrationTimers = world.hydrationTimers || new Map();
  world.hydrationTimers = hydrationTimers;

  const WATER_RANGE = 2;

  const parseKey = (key) => {
    if (!key || typeof key !== "string") return { row: null, col: null };
    const [rowStr, colStr] = key.split(",");
    return { row: parseInt(rowStr, 10), col: parseInt(colStr, 10) };
  };

  const isWaterStruct = (struct) => struct && struct.kind === "landscape" && typeof struct.id === "string" && struct.id.startsWith("water");

  const distanceToStruct = (row, col, struct) => {
    if (!struct || !Number.isFinite(row) || !Number.isFinite(col)) return Number.POSITIVE_INFINITY;
    const rowMin = struct.row;
    const rowMax = struct.row + Math.max(1, struct.height || 1) - 1;
    const colMin = struct.col;
    const colMax = struct.col + Math.max(1, struct.width || 1) - 1;
    const rowDist = row < rowMin ? rowMin - row : row > rowMax ? row - rowMax : 0;
    const colDist = col < colMin ? colMin - col : col > colMax ? col - colMax : 0;
    return Math.max(rowDist, colDist);
  };

  const collectWaterStructs = () => {
    const water = [];
    if (world.structures && typeof world.structures.forEach === "function") {
      world.structures.forEach((struct) => {
        if (isWaterStruct(struct)) water.push(struct);
      });
    }
    return water;
  };

  const closestWaterDistance = (key, waterList) => {
    const { row, col } = parseKey(key);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return Number.POSITIVE_INFINITY;
    let minDist = Number.POSITIVE_INFINITY;
    (waterList || []).forEach((struct) => {
      const dist = distanceToStruct(row, col, struct);
      if (dist < minDist) minDist = dist;
    });
    return minDist;
  };

  const cancelHydrationTimer = (targetKey) => {
    if (!targetKey) return;
    const existing = hydrationTimers.get(targetKey);
    if (existing) {
      const timeoutId = typeof existing === "object" ? existing.id : existing;
      if (timeoutId) clearTimeout(timeoutId);
    }
    hydrationTimers.delete(targetKey);
  };

  const applyPlotMultiplier = (targetKey, multiplier) => {
    const plot = world.plots.get(targetKey);
    if (!plot || multiplier <= 0) return;
    const crop = crops[plot.cropKey];
    const baseGrowMs = getCropGrowTimeMs(crop);
    const prevTotal = getPlotGrowTimeMs(plot, crop) || baseGrowMs;
    if (!baseGrowMs || baseGrowMs <= 0 || !prevTotal || prevTotal <= 0) return;
    const now = Date.now();
    const elapsed = Math.max(0, now - plot.plantedAt);
    const progress = Math.min(1, elapsed / prevTotal);
    const newTotal = baseGrowMs / multiplier;
    const newElapsed = progress * newTotal;
    plot.growTimeMs = newTotal;
    plot.growMultiplier = multiplier;
    plot.plantedAt = now - newElapsed;
  };

  const applySaturationToFarmland = (targetKey) => {
    if (!targetKey || !world.filled.has(targetKey)) {
      clearFarmlandType(world, targetKey);
      cancelHydrationTimer(targetKey);
      return;
    }
    cancelHydrationTimer(targetKey);
    if (getFarmlandType(world, targetKey) === FARMLAND_SATURATED) return;
    applyPlotMultiplier(targetKey, 1.25);
    setFarmlandType(world, targetKey, FARMLAND_SATURATED);
    const plot = world.plots.get(targetKey);
    if (plot) recomputeLastPlantedForCrop(plot.cropKey);
    renderCropOptions();
    state.needsRender = true;
    saveState();
  };

  const scheduleStateChange = (targetKey, targetState, distance) => {
    if (!targetKey || !world.filled.has(targetKey)) {
      cancelHydrationTimer(targetKey);
      return;
    }
    const current = getFarmlandType(world, targetKey);
    if (current === targetState) {
      cancelHydrationTimer(targetKey);
      return;
    }
    const existing = hydrationTimers.get(targetKey);
    if (existing && existing.targetState === targetState) return;
    cancelHydrationTimer(targetKey);
    const dist = Number.isFinite(distance) ? Math.max(0, distance) : WATER_RANGE;
    const maxDelay = 4000 * Math.min(1, dist / WATER_RANGE);
    const delayMs = Math.random() * maxDelay;
    const timeoutId = setTimeout(() => {
      hydrationTimers.delete(targetKey);
      if (!world.filled.has(targetKey)) {
        clearFarmlandType(world, targetKey);
        return;
      }
      if (targetState === FARMLAND_SATURATED) {
        applySaturationToFarmland(targetKey);
      } else {
        applyPlotMultiplier(targetKey, 1.0);
        setFarmlandType(world, targetKey, FARMLAND);
        state.needsRender = true;
        saveState();
      }
    }, delayMs);
    hydrationTimers.set(targetKey, { id: timeoutId, targetState });
  };

  const scheduleHydration = (targetKey, distance) => {
    scheduleStateChange(targetKey, FARMLAND_SATURATED, distance);
  };

  const scheduleDrying = (targetKey) => {
    scheduleStateChange(targetKey, FARMLAND, WATER_RANGE);
  };

  const reevaluateFarmlandHydration = (key, waterList) => {
    if (!world.filled.has(key)) {
      clearFarmlandType(world, key);
      cancelHydrationTimer(key);
      return;
    }
    const dist = closestWaterDistance(key, waterList);
    if (dist <= WATER_RANGE) {
      scheduleHydration(key, dist);
    } else {
      scheduleDrying(key);
    }
  };

  const tickHydration = () => {
    ensureFarmlandStates(world);
    const total = world.filled?.size || 0;
    if (!total) return;
    const now = performance.now();
    const HYDRATION_TICK_MS = 180;
    const HYDRATION_BATCH = 300;
    if (!tickHydration.lastTick) tickHydration.lastTick = 0;
    if (!tickHydration.offset) tickHydration.offset = 0;
    if (now - tickHydration.lastTick < HYDRATION_TICK_MS) return;
    tickHydration.lastTick = now;

    const waterList = collectWaterStructs();
    let skip = tickHydration.offset % total;
    let processed = 0;
    let idx = 0;
    for (const key of world.filled) {
      if (idx < skip) {
        idx += 1;
        continue;
      }
      reevaluateFarmlandHydration(key, waterList);
      processed += 1;
      idx += 1;
      if (processed >= HYDRATION_BATCH) break;
    }
    tickHydration.offset = (skip + processed) % total;
  };

  const clearFarmlandTracking = (farmlandKey) => {
    cancelHydrationTimer(farmlandKey);
    clearFarmlandType(world, farmlandKey);
  };

  const syncFarmlandPlaced = () => {
    state.farmlandPlaced = world.filled ? world.filled.size : state.farmlandPlaced || 0;
  };

  const removeFarmlandArea = (startRow, startCol, width = 1, height = 1) => {
    const h = Number.isFinite(height) && height > 0 ? height : 1;
    const w = Number.isFinite(width) && width > 0 ? width : 1;
    let removed = 0;
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const farmlandKey = `${startRow + r},${startCol + c}`;
        if (world.filled.delete(farmlandKey)) {
          clearFarmlandTracking(farmlandKey);
          removed += 1;
        }
      }
    }
    if (removed > 0) syncFarmlandPlaced();
    return removed;
  };

  function handleTileAction(row, col, action) {
    if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) return { success: false, reason: "Out of bounds" };
    ensureFarmlandStates(world);
    syncFarmlandPlaced();
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
          syncFarmlandPlaced();
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
        const farmlandStatus = getFarmlandUsage(state, world, null, crops);
        if (farmlandStatus.placed >= farmlandStatus.limit) {
          return {
            success: false,
            reason: `Farmland limit reached (${farmlandStatus.placed}/${farmlandStatus.limit}).`,
          };
        }
        world.filled.add(key);
        setFarmlandType(world, key, FARMLAND);
        cancelHydrationTimer(key);
        syncFarmlandPlaced();
        reevaluateFarmlandHydration(key);
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
        const multiplier = farmlandType === FARMLAND_SATURATED ? 1.25 : 1.0;
        const growTimeMs = baseGrowMs && baseGrowMs > 0 ? baseGrowMs / multiplier : baseGrowMs;
        world.plots.set(key, {
          cropKey,
          plantedAt,
          growTimeMs,
          growMultiplier: multiplier,
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

        removeFarmlandArea(row, col, selection.width, selection.height);

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
        state.totalMoney -= cost;
        onMoneyChanged();
        renderLandscapeOptions();
        state.needsRender = true;
        saveState();
        return { success: true };
      }
      case "destroyStructure": {
        const kind = resolvedAction?.kind === "landscape" ? "landscape" : "building";
        const structKey = resolvedAction?.structKey || getStructureAtKey(key);
        if (!structKey) return { success: false, reason: kind === "landscape" ? "No landscape here" : "No building here" };
        if (kind === "building") {
          const { wouldBreakLimit, overBy, nextLimit } = checkRemovalWouldBreakLimit(world.structures, [structKey], state, world, crops);
          if (wouldBreakLimit) {
            return { success: false, reason: formatFarmlandLimitError(overBy, nextLimit) || "Reduce farmland first" };
          }
        }
        const { success, refund } = removeStructure(structKey, kind);
        if (!success) return { success: false, reason: kind === "landscape" ? "No landscape here" : "No building here" };
        if (refund > 0) {
          state.totalMoney = clampMoney(state.totalMoney + refund);
          onMoneyChanged();
        }
        renderLandscapeOptions();
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

        if (oldStruct) {
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
        state.totalMoney -= cost;
        onMoneyChanged();
        state.needsRender = true;
        renderLandscapeOptions();
        saveState();
        return { success: true };
      }
      case "replaceLandscapeWithFarmland": {
        const oldStructKey = resolvedAction?.oldStructKey;
        const oldStruct = oldStructKey ? world.structures.get(oldStructKey) : null;
        if (!oldStruct) return { success: false, reason: "No landscape here" };
        const farmlandStatus = getFarmlandUsage(state, world, null, crops);
        if (farmlandStatus.placed >= farmlandStatus.limit) {
          return {
            success: false,
            reason: `Farmland limit reached (${farmlandStatus.placed}/${farmlandStatus.limit}).`,
          };
        }
        removeStructure(oldStructKey, "landscape");
        world.filled.add(key);
        setFarmlandType(world, key, FARMLAND);
        cancelHydrationTimer(key);
        syncFarmlandPlaced();
        reevaluateFarmlandHydration(key);
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

        const wasFarmlandId = oldStruct.id === "farmland";
        if (wasFarmlandId) {
          removeFarmlandArea(oldStruct.row, oldStruct.col, oldStruct.width, oldStruct.height);
        }
        removeStructure(oldStructKey, "landscape");

        state.needsRender = true;
        renderLandscapeOptions();
        saveState();
        return { success: true };
      }
      default:
        return { success: false };
    }
  }

  return { handleTileAction, tickHydration };
}

export function createActions({
  state,
  world,
  config,
  crops,
  currentSizeOption,
  formatCurrency,
  onMoneyChanged,
  renderCropOptions,
  showAggregateMoneyChange,
  saveState,
  openConfirmModal,
  showActionError,
  tileFromClient,
}) {
  function determineActionForTile(row, col, nowMs = Date.now()) {
    if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) return { type: "none", reason: "Out of bounds" };
    const key = row + "," + col;
    const existingPlot = world.plots.get(key);
    const mode = state.activeMode || "plant";
    const isHarvestMode = mode === "harvest";
    const isBuildMode = mode === "build";
    if (isHarvestMode) {
      if (existingPlot) {
        const crop = crops[existingPlot.cropKey];
        if (crop && nowMs - existingPlot.plantedAt >= crop.growTimeMs) return { type: "harvest" };
        return { type: "none", reason: "Not ready to harvest" };
      }
      return { type: "none", reason: "Nothing to harvest" };
    }

    if (isBuildMode) return { type: "none", reason: "Building mode coming soon" };

    if (existingPlot) return { type: "none", reason: "Already planted" };
    const cropSelection = state.selectedCropKey ? crops[state.selectedCropKey] : null;
    if (!cropSelection) return { type: "none", reason: "Select a crop" };
    if (cropSelection.id === "grass") return { type: "removeFarmland" };
    if (cropSelection.id === "farmland") {
      const farmlandCrop = crops.farmland;
      if (!farmlandCrop) return { type: "none", reason: "Missing farmland crop" };
      if (world.plots.has(key) || world.filled.has(key)) return { type: "none", reason: "Tile occupied" };
      const cost = farmlandCrop.placed < 4 ? 0 : 25;
      if (cost > 0 && state.totalMoney < cost) return { type: "none", reason: "Not enough money" };
      return { type: "placeFarmland" };
    }

    const crop = cropSelection;
    if (!crop || !crop.unlocked) return { type: "none", reason: "Crop locked" };
    if (!world.filled.has(key)) return { type: "none", reason: "Need farmland first" };
    if (typeof crop.limit === "number" && crop.limit >= 0 && crop.placed >= crop.limit) return { type: "none", reason: "Crop limit reached" };
    const plantCost = typeof crop.placeCost === "number" ? crop.placeCost : 0;
    if (plantCost > 0 && state.totalMoney < plantCost) return { type: "none", reason: "Not enough money" };
    return { type: "plantCrop", cropKey: cropSelection.id };
  }

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

  function simulateTileActionForPreview(action, key, previewState, nowMs, getFilled, getPlot) {
    if (!action || action.type === "none") return false;
    switch (action.type) {
      case "harvest": {
        const existingPlot = getPlot(key);
        const plotCrop = existingPlot ? crops[existingPlot.cropKey] : null;
        if (!existingPlot || !plotCrop) return false;
        const ready = nowMs - existingPlot.plantedAt >= plotCrop.growTimeMs;
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
          if (typeof previewState.placed.farmland === "number" && previewState.placed.farmland > 0) previewState.placed.farmland -= 1;
          return true;
        }
        return false;
      }
      case "placeFarmland": {
        if (getFilled(key) || getPlot(key)) return false;
        const farmlandPlaced = typeof previewState.placed.farmland === "number" ? previewState.placed.farmland : 0;
        const farmlandCost = farmlandPlaced < 4 ? 0 : 25;
        if (previewState.money < farmlandCost) return false;
        previewState.money -= farmlandCost;
        previewState.filledAdds.add(key);
        previewState.placed.farmland = farmlandPlaced + 1;
        return true;
      }
      case "plantCrop": {
        const crop = crops[action.cropKey];
        if (!crop || !crop.unlocked) return false;
        if (getPlot(key) || !getFilled(key)) return false;
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
    const isHarvestMode = state.activeMode === "harvest";
    const baseAction = isHarvestMode ? null : determineActionForTile(baseRow, baseCol, nowMs);
    const placed = {};
    Object.values(crops).forEach((c) => {
      placed[c.id] = typeof c.placed === "number" ? Math.max(0, c.placed) : 0;
    });
    const previewState = { money: state.totalMoney, placed, filledAdds: new Set(), filledRemovals: new Set(), plotsRemoved: new Set() };
    const getFilled = (key) => {
      if (previewState.filledAdds.has(key)) return true;
      if (previewState.filledRemovals.has(key)) return false;
      return world.filled.has(key);
    };
    const getPlot = (key) => {
      if (previewState.plotsRemoved.has(key)) return null;
      return world.plots.get(key) || null;
    };
    for (let dr = 0; dr < size; dr++) {
      for (let dc = 0; dc < size; dc++) {
        const row = baseRow + dr;
        const col = baseCol + dc;
        const key = row + "," + col;
        let allowed = false;
        if (row < 0 || row >= config.gridRows || col < 0 || col >= config.gridCols) {
          results.push({ row, col, allowed });
          continue;
        }
        const actionForCell = isHarvestMode ? determineActionForTile(row, col, nowMs) : baseAction;
        allowed = simulateTileActionForPreview(actionForCell, key, previewState, nowMs, getFilled, getPlot);
        results.push({ row, col, allowed });
      }
    }
    return results;
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
    if (state.activeMode !== "harvest") return [];
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
        if (plot && crop && now - plot.plantedAt < crop.growTimeMs) targets.push(key);
      }
    }
    return targets;
  }

  function handleTileAction(row, col, action) {
    if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) return { success: false };
    const key = row + "," + col;
    const resolvedAction = action || determineActionForTile(row, col);
    if (!resolvedAction || resolvedAction.type === "none") return { success: false, reason: resolvedAction ? resolvedAction.reason : undefined };

    switch (resolvedAction.type) {
      case "harvest": {
        const existingPlot = world.plots.get(key);
        if (!existingPlot) return { success: false, reason: "Nothing to harvest" };
        const crop = crops[existingPlot.cropKey];
        if (!crop) return { success: false, reason: "Unknown crop" };
        const elapsed = Date.now() - existingPlot.plantedAt;
        if (elapsed >= crop.growTimeMs) {
          harvestPlot(key);
          return { success: true };
        }
        return { success: false, reason: "Not ready to harvest" };
      }
      case "confirmDestroy": {
        const existingPlot = world.plots.get(key);
        if (!existingPlot) return { success: false, reason: "Nothing to remove" };
        openConfirmModal("Are you sure you want to destroy this crop? No money will be earned.", () => destroyPlot(key), "Destroy Crop");
        return { success: true };
      }
      case "removeFarmland": {
        const hadFarmland = world.filled.delete(key);
        if (hadFarmland && crops.farmland) {
          const f = crops.farmland;
          const previousPlaced = f.placed || 0;
          if (typeof f.placed === "number" && f.placed > 0) f.placed -= 1;
          if (previousPlaced > 4) {
            state.totalMoney += 25;
            onMoneyChanged();
            world.costAnimations.push({ key, value: 25, start: performance.now() });
          }
        }
        state.needsRender = true;
        renderCropOptions();
        saveState();
        return { success: hadFarmland, reason: hadFarmland ? undefined : "No farmland here" };
      }
      case "placeFarmland": {
        const farmlandCrop = crops.farmland;
        if (!farmlandCrop) return { success: false, reason: "Missing farmland crop" };
        if (world.plots.has(key) || world.filled.has(key)) return { success: false, reason: "Tile occupied" };
        const cost = farmlandCrop.placed < 4 ? 0 : 25;
        if (cost > 0) {
          if (state.totalMoney < cost) return { success: false, reason: `Need ${formatCurrency(cost)} to place` };
          state.totalMoney -= cost;
          onMoneyChanged();
          world.costAnimations.push({ key, value: -cost, start: performance.now() });
        }
        world.filled.add(key);
        farmlandCrop.placed += 1;
        state.needsRender = true;
        renderCropOptions();
        saveState();
        return { success: true };
      }
      case "plantCrop": {
        const cropKey = resolvedAction && resolvedAction.cropKey ? resolvedAction.cropKey : state.selectedCropKey;
        const crop = crops[cropKey];
        if (!crop || !crop.unlocked) return { success: false, reason: "Crop locked" };
        if (world.plots.has(key)) return { success: false, reason: "Tile already planted" };
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
        world.plots.set(key, {
          cropKey,
          plantedAt,
        });
        crop.placed += 1;
        crop.lastPlantedAt = plantedAt;
        renderCropOptions();
        state.needsRender = true;
        saveState();
        return { success: true };
      }
      default:
        return { success: false };
    }
  }

  function handleTap(clientX, clientY) {
    const startMoney = state.totalMoney;
    const tile = tileFromClient(clientX, clientY);
    if (!tile) return;
    const sizeOption = currentSizeOption();
    const size = sizeOption.size || 1;
    const baseRow = tile.row;
    const baseCol = tile.col;
    const isHarvestMode = state.activeMode === "harvest";
    const baseAction = isHarvestMode ? null : determineActionForTile(baseRow, baseCol);
    let failure = null;
    let hadSuccess = false;
    for (let dr = 0; dr < size; dr++) {
      for (let dc = 0; dc < size; dc++) {
        const row = baseRow + dr;
        const col = baseCol + dc;
        const actionForCell = isHarvestMode ? determineActionForTile(row, col) : baseAction;
        const result = handleTileAction(row, col, actionForCell);
        if (result.success) {
          hadSuccess = true;
          continue;
        }
        const reason = (actionForCell && actionForCell.reason) || result.reason;
        if (!reason || failure) continue;
        failure = { reason, x: clientX, y: clientY };
      }
    }
    if (!hadSuccess && failure) showActionError(failure.reason, failure.x, failure.y);
    const delta = state.totalMoney - startMoney;
    if (delta !== 0 && typeof showAggregateMoneyChange === "function") {
      showAggregateMoneyChange(delta);
    }
  }

  return {
    determineActionForTile,
    computeHoverPreview,
    collectHoeDestroyTargets,
    handleTileAction,
    handleTap,
    destroyPlot,
  };
}

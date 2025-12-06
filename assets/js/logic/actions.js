export function createActions({
  state,
  world,
  config,
  crops,
  buildings,
  landscapes,
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
  const getStructureAtKey = (key) => world.structureTiles.get(key) || null;
  const getStructKind = (struct) => (struct && struct.kind === "landscape" ? "landscape" : "building");
  const getPlacementSource = (kind, id) =>
    kind === "landscape" ? landscapes?.[id] : buildings?.[id];

  const canPlaceStructure = (row, col, building, opts = {}) => {
    if (!building) return false;
    const width = Number.isInteger(building.width) ? building.width : 0;
    const height = Number.isInteger(building.height) ? building.height : 0;
    if (width <= 0 || height <= 0) return false;
    if (row < 0 || col < 0 || row + height > config.gridRows || col + width > config.gridCols) return false;
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const key = `${row + r},${col + c}`;
        if (world.structureTiles.has(key)) return false;
        if (!opts.allowFilled && world.plots.has(key)) return false;
        if (building.isFarmland && (world.filled.has(key) || world.plots.has(key))) return false;
      }
    }
    return true;
  };

  const removeStructure = (structKey, expectedKind = null) => {
    if (!structKey) return { success: false, refund: 0 };
    const struct = world.structures.get(structKey);
    if (!struct) return { success: false, refund: 0 };
    const kind = getStructKind(struct);
    if (expectedKind && kind !== expectedKind) return { success: false, refund: 0 };
    for (let r = 0; r < struct.height; r++) {
      for (let c = 0; c < struct.width; c++) {
        world.structureTiles.delete(`${struct.row + r},${struct.col + c}`);
      }
    }
    world.structures.delete(structKey);
    const refund = Number.isFinite(struct.cost) ? struct.cost : 0;
    return { success: true, refund, kind };
  };

  function determineActionForTile(row, col, nowMs = Date.now()) {
    if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) return { type: "none", reason: "Out of bounds" };
    const key = row + "," + col;
    const existingPlot = world.plots.get(key);
    const existingStructKey = getStructureAtKey(key);
    const mode = state.activeMode || "plant";
    const isHarvestMode = mode === "harvest";
    const isBuildMode = mode === "build";
    const isLandscapeMode = mode === "landscape";
    const isPlacementMode = isBuildMode || isLandscapeMode;
    if (isPlacementMode) {
      const kind = isLandscapeMode ? "landscape" : "building";
      const selectionKey = isLandscapeMode ? state.selectedLandscapeKey : state.selectedBuildKey;
      if (selectionKey === "sell") {
        const structKey = getStructureAtKey(key);
        const struct = structKey ? world.structures.get(structKey) : null;
        if (isLandscapeMode && !struct && world.filled.has(key)) {
          return { type: "removeFarmland" };
        }
        if (!struct || getStructKind(struct) !== kind) return { type: "none", reason: `No ${kind} here` };
        return { type: "destroyStructure", structKey, kind };
      }
      const selection = selectionKey ? getPlacementSource(kind, selectionKey) : null;
      if (!selection) return { type: "none", reason: `Select a ${kind}` };
      if (!selection.unlocked) return { type: "none", reason: `${kind === "landscape" ? "Landscape" : "Building"} locked` };

      if (world.plots.has(key)) return { type: "none", reason: "Crop growing here" };

      if (isLandscapeMode && selection.isGrass) {
        if (!world.filled.has(key)) return { type: "none", reason: "No farmland here" };
        return { type: "removeFarmland" };
      }

      if (isLandscapeMode && selection.isFarmland) {
        if (world.plots.has(key)) return { type: "none", reason: "Crop growing here" };
        const existingStructKeyForFarmland = getStructureAtKey(key);
        const existingStructForFarmland = existingStructKeyForFarmland ? world.structures.get(existingStructKeyForFarmland) : null;
        if (existingStructForFarmland && getStructKind(existingStructForFarmland) === "landscape") {
          return { type: "replaceLandscapeWithFarmland", oldStructKey: existingStructKeyForFarmland };
        }
        if (world.filled.has(key)) return { type: "none", reason: "Already farmland" };
        if (world.structureTiles.has(key)) return { type: "none", reason: "Structure here" };
        const farmlandPlaced = state.farmlandPlaced || 0;
        const cost = farmlandPlaced < 4 ? 0 : 25;
        if (cost > state.totalMoney) return { type: "none", reason: `Need ${formatCurrency(cost)}` };
        return { type: "placeFarmland" };
      }

      const existingStructKeyForReplace = getStructureAtKey(key);
      const existingStructForReplace = existingStructKeyForReplace ? world.structures.get(existingStructKeyForReplace) : null;
      if (existingStructForReplace && getStructKind(existingStructForReplace) === "landscape") {
        const cost = Number.isFinite(selection.cost) ? selection.cost : 0;
        if (cost > state.totalMoney) return { type: "none", reason: `Need ${formatCurrency(cost)}` };
        return { type: "replaceLandscape", oldStructKey: existingStructKeyForReplace, structureId: selection.id, kind, row, col };
      }

      const allowFilled = isLandscapeMode && (selection.lowColor || selection.highColor);
      if (!canPlaceStructure(row, col, selection, { allowFilled })) {
        if (allowFilled && world.filled.has(key) && !world.structureTiles.has(key) && !world.plots.has(key)) {
          return { type: "placeStructureOverFarmland", structureId: selection.id, kind, row, col };
        }
        return { type: "none", reason: "Not enough space" };
      }
      const cost = Number.isFinite(selection.cost) ? selection.cost : 0;
      if (cost > state.totalMoney) return { type: "none", reason: `Need ${formatCurrency(cost)}` };
      return { type: "placeStructure", structureId: selection.id, kind, row, col };
    }
    if (isHarvestMode) {
      if (existingPlot) {
        const crop = crops[existingPlot.cropKey];
        if (crop && nowMs - existingPlot.plantedAt >= crop.growTimeMs) return { type: "harvest" };
        return { type: "none", reason: "Not ready to harvest" };
      }
      return { type: "none", reason: "Nothing to harvest" };
    }

    if (existingStructKey) return { type: "none", reason: "Structure here" };
    if (existingPlot) return { type: "none", reason: "Already planted" };
    const cropSelection = state.selectedCropKey ? crops[state.selectedCropKey] : null;
    if (!cropSelection) return { type: "none", reason: "Select a crop" };

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
      const selection = selectedKey && selectedKey !== "sell" ? getPlacementSource(kind, selectedKey) : null;
      const fallbackSize = selectedKey === "sell" ? 1 : Math.max(1, size || 1);
      const width = Number.isInteger(selection?.width) && selection.width > 0 ? selection.width : fallbackSize;
      const height = Number.isInteger(selection?.height) && selection.height > 0 ? selection.height : fallbackSize;
      const action = determineActionForTile(baseRow, baseCol, nowMs);
      const allowed = action?.type === "placeStructure" || action?.type === "destroyStructure" || action?.type === "placeFarmland" || action?.type === "removeFarmland" || action?.type === "placeStructureOverFarmland" || action?.type === "replaceLandscape" || action?.type === "replaceLandscapeWithFarmland";
      for (let dr = 0; dr < height; dr++) {
        for (let dc = 0; dc < width; dc++) {
          results.push({ row: baseRow + dr, col: baseCol + dc, allowed });
        }
      }
      return results;
    }

    const isHarvestMode = mode === "harvest";
    const baseAction = isHarvestMode ? null : determineActionForTile(baseRow, baseCol, nowMs);
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

  function collectStructureSellTargets(baseRow, baseCol, kindOverride = null) {
    const activeKind =
      kindOverride ||
      (state.activeMode === "build"
        ? "building"
        : state.activeMode === "landscape"
          ? "landscape"
          : null);
    if (!activeKind) return [];
    const targets = new Set();
    const selectedKey =
      activeKind === "landscape" ? state.selectedLandscapeKey : state.selectedBuildKey;
    const selected = selectedKey && selectedKey !== "sell" ? getPlacementSource(activeKind, selectedKey) : null;
    const width = Number.isInteger(selected?.width) && selected.width > 0 ? selected.width : 1;
    const height = Number.isInteger(selected?.height) && selected.height > 0 ? selected.height : 1;
    for (let dr = 0; dr < height; dr++) {
      for (let dc = 0; dc < width; dc++) {
        const row = baseRow + dr;
        const col = baseCol + dc;
        if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) continue;
        const key = `${row},${col}`;
        const structKey = getStructureAtKey(key);
        if (!structKey) continue;
        const struct = world.structures.get(structKey);
        if (struct && getStructKind(struct) === activeKind) targets.add(structKey);
      }
    }
    return Array.from(targets);
  }

  function getStructureSellSummary(structKeys, kind = null) {
    const seen = new Set();
    let count = 0;
    let total = 0;
    (structKeys || []).forEach((key) => {
      if (!key || seen.has(key)) return;
      seen.add(key);
      const struct = world.structures.get(key);
      if (!struct || (kind && getStructKind(struct) !== kind)) return;
      count += 1;
      const refund = Number.isFinite(struct.cost) ? struct.cost : 0;
      total += refund;
    });
    return { count, total };
  }

  function sellStructures(structKeys, kind = null) {
    const seen = new Set();
    let sold = 0;
    let totalRefund = 0;
    (structKeys || []).forEach((key) => {
      if (!key || seen.has(key)) return;
      seen.add(key);
      const result = removeStructure(key, kind || undefined);
      if (result.success) {
        sold += 1;
        totalRefund += result.refund;
      }
    });
    if (sold > 0) {
      if (totalRefund > 0) {
        state.totalMoney += totalRefund;
        onMoneyChanged();
      }
      state.needsRender = true;
      saveState();
    }
    return { sold, totalRefund };
  }

  function promptSellStructures(structKeys, kind = null) {
    const summary = getStructureSellSummary(structKeys, kind || undefined);
    if (!summary.count) return;
    const singleLabel =
      kind === "landscape" ? "landscape tile" : "building";
    const pluralLabel =
      kind === "landscape" ? "landscape tiles" : "buildings";
    const label = summary.count === 1 ? singleLabel : pluralLabel;
    const priceText = formatCurrency(summary.total || 0);
    openConfirmModal(
      `Sell ${summary.count} ${label} for ${priceText}?`,
      () => sellStructures(structKeys, kind || undefined),
      kind === "landscape" ? "Sell Landscapes" : "Sell Buildings",
      null,
      { confirmVariant: "danger", confirmText: "Sell" }
    );
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
        if (hadFarmland) {
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
        state.farmlandPlaced = farmlandPlaced + 1;
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
          const previousPlaced = state.farmlandPlaced || 0;
          if (previousPlaced > 0) state.farmlandPlaced = previousPlaced - 1;
          if (previousPlaced > 4) {
            state.totalMoney += 25;
            onMoneyChanged();
            world.costAnimations.push({ key, value: 25, start: performance.now() });
          }
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
        state.totalMoney -= cost;
        if (farmlandRefund > 0) {
          state.totalMoney += farmlandRefund;
          world.costAnimations.push({ key, value: farmlandRefund, start: performance.now() });
        }
        onMoneyChanged();
        state.needsRender = true;
        saveState();
        return { success: true };
      }
      case "replaceLandscapeWithFarmland": {
        const oldStructKey = resolvedAction?.oldStructKey;
        const oldStruct = oldStructKey ? world.structures.get(oldStructKey) : null;
        if (!oldStruct) return { success: false, reason: "No landscape here" };

        let farmlandRefund = 0;
        const wasFarmlandId = oldStruct.id === "farmland";
        if (wasFarmlandId) {
          const previousPlaced = state.farmlandPlaced || 0;
          if (previousPlaced > 4) farmlandRefund = 25;
        }
        removeStructure(oldStructKey, "landscape");

        const farmlandPlaced = state.farmlandPlaced || 0;
        const cost = farmlandPlaced < 4 ? 0 : 25;
        if (cost > 0) {
          if (state.totalMoney < cost) return { success: false, reason: `Need ${formatCurrency(cost)} to place` };
          state.totalMoney -= cost;
          world.costAnimations.push({ key, value: -cost, start: performance.now() });
        }
        if (farmlandRefund > 0) {
          state.totalMoney += farmlandRefund;
          world.costAnimations.push({ key, value: farmlandRefund, start: performance.now() });
        }
        world.filled.add(key);
        state.farmlandPlaced = farmlandPlaced + 1;
        onMoneyChanged();
        state.needsRender = true;
        renderCropOptions();
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
    const isPlacementMode = state.activeMode === "build" || state.activeMode === "landscape";
    const size = isPlacementMode ? 1 : sizeOption.size || 1;
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
    collectStructureSellTargets,
    promptSellStructures,
    handleTileAction,
    handleTap,
    destroyPlot,
  };
}

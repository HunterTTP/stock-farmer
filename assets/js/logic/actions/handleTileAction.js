export function buildActionHandler(context, helpers, determineActionForTile, cropOps) {
  const { state, world, config, crops, formatCurrency, onMoneyChanged, renderCropOptions, renderLandscapeOptions, saveState } = context;
  const { harvestPlot, destroyPlot, recomputeLastPlantedForCrop } = cropOps;
  const { removeStructure, getStructKind, getStructureAtKey, getPlacementSource, canPlaceStructure } = helpers;
  const getCropGrowTimeMs = (crop) => {
    if (!crop) return 0;
    if (Number.isFinite(crop.growTimeMs)) return crop.growTimeMs;
    if (Number.isFinite(crop.growMinutes)) return crop.growMinutes * 60 * 1000;
    return 0;
  };

  function handleTileAction(row, col, action) {
    if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) return { success: false, reason: "Out of bounds" };
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
        const growMs = getCropGrowTimeMs(crop);
        const elapsed = Number.isFinite(plantedAt) ? Date.now() - plantedAt : 0;
        if (elapsed >= growMs) {
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

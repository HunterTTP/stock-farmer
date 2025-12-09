import { getPlotGrowTimeMs } from "../../utils/helpers.js";
import { checkRemovalWouldBreakLimit, formatFarmlandLimitError, getFarmlandUsage } from "../farmlandLimits.js";

export function buildDetermineAction(context, helpers) {
  const { state, world, config, crops, formatCurrency } = context;
  const { getStructureAtKey, getStructKind, getPlacementSource, canPlaceStructure } = helpers;

  function determineActionForTile(row, col, nowMs = Date.now()) {
    if (row < 0 || col < 0 || row >= config.gridRows || col >= config.gridCols) return { type: "none", reason: "Out of bounds" };
    const key = row + "," + col;
    const existingPlot = world.plots.get(key);
    const existingStructKey = getStructureAtKey(key);
    const mode = state.activeMode || "plant";
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
        if (kind === "building") {
          const { wouldBreakLimit, overBy, nextLimit } = checkRemovalWouldBreakLimit(world.structures, [structKey], state, world, crops);
          if (wouldBreakLimit) {
            return { type: "none", reason: formatFarmlandLimitError(overBy, nextLimit) || "Reduce farmland first" };
          }
        }
        return { type: "destroyStructure", structKey, kind };
      }
      const selection = selectionKey ? getPlacementSource(kind, selectionKey) : null;
      if (!selection) return { type: "none", reason: `Select a ${kind}` };
      if (!selection.unlocked) return { type: "none", reason: `${kind === "landscape" ? "Landscape" : "Building"} locked` };

      if (world.plots.has(key)) return { type: "none", reason: "Crop growing here" };

      if (isLandscapeMode && selection.isGrass) {
        const existingStructKeyForGrass = getStructureAtKey(key);
        const existingStructForGrass = existingStructKeyForGrass ? world.structures.get(existingStructKeyForGrass) : null;
        if (existingStructForGrass && getStructKind(existingStructForGrass) === "landscape") {
          return { type: "replaceLandscapeWithGrass", oldStructKey: existingStructKeyForGrass };
        }
        if (!world.filled.has(key)) return { type: "none", reason: "Nothing here" };
        return { type: "removeFarmland" };
      }

      if (isLandscapeMode && selection.isFarmland) {
        if (world.plots.has(key)) return { type: "none", reason: "Crop growing here" };
        const existingStructKeyForFarmland = getStructureAtKey(key);
        const existingStructForFarmland = existingStructKeyForFarmland ? world.structures.get(existingStructKeyForFarmland) : null;
        const structKind = existingStructForFarmland ? getStructKind(existingStructForFarmland) : null;
        if (structKind === "building") return { type: "none", reason: "Structure here" };
        if (world.filled.has(key)) return { type: "none", reason: "Already farmland" };
        const farmlandStatus = getFarmlandUsage(state, world, null, crops);
        if (farmlandStatus.placed >= farmlandStatus.limit) {
          return {
            type: "none",
            reason: `Farmland limit reached (${farmlandStatus.placed}/${farmlandStatus.limit}).`,
          };
        }
        if (existingStructForFarmland && structKind === "landscape") {
          return { type: "replaceLandscapeWithFarmland", oldStructKey: existingStructKeyForFarmland };
        }
        if (world.structureTiles.has(key)) return { type: "none", reason: "Structure here" };
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

    if (existingStructKey) return { type: "none", reason: "Structure here" };
    if (existingPlot) {
      const crop = crops[existingPlot.cropKey];
      const plantedAt = Number(existingPlot.plantedAt);
      const growMs = getPlotGrowTimeMs(existingPlot, crop);
      if (crop && Number.isFinite(plantedAt) && (growMs <= 0 || nowMs - plantedAt >= growMs)) {
        return { type: "harvest" };
      }
      return { type: "none", reason: "Already planted" };
    }
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

  return { determineActionForTile };
}

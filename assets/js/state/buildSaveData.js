import { cleanPlotValue, cleanStockHoldings, cleanStructureValue, isKeyInBounds } from "./stateUtils.js";
import { FARMLAND_SATURATED, ensureFarmlandStates } from "../utils/helpers.js";

export function buildSaveData({ state, world, crops, sizes, landscapes = {}, config }) {
  const previousUpdatedAt = Number.isFinite(state.lastSavedAt) ? state.lastSavedAt : 0;
  const updatedAt = Date.now();
  ensureFarmlandStates(world);

  const plots = Array.from(world.plots.entries())
    .filter(([key]) => isKeyInBounds(key, config))
    .map(([key, value]) => {
      const cleaned = cleanPlotValue(value);
      return [key, cleaned];
    });

  const data = {
    totalMoney: state.totalMoney,
    stockHoldings: cleanStockHoldings(state.stockHoldings),
    filled: Array.from(world.filled).filter((k) => isKeyInBounds(k, config)),
    saturatedFarmland: world.farmlandStates
      ? Array.from(world.farmlandStates.entries())
          .filter(([key, type]) => type === FARMLAND_SATURATED && isKeyInBounds(key, config))
          .map(([key]) => key)
      : [],
    plots,
    selectedCropKey: state.selectedCropKey,
    previousCropKey: state.previousCropKey,
    selectedSizeKey: state.selectedSizeKey,
    activeMode: state.activeMode,
    scale: state.scale,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    cropsUnlocked: Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, c.unlocked])),
    sizesUnlocked: Object.fromEntries(Object.entries(sizes).map(([id, t]) => [id, t.unlocked])),
    landscapesUnlocked: Object.fromEntries(Object.entries(landscapes || {}).map(([id, l]) => [id, l.unlocked])),
    cropLimits: Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, typeof c.limit === "number" ? c.limit : -1])),
    structures: Array.from(world.structures.entries())
      .map(([key, value]) => [key, cleanStructureValue({ ...value, key }, config)])
      .filter(([, value]) => !!value),
    previousUpdatedAt,
    updatedAt,
    selectedBuildKey: state.selectedBuildKey || null,
    selectedLandscapeKey: state.selectedLandscapeKey || null,
    farmlandPlaced: state.farmlandPlaced || 0,
    accentColor: state.accentColor || null,
    hudDockScale: state.hudDockScale || 1.0,
    hudDropdownScale: state.hudDropdownScale || 1.0,
    hudFontSize: state.hudFontSize || 1.0,
    hudFontOverrideEnabled: !!state.hudFontOverrideEnabled,
    hudOpacity: typeof state.hudOpacity === "number" ? state.hudOpacity : 1.0,
  };

  state.lastSavedAt = updatedAt;

  console.log("[save] buildSaveData", {
    filled: data.filled.length,
    plots: data.plots.length,
    sample: data.plots.length ? data.plots[0][0] : null,
  });

  return data;
}

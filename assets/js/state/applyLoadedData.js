import {
  cleanPlotValue,
  cleanStockHoldings,
  cleanStructureValue,
  isKeyInBounds,
  normalizeBuildKey,
  normalizeLandscapeKey,
} from "./stateUtils.js";
import { ensureFarmlandStates, FARMLAND_SATURATED, setFarmlandType } from "../utils/helpers.js";

export function applyLoadedData(data, { state, world, crops, sizes, landscapes = {}, config }) {
  if (!data || typeof data !== "object") return;
  if (world.structures && typeof world.structures.clear === "function") world.structures.clear();
  if (world.structureTiles && typeof world.structureTiles.clear === "function") world.structureTiles.clear();
  if (world.farmlandStates && typeof world.farmlandStates.clear === "function") world.farmlandStates.clear();
  if (!world.farmlandStates) world.farmlandStates = new Map();
  if (world.hydrationTimers?.forEach) {
    world.hydrationTimers.forEach((id) => clearTimeout(id));
    world.hydrationTimers.clear();
  } else {
    world.hydrationTimers = new Map();
  }
  console.log("[load] applyLoadedData start", {
    filled: Array.isArray(data.filled) ? data.filled.length : 0,
    plots: Array.isArray(data.plots) ? data.plots.length : 0,
  });

  if (typeof data.totalMoney === "number") state.totalMoney = data.totalMoney;
  if (Number.isFinite(data.updatedAt)) state.lastSavedAt = data.updatedAt;
  if (data.stockHoldings) state.stockHoldings = cleanStockHoldings(data.stockHoldings);

  if (Array.isArray(data.filled)) {
    world.filled.clear();
    data.filled.forEach((k) => {
      if (isKeyInBounds(k, config)) world.filled.add(k);
    });
  }
  ensureFarmlandStates(world);
  if (Array.isArray(data.saturatedFarmland)) {
    data.saturatedFarmland.forEach((k) => {
      if (isKeyInBounds(k, config) && world.filled.has(k)) setFarmlandType(world, k, FARMLAND_SATURATED);
    });
  }

  if (Array.isArray(data.plots)) {
    world.plots.clear();
    data.plots.forEach(([key, value]) => {
      if (isKeyInBounds(key, config)) world.plots.set(key, cleanPlotValue(value));
    });
  }

  if (Array.isArray(data.structures)) {
    world.structures.clear();
    world.structureTiles.clear();
    data.structures.forEach(([key, value]) => {
      const cleaned = cleanStructureValue({ ...(value || {}), key }, config);
      if (!cleaned) return;
      const structKey = key || `${cleaned.row},${cleaned.col}`;
      world.structures.set(structKey, cleaned);
      for (let r = 0; r < cleaned.height; r++) {
        for (let c = 0; c < cleaned.width; c++) {
          world.structureTiles.set(`${cleaned.row + r},${cleaned.col + c}`, structKey);
        }
      }
    });
  }

  if (data.cropsUnlocked) {
    Object.entries(data.cropsUnlocked).forEach(([id, unlocked]) => {
      if (crops[id]) crops[id].unlocked = !!unlocked;
    });
  }
  // Ensure first crop is always unlocked (starter crop)
  const firstCropKey = Object.keys(crops)[0];
  if (firstCropKey && crops[firstCropKey]) {
    crops[firstCropKey].unlocked = true;
  }

  const sizeUnlockData = data.sizesUnlocked || data.toolsUnlocked;
  if (sizeUnlockData) {
    Object.entries(sizeUnlockData).forEach(([id, unlocked]) => {
      if (sizes[id]) sizes[id].unlocked = !!unlocked;
    });
  }

  if (data.landscapesUnlocked) {
    Object.entries(data.landscapesUnlocked).forEach(([id, unlocked]) => {
      if (landscapes[id]) landscapes[id].unlocked = !!unlocked;
    });
  }

  if (data.cropLimits) {
    Object.entries(data.cropLimits).forEach(([id, limit]) => {
      if (crops[id] && typeof limit === "number") crops[id].limit = limit;
    });
  }

  if (typeof data.accentColor === "string") {
    state.accentColor = data.accentColor;
  }
  if (Number.isFinite(data.hudDockScale)) {
    state.hudDockScale = data.hudDockScale;
  } else if (Number.isFinite(data.hudScale)) {
    state.hudDockScale = data.hudScale;
  }
  if (Number.isFinite(data.hudDropdownScale)) {
    state.hudDropdownScale = data.hudDropdownScale;
  } else if (Number.isFinite(data.hudScale)) {
    state.hudDropdownScale = data.hudScale;
  }
  if (Number.isFinite(data.hudFontSize)) {
    state.hudFontSize = data.hudFontSize;
  }
  if (Number.isFinite(data.hudOpacity)) {
    state.hudOpacity = data.hudOpacity;
  } else if (typeof data.hudVisible === "boolean") {
    state.hudOpacity = data.hudVisible ? 1.0 : 0.0;
  }

  if (Object.prototype.hasOwnProperty.call(data, "selectedCropKey")) {
    if (data.selectedCropKey && crops[data.selectedCropKey]) state.selectedCropKey = data.selectedCropKey;
    else if (data.selectedCropKey === null) state.selectedCropKey = null;
  }

  if (data.previousCropKey && crops[data.previousCropKey]) state.previousCropKey = data.previousCropKey;
  state.selectedStockKey = null;
  if (data.selectedSizeKey && sizes[data.selectedSizeKey]) state.selectedSizeKey = data.selectedSizeKey;
  else if (data.selectedToolKey && sizes[data.selectedToolKey]) state.selectedSizeKey = data.selectedToolKey;
  const savedBuildKey = normalizeBuildKey(data.selectedBuildKey);
  if (savedBuildKey) state.selectedBuildKey = savedBuildKey;
  const savedLandscapeKey = normalizeLandscapeKey(data.selectedLandscapeKey);
  if (savedLandscapeKey && (!landscapes[savedLandscapeKey] || !landscapes[savedLandscapeKey].hidden)) state.selectedLandscapeKey = savedLandscapeKey;

  state.showTickerInfo = false;
  state.showPctInfo = false;
  state.showSellInfo = false;
  const savedMode = typeof data.activeMode === "string" ? data.activeMode : null;
  if (savedMode === "plant" || savedMode === "build" || savedMode === "landscape") {
    state.activeMode = savedMode;
  } else {
    state.activeMode = "plant";
  }
  if (Number.isFinite(data.scale)) state.savedScaleFromState = data.scale;
  if (Number.isFinite(data.offsetX)) state.savedOffsetX = data.offsetX;
  if (Number.isFinite(data.offsetY)) state.savedOffsetY = data.offsetY;

  if (state.selectedCropKey && crops[state.selectedCropKey]) {
    state.previousCropKey = state.selectedCropKey;
  }

  state.needsRender = true;
  if (Number.isFinite(data.farmlandPlaced)) state.farmlandPlaced = data.farmlandPlaced;
  else state.farmlandPlaced = world.filled.size;
  console.log("[load] applyLoadedData done", {
    filled: world.filled.size,
    plots: world.plots.size,
  });
}

export function createInitialState(config) {
  return {
    tileSize: config.baseTileSize,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    defaultScale: 1,
    dragStart: { x: 0, y: 0 },
    dragOffsetStart: { x: 0, y: 0 },
    isDragging: false,
    activePointers: new Map(),
    isPinching: false,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    pinchCenter: { x: 0, y: 0 },
    tapStart: null,
    hoverTile: null,
    needsRender: true,
    firstResizeDone: false,
    savedScaleFromState: null,
    savedOffsetX: null,
    savedOffsetY: null,
    viewDirty: false,
    totalMoney: 0,
    showStats: true,
    selectedCropKey: "wheat",
    previousCropKey: "wheat",
    selectedStockKey: "SP500",
    selectedSizeKey: "single",
    hoeSelected: false,
    hoeHoldTimeoutId: null,
    hoeHoldTriggered: false,
  };
}

export function createInitialWorld(config) {
  return {
    plots: new Map(),
    filled: new Set(config.defaultFilled),
    harvestAnimations: [],
    costAnimations: [],
  };
}

export function applyDefaultSelection(state) {
  state.selectedCropKey = "wheat";
  state.previousCropKey = "wheat";
  state.selectedStockKey = "SP500";
  state.selectedSizeKey = "single";
  state.hoeSelected = false;
}

export function recalcPlacedCounts(world, crops) {
  Object.values(crops).forEach((c) => {
    c.placed = 0;
  });
  if (crops.farmland) {
    crops.farmland.placed = world.filled.size;
  }
  world.plots.forEach((plot) => {
    const crop = crops[plot.cropKey];
    if (crop) crop.placed += 1;
  });
}

export function saveState({ state, world, crops, sizes, config }) {
  const data = buildSaveData({ state, world, crops, sizes });
  try {
    localStorage.setItem(config.saveKey, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save state", err);
  }
}

export function loadState({ state, world, crops, stocks, sizes, config }) {
  let raw;
  try {
    raw = localStorage.getItem(config.saveKey);
  } catch (err) {
    console.error("Failed to read state", err);
    return;
  }
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (typeof data.totalMoney === "number") state.totalMoney = data.totalMoney;

    if (Array.isArray(data.filled)) {
      world.filled.clear();
      data.filled.forEach((k) => world.filled.add(k));
    }

    if (Array.isArray(data.plots)) {
      world.plots.clear();
      data.plots.forEach(([key, value]) => {
        world.plots.set(key, value);
      });
    }

    if (data.cropsUnlocked) {
      Object.entries(data.cropsUnlocked).forEach(([id, unlocked]) => {
        if (crops[id]) crops[id].unlocked = !!unlocked;
      });
    }

    const sizeUnlockData = data.sizesUnlocked || data.toolsUnlocked;
    if (sizeUnlockData) {
      Object.entries(sizeUnlockData).forEach(([id, unlocked]) => {
        if (sizes[id]) sizes[id].unlocked = !!unlocked;
      });
    }

    if (data.cropLimits) {
      Object.entries(data.cropLimits).forEach(([id, limit]) => {
        if (crops[id] && typeof limit === "number") crops[id].limit = limit;
      });
    }

    if (Object.prototype.hasOwnProperty.call(data, "selectedCropKey")) {
      if (data.selectedCropKey && crops[data.selectedCropKey]) state.selectedCropKey = data.selectedCropKey;
      else if (data.selectedCropKey === null) state.selectedCropKey = null;
    }

    if (data.previousCropKey && crops[data.previousCropKey]) state.previousCropKey = data.previousCropKey;
    if (data.selectedStockKey && stocks[data.selectedStockKey]) state.selectedStockKey = data.selectedStockKey;
    if (data.selectedSizeKey && sizes[data.selectedSizeKey]) state.selectedSizeKey = data.selectedSizeKey;
    else if (data.selectedToolKey && sizes[data.selectedToolKey]) state.selectedSizeKey = data.selectedToolKey;

    if (typeof data.showStats === "boolean") state.showStats = data.showStats;
    if (typeof data.hoeSelected === "boolean") state.hoeSelected = data.hoeSelected;
    if (Number.isFinite(data.scale)) state.savedScaleFromState = data.scale;
    if (Number.isFinite(data.offsetX)) state.savedOffsetX = data.offsetX;
    if (Number.isFinite(data.offsetY)) state.savedOffsetY = data.offsetY;

    if (!state.hoeSelected && state.selectedCropKey && crops[state.selectedCropKey]) {
      state.previousCropKey = state.selectedCropKey;
    }

    state.needsRender = true;
  } catch (err) {
    console.error("State load failed", err);
  }
}

export function buildSaveData({ state, world, crops, sizes }) {
  return {
    totalMoney: state.totalMoney,
    filled: Array.from(world.filled),
    plots: Array.from(world.plots.entries()),
    selectedCropKey: state.selectedCropKey,
    previousCropKey: state.previousCropKey,
    selectedStockKey: state.selectedStockKey,
    selectedSizeKey: state.selectedSizeKey,
    hoeSelected: state.hoeSelected,
    showStats: state.showStats,
    scale: state.scale,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    cropsUnlocked: Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, c.unlocked])),
    sizesUnlocked: Object.fromEntries(Object.entries(sizes).map(([id, t]) => [id, t.unlocked])),
    cropLimits: Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, typeof c.limit === "number" ? c.limit : -1])),
  };
}

export function applyLoadedData(data, { state, world, crops, stocks, sizes }) {
  if (!data || typeof data !== "object") return;

  if (typeof data.totalMoney === "number") state.totalMoney = data.totalMoney;

  if (Array.isArray(data.filled)) {
    world.filled.clear();
    data.filled.forEach((k) => world.filled.add(k));
  }

  if (Array.isArray(data.plots)) {
    world.plots.clear();
    data.plots.forEach(([key, value]) => {
      world.plots.set(key, value);
    });
  }

  if (data.cropsUnlocked) {
    Object.entries(data.cropsUnlocked).forEach(([id, unlocked]) => {
      if (crops[id]) crops[id].unlocked = !!unlocked;
    });
  }

  const sizeUnlockData = data.sizesUnlocked || data.toolsUnlocked;
  if (sizeUnlockData) {
    Object.entries(sizeUnlockData).forEach(([id, unlocked]) => {
      if (sizes[id]) sizes[id].unlocked = !!unlocked;
    });
  }

  if (data.cropLimits) {
    Object.entries(data.cropLimits).forEach(([id, limit]) => {
      if (crops[id] && typeof limit === "number") crops[id].limit = limit;
    });
  }

  if (Object.prototype.hasOwnProperty.call(data, "selectedCropKey")) {
    if (data.selectedCropKey && crops[data.selectedCropKey]) state.selectedCropKey = data.selectedCropKey;
    else if (data.selectedCropKey === null) state.selectedCropKey = null;
  }

  if (data.previousCropKey && crops[data.previousCropKey]) state.previousCropKey = data.previousCropKey;
  if (data.selectedStockKey && stocks[data.selectedStockKey]) state.selectedStockKey = data.selectedStockKey;
  if (data.selectedSizeKey && sizes[data.selectedSizeKey]) state.selectedSizeKey = data.selectedSizeKey;
  else if (data.selectedToolKey && sizes[data.selectedToolKey]) state.selectedSizeKey = data.selectedToolKey;

  if (typeof data.showStats === "boolean") state.showStats = data.showStats;
  if (typeof data.hoeSelected === "boolean") state.hoeSelected = data.hoeSelected;
  if (Number.isFinite(data.scale)) state.savedScaleFromState = data.scale;
  if (Number.isFinite(data.offsetX)) state.savedOffsetX = data.offsetX;
  if (Number.isFinite(data.offsetY)) state.savedOffsetY = data.offsetY;

  if (!state.hoeSelected && state.selectedCropKey && crops[state.selectedCropKey]) {
    state.previousCropKey = state.selectedCropKey;
  }

  state.needsRender = true;
}

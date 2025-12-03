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
    totalMoney: 0,
    showStats: true,
    showTickerInfo: true,
    showPctInfo: true,
    showTimerInfo: true,
    showSellInfo: true,
    statBaseSize: 14,
    statTextAlpha: 1,
    statBgAlpha: 1,
    activeMode: "plant",
    selectedCropKey: "wheat",
    previousCropKey: "wheat",
    selectedStockKey: "SP500",
    selectedSizeKey: "single",
    hoeSelected: false,
    hoeHoldTimeoutId: null,
    hoeHoldTriggered: false,
    lastSavedAt: 0,
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
  state.activeMode = "plant";
  state.hoeSelected = false;
  state.showTickerInfo = true;
  state.showPctInfo = true;
  state.showTimerInfo = true;
  state.showSellInfo = true;
  state.statBaseSize = 14;
  state.statTextAlpha = 1;
  state.statBgAlpha = 1;
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
  return data;
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
    if (Number.isFinite(data.updatedAt)) state.lastSavedAt = data.updatedAt;

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
    const legacyStock = typeof data.showStockInfo === "boolean" ? data.showStockInfo : undefined;
    state.showTickerInfo =
      typeof data.showTickerInfo === "boolean" ? data.showTickerInfo : legacyStock ?? state.showStats;
    state.showPctInfo = typeof data.showPctInfo === "boolean" ? data.showPctInfo : state.showStats;
    state.showTimerInfo = typeof data.showTimerInfo === "boolean" ? data.showTimerInfo : state.showStats;
    state.showSellInfo = typeof data.showSellInfo === "boolean" ? data.showSellInfo : state.showStats;
    state.showStats = state.showTickerInfo || state.showPctInfo || state.showTimerInfo || state.showSellInfo;
    state.statBaseSize = typeof data.statBaseSize === "number" ? data.statBaseSize : 14;
    state.statTextAlpha = typeof data.statTextAlpha === "number" ? Math.min(1, Math.max(0, data.statTextAlpha)) : 1;
    state.statBgAlpha = typeof data.statBgAlpha === "number" ? Math.min(1, Math.max(0, data.statBgAlpha)) : 1;
    const savedMode = typeof data.activeMode === "string" ? data.activeMode : null;
    if (savedMode === "plant" || savedMode === "harvest" || savedMode === "build") {
      state.activeMode = savedMode;
    } else if (typeof data.hoeSelected === "boolean" && data.hoeSelected) {
      state.activeMode = "harvest";
    } else {
      state.activeMode = "plant";
    }
    state.hoeSelected = state.activeMode === "harvest";
    if (Number.isFinite(data.scale)) state.savedScaleFromState = data.scale;
    if (Number.isFinite(data.offsetX)) state.savedOffsetX = data.offsetX;
    if (Number.isFinite(data.offsetY)) state.savedOffsetY = data.offsetY;

    if (state.activeMode !== "harvest" && state.selectedCropKey && crops[state.selectedCropKey]) {
      state.previousCropKey = state.selectedCropKey;
    }

    state.needsRender = true;
  } catch (err) {
    console.error("State load failed", err);
  }
}

export function buildSaveData({ state, world, crops, sizes }) {
  const previousUpdatedAt = Number.isFinite(state.lastSavedAt) ? state.lastSavedAt : 0;
  const updatedAt = Date.now();
  const plots = Array.from(world.plots.entries()).map(([key, value]) => {
    const stageBreakpoints = Array.isArray(value?.stageBreakpoints) ? value.stageBreakpoints : [];
    const cleaned = {
      cropKey: value?.cropKey || null,
      stockKey: value?.stockKey || null,
      plantedAt: typeof value?.plantedAt === "number" ? value.plantedAt : Date.now(),
      stockPriceAtPlant: typeof value?.stockPriceAtPlant === "number" ? value.stockPriceAtPlant : 0,
      lockedStockPrice: value?.lockedStockPrice ?? null,
      stageBreakpoints,
    };
    return [key, cleaned];
  });

  const data = {
    totalMoney: state.totalMoney,
    filled: Array.from(world.filled),
    plots,
    selectedCropKey: state.selectedCropKey,
    previousCropKey: state.previousCropKey,
    selectedStockKey: state.selectedStockKey,
    selectedSizeKey: state.selectedSizeKey,
    activeMode: state.activeMode,
    hoeSelected: state.activeMode === "harvest",
    showStats: state.showStats,
    showTickerInfo: state.showTickerInfo,
    showPctInfo: state.showPctInfo,
    showTimerInfo: state.showTimerInfo,
    showSellInfo: state.showSellInfo,
    statBaseSize: state.statBaseSize,
    statTextAlpha: state.statTextAlpha,
    statBgAlpha: state.statBgAlpha,
    scale: state.scale,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    cropsUnlocked: Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, c.unlocked])),
    sizesUnlocked: Object.fromEntries(Object.entries(sizes).map(([id, t]) => [id, t.unlocked])),
    cropLimits: Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, typeof c.limit === "number" ? c.limit : -1])),
    previousUpdatedAt,
    updatedAt,
  };

  state.lastSavedAt = updatedAt;

  console.log("[save] buildSaveData", {
    filled: data.filled.length,
    plots: data.plots.length,
    sample: data.plots.length ? data.plots[0][0] : null,
  });

  return data;
}

export function applyLoadedData(data, { state, world, crops, stocks, sizes }) {
  if (!data || typeof data !== "object") return;
  console.log("[load] applyLoadedData start", {
    filled: Array.isArray(data.filled) ? data.filled.length : 0,
    plots: Array.isArray(data.plots) ? data.plots.length : 0,
  });

  if (typeof data.totalMoney === "number") state.totalMoney = data.totalMoney;
  if (Number.isFinite(data.updatedAt)) state.lastSavedAt = data.updatedAt;

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
  const legacyStock = typeof data.showStockInfo === "boolean" ? data.showStockInfo : undefined;
  state.showTickerInfo =
    typeof data.showTickerInfo === "boolean" ? data.showTickerInfo : legacyStock ?? state.showStats;
  state.showPctInfo = typeof data.showPctInfo === "boolean" ? data.showPctInfo : state.showStats;
  state.showTimerInfo = typeof data.showTimerInfo === "boolean" ? data.showTimerInfo : state.showStats;
  state.showSellInfo = typeof data.showSellInfo === "boolean" ? data.showSellInfo : state.showStats;
  state.showStats = state.showTickerInfo || state.showPctInfo || state.showTimerInfo || state.showSellInfo;
  state.statBaseSize = typeof data.statBaseSize === "number" ? data.statBaseSize : 14;
  state.statTextAlpha = typeof data.statTextAlpha === "number" ? Math.min(1, Math.max(0, data.statTextAlpha)) : 1;
  state.statBgAlpha = typeof data.statBgAlpha === "number" ? Math.min(1, Math.max(0, data.statBgAlpha)) : 1;
  const savedMode = typeof data.activeMode === "string" ? data.activeMode : null;
  if (savedMode === "plant" || savedMode === "harvest" || savedMode === "build") {
    state.activeMode = savedMode;
  } else if (typeof data.hoeSelected === "boolean" && data.hoeSelected) {
    state.activeMode = "harvest";
  } else {
    state.activeMode = "plant";
  }
  state.hoeSelected = state.activeMode === "harvest";
  if (Number.isFinite(data.scale)) state.savedScaleFromState = data.scale;
  if (Number.isFinite(data.offsetX)) state.savedOffsetX = data.offsetX;
  if (Number.isFinite(data.offsetY)) state.savedOffsetY = data.offsetY;

  if (state.activeMode !== "harvest" && state.selectedCropKey && crops[state.selectedCropKey]) {
    state.previousCropKey = state.selectedCropKey;
  }

  state.needsRender = true;
  console.log("[load] applyLoadedData done", {
    filled: world.filled.size,
    plots: world.plots.size,
  });
}

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
    stockHoldings: {},
    showStats: false,
    showTimerInfo: false,
    showTickerInfo: false,
    showPctInfo: false,
    showSellInfo: false,
    statBaseSize: 14,
    statTextAlpha: 1,
    statBgAlpha: 1,
    activeMode: "plant",
    selectedCropKey: "wheat",
    previousCropKey: "wheat",
    selectedStockKey: null,
    selectedSizeKey: "single",
    hoeSelected: false,
    hoeHoldTimeoutId: null,
    hoeHoldTriggered: false,
    lastSavedAt: 0,
    selectedBuildKey: null,
  };
}

export function createInitialWorld(config) {
  return {
    plots: new Map(),
    filled: new Set(config.defaultFilled),
    harvestAnimations: [],
    costAnimations: [],
    structures: new Map(),
    structureTiles: new Map(),
  };
}

function isKeyInBounds(key, config) {
  if (!config || typeof config.gridRows !== "number" || typeof config.gridCols !== "number") return true;
  if (typeof key !== "string") return false;
  const [rowStr, colStr] = key.split(",");
  const row = parseInt(rowStr, 10);
  const col = parseInt(colStr, 10);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  return row >= 0 && row < config.gridRows && col >= 0 && col < config.gridCols;
}

export function applyDefaultSelection(state) {
  state.selectedCropKey = "wheat";
  state.previousCropKey = "wheat";
  state.selectedStockKey = null;
  state.stockHoldings = {};
  state.selectedSizeKey = "single";
  state.selectedBuildKey = null;
  state.activeMode = "plant";
  state.hoeSelected = false;
  state.showTickerInfo = false;
  state.showPctInfo = false;
  state.showTimerInfo = false;
  state.showSellInfo = false;
  state.showStats = false;
  state.statBaseSize = 14;
  state.statTextAlpha = 1;
  state.statBgAlpha = 1;
}

export function recalcPlacedCounts(world, crops) {
  Object.values(crops).forEach((c) => {
    c.placed = 0;
    c.lastPlantedAt = null;
  });
  if (crops.farmland) {
    crops.farmland.placed = world.filled.size;
  }
  world.plots.forEach((plot) => {
    const crop = crops[plot.cropKey];
    if (crop) {
      crop.placed += 1;
      const plantedAt = Number(plot?.plantedAt);
      if (Number.isFinite(plantedAt) && (crop.lastPlantedAt === null || plantedAt > crop.lastPlantedAt)) {
        crop.lastPlantedAt = plantedAt;
      }
    }
  });
}

export function saveState({ state, world, crops, sizes, config }) {
  const data = buildSaveData({ state, world, crops, sizes, config });
  try {
    localStorage.setItem(config.saveKey, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save state", err);
  }
  return data;
}

function cleanPlotValue(value) {
  const plantedAt = typeof value?.plantedAt === "number" ? value.plantedAt : Date.now();
  return {
    cropKey: value?.cropKey || null,
    plantedAt,
  };
}

function isFootprintInBounds(row, col, width, height, config) {
  if (!config || typeof config.gridRows !== "number" || typeof config.gridCols !== "number") return true;
  if (![row, col, width, height].every(Number.isInteger)) return false;
  if (width <= 0 || height <= 0) return false;
  return row >= 0 && col >= 0 && row + height <= config.gridRows && col + width <= config.gridCols;
}

function cleanStructureValue(value, config) {
  if (!value || typeof value !== "object") return null;
  const row = Number.isInteger(value.row) ? value.row : null;
  const col = Number.isInteger(value.col) ? value.col : null;
  const width = Number.isInteger(value.width) ? value.width : null;
  const height = Number.isInteger(value.height) ? value.height : null;
  if (row === null || col === null || width === null || height === null) return null;
  if (!isFootprintInBounds(row, col, width, height, config)) return null;
  return {
    id: typeof value.id === "string" ? value.id : null,
    name: typeof value.name === "string" ? value.name : "",
    row,
    col,
    width,
    height,
    cost: Number.isFinite(value.cost) ? value.cost : 0,
    image: typeof value.image === "string" ? value.image : "",
  };
}

function clampShares(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function cleanStockHoldings(raw) {
  const cleaned = {};
  if (!raw || typeof raw !== "object") return cleaned;
  Object.entries(raw).forEach(([sym, lots]) => {
    if (!Array.isArray(lots)) return;
    const filtered = lots
      .map((lot) => ({
        shares: clampShares(lot?.shares),
        price: Number.isFinite(lot?.price) ? lot.price : 0,
      }))
      .filter((lot) => lot.shares > 0 && Number.isFinite(lot.price));
    if (filtered.length) cleaned[sym] = filtered;
  });
  return cleaned;
}

export function loadState({ state, world, crops, sizes, config }) {
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
    if (world.structures && typeof world.structures.clear === "function") world.structures.clear();
    if (world.structureTiles && typeof world.structureTiles.clear === "function") world.structureTiles.clear();
    if (typeof data.totalMoney === "number") state.totalMoney = data.totalMoney;
    if (Number.isFinite(data.updatedAt)) state.lastSavedAt = data.updatedAt;
    if (data.stockHoldings) state.stockHoldings = cleanStockHoldings(data.stockHoldings);

    if (Array.isArray(data.filled)) {
      world.filled.clear();
      data.filled.forEach((k) => {
        if (isKeyInBounds(k, config)) world.filled.add(k);
      });
    }

    if (Array.isArray(data.plots)) {
      world.plots.clear();
      data.plots.forEach(([key, value]) => {
        if (isKeyInBounds(key, config)) world.plots.set(key, cleanPlotValue(value));
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
    if (data.selectedStockKey) state.selectedStockKey = null;
    if (data.selectedSizeKey && sizes[data.selectedSizeKey]) state.selectedSizeKey = data.selectedSizeKey;
    else if (data.selectedToolKey && sizes[data.selectedToolKey]) state.selectedSizeKey = data.selectedToolKey;
    if (typeof data.selectedBuildKey === "string") state.selectedBuildKey = data.selectedBuildKey;

    const legacyStock = typeof data.showStockInfo === "boolean" ? data.showStockInfo : undefined;
    const legacyStats = typeof data.showStats === "boolean" ? data.showStats : legacyStock;
    state.showTimerInfo = typeof data.showTimerInfo === "boolean" ? data.showTimerInfo : !!legacyStats;
    state.showTickerInfo = false;
    state.showPctInfo = false;
    state.showSellInfo = false;
    state.showStats = !!state.showTimerInfo;
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

export function buildSaveData({ state, world, crops, sizes, config }) {
  const previousUpdatedAt = Number.isFinite(state.lastSavedAt) ? state.lastSavedAt : 0;
  const updatedAt = Date.now();
  const showTimer = !!state.showTimerInfo;
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
    plots,
    selectedCropKey: state.selectedCropKey,
    previousCropKey: state.previousCropKey,
    selectedSizeKey: state.selectedSizeKey,
    activeMode: state.activeMode,
    hoeSelected: state.activeMode === "harvest",
    showStats: showTimer,
    showTimerInfo: showTimer,
    statBaseSize: state.statBaseSize,
    statTextAlpha: state.statTextAlpha,
    statBgAlpha: state.statBgAlpha,
    scale: state.scale,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    cropsUnlocked: Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, c.unlocked])),
    sizesUnlocked: Object.fromEntries(Object.entries(sizes).map(([id, t]) => [id, t.unlocked])),
    cropLimits: Object.fromEntries(Object.entries(crops).map(([id, c]) => [id, typeof c.limit === "number" ? c.limit : -1])),
    structures: Array.from(world.structures.entries())
      .map(([key, value]) => [key, cleanStructureValue({ ...value, key }, config)])
      .filter(([, value]) => !!value),
    previousUpdatedAt,
    updatedAt,
    selectedBuildKey: state.selectedBuildKey || null,
  };

  state.lastSavedAt = updatedAt;

  console.log("[save] buildSaveData", {
    filled: data.filled.length,
    plots: data.plots.length,
    sample: data.plots.length ? data.plots[0][0] : null,
  });

  return data;
}

export function applyLoadedData(data, { state, world, crops, sizes, config }) {
  if (!data || typeof data !== "object") return;
  if (world.structures && typeof world.structures.clear === "function") world.structures.clear();
  if (world.structureTiles && typeof world.structureTiles.clear === "function") world.structureTiles.clear();
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
  state.selectedStockKey = null;
  if (data.selectedSizeKey && sizes[data.selectedSizeKey]) state.selectedSizeKey = data.selectedSizeKey;
  else if (data.selectedToolKey && sizes[data.selectedToolKey]) state.selectedSizeKey = data.selectedToolKey;
  if (typeof data.selectedBuildKey === "string") state.selectedBuildKey = data.selectedBuildKey;

  const legacyStock = typeof data.showStockInfo === "boolean" ? data.showStockInfo : undefined;
  const legacyStats = typeof data.showStats === "boolean" ? data.showStats : legacyStock;
  state.showTimerInfo = typeof data.showTimerInfo === "boolean" ? data.showTimerInfo : !!legacyStats;
  state.showTickerInfo = false;
  state.showPctInfo = false;
  state.showSellInfo = false;
  state.showStats = !!state.showTimerInfo;
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

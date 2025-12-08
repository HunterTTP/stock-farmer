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
    isDragPending: false,
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

    activeMode: "plant",
    selectedCropKey: "carrot",
    previousCropKey: "carrot",
    selectedStockKey: null,
    selectedSizeKey: "single",
    buildingHoldTimeoutId: null,
    buildingHoldTriggered: false,
    lastSavedAt: 0,
    selectedBuildKey: null,
    selectedLandscapeKey: null,
    farmlandPlaced: 0,
    accentColor: null,
    hudDockScale: 1.0,
    hudDropdownScale: 1.0,
    hudFontSize: 1.0,
    hudOpacity: 0.95,
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

export function applyDefaultSelection(state) {
  state.selectedCropKey = "carrot";
  state.previousCropKey = "carrot";
  state.selectedStockKey = null;
  state.stockHoldings = {};
  state.selectedSizeKey = "single";
  state.selectedBuildKey = null;
  state.activeMode = "plant";
  state.buildingHoldTimeoutId = null;
  state.buildingHoldTriggered = false;
  state.showTickerInfo = false;
  state.showPctInfo = false;
  state.showSellInfo = false;
  state.selectedLandscapeKey = null;
}

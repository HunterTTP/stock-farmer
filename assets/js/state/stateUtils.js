function isKeyInBounds(key, config) {
  if (!config || typeof config.gridRows !== "number" || typeof config.gridCols !== "number") return true;
  if (typeof key !== "string") return false;
  const [rowStr, colStr] = key.split(",");
  const row = parseInt(rowStr, 10);
  const col = parseInt(colStr, 10);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
  return row >= 0 && row < config.gridRows && col >= 0 && col < config.gridCols;
}

function isFootprintInBounds(row, col, width, height, config) {
  if (!config || typeof config.gridRows !== "number" || typeof config.gridCols !== "number") return true;
  if (![row, col, width, height].every(Number.isInteger)) return false;
  if (width <= 0 || height <= 0) return false;
  return row >= 0 && col >= 0 && row + height <= config.gridRows && col + width <= config.gridCols;
}

function normalizeStructureKind(kind) {
  if (kind === "landscape") return "landscape";
  return "building";
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
    kind: normalizeStructureKind(value.kind),
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

function normalizeBuildKey(value) {
  if (value === "destroy") return "sell";
  return typeof value === "string" ? value : null;
}

function normalizeLandscapeKey(value) {
  return normalizeBuildKey(value);
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

function cleanPlotValue(value) {
  const plantedAt = typeof value?.plantedAt === "number" ? value.plantedAt : Date.now();
  const growTimeMs = Number.isFinite(value?.growTimeMs) ? value.growTimeMs : null;
  const cleaned = {
    cropKey: value?.cropKey || null,
    plantedAt,
  };
  if (Number.isFinite(growTimeMs)) cleaned.growTimeMs = growTimeMs;
  return cleaned;
}

export {
  cleanPlotValue,
  cleanStockHoldings,
  cleanStructureValue,
  clampShares,
  isFootprintInBounds,
  isKeyInBounds,
  normalizeBuildKey,
  normalizeLandscapeKey,
  normalizeStructureKind,
};

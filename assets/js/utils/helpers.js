export function formatCurrency(amount, allowCents = true) {
  const rounded = Math.round(amount * 100) / 100;
  if (allowCents) {
    return "$" + rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return "$" + Math.round(rounded).toLocaleString();
}

export function cropImageSrc(cropId) {
  if (cropId === "grass") return "images/grass.jpg";
  if (cropId === "farmland") return "images/farmland.jpg";
  if (cropId === "farmland_saturated") return "images/farmland_saturated.jpg";
  if (cropId) return `images/crops/${cropId}/${cropId}-phase-4.png`;
  return "images/grass.jpg";
}

export const FARMLAND = "farmland";
export const FARMLAND_SATURATED = "farmland_saturated";

export function getCropGrowTimeMs(crop) {
  if (!crop) return 0;
  if (Number.isFinite(crop.growTimeMs)) return crop.growTimeMs;
  if (Number.isFinite(crop.growMinutes)) return crop.growMinutes * 60 * 1000;
  return 0;
}

export function getPlotGrowTimeMs(plot, crop) {
  if (plot && Number.isFinite(plot.growTimeMs)) return plot.growTimeMs;
  return getCropGrowTimeMs(crop);
}

export function getFarmlandType(world, key) {
  if (!world || !key || !world.filled || !world.filled.has(key)) return null;
  return (world.farmlandStates && world.farmlandStates.get(key)) || FARMLAND;
}

export function setFarmlandType(world, key, type = FARMLAND) {
  if (!world || !key) return;
  if (!world.farmlandStates) world.farmlandStates = new Map();
  if (!world.filled || !world.filled.has(key)) {
    world.farmlandStates.delete(key);
    return;
  }
  const normalized = type === FARMLAND_SATURATED ? FARMLAND_SATURATED : FARMLAND;
  world.farmlandStates.set(key, normalized);
}

export function clearFarmlandType(world, key) {
  if (world?.farmlandStates) world.farmlandStates.delete(key);
}

export function ensureFarmlandStates(world) {
  if (!world) return;
  if (!world.farmlandStates) world.farmlandStates = new Map();
  if (world.filled && typeof world.filled.forEach === "function") {
    world.filled.forEach((k) => {
      if (!world.farmlandStates.has(k)) world.farmlandStates.set(k, FARMLAND);
    });
  }
  if (world.farmlandStates && world.filled) {
    Array.from(world.farmlandStates.keys()).forEach((k) => {
      if (!world.filled.has(k)) world.farmlandStates.delete(k);
    });
  }
}


export function clampScale(scale, minScale, maxScale) {
  return Math.min(maxScale, Math.max(minScale, scale));
}

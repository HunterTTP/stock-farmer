export const BASE_FARMLAND_LIMIT = 4;

export function getBuildingGrowSpeedBoost(struct = null, buildingsData = null) {
  if (!struct) return 0;
  if (struct.kind && struct.kind !== "building") return 0;
  if (Number.isFinite(struct.growSpeedBoost)) return struct.growSpeedBoost;
  if (buildingsData && struct.id && buildingsData[struct.id]) {
    const bData = buildingsData[struct.id];
    if (Number.isFinite(bData.growSpeedBoost)) return bData.growSpeedBoost;
  }
  return 0;
}

export function computeTotalBuildingGrowSpeedBoost(structures = null, buildingsData = null) {
  let totalBoost = 0;
  if (structures && typeof structures.forEach === "function") {
    structures.forEach((struct) => {
      totalBoost += getBuildingGrowSpeedBoost(struct, buildingsData);
    });
  }
  return totalBoost;
}

export function getBuildingPlacedCount(buildingId, structures = null) {
  if (!buildingId || !structures) return 0;
  let count = 0;
  if (typeof structures.forEach === "function") {
    structures.forEach((struct) => {
      if (struct && struct.id === buildingId && (!struct.kind || struct.kind === "building")) {
        count += 1;
      }
    });
  }
  return count;
}

export function getCropFarmlandBoost(crops = null) {
  if (!crops) return 0;
  const values = Array.isArray(crops) ? crops : Object.values(crops);
  let total = 0;
  values.forEach((c) => {
    if (c && c.unlocked && Number.isFinite(c.tilesUnlocked)) {
      total += c.tilesUnlocked;
    }
  });
  return total;
}

export function computeFarmlandLimit(structures = null, crops = null, baseLimit = BASE_FARMLAND_LIMIT) {
  const limit = baseLimit + getCropFarmlandBoost(crops);
  return Math.max(baseLimit, limit);
}

export function getFarmlandPlaced(state, world) {
  const filledCount = world?.filled ? world.filled.size : null;
  if (Number.isFinite(filledCount)) return Math.max(0, filledCount);
  if (state && Number.isFinite(state.farmlandPlaced)) return Math.max(0, state.farmlandPlaced);
  return 0;
}

export function getFarmlandUsage(state, world, structures = null, crops = null) {
  const placed = getFarmlandPlaced(state, world);
  const limit = computeFarmlandLimit(structures || world?.structures, crops);
  return { placed, limit, remaining: limit - placed };
}

export function formatFarmlandLimitError(overBy, nextLimit = null) {
  if (!Number.isFinite(overBy) || overBy <= 0) return "";
  const tileLabel = overBy === 1 ? "tile" : "tiles";
  if (Number.isFinite(nextLimit)) {
    return `Remove ${overBy} farmland ${tileLabel} first (limit ${nextLimit}).`;
  }
  return `Remove ${overBy} farmland ${tileLabel} first.`;
}

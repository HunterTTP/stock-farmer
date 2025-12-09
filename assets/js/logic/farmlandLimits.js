export const BASE_FARMLAND_LIMIT = 4;
export const FARMLAND_DOLLARS_PER_TILE = 1000;
export const CROP_UNLOCK_FARMLAND_BONUS = 2;

export function getBuildingFarmlandBoost(struct = null) {
  if (!struct) return 0;
  if (struct.kind && struct.kind !== "building") return 0;
  const cost = Number.isFinite(struct.cost) ? struct.cost : 0;
  return Math.max(0, Math.floor(cost / FARMLAND_DOLLARS_PER_TILE));
}

export function getCropFarmlandBoost(crops = null) {
  if (!crops) return 0;
  const values = Array.isArray(crops) ? crops : Object.values(crops);
  let count = 0;
  values.forEach((c) => {
    if (c && c.unlocked) count += 1;
  });
  const bonusEligible = Math.max(0, count - 1); // First crop is your starter; bonuses apply after that.
  return bonusEligible * CROP_UNLOCK_FARMLAND_BONUS;
}

export function computeFarmlandLimit(structures = null, crops = null, baseLimit = BASE_FARMLAND_LIMIT) {
  let limit = baseLimit + getCropFarmlandBoost(crops);
  if (structures && typeof structures.forEach === "function") {
    structures.forEach((struct) => {
      limit += getBuildingFarmlandBoost(struct);
    });
  }
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

export function getLimitAfterRemoval(structures = null, keysToRemove = null, crops = null) {
  const currentLimit = computeFarmlandLimit(structures, crops);
  if (!structures || !keysToRemove || keysToRemove.length === 0) return currentLimit;
  const targets = new Set(keysToRemove);
  let lost = 0;
  structures.forEach((struct, key) => {
    if (targets.has(key)) lost += getBuildingFarmlandBoost(struct);
  });
  return Math.max(BASE_FARMLAND_LIMIT + getCropFarmlandBoost(crops), currentLimit - lost);
}

export function checkRemovalWouldBreakLimit(structures, keysToRemove, state, world, crops = null) {
  const placed = getFarmlandPlaced(state, world);
  const nextLimit = getLimitAfterRemoval(structures, keysToRemove, crops);
  const overBy = Math.max(0, placed - nextLimit);
  return { overBy, nextLimit, wouldBreakLimit: overBy > 0 };
}

export function formatFarmlandLimitError(overBy, nextLimit = null) {
  if (!Number.isFinite(overBy) || overBy <= 0) return "";
  const tileLabel = overBy === 1 ? "tile" : "tiles";
  if (Number.isFinite(nextLimit)) {
    return `Remove ${overBy} farmland ${tileLabel} first (limit ${nextLimit}).`;
  }
  return `Remove ${overBy} farmland ${tileLabel} first.`;
}

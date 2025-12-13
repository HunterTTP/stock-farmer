import { FARMLAND_SATURATED, getFarmlandType, getCropGrowTimeMs } from "../utils/helpers.js";
import { computeTotalBuildingGrowSpeedBoost } from "./farmlandLimits.js";

export function getGrowSpeedMultiplier(world, buildings, key) {
    const buildingBoostPercent = computeTotalBuildingGrowSpeedBoost(world?.structures, buildings);
    const buildingMultiplier = 1 + buildingBoostPercent / 100;
    const isSaturated = key ? getFarmlandType(world, key) === FARMLAND_SATURATED : false;
    const saturationMultiplier = isSaturated ? 1.25 : 1.0;
    return buildingMultiplier * saturationMultiplier;
}

export function getEffectiveGrowTimeMs(crop, multiplier) {
    const baseGrowMs = getCropGrowTimeMs(crop);
    if (!baseGrowMs || baseGrowMs <= 0 || !multiplier || multiplier <= 0) return baseGrowMs;
    return baseGrowMs / multiplier;
}

export function getPlotProgress(plot, crop, multiplier, nowMs = Date.now()) {
    if (!plot || !crop) return 0;
    const effectiveGrowMs = getEffectiveGrowTimeMs(crop, multiplier);
    if (!effectiveGrowMs || effectiveGrowMs <= 0) return 1;
    const plantedAt = Number(plot.plantedAt);
    if (!Number.isFinite(plantedAt)) return 0;
    const elapsed = Math.max(0, nowMs - plantedAt);
    return Math.min(1, elapsed / effectiveGrowMs);
}

export function getRemainingGrowTimeMs(plot, crop, multiplier, nowMs = Date.now()) {
    if (!plot || !crop) return 0;
    const effectiveGrowMs = getEffectiveGrowTimeMs(crop, multiplier);
    if (!effectiveGrowMs || effectiveGrowMs <= 0) return 0;
    const plantedAt = Number(plot.plantedAt);
    if (!Number.isFinite(plantedAt)) return effectiveGrowMs;
    const elapsed = Math.max(0, nowMs - plantedAt);
    return Math.max(0, effectiveGrowMs - elapsed);
}

export function isPlotReady(plot, crop, multiplier, nowMs = Date.now()) {
    return getPlotProgress(plot, crop, multiplier, nowMs) >= 1;
}

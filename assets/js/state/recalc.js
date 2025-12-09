import { getPlotGrowTimeMs } from "../utils/helpers.js";

export function recalcPlacedCounts(world, crops, state) {
  Object.values(crops).forEach((c) => {
    c.placed = 0;
    c.lastPlantedAt = null;
    c.lastPlantedGrowMs = null;
  });
  if (state) {
    state.farmlandPlaced = world.filled.size;
  }
  world.plots.forEach((plot) => {
    const crop = crops[plot.cropKey];
    if (crop) {
      crop.placed += 1;
      const plantedAt = Number(plot?.plantedAt);
      const growMs = getPlotGrowTimeMs(plot, crop);
      if (Number.isFinite(plantedAt) && (crop.lastPlantedAt === null || plantedAt > crop.lastPlantedAt)) {
        crop.lastPlantedAt = plantedAt;
        crop.lastPlantedGrowMs = Number.isFinite(growMs) ? growMs : crop.lastPlantedGrowMs;
      }
    }
  });
}

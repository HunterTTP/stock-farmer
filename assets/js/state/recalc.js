export function recalcPlacedCounts(world, crops, state) {
  Object.values(crops).forEach((c) => {
    c.placed = 0;
    c.lastPlantedAt = null;
  });
  if (state) {
    state.farmlandPlaced = world.filled.size;
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

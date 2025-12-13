export function recalcPlacedCounts(world, crops, state) {
  Object.values(crops).forEach((c) => {
    c.placed = 0;
  });
  if (state) {
    state.farmlandPlaced = world.filled.size;
  }
  world.plots.forEach((plot) => {
    const crop = crops[plot.cropKey];
    if (crop) {
      crop.placed += 1;
    }
  });
}

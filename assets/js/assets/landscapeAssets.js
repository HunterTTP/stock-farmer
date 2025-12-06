function mixColors(c1, c2, t) {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t),
  };
}

function createWaterTileAsset({ lowColor, highColor } = {}) {
  const TILE_SIZE = 20;
  const ROWS = 48;
  const COLS = 48;
  const LOOP_DURATION = 5;
  const CYCLES_PER_LOOP = 2;
  // Default palette matches the provided example; variants override below.
  const low = lowColor || { r: 40, g: 132, b: 189 };
  const high = highColor || { r: 108, g: 179, b: 224 };

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = COLS * TILE_SIZE;
  canvas.height = ROWS * TILE_SIZE;
  ctx.imageSmoothingEnabled = false;
  const cellSize = TILE_SIZE;
  const rows = ROWS;
  const cols = COLS;

  const phases = new Float32Array(rows * cols);
  for (let i = 0; i < phases.length; i += 1) phases[i] = Math.random();
  const baseTime = performance.now();

  const update = (nowPerf = performance.now()) => {
    const elapsed = (nowPerf - baseTime) / 1000;
    const tNorm = (elapsed % LOOP_DURATION) / LOOP_DURATION;
    const cycles = Math.max(CYCLES_PER_LOOP, 1);

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const idx = y * cols + x;
        const arg = 2 * Math.PI * (cycles * tNorm + phases[idx]);
        const v = 0.5 + 0.5 * Math.sin(arg);
        const c = mixColors(low, high, v);
        ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
        ctx.fillRect(Math.floor(x * cellSize), Math.floor(y * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
      }
    }
  };

  update();

  return {
    canvas,
    update,
    animated: true,
    getPreviewSrc: () => canvas.toDataURL("image/png"),
  };
}

export function createLandscapeAssets({ landscapes, state } = {}) {
  const assets = {};
  Object.values(landscapes || {}).forEach((land) => {
    if (!land || !land.id) return;
    if (land.id.startsWith("water")) {
      const water = createWaterTileAsset({
        lowColor: land.lowColor,
        highColor: land.highColor,
      });
      assets[land.id] = water;
      land.image = water.getPreviewSrc();
    }
  });
  if (state) state.needsRender = true;
  return assets;
}

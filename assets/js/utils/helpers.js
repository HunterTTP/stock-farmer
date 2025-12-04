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
  if (cropId) return `images/crops/${cropId}/${cropId}-phase-4.png`;
  return "images/grass.jpg";
}

export function createRandomStageBreakpoints(growTimeMs) {
  // First phase change should feel quick: anywhere from instant to within ~2 minutes.
  const totalMs = Number.isFinite(growTimeMs) && growTimeMs > 0 ? growTimeMs : null;
  const maxFirstMs = 2 * 60 * 1000;
  const maxFirstFraction = totalMs ? Math.min(1, maxFirstMs / totalMs) : 0.25;
  const cappedFirstFraction = Math.min(maxFirstFraction, 0.4);
  const first = Math.random() * cappedFirstFraction;

  // Later stages stay spaced out reasonably far apart.
  const minSecond = Math.max(first + 0.1, 0.4);
  const maxSecond = 0.95;
  const second = Math.min(maxSecond, minSecond + Math.random() * (maxSecond - minSecond));

  return [first, Math.max(second, first + 0.05)];
}

export function clampScale(scale, minScale, maxScale) {
  return Math.min(maxScale, Math.max(minScale, scale));
}

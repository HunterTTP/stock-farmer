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

export function createRandomStageBreakpoints() {
  const a = Math.random() * 0.6 + 0.1;
  const b = Math.random() * 0.2 + 0.75;
  return [Math.min(a, b - 0.05), b];
}

export function clampScale(scale, minScale, maxScale) {
  return Math.min(maxScale, Math.max(minScale, scale));
}

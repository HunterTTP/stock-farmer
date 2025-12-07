export function createDrawUtils({ ctx, COLORS, hexToRgba, state }) {
  const imageCache = {};

  const drawRoundedRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  const drawModeIcon = (cx, cy, size, mode, isActive) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = isActive ? COLORS.accent : COLORS.text;
    ctx.lineWidth = 2;

    if (mode === "plant") {
      ctx.beginPath();
      ctx.moveTo(-2, 6);
      ctx.quadraticCurveTo(-8, 4, -10, -2);
      ctx.quadraticCurveTo(-4, -1, 0, 4);
      ctx.quadraticCurveTo(4, -1, 10, -2);
      ctx.quadraticCurveTo(8, 4, 2, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(0, 10);
      ctx.stroke();
    } else if (mode === "harvest") {
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.moveTo(8, -8);
      ctx.lineTo(-8, 8);
      ctx.stroke();
    } else if (mode === "landscape") {
      ctx.beginPath();
      ctx.moveTo(-10, 6);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-2, 6);
      ctx.lineTo(2, -2);
      ctx.lineTo(6, 6);
      ctx.lineTo(10, 0);
      ctx.stroke();
    } else if (mode === "build") {
      ctx.strokeRect(-8, -4, 16, 12);
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(0, -10);
      ctx.lineTo(10, -4);
      ctx.stroke();
    } else if (mode === "trade") {
      ctx.beginPath();
      ctx.moveTo(-8, 4);
      ctx.lineTo(-4, -4);
      ctx.lineTo(0, 2);
      ctx.lineTo(4, -6);
      ctx.lineTo(8, 0);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawChevron = (x, y, size, isOpen) => {
    ctx.save();
    ctx.strokeStyle = COLORS.textSecondary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (isOpen) {
      ctx.moveTo(x - size, y + size * 0.5);
      ctx.lineTo(x, y - size * 0.5);
      ctx.lineTo(x + size, y + size * 0.5);
    } else {
      ctx.moveTo(x - size, y - size * 0.5);
      ctx.lineTo(x, y + size * 0.5);
      ctx.lineTo(x + size, y - size * 0.5);
    }
    ctx.stroke();
    ctx.restore();
  };

  const getOrLoadImage = (src) => {
    if (!src) return null;
    if (imageCache[src]) return imageCache[src];
    const img = new Image();
    img.src = src;
    img.onload = () => {
      state.needsRender = true;
    };
    imageCache[src] = img;
    return img;
  };

  const drawPreviewImage = (x, y, size, imageSrc, colorData) => {
    const radius = 4;
    const padding = 1;

    ctx.save();
    drawRoundedRect(x, y, size, size, radius);
    ctx.fillStyle = "rgba(64, 64, 64, 0.8)";
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundedRect(x, y, size, size, radius);
    ctx.clip();

    const innerX = x + padding;
    const innerY = y + padding;
    const innerSize = size - padding * 2;

    if (imageSrc) {
      const img = getOrLoadImage(imageSrc);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, innerX, innerY, innerSize, innerSize);
      }
    } else if (colorData) {
      const gradient = ctx.createLinearGradient(innerX, innerY, innerX + innerSize, innerY + innerSize);
      gradient.addColorStop(0, colorData);
      gradient.addColorStop(1, colorData);
      ctx.fillStyle = gradient;
      ctx.fillRect(innerX, innerY, innerSize, innerSize);
    }

    ctx.restore();
  };

  const drawGridIcon = (x, y, size, gridSize) => {
    const cell = size / gridSize;
    ctx.save();
    ctx.strokeStyle = COLORS.textSecondary;
    ctx.lineWidth = 1;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        ctx.strokeRect(x + c * cell + 0.5, y + r * cell + 0.5, cell - 1, cell - 1);
      }
    }
    ctx.restore();
  };

  const drawTrashIcon = (x, y, size) => {
    ctx.save();
    ctx.strokeStyle = COLORS.textSecondary;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.rect(x + size * 0.25, y + size * 0.3, size * 0.5, size * 0.6);
    ctx.moveTo(x + size * 0.2, y + size * 0.3);
    ctx.lineTo(x + size * 0.8, y + size * 0.3);
    ctx.moveTo(x + size * 0.35, y + size * 0.2);
    ctx.lineTo(x + size * 0.65, y + size * 0.2);
    ctx.stroke();
    ctx.restore();
  };

  const drawDollarIcon = (x, y, size) => {
    ctx.save();
    ctx.fillStyle = COLORS.accent;
    ctx.font = `bold ${size * 0.75}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("$", x + size / 2, y + size / 2);
    ctx.restore();
  };

  return {
    drawRoundedRect,
    drawModeIcon,
    drawChevron,
    getOrLoadImage,
    drawPreviewImage,
    drawGridIcon,
    drawTrashIcon,
    drawDollarIcon,
  };
}

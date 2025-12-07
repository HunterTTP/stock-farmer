const MODE_ICONS = {
  plant: "\uf4d8",
  landscape: "\uf1bb",
  build: "\uf6e3",
  trade: "\uf201",
};

export function createDrawUtils({ ctx, COLORS, hexToRgba, state }) {
  const imageCache = {};

  const drawFaIcon = (glyph, x, y, size, color = COLORS.text, weight = 900) => {
    if (!glyph) return;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px 'Font Awesome 6 Free'`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(glyph, x + size / 2, y + size / 2 + 0.5);
    ctx.restore();
  };

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
    const glyph = MODE_ICONS[mode] || MODE_ICONS.trade;
    drawFaIcon(glyph, cx - size / 2, cy - size / 2, size, isActive ? COLORS.accent : COLORS.text);
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

  const drawSquaresIcon = (x, y, size, gridSize) => {
    const cell = size / gridSize;
    const inset = 1;
    ctx.save();
    ctx.fillStyle = COLORS.accent;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const sx = x + c * cell + inset;
        const sy = y + r * cell + inset;
        const s = cell - inset * 2;
        ctx.fillRect(sx, sy, s, s);
      }
    }
    ctx.restore();
  };

  const drawPreviewImage = (x, y, size, imageSrc, colorData, faGlyph = null, gridSize = null, faWeight = 900) => {
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

    if (faGlyph) {
      drawFaIcon(faGlyph, innerX, innerY, innerSize, COLORS.text, faWeight);
    } else if (Number.isInteger(gridSize) && gridSize > 0) {
      drawSquaresIcon(innerX, innerY, innerSize, Math.max(1, gridSize));
    } else if (imageSrc) {
      const img = getOrLoadImage(imageSrc);
      if (img && img.complete && img.naturalWidth > 0) {
        const ratio = Math.min(innerSize / img.width, innerSize / img.height);
        const targetW = img.width * ratio;
        const targetH = img.height * ratio;
        const dx = innerX + (innerSize - targetW) / 2;
        const dy = innerY + (innerSize - targetH) / 2;
        ctx.drawImage(img, dx, dy, targetW, targetH);
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
    drawFaIcon,
    drawSquaresIcon,
  };
}

export function createToolbarRenderer({ ctx, COLORS, state, hudState, layoutManager, menuData, drawUtils, formatCurrency, hexToRgba }) {
  const { drawRoundedRect, drawModeIcon, drawChevron, drawPreviewImage, drawGridIcon, drawTrashIcon, drawDollarIcon } = drawUtils;

  const drawToolbar = () => {
    const computed = hudState.layout;
    if (!computed) return;
    const { toolbar, layout, showDockText } = computed;

    ctx.save();
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;

    drawRoundedRect(toolbar.x, toolbar.y, toolbar.width, toolbar.height, 14);
    ctx.fillStyle = COLORS.toolbarBg;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = COLORS.toolbarBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    if (showDockText) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.font = `600 ${layout.fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = COLORS.textSecondary;
      ctx.fillText("Modes", toolbar.x + toolbar.width / 2, toolbar.y - 6);
      ctx.restore();
    }
  };

  const drawButton = (btn, isActive, isHover, isPressed) => {
    const radius = 12 * (hudState.layout?.dockScale || 1);

    ctx.save();
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;

    drawRoundedRect(btn.x, btn.y, btn.width, btn.height, radius);
    ctx.fillStyle = isActive ? COLORS.buttonActive : COLORS.buttonBg;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = isActive ? COLORS.buttonActiveBorder : COLORS.buttonBorder;
    ctx.lineWidth = isPressed ? 2 : 1.5;
    ctx.stroke();

    ctx.restore();

    const scale = hudState.layout?.dockScale || 1;
    const iconSize = (hudState.layout?.layout?.iconSize || 22) * scale;
    const cx = btn.x + btn.width / 2;
    const cy = btn.y + btn.height / 2;

    drawModeIcon(cx, cy, iconSize, btn.mode, isActive);

  };

  const drawDropdown = (dropdown, isOpen, isHover) => {
    const layout = hudState.layout?.layout || layoutManager.getLayout();
    const radius = 12 * (hudState.layout?.dropdownScale || 1);
    const label = menuData.getDropdownLabel(dropdown);
    const meta = menuData.getDropdownMeta(dropdown);
    const previewData = menuData.getDropdownPreviewData(dropdown);
    const hasPreview = previewData && (previewData.imageUrl || previewData.colorData || previewData.iconType);

    ctx.save();
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    drawRoundedRect(dropdown.x, dropdown.y, dropdown.width, dropdown.height, radius);
    const baseFill = isHover ? COLORS.buttonHover : COLORS.buttonBg;
    ctx.fillStyle = isOpen ? baseFill : baseFill;
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.strokeStyle = isOpen ? COLORS.buttonActiveBorder : COLORS.buttonBorder;
    ctx.lineWidth = isOpen ? 2 : 1.5;
    ctx.stroke();

    ctx.restore();

    ctx.save();
    const previewSize = dropdown.height - 12;
    const innerPadX = 12;
    const previewX = dropdown.x + innerPadX;
    const previewY = dropdown.y + (dropdown.height - previewSize) / 2;
    const textX = previewX + previewSize + 12;
    const scaledFontSize = layout.fontSize;

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    if (hasPreview) {
      if (previewData.iconType === "grid") {
        drawGridIcon(previewX, previewY, previewSize, previewData.gridSize || 1);
      } else if (previewData.iconType === "faSquares") {
        drawPreviewImage(previewX, previewY, previewSize, null, null, null, previewData.gridSize || 1);
      } else if (previewData.iconType === "fa" && previewData.faGlyph) {
        drawPreviewImage(previewX, previewY, previewSize, null, null, previewData.faGlyph);
      } else if (previewData.iconType === "trash") {
        drawTrashIcon(previewX, previewY, previewSize);
      } else if (previewData.iconType === "dollar") {
        drawDollarIcon(previewX, previewY, previewSize);
      } else {
        drawPreviewImage(previewX, previewY, previewSize, previewData.imageUrl, previewData.colorData);
      }
    }

    if (meta) {
      const lineHeight = layout.fontSize + 2;
      const totalTextHeight = lineHeight * 2;
      const textStartY = dropdown.y + (dropdown.height - totalTextHeight) / 2 + lineHeight / 2;

      ctx.textBaseline = "middle";
      ctx.font = `600 ${scaledFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = COLORS.text;
      ctx.fillText(label, textX, textStartY);

      ctx.font = `400 ${scaledFontSize - 2}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = COLORS.textSecondary;
      ctx.fillText(meta, textX, textStartY + lineHeight);
    } else {
      ctx.textBaseline = "middle";
      ctx.font = `600 ${scaledFontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = COLORS.text;
      ctx.fillText(label, textX, dropdown.y + dropdown.height / 2);
    }

    ctx.restore();

    drawChevron(dropdown.x + dropdown.width - innerPadX, dropdown.y + dropdown.height / 2, 6, isOpen);
    ctx.restore();
  };

  const drawMoneyDisplay = (elem) => {
    const radius = 16;

    ctx.save();
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    drawRoundedRect(elem.x, elem.y, elem.width, elem.height, radius);
    ctx.fillStyle = COLORS.moneyBg;
    ctx.fill();

    ctx.shadowColor = "transparent";

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `700 13px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = "#d4af37";

    const moneyText = formatCurrency(state.totalMoney, true);
    const textX = elem.x + 12;
    const textY = elem.y + elem.height / 2;
    ctx.fillText(moneyText, textX, textY);

    ctx.restore();
  };

  const drawMoneyChange = (elem) => {
    if (hudState.moneyChangeOpacity <= 0) return;

    const radius = 12;
    const amount = hudState.moneyChangeAmount;
    const isGain = amount >= 0;

    ctx.save();
    ctx.globalAlpha = hudState.moneyChangeOpacity;

    drawRoundedRect(elem.x, elem.y, elem.width, elem.height, radius);
    ctx.fillStyle = COLORS.moneyBg;
    ctx.fill();

    ctx.strokeStyle = isGain ? hexToRgba(COLORS.accent, 0.5) : "rgba(231, 76, 60, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 12px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = isGain ? COLORS.accent : COLORS.moneyLoss;

    const prefix = isGain ? "+" : "";
    ctx.fillText(prefix + formatCurrency(amount, true), elem.x + elem.width / 2, elem.y + elem.height / 2);

    ctx.restore();
  };

  return {
    drawToolbar,
    drawButton,
    drawDropdown,
    drawMoneyDisplay,
    drawMoneyChange,
  };
}

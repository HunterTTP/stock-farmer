import { LAYOUT, MODE_ORDER } from "./constants.js";

export function createHudLayout({ canvas, ctx, state, hudState, dropdownData, formatCurrency }) {
  const getLayout = () => {
    const width = canvas.clientWidth;
    if (width >= 1024) return { ...LAYOUT.desktop, breakpoint: "desktop" };
    if (width >= 640) return { ...LAYOUT.tablet, breakpoint: "tablet" };
    return { ...LAYOUT.mobile, breakpoint: "mobile" };
  };

  const measureDropdownWidth = (dropdownId, layout) => {
    const dropdown = { id: dropdownId };
    const label = dropdownData.getDropdownLabel(dropdown);
    const meta = dropdownData.getDropdownMeta(dropdown);
    const previewData = dropdownData.getDropdownPreviewData(dropdown);
    const hasPreview = previewData && (previewData.imageUrl || previewData.colorData || previewData.iconType);

    const previewWidth = hasPreview ? 28 + 8 : 0;
    const paddingLeft = hasPreview ? 10 : 12;
    const chevronWidth = 28;
    const paddingRight = 8;
    const widthMultiplier = Math.min(1.85, Math.max(1.4, layout.modeButtonSize / 38));
    const listPadding = 16;

    ctx.font = `600 ${layout.fontSize}px system-ui, -apple-system, sans-serif`;
    const labelWidth = ctx.measureText(label).width;

    let textWidth = labelWidth;
    if (meta) {
      ctx.font = `400 ${layout.fontSize - 2}px system-ui, -apple-system, sans-serif`;
      const metaWidth = ctx.measureText(meta).width;
      textWidth = Math.max(labelWidth, metaWidth);
    }

    return Math.ceil((paddingLeft + previewWidth + textWidth + chevronWidth + paddingRight + listPadding) * widthMultiplier);
  };

  const computeDropdownLayout = (canvasWidth, y, height, layout, toolbar) => {
    const active = state.activeMode || "plant";
    const dropdowns = [];
    const maxMenuWidth = toolbar ? toolbar.width : canvasWidth - layout.padding * 2;
    const minX = toolbar ? toolbar.x : layout.padding;
    const maxX = toolbar ? toolbar.x + toolbar.width : canvasWidth - layout.padding;
    const availableWidth = maxX - minX;

    if (active === "plant") {
      let cropW = measureDropdownWidth("cropSelect", layout);
      let sizeW = measureDropdownWidth("sizeSelect", layout);
      let totalW = cropW + layout.gap + sizeW;

      if (totalW > availableWidth) {
        const scale = availableWidth / totalW;
        cropW = Math.floor(cropW * scale);
        sizeW = Math.floor(sizeW * scale);
        totalW = cropW + layout.gap + sizeW;
      }

      const startX = minX + (availableWidth - totalW) / 2;
      dropdowns.push({ id: "cropSelect", type: "dropdown", x: startX, y, width: cropW, height, menu: "cropMenu", maxMenuWidth });
      dropdowns.push({ id: "sizeSelect", type: "dropdown", x: startX + cropW + layout.gap, y, width: sizeW, height, menu: "sizeMenu", maxMenuWidth });
    } else if (active === "harvest") {
      let sizeW = measureDropdownWidth("harvestSizeSelect", layout);
      if (sizeW > availableWidth) sizeW = availableWidth;
      const startX = minX + (availableWidth - sizeW) / 2;
      dropdowns.push({ id: "harvestSizeSelect", type: "dropdown", x: startX, y, width: sizeW, height, menu: "harvestSizeMenu", maxMenuWidth });
    } else if (active === "landscape") {
      let w = measureDropdownWidth("landscapeSelect", layout);
      if (w > availableWidth) w = availableWidth;
      const startX = minX + (availableWidth - w) / 2;
      dropdowns.push({ id: "landscapeSelect", type: "dropdown", x: startX, y, width: w, height, menu: "landscapeMenu", maxMenuWidth });
    } else if (active === "build") {
      let w = measureDropdownWidth("buildSelect", layout);
      if (w > availableWidth) w = availableWidth;
      const startX = minX + (availableWidth - w) / 2;
      dropdowns.push({ id: "buildSelect", type: "dropdown", x: startX, y, width: w, height, menu: "buildMenu", maxMenuWidth });
    }

    return dropdowns;
  };

  const computeLayout = () => {
    const layout = getLayout();
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const dockScaleBase = 0.81;
    const dockScale = (state.hudDockScale || 1.0) * dockScaleBase;
    const dropdownScale = (state.hudDropdownScale || 1.0) * 0.9;
    const fontSizeBase = 1.1;
    const hudFontSize = (state.hudFontSize || 1.0) * fontSizeBase;
    const showDockText = false;

    const dockScaledPadding = Math.round(layout.padding * dockScale);
    const dockScaledGap = Math.round(layout.gap * dockScale);
    const dockScaledToolbarPadding = Math.round(layout.toolbarPadding * dockScale);
    const scaledFontSize = Math.round(layout.fontSize * hudFontSize);

    const modeCount = MODE_ORDER.length;
    const availableWidth = canvasWidth - dockScaledPadding * 2;
    const targetToolbarWidth = Math.min((layout.toolbarMaxWidth || availableWidth) * dockScale, availableWidth);
    const buttonMinLimit = layout.minModeButtonSize * dockScale;
    const buttonMaxLimit = layout.maxModeButtonSize * dockScale;
    const minButtonWidth = buttonMinLimit;
    const maxButtonWidth = buttonMaxLimit;
    const buttonSize = Math.max(
      minButtonWidth,
      Math.min(
        maxButtonWidth,
        (targetToolbarWidth - dockScaledToolbarPadding * 2 - (modeCount - 1) * dockScaledGap) / modeCount
      )
    );
    const totalModeWidth = modeCount * buttonSize + (modeCount - 1) * dockScaledGap + dockScaledToolbarPadding * 2;
    const toolbarContentHeight = buttonSize * 0.75;
    const toolbarHeight = toolbarContentHeight + dockScaledToolbarPadding * 2;
    const toolbarX = (canvasWidth - totalModeWidth) / 2;
    const hudBottomOffset = 20;
    const toolbarY = canvasHeight - toolbarHeight - dockScaledPadding - hudBottomOffset;

    const modeButtons = MODE_ORDER.map((mode, i) => ({
      id: mode,
      type: "modeButton",
      x: toolbarX + dockScaledToolbarPadding + i * (buttonSize + dockScaledGap),
      y: toolbarY + dockScaledToolbarPadding,
      width: buttonSize,
      height: toolbarContentHeight,
      mode,
    }));

    const toolbar = { x: toolbarX, y: toolbarY, width: totalModeWidth, height: toolbarHeight };

    const dropdownScaledGap = Math.round(layout.gap * dropdownScale);
    const dropdownScaledPadding = Math.round(layout.padding * dropdownScale);
    const dropdownHeight = Math.min(72 * dropdownScale, Math.max(52 * dropdownScale, Math.round(layout.modeButtonSize * 1.05 * dropdownScale)));
    const dropdownY = toolbarY - dropdownScaledGap - dropdownHeight;
    const dropdownLayout = { ...layout, padding: dropdownScaledPadding, gap: dropdownScaledGap, fontSize: scaledFontSize };
    const dropdowns = computeDropdownLayout(canvasWidth, dropdownY, dropdownHeight, dropdownLayout, toolbar);

    const moneyHeight = 34;
    const moneyText = formatCurrency(state.totalMoney, true);
    ctx.font = `700 13px system-ui, -apple-system, sans-serif`;
    const moneyTextWidth = ctx.measureText(moneyText).width;
    const moneyWidth = 24 + moneyTextWidth;
    const moneyX = canvasWidth - moneyWidth - layout.padding;
    const moneyY = layout.padding;
    const moneyDisplay = { id: "money", type: "moneyDisplay", x: moneyX, y: moneyY, width: moneyWidth, height: moneyHeight };

    const moneyChangeX = moneyX - 80 - 8;
    const moneyChange = { id: "moneyChange", type: "moneyChange", x: moneyChangeX, y: moneyY, width: 80, height: moneyHeight };

    hudState.layout = {
      layout: { ...layout, fontSize: scaledFontSize, iconSize: Math.round(layout.iconSize * dockScale) },
      modeButtons,
      dropdowns,
      moneyDisplay,
      moneyChange,
      toolbar,
      showDockText,
      dockScale,
      dropdownScale,
    };
    return hudState.layout;
  };

  return {
    getLayout,
    computeLayout,
    measureDropdownWidth,
  };
}

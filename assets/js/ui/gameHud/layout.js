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
    const isCompact = dropdownId === "sizeSelect" && layout.breakpoint !== "mobile";
    const widthMultiplier = isCompact ? 1.0 : Math.min(1.85, Math.max(1.4, layout.modeButtonSize / 38));
    const listPadding = isCompact ? 0 : 16;

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
    const availableWidth = toolbar ? toolbar.width : canvasWidth - layout.padding * 2;
    const minX = toolbar ? toolbar.x : layout.padding;
    const menuWidthOverride = toolbar ? toolbar.width : availableWidth;
    const menuXOverride = toolbar ? toolbar.x : minX;

    if (active === "plant") {
      let cropW = measureDropdownWidth("cropSelect", layout);
      let sizeW = measureDropdownWidth("sizeSelect", layout);
      const isMobile = layout.breakpoint === "mobile";
      const sideBySideGap = Math.max(4, layout.gap - (isMobile ? 4 : 2));
      const compactSizeW = Math.min(
        Math.max(Math.round(sizeW * (isMobile ? 0.6 : 0.75)), sizeW - (isMobile ? 28 : 20)),
        Math.round(availableWidth * (isMobile ? 0.26 : 0.3))
      );
      sizeW = compactSizeW;
      const totalSideBySideWidth = availableWidth;
      const resolvedCropWidth = Math.max(120, totalSideBySideWidth - sizeW - sideBySideGap);
      const canFitSideBySide = resolvedCropWidth > 0;

      if (canFitSideBySide) {
        const cropX = minX;
        const sizeX = cropX + resolvedCropWidth + sideBySideGap;
        dropdowns.push({
          id: "cropSelect",
          type: "dropdown",
          x: cropX,
          y,
          width: resolvedCropWidth,
          height,
          menu: "cropMenu",
          maxMenuWidth,
          menuWidthOverride,
          menuXOverride,
        });
        dropdowns.push({
          id: "sizeSelect",
          type: "dropdown",
          x: sizeX,
          y,
          width: sizeW,
          height,
          menu: "sizeMenu",
          maxMenuWidth,
          menuWidthOverride,
          menuXOverride,
        });
      } else {
        const width = availableWidth;
        const sizeY = y;
        const cropY = y - height - layout.gap;
        dropdowns.push({
          id: "cropSelect",
          type: "dropdown",
          x: minX,
          y: cropY,
          width,
          height,
          menu: "cropMenu",
          maxMenuWidth,
          menuWidthOverride,
          menuXOverride,
        });
        dropdowns.push({
          id: "sizeSelect",
          type: "dropdown",
          x: minX,
          y: sizeY,
          width,
          height,
          menu: "sizeMenu",
          maxMenuWidth,
          menuWidthOverride,
          menuXOverride,
        });
      }
    } else if (active === "landscape") {
      const w = availableWidth;
      dropdowns.push({
        id: "landscapeSelect",
        type: "dropdown",
        x: minX,
        y,
        width: w,
        height,
        menu: "landscapeMenu",
        maxMenuWidth,
        menuWidthOverride,
        menuXOverride,
      });
    } else if (active === "build") {
      const w = availableWidth;
      dropdowns.push({
        id: "buildSelect",
        type: "dropdown",
        x: minX,
        y,
        width: w,
        height,
        menu: "buildMenu",
        maxMenuWidth,
        menuWidthOverride,
        menuXOverride,
      });
    }

    return dropdowns;
  };

  const computeDropdownHeight = (layout, scale) => {
    const labelFontSize = Math.max(8, Math.round(layout.fontSize));
    const metaFontSize = Math.max(8, Math.round((layout.fontSize - 2)));
    const previewSize = Math.round(36 * scale);
    const paddingY = Math.round(12 * scale);
    const labelToMetaGap = Math.round(6 * scale);
    const textHeight = labelFontSize + labelToMetaGap + metaFontSize;
    const minHeight = Math.round(48 * scale);
    return Math.max(minHeight, previewSize + paddingY * 2, textHeight + paddingY * 2);
  };

  const computeLayout = () => {
    const layout = getLayout();
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const dockScaleBase = 0.86;
    const dockScaleSetting =
      layout.breakpoint === "mobile"
        ? 1.45
        : layout.breakpoint === "desktop"
          ? 0.95
          : 1.05;
    const dockScale = dockScaleSetting * dockScaleBase;
    const dropdownScale = dockScale;
    const fontSizeBase = 1.1;
    const fontSizeOffset = 0.1; // Rebase so 1.0x renders like the previous 1.1x selection
    const fontSliderMin = 0.5;
    const fontSliderMax = 1.5;
    const useOverride = !!state.hudFontOverrideEnabled;
    const hudFontSetting = useOverride && Number.isFinite(state.hudFontSize) ? state.hudFontSize : 1.0;
    const clampedHudFont = Math.max(fontSliderMin, Math.min(fontSliderMax, hudFontSetting));
    const hudFontSize = useOverride ? (clampedHudFont + fontSizeOffset) * fontSizeBase : 1.0;
    const showDockText = false;

    const dockScaledPadding = Math.round(layout.padding * dockScale);
    const dockScaledGap = Math.round(layout.gap * dockScale);
    const dockScaledToolbarPadding = Math.round(layout.toolbarPadding * dockScale);
    const scaledFontSize = Math.round(layout.fontSize * hudFontSize);

    const modeCount = MODE_ORDER.length;
    const isDesktop = layout.breakpoint === "desktop";
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
    const hudBottomOffset = isDesktop ? 12 : 20;
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

    const dropdownScaledGap = isDesktop ? Math.max(6, Math.round(layout.gap * dropdownScale * 0.65)) : Math.round(layout.gap * dropdownScale);
    const dropdownScaledPadding = Math.round(layout.padding * dropdownScale);
    const dropdownLayout = { ...layout, padding: dropdownScaledPadding, gap: dropdownScaledGap, fontSize: Math.round(scaledFontSize * dropdownScale) };
    const dropdownHeight = computeDropdownHeight(dropdownLayout, dropdownScale);
    const dropdownY = toolbarY - dropdownScaledGap - dropdownHeight;
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

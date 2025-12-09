export function createMenuRenderer({ ctx, COLORS, formatCurrency, menuData, drawUtils, hudState, canvas, hexToRgba, layoutManager }) {
  const { drawRoundedRect, drawPreviewImage, drawGridIcon, drawTrashIcon, drawDollarIcon } = drawUtils;

  const getDropdownScale = () => hudState.layout?.dropdownScale || 1;

  const normalizeMetaLines = (item) => {
    if (Array.isArray(item.metaLines)) {
      return item.metaLines
        .map((line) => {
          if (typeof line === "string") return { text: line, type: "meta" };
          return { text: line?.text || "", type: line?.type || "meta" };
        })
        .filter((line) => line.text && line.text.trim().length > 0);
    }
    const fallbackText = item.locked && item.unlockCost > 0 ? `Unlock for ${formatCurrency(item.unlockCost)}` : item.meta;
    if (!fallbackText) return [];
    const type = item.locked && item.unlockCost > 0 ? "unlock" : "meta";
    return [{ text: fallbackText, type }];
  };

  const getMaxMetaLines = (items) => items.reduce((max, item) => Math.max(max, normalizeMetaLines(item).length), 0);

  const getMetaColor = (line, item) => {
    if (line.type === "unlock") return item.canAfford ? COLORS.gold : COLORS.goldDimmed;
    if (line.type === "status") return COLORS.accent;
    return COLORS.textSecondary;
  };

  const computeTextBlock = (metaLines, labelFontSize, metaFontSize, scale) => {
    const labelToMetaGap = Math.round(4 * scale);
    const metaGap = Math.round(2 * scale);
    const metaHeight = metaLines.length > 0 ? metaLines.length * metaFontSize + Math.max(0, metaLines.length - 1) * metaGap : 0;
    const blockHeight = labelFontSize + (metaLines.length > 0 ? labelToMetaGap + metaHeight : 0);
    return { blockHeight, labelToMetaGap, metaGap };
  };

  const calculateItemHeight = (maxMetaLines, scale, labelFontSize, metaFontSize) => {
    const previewSize = Math.round(36 * scale);
    const paddingY = Math.round(10 * scale);
    const metaGap = Math.round(2 * scale);
    const labelGap = maxMetaLines > 0 ? Math.round(4 * scale) : 0;
    const textHeight =
      labelFontSize +
      labelGap +
      (maxMetaLines > 0 ? maxMetaLines * metaFontSize + Math.max(0, maxMetaLines - 1) * metaGap : 0);
    const minHeightForPreview = previewSize + paddingY * 2;
    const minHeightForText = textHeight + paddingY * 2;
    return Math.max(Math.round(48 * scale), minHeightForPreview, minHeightForText);
  };

  const measureMenuWidth = (items, layout, dropdown) => {
    const scale = getDropdownScale();
    const previewSize = Math.round(36 * scale);
    const previewMargin = Math.round(10 * scale);
    const textOffset = previewSize + previewMargin * 2;
    const padding = Math.round(32 * scale);
    const scrollbarWidth = Math.round(16 * scale);
    const extraMenuPad = dropdown?.id === "cropSelect" ? Math.round(80 * scale) : 0;
    const labelFontSize = Math.max(8, layout.fontSize * scale);
    const metaFontSize = Math.max(8, (layout.fontSize - 2) * scale);

    let maxWidth = 0;

    items.forEach((item) => {
      ctx.font = `600 ${labelFontSize}px system-ui, -apple-system, sans-serif`;
      const labelWidth = ctx.measureText(item.label).width;

      ctx.font = `400 ${metaFontSize}px system-ui, -apple-system, sans-serif`;
      const metaLines = normalizeMetaLines(item);
      const metaWidth = metaLines.reduce((max, line) => Math.max(max, ctx.measureText(line.text).width), 0);

      const textWidth = Math.max(labelWidth, metaWidth);
      const totalWidth = textOffset + textWidth + padding + scrollbarWidth + extraMenuPad;
      if (totalWidth > maxWidth) maxWidth = totalWidth;
    });

    return Math.max(maxWidth, Math.round(180 * scale) + extraMenuPad);
  };

  const computeMenuGeometry = (dropdown) => {
    const items = menuData.getMenuItems(dropdown);
    if (!items || !items.length) return null;

    const layout = hudState.layout?.layout || layoutManager.getLayout();
    const toolbar = hudState.layout?.toolbar;
    const scale = getDropdownScale();
    const labelFontSize = Math.max(8, layout.fontSize * scale);
    const metaFontSize = Math.max(8, (layout.fontSize - 2) * scale);
    const metaLinesList = items.map((item) => normalizeMetaLines(item));
    const itemHeights = metaLinesList.map((metaLines) => calculateItemHeight(metaLines.length, scale, labelFontSize, metaFontSize));
    const padding = Math.max(10, Math.round((layout.padding || 12) * scale));
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const baseMaxHeight = Math.min(360, Math.max(180, canvasHeight * 0.65));
    const availableHeight = Math.max(140, dropdown.y - padding - Math.round(10 * scale));
    const contentOffsetY = Math.round(8 * scale);
    const menuChrome = Math.round(16 * scale);

    let maxVisibleHeight = Math.min(baseMaxHeight, availableHeight);
    const totalContentHeight = itemHeights.reduce((sum, h) => sum + h, 0);
    let menuContentHeight = Math.min(totalContentHeight, maxVisibleHeight);
    let menuHeight = menuContentHeight + menuChrome;

    const measuredWidth = measureMenuWidth(items, layout, dropdown);
    const maxMenuWidth = dropdown.maxMenuWidth || (toolbar ? toolbar.width : canvasWidth - padding * 2);
    let menuWidth = dropdown.menuWidthOverride || Math.min(measuredWidth, maxMenuWidth);
    const toolbarCenterX = toolbar ? toolbar.x + toolbar.width / 2 : canvasWidth / 2;
    let menuX = dropdown.menuXOverride ?? toolbarCenterX - menuWidth / 2;

    if (menuX + menuWidth > canvasWidth - padding) {
      menuX = canvasWidth - menuWidth - padding;
    }
    if (menuX < padding) {
      menuX = padding;
    }

    let menuY = dropdown.y - menuHeight - Math.round(10 * scale);
    if (menuY < padding) {
      const adjustedContentHeight = Math.max(140, Math.min(menuContentHeight - (padding - menuY), maxVisibleHeight));
      menuContentHeight = Math.min(adjustedContentHeight, totalContentHeight);
      menuHeight = menuContentHeight + menuChrome;
      maxVisibleHeight = menuContentHeight;
      menuY = padding;
    }

    const scrollable = totalContentHeight > menuContentHeight;
    const maxScroll = scrollable ? totalContentHeight - menuContentHeight : 0;

    return {
      items,
      layout,
      menuX,
      menuY,
      menuWidth,
      menuHeight,
      menuContentHeight,
      itemHeights,
      metaLinesList,
      maxScroll,
      scrollable,
      totalContentHeight,
      maxVisibleHeight,
      contentOffsetY,
    };
  };

  const getMenuBounds = (dropdown) => {
    const geometry = computeMenuGeometry(dropdown);
    if (!geometry) return null;
    return geometry;
  };

  const drawMenu = (dropdown) => {
    const geometry = computeMenuGeometry(dropdown);
    if (!geometry) return;
    const {
      items,
      layout,
      menuX,
      menuY,
      menuWidth,
      menuHeight,
      menuContentHeight,
      itemHeights,
      metaLinesList,
      scrollable,
      maxScroll,
      totalContentHeight,
      maxVisibleHeight,
      contentOffsetY,
    } = geometry;
    const scale = getDropdownScale();
    const radius = Math.round(14 * scale);
    const previewSize = Math.round(36 * scale);
    const previewMargin = Math.round(10 * scale);
    const textOffset = previewSize + previewMargin * 2;
    const labelFontSize = Math.max(8, layout.fontSize * scale);
    const metaFontSize = Math.max(8, (layout.fontSize - 2) * scale);
    const scrollOffset = Math.max(0, Math.min(hudState.menuScrollOffset, maxScroll));
    const contentInsetX = Math.round(6 * scale);
    const clipRadius = Math.round(8 * scale);

    ctx.save();

    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;

    drawRoundedRect(menuX, menuY, menuWidth, menuHeight, radius);
    ctx.fillStyle = COLORS.panelBg;
    ctx.fill();

    ctx.shadowColor = "transparent";

    ctx.strokeStyle = COLORS.panelBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    drawRoundedRect(menuX + contentInsetX, menuY + contentOffsetY, menuWidth - contentInsetX * 2, menuContentHeight, clipRadius);
    ctx.clip();

    let runningOffset = 0;
    items.forEach((item, i) => {
      const itemHeight = itemHeights[i] || calculateItemHeight(getMaxMetaLines([item]), scale, labelFontSize, metaFontSize);
      const itemYBase = menuY + contentOffsetY + runningOffset - scrollOffset;
      const nextOffset = runningOffset + itemHeight;
      if (itemYBase + itemHeight < menuY + contentOffsetY || itemYBase > menuY + contentOffsetY + menuContentHeight) {
        runningOffset = nextOffset;
        return;
      }

      const itemX = menuX + Math.round(10 * scale);
      const itemY = itemYBase;
      const rightPad = scrollable ? Math.round(24 * scale) : Math.round(12 * scale);
      const itemW = menuWidth - (Math.round(10 * scale) + rightPad);
      const itemH = itemHeight - Math.round(6 * scale);
      const itemRadius = Math.round(8 * scale);
      const isSelected = menuData.isItemSelected(dropdown, item);
      const isHover = hudState.hoverElement?.id === `menuItem_${dropdown.id}_${i}`;

      drawRoundedRect(itemX, itemY, itemW, itemH, itemRadius);
      if (isSelected) {
        ctx.fillStyle = COLORS.itemSelected;
        ctx.fill();
        ctx.strokeStyle = COLORS.itemSelectedBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isHover) {
        ctx.fillStyle = COLORS.itemHover;
        ctx.fill();
      } else {
        ctx.fillStyle = COLORS.itemBg;
        ctx.fill();
      }

      const previewX = itemX + previewMargin;
      const previewY = itemY + (itemH - previewSize) / 2;
      const dimPreview = item.locked && !item.canAfford;
      ctx.save();
      if (dimPreview) {
        ctx.globalAlpha *= 0.45;
      }
      if (item.iconType === "trash") {
        drawTrashIcon(previewX, previewY, previewSize);
      } else if (item.iconType === "dollar") {
        drawDollarIcon(previewX, previewY, previewSize);
      } else if (item.iconType === "grid") {
        drawGridIcon(previewX, previewY, previewSize, item.gridSize || 1);
      } else if (item.iconType === "fa") {
        const faSize = previewSize * (item.faScale || 1);
        const faWeight = item.faWeight || 900;
        drawPreviewImage(previewX, previewY, faSize, null, null, item.faGlyph, null, faWeight);
      } else if (item.iconType === "faSquares") {
        drawPreviewImage(previewX, previewY, previewSize, null, null, null, item.gridSize || 1);
      } else {
        drawPreviewImage(previewX, previewY, previewSize, item.imageUrl, item.colorData);
      }
      ctx.restore();
      if (dimPreview) {
        const dimRadius = Math.round(6 * scale);
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.beginPath();
        ctx.roundRect(previewX, previewY, previewSize, previewSize, dimRadius);
        ctx.fill();
        ctx.restore();
      }

      const metaLines = (metaLinesList && metaLinesList[i]) || normalizeMetaLines(item);
      const textX = itemX + textOffset;
      ctx.textAlign = "left";

      if (metaLines.length > 0) {
        ctx.textBaseline = "top";
        ctx.font = `600 ${labelFontSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = item.locked && !item.canAfford ? COLORS.textSecondary : COLORS.text;
        const { blockHeight, labelToMetaGap, metaGap } = computeTextBlock(metaLines, labelFontSize, metaFontSize, scale);
        let textY = itemY + (itemH - blockHeight) / 2;
        ctx.fillText(item.label, textX, textY);

        textY += labelFontSize + labelToMetaGap;
        ctx.font = `400 ${metaFontSize}px system-ui, -apple-system, sans-serif`;
        metaLines.forEach((line, idx) => {
          ctx.fillStyle = getMetaColor(line, item);
          ctx.fillText(line.text, textX, textY);
          textY += metaFontSize + (idx === metaLines.length - 1 ? 0 : metaGap);
        });
      } else {
        ctx.textBaseline = "middle";
        ctx.font = `600 ${labelFontSize}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = item.locked && !item.canAfford ? COLORS.textSecondary : COLORS.text;
        ctx.fillText(item.label, textX, itemY + itemH / 2);
      }

      runningOffset = nextOffset;
    });

    ctx.restore();

    if (scrollable) {
      const scrollTrackX = menuX + menuWidth - Math.round(16 * scale);
      const scrollTrackY = menuY + contentOffsetY + Math.round(6 * scale);
      const scrollTrackHeight = menuContentHeight - Math.round(12 * scale);
      const scrollThumbHeight = Math.max(Math.round(30 * scale), (maxVisibleHeight / totalContentHeight) * scrollTrackHeight);
      const scrollThumbY = scrollTrackY + (scrollOffset / maxScroll) * (scrollTrackHeight - scrollThumbHeight);
      const scrollTrackWidth = Math.max(4, Math.round(5 * scale));
      const scrollRadius = Math.max(2, Math.round(2.5 * scale));

      ctx.save();
      ctx.fillStyle = "rgba(80, 80, 80, 0.5)";
      ctx.beginPath();
      ctx.roundRect(scrollTrackX, scrollTrackY, scrollTrackWidth, scrollTrackHeight, scrollRadius);
      ctx.fill();

      ctx.fillStyle = hexToRgba(COLORS.accent, 0.8);
      ctx.beginPath();
      ctx.roundRect(scrollTrackX, scrollThumbY, scrollTrackWidth, scrollThumbHeight, scrollRadius);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  };

  return {
    drawMenu,
    measureMenuWidth,
    getMenuBounds,
  };
}

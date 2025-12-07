export function createMenuRenderer({ ctx, COLORS, formatCurrency, menuData, drawUtils, hudState, canvas, hexToRgba, layoutManager }) {
  const { drawRoundedRect, drawPreviewImage, drawGridIcon, drawTrashIcon, drawDollarIcon } = drawUtils;

  const measureMenuWidth = (items, layout, dropdown) => {
    const previewSize = 32;
    const previewMargin = 8;
    const textOffset = previewSize + previewMargin * 2;
    const padding = 32;
    const scrollbarWidth = 16;
    const extraMenuPad = dropdown?.id === "cropSelect" ? 80 : 0;

    let maxWidth = 0;

    items.forEach((item) => {
      ctx.font = `600 ${layout.fontSize - 1}px system-ui, -apple-system, sans-serif`;
      const labelWidth = ctx.measureText(item.label).width;

      ctx.font = `400 ${layout.fontSize - 3}px system-ui, -apple-system, sans-serif`;
      let metaText = item.meta;
      if (item.locked && item.unlockCost > 0) {
        metaText = `Unlock for ${formatCurrency(item.unlockCost)}`;
      }
      const metaWidth = ctx.measureText(metaText || "").width;

      const textWidth = Math.max(labelWidth, metaWidth);
      const totalWidth = textOffset + textWidth + padding + scrollbarWidth + extraMenuPad;
      if (totalWidth > maxWidth) maxWidth = totalWidth;
    });

    return Math.max(maxWidth, 180 + extraMenuPad);
  };

  const computeMenuGeometry = (dropdown) => {
    const items = menuData.getMenuItems(dropdown);
    if (!items || !items.length) return null;

    const layout = hudState.layout?.layout || layoutManager.getLayout();
    const toolbar = hudState.layout?.toolbar;
    const itemHeight = 48;
    const padding = layout.padding || 12;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const baseMaxHeight = Math.min(360, Math.max(180, canvasHeight * 0.65));
    const availableHeight = Math.max(140, dropdown.y - padding - 10);

    let maxVisibleHeight = Math.min(baseMaxHeight, availableHeight);
    const totalContentHeight = items.length * itemHeight;
    let menuContentHeight = Math.min(totalContentHeight, maxVisibleHeight);
    let menuHeight = menuContentHeight + 16;

    const measuredWidth = measureMenuWidth(items, layout, dropdown);
    const maxMenuWidth = dropdown.maxMenuWidth || (toolbar ? toolbar.width : canvasWidth - padding * 2);
    let menuWidth = Math.min(measuredWidth, maxMenuWidth);
    const toolbarCenterX = toolbar ? toolbar.x + toolbar.width / 2 : canvasWidth / 2;
    let menuX = toolbarCenterX - menuWidth / 2;

    if (menuX + menuWidth > canvasWidth - padding) {
      menuX = canvasWidth - menuWidth - padding;
    }
    if (menuX < padding) {
      menuX = padding;
    }

    let menuY = dropdown.y - menuHeight - 10;
    if (menuY < padding) {
      const adjustedContentHeight = Math.max(140, Math.min(menuContentHeight - (padding - menuY), maxVisibleHeight));
      menuContentHeight = Math.min(adjustedContentHeight, totalContentHeight);
      menuHeight = menuContentHeight + 16;
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
      itemHeight,
      maxScroll,
      scrollable,
      totalContentHeight,
      maxVisibleHeight,
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
      itemHeight,
      scrollable,
      maxScroll,
      totalContentHeight,
      maxVisibleHeight,
    } = geometry;
    const radius = 14;
    const previewSize = 36;
    const previewMargin = 10;
    const textOffset = previewSize + previewMargin * 2;
    const scrollOffset = Math.max(0, Math.min(hudState.menuScrollOffset, maxScroll));

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
    drawRoundedRect(menuX + 6, menuY + 8, menuWidth - 12, menuContentHeight, 8);
    ctx.clip();

    items.forEach((item, i) => {
      const itemYBase = menuY + 8 + i * itemHeight - scrollOffset;
      if (itemYBase + itemHeight < menuY + 8 || itemYBase > menuY + 8 + menuContentHeight) {
        return;
      }

      const itemX = menuX + 10;
      const itemY = itemYBase;
      const rightPad = scrollable ? 24 : 12;
      const itemW = menuWidth - (10 + rightPad);
      const itemH = itemHeight - 6;
      const isSelected = menuData.isItemSelected(dropdown, item);
      const isHover = hudState.hoverElement?.id === `menuItem_${dropdown.id}_${i}`;

      drawRoundedRect(itemX, itemY, itemW, itemH, 8);
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
      if (item.iconType === "trash") {
        drawTrashIcon(previewX, previewY, previewSize);
      } else if (item.iconType === "dollar") {
        drawDollarIcon(previewX, previewY, previewSize);
      } else if (item.iconType === "grid") {
        drawGridIcon(previewX, previewY, previewSize, item.gridSize || 1);
      } else if (item.iconType === "fa") {
        drawPreviewImage(previewX, previewY, previewSize, null, null, item.faGlyph);
      } else {
        drawPreviewImage(previewX, previewY, previewSize, item.imageUrl, item.colorData);
      }

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${layout.fontSize}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = item.locked && !item.canAfford ? COLORS.textSecondary : COLORS.text;

      const labelY = itemY + itemH / 2 - 7;
      ctx.fillText(item.label, itemX + textOffset, labelY);

      ctx.font = `400 ${layout.fontSize - 2}px system-ui, -apple-system, sans-serif`;
      const metaY = itemY + itemH / 2 + 8;

      if (item.locked && item.unlockCost > 0) {
        ctx.fillStyle = item.canAfford ? COLORS.gold : COLORS.goldDimmed;
        ctx.fillText(`Unlock for ${formatCurrency(item.unlockCost)}`, itemX + textOffset, metaY);
      } else {
        ctx.fillStyle = COLORS.textSecondary;
        ctx.fillText(item.meta, itemX + textOffset, metaY);
      }
    });

    ctx.restore();

    if (scrollable) {
      const scrollTrackX = menuX + menuWidth - 16;
      const scrollTrackY = menuY + 14;
      const scrollTrackHeight = menuContentHeight - 12;
      const scrollThumbHeight = Math.max(30, (maxVisibleHeight / totalContentHeight) * scrollTrackHeight);
      const scrollThumbY = scrollTrackY + (scrollOffset / maxScroll) * (scrollTrackHeight - scrollThumbHeight);

      ctx.save();
      ctx.fillStyle = "rgba(80, 80, 80, 0.5)";
      ctx.beginPath();
      ctx.roundRect(scrollTrackX, scrollTrackY, 5, scrollTrackHeight, 2.5);
      ctx.fill();

      ctx.fillStyle = hexToRgba(COLORS.accent, 0.8);
      ctx.beginPath();
      ctx.roundRect(scrollTrackX, scrollThumbY, 5, scrollThumbHeight, 2.5);
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

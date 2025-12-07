export function createHudInteractions({
  canvas,
  state,
  hudState,
  menuRenderer,
  openConfirmModal,
  onMoneyChanged,
  formatCurrency,
  saveState,
  crops,
  sizes,
}) {
  const hitTest = (x, y) => {
    const computed = hudState.layout;
    if (!computed) return null;

    if (hudState.openMenuKey) {
      const dropdown = computed.dropdowns.find((d) => d.menu === hudState.openMenuKey);
      if (dropdown) {
        const bounds = menuRenderer.getMenuBounds(dropdown);
        if (!bounds) return null;
        const { menuX, menuY, menuWidth, menuHeight, menuContentHeight, itemHeight, items, maxScroll } = bounds;
        const scrollOffset = Math.max(0, Math.min(hudState.menuScrollOffset, maxScroll));

        if (x >= menuX && x <= menuX + menuWidth && y >= menuY && y <= menuY + menuHeight) {
          const relY = y - menuY - 8 + scrollOffset;
          const itemIndex = Math.floor(relY / itemHeight);
          if (itemIndex >= 0 && itemIndex < items.length) {
            const itemYBase = menuY + 8 + itemIndex * itemHeight - scrollOffset;
            if (itemYBase >= menuY + 8 - itemHeight && itemYBase < menuY + 8 + menuContentHeight) {
              return { type: "menuItem", id: `menuItem_${dropdown.id}_${itemIndex}`, dropdown, itemIndex, item: items[itemIndex] };
            }
          }
          return { type: "menu", id: "menu" };
        }
      }
    }

    for (const dd of computed.dropdowns) {
      if (x >= dd.x && x <= dd.x + dd.width && y >= dd.y && y <= dd.y + dd.height) {
        return { type: "dropdown", ...dd };
      }
    }

    for (const btn of computed.modeButtons) {
      if (x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height) {
        return { type: "modeButton", ...btn };
      }
    }

    const md = computed.moneyDisplay;
    if (x >= md.x && x <= md.x + md.width && y >= md.y && y <= md.y + md.height) {
      return { type: "moneyDisplay", ...md };
    }

    return null;
  };

  const handlePointerDown = (x, y) => {
    const hit = hitTest(x, y);
    hudState.pointerDown = true;
    hudState.pointerDownElement = hit;

    if (hit && (hit.type === "menu" || hit.type === "menuItem") && hudState.openMenuKey) {
      hudState.menuDragStart = y;
      hudState.menuDragScrollStart = hudState.menuScrollOffset;
    } else {
      hudState.menuDragStart = null;
    }

    if (hit) {
      state.needsRender = true;
    }
    return !!hit;
  };

  const handlePointerMove = (x, y) => {
    const hit = hitTest(x, y);
    const prev = hudState.hoverElement?.id;
    hudState.hoverElement = hit;

    if (hudState.menuDragStart !== null && hudState.pointerDown) {
      const deltaY = hudState.menuDragStart - y;
      const computed = hudState.layout;
      if (computed && hudState.openMenuKey) {
        const dropdown = computed.dropdowns.find((d) => d.menu === hudState.openMenuKey);
        if (dropdown) {
          const bounds = menuRenderer.getMenuBounds(dropdown);
          if (bounds && bounds.scrollable) {
            hudState.menuScrollOffset = Math.max(0, Math.min(bounds.maxScroll, hudState.menuDragScrollStart + deltaY));
            state.needsRender = true;
          }
        }
      }
    }

    if (hit?.id !== prev) {
      state.needsRender = true;
    }
  };

  const handleModeButtonClick = (mode) => {
    if (mode === "trade") {
      state.activeMode = "trade";
      hudState.openMenuKey = null;
      state.needsRender = true;
      const tradeModal = document.getElementById("tradeModal");
      if (tradeModal) {
        tradeModal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
      }
      return;
    }

    if (mode === state.activeMode) return;

    state.activeMode = mode;
    hudState.openMenuKey = null;
    state.needsRender = true;
    saveState();
  };

  const handleDropdownClick = (dropdown) => {
    if (hudState.openMenuKey === dropdown.menu) {
      hudState.openMenuKey = null;
    } else {
      hudState.openMenuKey = dropdown.menu;
      hudState.menuScrollOffset = 0;
    }
    state.needsRender = true;
  };

  const handleMenuScroll = (deltaY) => {
    if (!hudState.openMenuKey) return false;
    const computed = hudState.layout;
    if (!computed) return false;
    const dropdown = computed.dropdowns.find((d) => d.menu === hudState.openMenuKey);
    if (!dropdown) return false;

    const bounds = menuRenderer.getMenuBounds(dropdown);
    if (!bounds || !bounds.scrollable) return false;

    hudState.menuScrollOffset = Math.max(0, Math.min(bounds.maxScroll, hudState.menuScrollOffset + deltaY));
    state.needsRender = true;
    return true;
  };

  const unlockItem = (dropdownId, itemId) => {
    if (dropdownId === "cropSelect") {
      if (crops[itemId]) crops[itemId].unlocked = true;
    } else if (dropdownId === "sizeSelect" || dropdownId === "harvestSizeSelect") {
      if (sizes[itemId]) sizes[itemId].unlocked = true;
    }
  };

  const selectItem = (dropdownId, itemId) => {
    if (dropdownId === "cropSelect") {
      state.selectedCropKey = itemId;
      state.previousCropKey = itemId;
    } else if (dropdownId === "sizeSelect" || dropdownId === "harvestSizeSelect") {
      state.selectedSizeKey = itemId;
    } else if (dropdownId === "landscapeSelect") {
      state.selectedLandscapeKey = itemId;
    } else if (dropdownId === "buildSelect") {
      state.selectedBuildKey = itemId;
    }
  };

  const handleMenuItemClick = (dropdown, item) => {
    if (item.locked && item.unlockCost > 0) {
      const cost = item.unlockCost || 0;
      if (!item.canAfford || state.totalMoney < cost) {
        hudState.openMenuKey = null;
        state.needsRender = true;
        return;
      }
      openConfirmModal(
        `Unlock ${item.label} for ${formatCurrency(cost)}?`,
        () => {
          if (state.totalMoney < cost) return;
          state.totalMoney -= cost;
          unlockItem(dropdown.id, item.id);
          selectItem(dropdown.id, item.id);
          onMoneyChanged();
          state.needsRender = true;
          saveState();
        },
        "Confirm Unlock"
      );
      hudState.openMenuKey = null;
      state.needsRender = true;
      return;
    }

    selectItem(dropdown.id, item.id);
    hudState.openMenuKey = null;
    state.needsRender = true;
    saveState();
  };

  const handlePointerUp = (x, y) => {
    const hit = hitTest(x, y);
    const wasDown = hudState.pointerDownElement;
    const wasDragging = hudState.menuDragStart !== null && Math.abs(hudState.menuScrollOffset - hudState.menuDragScrollStart) > 5;

    hudState.pointerDown = false;
    hudState.pointerDownElement = null;
    hudState.menuDragStart = null;

    if (wasDragging) {
      return !!hit;
    }

    if (!hit || !wasDown || hit.id !== wasDown.id) {
      if (hudState.openMenuKey && !hit) {
        hudState.openMenuKey = null;
        state.needsRender = true;
      }
      return !!hit;
    }

    if (hit.type === "modeButton") {
      handleModeButtonClick(hit.mode);
      return true;
    }

    if (hit.type === "dropdown") {
      handleDropdownClick(hit);
      return true;
    }

    if (hit.type === "menuItem") {
      handleMenuItemClick(hit.dropdown, hit.item);
      return true;
    }

    return !!hit;
  };

  const isPointerOverHud = (x, y) => hitTest(x, y) !== null;

  const closeAllMenus = () => {
    if (hudState.openMenuKey) {
      hudState.openMenuKey = null;
      state.needsRender = true;
    }
  };

  return {
    hitTest,
    handlePointerMove,
    handlePointerDown,
    handlePointerUp,
    handleMenuScroll,
    handleMenuItemClick,
    unlockItem,
    selectItem,
    isPointerOverHud,
    closeAllMenus,
  };
}

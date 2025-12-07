export function createHudRenderer({ ctx, state, hudState, layoutManager, toolbarRenderer, menuRenderer }) {
  const render = () => {
    const opacity = typeof state.hudOpacity === "number" ? state.hudOpacity : 1.0;
    if (opacity <= 0) return;

    const computed = layoutManager.computeLayout();

    ctx.save();
    ctx.globalAlpha = opacity;

    toolbarRenderer.drawToolbar();

    computed.modeButtons.forEach((btn) => {
      const isActive = btn.mode === state.activeMode;
      const isHover = hudState.hoverElement?.id === btn.id;
      const isPressed = hudState.pointerDown && hudState.pointerDownElement?.id === btn.id;
      toolbarRenderer.drawButton(btn, isActive, isHover, isPressed);
    });

    computed.dropdowns.forEach((dropdown) => {
      const isOpen = hudState.openMenuKey === dropdown.menu;
      const isHover = hudState.hoverElement?.id === dropdown.id;
      toolbarRenderer.drawDropdown(dropdown, isOpen, isHover);
    });

    toolbarRenderer.drawMoneyDisplay(computed.moneyDisplay);
    toolbarRenderer.drawMoneyChange(computed.moneyChange);

    const openDropdown = computed.dropdowns.find((d) => hudState.openMenuKey === d.menu);
    if (openDropdown) {
      menuRenderer.drawMenu(openDropdown);
    }

    ctx.restore();
  };

  return { render };
}

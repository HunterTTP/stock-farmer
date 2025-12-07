import { hexToRgba } from "../utils/colorUtils.js";
import { getAccentPalette, onAccentChange } from "./theme.js";
import { createColors, applyAccentColors } from "./gameHud/constants.js";
import { createMenuData } from "./gameHud/menuData.js";
import { createHudLayout } from "./gameHud/layout.js";
import { createDrawUtils } from "./gameHud/drawUtils.js";
import { createMenuRenderer } from "./gameHud/menuRenderer.js";
import { createToolbarRenderer } from "./gameHud/toolbarRenderer.js";
import { createHudRenderer } from "./gameHud/renderHud.js";
import { createHudInteractions } from "./gameHud/interactions.js";
import { createHudAnimations } from "./gameHud/animations.js";

export function createGameHud({ canvas, ctx, state, crops, sizes, landscapes, buildings, formatCurrency, onMoneyChanged, saveState, openConfirmModal }) {
  const hudState = {
    openMenuKey: null,
    hoverElement: null,
    pointerDown: false,
    pointerDownElement: null,
    moneyChangeAmount: 0,
    moneyChangeOpacity: 0,
    moneyChangeStart: 0,
    layout: null,
    menuScrollOffset: 0,
    menuDragStart: null,
    menuDragScrollStart: 0,
    sliderX: null,
    sliderTargetX: null,
  };

  const colors = createColors(getAccentPalette(), hexToRgba);
  onAccentChange((palette) => {
    applyAccentColors(colors, palette, hexToRgba);
    state.needsRender = true;
  });

  const menuData = createMenuData({ state, crops, sizes, landscapes, buildings, formatCurrency });
  const layoutManager = createHudLayout({ canvas, ctx, state, hudState, dropdownData: menuData, formatCurrency });
  const drawUtils = createDrawUtils({ ctx, COLORS: colors, hexToRgba, state });
  const menuRenderer = createMenuRenderer({
    ctx,
    COLORS: colors,
    formatCurrency,
    menuData,
    drawUtils,
    hudState,
    canvas,
    hexToRgba,
    layoutManager,
  });
  const toolbarRenderer = createToolbarRenderer({
    ctx,
    COLORS: colors,
    state,
    hudState,
    layoutManager,
    menuData,
    drawUtils,
    formatCurrency,
    hexToRgba,
  });
  const { render } = createHudRenderer({ ctx, state, hudState, layoutManager, toolbarRenderer, menuRenderer });
  const animations = createHudAnimations({ state, hudState });
  const interactions = createHudInteractions({
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
  });

  return {
    render,
    hitTest: interactions.hitTest,
    handlePointerMove: interactions.handlePointerMove,
    handlePointerDown: interactions.handlePointerDown,
    handlePointerUp: interactions.handlePointerUp,
    isPointerOverHud: interactions.isPointerOverHud,
    showMoneyChange: animations.showMoneyChange,
    updateMoneyChangeAnimation: animations.updateMoneyChangeAnimation,
    closeAllMenus: interactions.closeAllMenus,
    computeLayout: layoutManager.computeLayout,
    handleMenuScroll: interactions.handleMenuScroll,
  };
}

export function createHudAnimations({ state, hudState, menuRenderer }) {
  const updateMoneyChangeAnimation = () => {
    if (hudState.moneyChangeOpacity <= 0) return false;

    const elapsed = performance.now() - hudState.moneyChangeStart;
    const visibleDuration = 2000;
    const fadeDuration = 300;

    if (elapsed < visibleDuration) {
      hudState.moneyChangeOpacity = 1;
    } else if (elapsed < visibleDuration + fadeDuration) {
      hudState.moneyChangeOpacity = 1 - (elapsed - visibleDuration) / fadeDuration;
    } else {
      hudState.moneyChangeOpacity = 0;
    }

    return hudState.moneyChangeOpacity > 0;
  };

  const showMoneyChange = (amount) => {
    if (amount === 0) return;
    hudState.moneyChangeAmount = amount;
    hudState.moneyChangeOpacity = 1;
    hudState.moneyChangeStart = performance.now();
    state.needsRender = true;
  };

  const stopMenuMomentum = () => {
    hudState.menuMomentumActive = false;
    hudState.menuScrollVelocity = 0;
    hudState.menuMomentumLastTime = 0;
  };

  const updateMenuMomentum = () => {
    if (!hudState.menuMomentumActive || !hudState.openMenuKey) return false;

    const dropdown = hudState.layout?.dropdowns?.find((d) => d.menu === hudState.openMenuKey);
    if (!dropdown) {
      stopMenuMomentum();
      return false;
    }

    const bounds = menuRenderer.getMenuBounds(dropdown);
    if (!bounds || !bounds.scrollable) {
      stopMenuMomentum();
      return false;
    }

    const now = performance.now();
    const elapsed = hudState.menuMomentumLastTime ? now - hudState.menuMomentumLastTime : 16;
    hudState.menuMomentumLastTime = now;

    const friction = 0.92;
    hudState.menuScrollVelocity *= Math.pow(friction, elapsed / 16);

    const nextOffset = hudState.menuScrollOffset + hudState.menuScrollVelocity * elapsed;
    const clampedOffset = Math.max(0, Math.min(bounds.maxScroll, nextOffset));
    const hitEdge = clampedOffset !== nextOffset;

    if (clampedOffset !== hudState.menuScrollOffset) {
      hudState.menuScrollOffset = clampedOffset;
    }

    const isSettled = Math.abs(hudState.menuScrollVelocity) < 0.02 || hitEdge;
    if (isSettled) {
      stopMenuMomentum();
    }

    return !isSettled;
  };

  return {
    updateMoneyChangeAnimation,
    updateMenuMomentum,
    showMoneyChange,
  };
}

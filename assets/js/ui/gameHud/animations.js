export function createHudAnimations({ state, hudState }) {
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

  return {
    updateMoneyChangeAnimation,
    showMoneyChange,
  };
}

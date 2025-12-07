export function createFeedback({ dom, state, formatCurrency }) {
  let moneyChangeHideTimeout = null;

  const updateTotalDisplay = () => {
    if (dom.totalDisplay) dom.totalDisplay.textContent = formatCurrency(state.totalMoney, true);
  };

  const showAggregateMoneyChange = (amount) => {
    const el = dom.moneyChangeDisplay;
    if (!el || amount === 0) return;
    const isGain = amount >= 0;
    const valueText = `${isGain ? "+" : "-"}${formatCurrency(Math.abs(amount), true)}`;
    el.textContent = valueText;
    el.classList.remove("hidden");
    el.classList.remove("text-red-400", "text-accent", "text-accent-soft");
    if (isGain) el.classList.add("text-accent");
    else el.classList.add("text-red-400");
    requestAnimationFrame(() => {
      el.classList.remove("opacity-0");
      el.classList.add("opacity-100");
    });
    if (moneyChangeHideTimeout) clearTimeout(moneyChangeHideTimeout);
    moneyChangeHideTimeout = setTimeout(() => {
      el.classList.remove("opacity-100");
      el.classList.add("opacity-0");
      setTimeout(() => {
        el.classList.add("hidden");
      }, 200);
    }, 2200);
  };

  const showActionError = (message, clientX, clientY) => {
    const bubble = document.createElement("div");
    bubble.className = "action-error";
    bubble.textContent = message;
    const clampedX = Math.max(12, Math.min(window.innerWidth - 12, clientX));
    const clampedY = Math.max(12, Math.min(window.innerHeight - 12, clientY - 16));
    bubble.style.left = clampedX + "px";
    bubble.style.top = clampedY + "px";
    document.body.appendChild(bubble);
    setTimeout(() => {
      bubble.style.opacity = "0";
      bubble.style.transition = "opacity 120ms ease";
      setTimeout(() => bubble.remove(), 150);
    }, 1200);
  };

  return {
    updateTotalDisplay,
    showAggregateMoneyChange,
    showActionError,
  };
}

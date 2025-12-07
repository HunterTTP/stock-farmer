export function createSizeMenus({
  dom,
  state,
  sizes,
  formatCurrency,
  openConfirmModal,
  onMoneyChanged,
  closeAllMenus,
  saveState,
}) {
  const currentSizeOption = () => sizes[state.selectedSizeKey] || sizes.single;

  function renderSizeMenuFor(menuEl, variant = "text", onSelectionChange = null) {
    if (!menuEl) return;
    menuEl.innerHTML = "";
    let chainLocked = false;
    Object.values(sizes).forEach((size) => {
      const locked = !size.unlocked;
      const canAffordUnlock = locked && typeof size.unlockCost === "number" && state.totalMoney >= size.unlockCost;
      const gatedLocked = locked && chainLocked;
      const row = document.createElement("button");
      row.type = "button";
      row.className = "w-full px-3 py-2 rounded-lg flex items-center justify-between text-sm border border-transparent hover:border-neutral-700 hover:bg-neutral-900/80 transition";
      if (size.id === state.selectedSizeKey) row.classList.add("border-accent", "bg-neutral-900/70");
      if (locked && !canAffordUnlock) row.classList.add("opacity-50", "cursor-not-allowed");
      if (gatedLocked) row.classList.add("opacity-50", "cursor-not-allowed");

      const left = document.createElement("div");
      left.className = "flex items-center gap-2";
      const label = document.createElement("span");
      label.textContent = size.name;
      left.appendChild(label);
      row.appendChild(left);

      if (locked && typeof size.unlockCost === "number") {
        const cost = document.createElement("span");
        cost.className = "text-[11px] font-semibold text-amber-300 ml-3";
        cost.textContent = `Unlock for ${formatCurrency(size.unlockCost)}`;
        row.appendChild(cost);
      }

      row.disabled = locked && (!canAffordUnlock || gatedLocked);
      row.addEventListener("click", () => {
        if (gatedLocked) return;
        if (locked) {
          if (!canAffordUnlock) return;
          openConfirmModal(
            `Unlock ${size.name} for ${formatCurrency(size.unlockCost)}?`,
            () => {
              state.totalMoney -= size.unlockCost;
              size.unlocked = true;
              state.selectedSizeKey = size.id;
              onMoneyChanged();
              renderSizeMenu(onSelectionChange);
              state.needsRender = true;
              closeAllMenus();
              saveState();
            },
            "Confirm Unlock",
            null,
            { confirmVariant: "primary" }
          );
          return;
        }
        state.selectedSizeKey = size.id;
        renderSizeMenu(onSelectionChange);
        state.needsRender = true;
        closeAllMenus();
        saveState();
      });

      menuEl.appendChild(row);
      if (locked && !chainLocked) chainLocked = true;
    });
  }

  function renderSizeMenu(onSelectionChange = null) {
    renderSizeMenuFor(dom.plantSizeMenu, "text", onSelectionChange);
    if (onSelectionChange) onSelectionChange();
  }

  return {
    currentSizeOption,
    renderSizeMenu,
  };
}

export function createUIControls({ dom, state, crops, stocks, sizes, formatCurrency, cropImageSrc, onMoneyChanged, saveState, centerView, resetFarm }) {
  let pendingConfirmAction = null;
  let sizeMenuVisible = false;

  const currentSizeOption = () => sizes[state.selectedSizeKey] || sizes.single;

  function openOffcanvas() {
    if (!dom.navOffcanvas || !dom.navOverlay || !dom.navToggle) return;
    dom.navOffcanvas.classList.remove("translate-x-full");
    dom.navOverlay.classList.remove("hidden");
    dom.navToggle.setAttribute("aria-expanded", "true");
  }

  function closeOffcanvas() {
    if (!dom.navOffcanvas || !dom.navOverlay || !dom.navToggle) return;
    dom.navOffcanvas.classList.add("translate-x-full");
    dom.navOverlay.classList.add("hidden");
    dom.navToggle.setAttribute("aria-expanded", "false");
  }

  function toggleOffcanvas() {
    if (!dom.navOffcanvas) return;
    const isClosed = dom.navOffcanvas.classList.contains("translate-x-full");
    if (isClosed) openOffcanvas();
    else closeOffcanvas();
  }

  function closeConfirmModal() {
    if (!dom.confirmModal) return;
    dom.confirmModal.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
    pendingConfirmAction = null;
  }

  function openConfirmModal(message, onConfirm, title = "Confirm") {
    if (!dom.confirmModal || !dom.confirmMessage || !dom.confirmConfirm || !dom.confirmCancel) {
      onConfirm();
      return;
    }
    if (dom.confirmTitle) dom.confirmTitle.textContent = title;
    dom.confirmMessage.textContent = message;
    pendingConfirmAction = onConfirm;
    dom.confirmModal.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    dom.confirmConfirm.focus();
  }

  function updateStatsToggleUI() {
    if (!dom.toggleStatsBtn) return;
    dom.toggleStatsBtn.textContent = "Show Stats";
    dom.toggleStatsBtn.classList.toggle("bg-emerald-600", state.showStats);
    dom.toggleStatsBtn.classList.toggle("text-white", state.showStats);
    dom.toggleStatsBtn.classList.toggle("border-emerald-500", state.showStats);
    dom.toggleStatsBtn.classList.toggle("bg-neutral-800", !state.showStats);
    dom.toggleStatsBtn.classList.toggle("text-neutral-200", !state.showStats);
    dom.toggleStatsBtn.classList.toggle("border-neutral-600", !state.showStats);
  }

  function updateModeButtonsUI() {
    const plantingMode = !state.hoeSelected;
    if (dom.hoeButton) {
      dom.hoeButton.classList.toggle("border-emerald-500", state.hoeSelected);
      dom.hoeButton.classList.toggle("border-neutral-700", !state.hoeSelected);
      dom.hoeButton.classList.remove("bg-emerald-500/10");
      dom.hoeButton.setAttribute("aria-pressed", state.hoeSelected ? "true" : "false");
    }
    if (dom.cropStockButton) {
      dom.cropStockButton.classList.toggle("border-emerald-500", plantingMode);
      dom.cropStockButton.classList.toggle("border-neutral-700", !plantingMode);
    }
  }

  function updateCropStockButtonUI() {
    if (!dom.cropStockButton) return;
    const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
    const stock = stocks[state.selectedStockKey];
    const src = cropImageSrc(crop ? crop.id : null);
    if (dom.cropStockImage) {
      dom.cropStockImage.src = src;
      dom.cropStockImage.alt = crop ? crop.name : "Crop";
    }
    const stockText = stock ? stock.symbol : "";
    if (dom.cropStockStockLabel) {
      dom.cropStockStockLabel.textContent = stockText;
      const len = stockText.length || 1;
      const fontSize = len > 6 ? 8 : len > 4 ? 9 : 11;
      dom.cropStockStockLabel.style.fontSize = fontSize + "px";
    }
    if (dom.cropStockStockWrapper) {
      const hideStock = crop && (crop.id === "grass" || crop.id === "farmland");
      dom.cropStockStockWrapper.classList.toggle("hidden", hideStock);
    }
  }

  function updateSizeButtonUI() {
    if (!dom.sizeButton) return;
    const size = currentSizeOption();
    if (dom.sizeButtonLabel) dom.sizeButtonLabel.textContent = size ? size.name : "";
  }

  function renderSizeMenu() {
    if (!dom.sizeMenu) return;
    dom.sizeMenu.innerHTML = "";
    Object.values(sizes).forEach((size) => {
      const locked = !size.unlocked;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-full px-3 py-2 text-left text-[11px] font-semibold border-b border-neutral-800 last:border-b-0 flex items-center justify-between";
      if (!locked) btn.classList.add("hover:bg-neutral-800");
      btn.textContent = size.name;
      if (size.id === state.selectedSizeKey) {
        btn.classList.add("text-emerald-400");
      } else {
        btn.classList.add(locked ? "text-neutral-600" : "text-neutral-100");
      }
      let unlockCostEl = null;
      if (locked && typeof size.unlockCost === "number") {
        unlockCostEl = document.createElement("span");
        unlockCostEl.textContent = `Unlock: ${formatCurrency(size.unlockCost)}`;
        unlockCostEl.className = "text-[10px] font-normal";
        btn.appendChild(unlockCostEl);
      }
      const canAffordUnlock = locked && typeof size.unlockCost === "number" && state.totalMoney >= size.unlockCost;
      btn.disabled = locked && !canAffordUnlock;
      if (unlockCostEl) {
        unlockCostEl.classList.toggle("text-amber-300", canAffordUnlock);
        unlockCostEl.classList.toggle("text-neutral-600", !canAffordUnlock);
      }
      btn.addEventListener("click", () => {
        if (locked) {
          if (!canAffordUnlock) return;
          openConfirmModal(
            `Unlock ${size.name} for ${formatCurrency(size.unlockCost)}?`,
            () => {
              state.totalMoney -= size.unlockCost;
              size.unlocked = true;
              state.selectedSizeKey = size.id;
              onMoneyChanged();
              renderSizeMenu();
              updateSizeButtonUI();
              state.needsRender = true;
              saveState();
              if (dom.sizeMenu) dom.sizeMenu.classList.add("hidden");
              sizeMenuVisible = false;
            },
            "Confirm Unlock"
          );
          return;
        }
        state.selectedSizeKey = size.id;
        renderSizeMenu();
        updateSizeButtonUI();
        state.needsRender = true;
        saveState();
        dom.sizeMenu.classList.add("hidden");
        sizeMenuVisible = false;
      });
      dom.sizeMenu.appendChild(btn);
    });
  }

  function closeSizeMenu() {
    if (!dom.sizeMenu) return;
    dom.sizeMenu.classList.add("hidden");
    sizeMenuVisible = false;
  }

  function renderCropOptions() {
    if (!dom.cropGrid) return;
    dom.cropGrid.innerHTML = "";
    Object.values(crops).forEach((crop) => {
      const card = document.createElement("button");
      card.type = "button";
      const canAffordUnlock = !crop.unlocked && typeof crop.unlockCost === "number" && crop.unlockCost > 0 && state.totalMoney >= crop.unlockCost;
      let baseClass = "relative w-full aspect-square rounded-md overflow-hidden border text-left bg-neutral-900";
      if (crop.id === state.selectedCropKey) baseClass += " border-emerald-500 ring-1 ring-emerald-500";
      else if (!crop.unlocked && canAffordUnlock) baseClass += " border-amber-400/60 hover:border-amber-300";
      else baseClass += " border-neutral-700 hover:border-neutral-500";
      if (!crop.unlocked) {
        baseClass += " cursor-pointer";
        if (!canAffordUnlock) baseClass += " opacity-40";
      } else {
        baseClass += " cursor-pointer";
      }
      card.className = baseClass;

      const img = document.createElement("img");
      if (crop.id === "grass") img.src = "images/grass.jpg";
      else if (crop.id === "farmland") img.src = "images/farmland.jpg";
      else img.src = `images/${crop.id}/${crop.id}-phase-4.png`;
      img.alt = crop.name;
      img.className = "absolute inset-0 w-full h-full object-cover";
      if (!crop.unlocked && !canAffordUnlock) img.className += " grayscale";
      card.appendChild(img);

      const overlay = document.createElement("div");
      overlay.className = "relative z-10 h-full flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2 text-[10px] space-y-0.5";
      if (crop.id === "grass") {
        overlay.innerHTML = `<div class="font-semibold text-xs text-white">${crop.name}</div><div class="text-neutral-200">Cost: Free</div>`;
      } else if (crop.id === "farmland") {
        const nextCost = crop.placed < 4 ? 0 : 25;
        const costText = nextCost === 0 ? "Cost: Free" : `Cost: ${formatCurrency(nextCost)}`;
        overlay.innerHTML = `<div class="font-semibold text-xs text-white">${crop.name}</div><div class="text-neutral-200">${costText}</div>`;
      } else {
        const plantCost = typeof crop.placeCost === "number" ? crop.placeCost : 0;
        const costText = plantCost > 0 ? formatCurrency(plantCost) : "Free";
        const sellText = formatCurrency(crop.baseValue);
        overlay.innerHTML =
          `<div class="font-semibold text-xs text-white">${crop.name}</div>` +
          `<div class="text-neutral-200">Cost: ${costText}</div>` +
          `<div class="text-neutral-200">Sell: ${sellText}</div>` +
          `<div class="text-neutral-300">Time: ${crop.growMinutes} min</div>`;
        if (!crop.unlocked && crop.unlockCost > 0) {
          overlay.innerHTML += `<div class="text-[9px] font-normal text-amber-300 mt-1">Unlock: ${formatCurrency(crop.unlockCost)}</div>`;
        }
      }
      card.appendChild(overlay);

      card.addEventListener("click", () => {
        if (!crop.unlocked) {
          if (crop.unlockCost > 0 && state.totalMoney >= crop.unlockCost) {
            openConfirmModal(
              `Unlock ${crop.name} for ${formatCurrency(crop.unlockCost)}?`,
              () => {
                state.totalMoney -= crop.unlockCost;
                crop.unlocked = true;
                state.selectedCropKey = crop.id;
                state.previousCropKey = crop.id;
                onMoneyChanged();
                updateCropStockButtonUI();
                saveState();
              },
              "Confirm Unlock"
            );
          }
          return;
        }
        state.selectedCropKey = crop.id;
        state.previousCropKey = crop.id;
        renderCropOptions();
        updateCropStockButtonUI();
        saveState();
      });

      dom.cropGrid.appendChild(card);
    });
  }

  function renderStockOptions() {
    if (!dom.stockGrid) return;
    dom.stockGrid.innerHTML = "";
    Object.values(stocks).forEach((stock) => {
      const btn = document.createElement("button");
      btn.type = "button";
      let cls = "w-full aspect-square rounded-md border flex items-center justify-center text-[11px] font-semibold tracking-wide";
      if (stock.symbol === state.selectedStockKey) cls += " border-emerald-500 bg-emerald-500/10";
      else cls += " border-neutral-700 bg-neutral-900 hover:bg-neutral-800";
      btn.className = cls;
      btn.textContent = stock.symbol;
      btn.addEventListener("click", () => {
        state.selectedStockKey = stock.symbol;
        renderStockOptions();
        updateCropStockButtonUI();
        saveState();
      });
      dom.stockGrid.appendChild(btn);
    });
  }

  function updateTotalDisplay() {
    if (dom.totalDisplay) dom.totalDisplay.textContent = formatCurrency(state.totalMoney, true);
  }

  function refreshAllUI() {
    updateTotalDisplay();
    renderStockOptions();
    updateCropStockButtonUI();
    updateSizeButtonUI();
    renderSizeMenu();
    updateModeButtonsUI();
    updateStatsToggleUI();
  }

  function showActionError(message, clientX, clientY) {
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
  }

  function bindUIEvents() {
    if (dom.navToggle) dom.navToggle.addEventListener("click", toggleOffcanvas);
    if (dom.navClose) dom.navClose.addEventListener("click", closeOffcanvas);
    if (dom.navOverlay) dom.navOverlay.addEventListener("click", closeOffcanvas);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeConfirmModal();
        closeOffcanvas();
      }
    });

    if (dom.recenterBtn) {
      dom.recenterBtn.addEventListener("click", () => {
        centerView();
        closeOffcanvas();
      });
    }

    if (dom.confirmCancel) dom.confirmCancel.addEventListener("click", closeConfirmModal);
    if (dom.confirmClose) dom.confirmClose.addEventListener("click", closeConfirmModal);
    if (dom.confirmConfirm) {
      dom.confirmConfirm.addEventListener("click", () => {
        if (pendingConfirmAction) pendingConfirmAction();
        closeConfirmModal();
      });
    }

    if (dom.toggleStatsBtn) {
      dom.toggleStatsBtn.addEventListener("click", () => {
        state.showStats = !state.showStats;
        updateStatsToggleUI();
        state.needsRender = true;
        saveState();
      });
    }

    if (dom.resetFarmBtn) {
      dom.resetFarmBtn.addEventListener("click", () => {
        openConfirmModal("Reset your farm and start fresh? This clears all progress.", resetFarm, "Reset Farm");
      });
    }

    if (dom.hoeButton) {
      dom.hoeButton.addEventListener("click", () => {
        state.hoeSelected = !state.hoeSelected;
        updateModeButtonsUI();
        state.needsRender = true;
        saveState();
      });
    }

    if (dom.cropStockButton) {
      dom.cropStockButton.addEventListener("click", () => {
        state.hoeSelected = false;
        if (!state.selectedCropKey) {
          const firstUnlocked = Object.values(crops).find((c) => c && c.unlocked);
          if (firstUnlocked) {
            state.selectedCropKey = firstUnlocked.id;
            state.previousCropKey = firstUnlocked.id;
          }
        }
        updateModeButtonsUI();
        state.needsRender = true;
        saveState();
      });
    }

    if (dom.sizeButton) {
      dom.sizeButton.addEventListener("click", (e) => {
        e.stopPropagation();
        if (sizeMenuVisible) {
          closeSizeMenu();
        } else {
          renderSizeMenu();
          dom.sizeMenu?.classList.remove("hidden");
          sizeMenuVisible = true;
        }
      });
    }

    document.addEventListener("click", (e) => {
      if (!sizeMenuVisible) return;
      if (dom.sizeMenu && (dom.sizeMenu.contains(e.target) || (dom.sizeButton && dom.sizeButton.contains(e.target)))) return;
      closeSizeMenu();
    });
  }

  return {
    bindUIEvents,
    refreshAllUI,
    currentSizeOption,
    updateTotalDisplay,
    updateStatsToggleUI,
    updateModeButtonsUI,
    updateCropStockButtonUI,
    updateSizeButtonUI,
    renderSizeMenu,
    renderCropOptions,
    renderStockOptions,
    openConfirmModal,
    closeConfirmModal,
    openOffcanvas,
    closeOffcanvas,
    toggleOffcanvas,
    showActionError,
  };
}

export function createUIControls({ dom, state, crops, stocks, sizes, formatCurrency, onMoneyChanged, saveState, centerView, resetFarm, clearCache }) {
  let pendingConfirmAction = null;
  let pendingCancelAction = null;
  let openMenuKey = null;
  const confirmVariantClasses = {
    primary: "py-2 rounded-md bg-sky-600 text-white text-sm font-semibold hover:bg-sky-500 focus:outline-none",
    danger: "py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-500 focus:outline-none",
  };
  const defaultCancelBtnClass = "py-2 rounded-md border border-neutral-700 bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 focus:outline-none";
  const modeOrder = ["plant", "harvest", "build"];

  const currentSizeOption = () => sizes[state.selectedSizeKey] || sizes.single;

  function formatGrowTime(minutes) {
    if (!Number.isFinite(minutes)) return "";
    if (minutes === 60) return "1hr";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0 && mins === 0) return `${hrs}hr`;
    if (hrs > 0) return `${hrs}hr ${mins}m`;
    return `${minutes}m`;
  }

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
    pendingCancelAction = null;
  }

  function openConfirmModal(message, onConfirm, title = "Confirm", onCancel = null, options = {}) {
    if (!dom.confirmModal || !dom.confirmMessage || !dom.confirmConfirm || !dom.confirmCancel) {
      onConfirm();
      return;
    }
    const { confirmText = "Confirm", cancelText = "Cancel", showCancel = true, hideClose = false, confirmVariant = "primary" } = options;
    const confirmBaseClass = confirmVariantClasses[confirmVariant] || confirmVariantClasses.primary;
    const confirmWidthClass = showCancel ? "w-full sm:w-1/2" : "w-full";

    if (dom.confirmTitle) dom.confirmTitle.textContent = title;
    dom.confirmMessage.textContent = message;
    dom.confirmConfirm.textContent = confirmText;
    dom.confirmConfirm.className = `${confirmWidthClass} ${confirmBaseClass}`;
    dom.confirmCancel.textContent = cancelText;
    dom.confirmCancel.className = `${showCancel ? "w-full sm:w-1/2" : "hidden"} ${defaultCancelBtnClass}`;
    dom.confirmClose?.classList.toggle("hidden", hideClose);
    pendingConfirmAction = onConfirm;
    pendingCancelAction = onCancel;
    dom.confirmModal.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    dom.confirmConfirm.focus();
  }

  function updateHideButtonsUI() {
    if (dom.showTickerToggle) dom.showTickerToggle.checked = !!state.showTickerInfo;
    if (dom.showPctToggle) dom.showPctToggle.checked = !!state.showPctInfo;
    if (dom.showTimerToggle) dom.showTimerToggle.checked = !!state.showTimerInfo;
    if (dom.showSellToggle) dom.showSellToggle.checked = !!state.showSellInfo;
    if (dom.statBaseSize) {
      const val = Math.round(state.statBaseSize ?? 14);
      dom.statBaseSize.value = val;
      const label = document.getElementById("statSizeValue");
      if (label) label.textContent = `${val}`;
    }
    if (dom.statTextAlpha) {
      const pct = Math.round((state.statTextAlpha ?? 1) * 100);
      dom.statTextAlpha.value = pct;
      const label = document.getElementById("statTextAlphaValue");
      if (label) label.textContent = `${pct}%`;
    }
    if (dom.statBgAlpha) {
      const pct = Math.round((state.statBgAlpha ?? 1) * 100);
      dom.statBgAlpha.value = pct;
      const label = document.getElementById("statBgAlphaValue");
      if (label) label.textContent = `${pct}%`;
    }
  }

  function ensurePlantDefaults() {
    if (!state.selectedCropKey) {
      const fallback = state.previousCropKey && crops[state.previousCropKey] && crops[state.previousCropKey].unlocked ? crops[state.previousCropKey] : null;
      const firstUnlocked = fallback || Object.values(crops).find((c) => c && c.unlocked);
      if (firstUnlocked) {
        state.selectedCropKey = firstUnlocked.id;
        state.previousCropKey = firstUnlocked.id;
      }
    }
    if (!state.selectedStockKey) {
      const firstStock = Object.values(stocks)[0];
      if (firstStock) state.selectedStockKey = firstStock.symbol;
    }
  }

  function updateModeButtonsUI() {
    const active = state.activeMode || "plant";
    const entries = [
      { key: "plant", el: dom.modePlantBtn },
      { key: "harvest", el: dom.modeHarvestBtn },
      { key: "build", el: dom.modeBuildBtn },
    ];
    entries.forEach(({ key, el }) => {
      if (!el) return;
      const isActive = key === active;
      el.classList.toggle("border-emerald-500", isActive);
      el.classList.toggle("shadow-emerald-500/20", isActive);
      el.classList.toggle("border-neutral-800", !isActive);
      el.classList.add("bg-neutral-900/80", "text-white");
      el.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function renderDropdownGroups() {
    const active = state.activeMode || "plant";
    if (dom.plantDropdowns) dom.plantDropdowns.classList.toggle("hidden", active !== "plant");
    if (dom.harvestDropdowns) dom.harvestDropdowns.classList.toggle("hidden", active !== "harvest");
    if (dom.buildDropdowns) dom.buildDropdowns.classList.toggle("hidden", active !== "build");
  }

  function setActiveMode(nextMode) {
    if (!modeOrder.includes(nextMode)) return;
    if (nextMode === "plant") ensurePlantDefaults();
    state.activeMode = nextMode;
    state.hoeSelected = nextMode === "harvest";
    closeAllMenus();
    updateModeButtonsUI();
    renderSizeMenu();
    if (nextMode === "plant") renderCropOptions();
    if (nextMode === "plant") renderStockOptions();
    if (nextMode === "build") renderBuildOptions();
    renderDropdownGroups();
    state.needsRender = true;
    saveState();
  }

  function cropThumbSrc(cropId) {
    if (cropId === "grass") return "images/grass.jpg";
    if (cropId === "farmland") return "images/farmland.jpg";
    if (!cropId) return "images/farmland.jpg";
    return `images/crops/${cropId}/${cropId}-phase-4.png`;
  }

  function renderPlantCropMenu() {
    if (!dom.plantCropMenu) return;
    dom.plantCropMenu.innerHTML = "";
    let chainLocked = false;
    Object.values(crops).forEach((crop) => {
      const canAffordUnlock = !crop.unlocked && typeof crop.unlockCost === "number" && crop.unlockCost > 0 && state.totalMoney >= crop.unlockCost;
      const gatedLocked = !crop.unlocked && chainLocked;
      const item = document.createElement("button");
      item.type = "button";
      item.className = "w-full px-3 py-2 rounded-lg flex items-center gap-3 text-left border border-transparent hover:border-neutral-700 hover:bg-neutral-900/80 transition";
      if (!crop.unlocked && !canAffordUnlock) item.classList.add("opacity-50", "cursor-not-allowed");
      if (gatedLocked) item.classList.add("opacity-50", "cursor-not-allowed");
      if (crop.id === state.selectedCropKey) item.classList.add("border-emerald-500", "bg-neutral-900/70");

      const img = document.createElement("img");
      img.src = cropThumbSrc(crop.id);
      img.alt = crop.name;
      img.className = "w-5 h-5 rounded-sm object-cover border border-neutral-800";
      item.appendChild(img);

      const textWrap = document.createElement("div");
      textWrap.className = "flex-1 min-w-0";
      const title = document.createElement("div");
      title.className = "text-sm font-semibold text-white truncate";
      title.textContent = crop.name;
      const meta = document.createElement("div");
      meta.className = "text-[11px] text-neutral-400 truncate";
      if (crop.id === "grass") meta.textContent = "Free";
      else if (crop.id === "farmland") meta.textContent = crop.placed < 4 ? "Free" : formatCurrency(25);
      else {
        const costText = typeof crop.placeCost === "number" && crop.placeCost > 0 ? formatCurrency(crop.placeCost) : "Free";
        meta.textContent = `Cost ${costText} • Sell ${formatCurrency(crop.baseValue)} • ${formatGrowTime(crop.growMinutes)}`;
      }
      textWrap.appendChild(title);
      textWrap.appendChild(meta);
      item.appendChild(textWrap);

      if (!crop.unlocked && crop.unlockCost > 0) {
        const lockHint = document.createElement("div");
        lockHint.className = "text-[11px] font-semibold text-amber-300";
        lockHint.textContent = formatCurrency(crop.unlockCost);
        item.appendChild(lockHint);
      }

      item.addEventListener("click", () => {
        if (gatedLocked) return;
        if (!crop.unlocked) {
          if (crop.unlockCost > 0 && state.totalMoney >= crop.unlockCost) {
            openConfirmModal(
              `Unlock ${crop.name} for ${formatCurrency(crop.unlockCost)}?`,
              () => {
                state.totalMoney -= crop.unlockCost;
                crop.unlocked = true;
                state.selectedCropKey = crop.id;
                state.previousCropKey = crop.id;
                state.needsRender = true;
                onMoneyChanged();
                renderCropOptions();
                closeAllMenus();
                saveState();
              },
              "Confirm Unlock"
            );
          }
          return;
        }
        state.selectedCropKey = crop.id;
        state.previousCropKey = crop.id;
        state.needsRender = true;
        renderCropOptions();
        closeAllMenus();
        saveState();
      });

      dom.plantCropMenu.appendChild(item);
      if (!crop.unlocked && !chainLocked) chainLocked = true;
    });
  }

  function renderCropOptions() {
    renderPlantCropMenu();
    updateSelectionLabels();
  }

  function renderPlantStockMenu() {
    if (!dom.plantStockMenu) return;
    dom.plantStockMenu.innerHTML = "";
    Object.values(stocks).forEach((stock) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-full px-3 py-2 rounded-lg flex items-center justify-between text-sm font-semibold border border-transparent hover:border-neutral-700 hover:bg-neutral-900/80 transition";
      if (stock.symbol === state.selectedStockKey) btn.classList.add("border-emerald-500", "bg-neutral-900/70");
      btn.textContent = stock.symbol;
      btn.addEventListener("click", () => {
        state.selectedStockKey = stock.symbol;
        renderStockOptions();
        state.needsRender = true;
        closeAllMenus();
        saveState();
      });
      dom.plantStockMenu.appendChild(btn);
    });
  }

  function renderStockOptions() {
    renderPlantStockMenu();
    updateSelectionLabels();
  }

  function renderSizeMenuFor(menuEl, variant = "text") {
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
      if (size.id === state.selectedSizeKey) row.classList.add("border-emerald-500", "bg-neutral-900/70");
      if (locked && !canAffordUnlock) row.classList.add("opacity-50", "cursor-not-allowed");
      if (gatedLocked) row.classList.add("opacity-50", "cursor-not-allowed");

      const left = document.createElement("div");
      left.className = "flex items-center gap-2";
      if (variant === "harvest") {
        const icon = document.createElement("img");
        icon.src = "images/hoe/hoe-phase-1.png";
        icon.alt = "Hoe";
        icon.className = "w-5 h-5 object-contain";
        left.appendChild(icon);
      }
      const label = document.createElement("span");
      label.textContent = size.name;
      left.appendChild(label);
      row.appendChild(left);

      if (locked && typeof size.unlockCost === "number") {
        const cost = document.createElement("span");
        cost.className = "text-[11px] font-semibold text-amber-300";
        cost.textContent = formatCurrency(size.unlockCost);
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
              renderSizeMenu();
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
        renderSizeMenu();
        state.needsRender = true;
        closeAllMenus();
        saveState();
      });

      menuEl.appendChild(row);
      if (locked && !chainLocked) chainLocked = true;
    });
  }

  function renderSizeMenu() {
    renderSizeMenuFor(dom.plantSizeMenu, "text");
    renderSizeMenuFor(dom.harvestSizeMenu, "harvest");
    updateSelectionLabels();
  }

  function renderBuildOptions() {
    if (dom.buildSelectLabel) dom.buildSelectLabel.textContent = "Coming soon..";
  }

  const menuMap = {
    plantCrop: () => ({ button: dom.plantCropButton, menu: dom.plantCropMenu }),
    plantStock: () => ({ button: dom.plantStockButton, menu: dom.plantStockMenu }),
    plantSize: () => ({ button: dom.plantSizeButton, menu: dom.plantSizeMenu }),
    harvestSize: () => ({ button: dom.harvestSizeButton, menu: dom.harvestSizeMenu }),
  };

  function closeAllMenus() {
    Object.values(menuMap).forEach((get) => {
      const { menu } = get();
      if (menu) menu.classList.add("hidden");
    });
    openMenuKey = null;
  }

  function toggleMenu(key) {
    const entry = menuMap[key]?.();
    if (!entry || !entry.menu) return;
    const shouldOpen = openMenuKey !== key;
    closeAllMenus();
    if (shouldOpen) {
      entry.menu.classList.remove("hidden");
      openMenuKey = key;
    }
  }

  function updateSelectionLabels() {
    const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
    if (dom.plantCropLabel) dom.plantCropLabel.textContent = crop ? crop.name : "Crop";
    if (dom.plantCropImage) {
      dom.plantCropImage.src = cropThumbSrc(crop ? crop.id : null);
      dom.plantCropImage.alt = crop ? crop.name : "Crop";
    }
    const stock = state.selectedStockKey ? stocks[state.selectedStockKey] : null;
    if (dom.plantStockLabel) dom.plantStockLabel.textContent = stock ? stock.symbol : "Stock";
    const size = currentSizeOption();
    if (dom.plantSizeLabel) dom.plantSizeLabel.textContent = size ? size.name : "Size";
    if (dom.harvestSizeLabel) dom.harvestSizeLabel.textContent = size ? size.name : "Size";
    if (dom.buildSelectLabel) dom.buildSelectLabel.textContent = "Coming soon..";
  }

  function bindMenuToggle(button, key) {
    if (!button) return;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu(key);
    });
  }

  function updateTotalDisplay() {
    if (dom.totalDisplay) dom.totalDisplay.textContent = formatCurrency(state.totalMoney, true);
  }

  function refreshAllUI() {
    ensurePlantDefaults();
    updateTotalDisplay();
    renderStockOptions();
    renderCropOptions();
    renderSizeMenu();
    renderBuildOptions();
    updateModeButtonsUI();
    updateHideButtonsUI();
    renderDropdownGroups();
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
        if (pendingCancelAction) pendingCancelAction();
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

    if (dom.confirmConfirm) {
      dom.confirmConfirm.addEventListener("click", () => {
        if (pendingConfirmAction) pendingConfirmAction();
        closeConfirmModal();
      });
    }
    if (dom.confirmCancel) {
      dom.confirmCancel.addEventListener("click", () => {
        if (pendingCancelAction) pendingCancelAction();
        closeConfirmModal();
      });
    }
    if (dom.confirmClose) {
      dom.confirmClose.addEventListener("click", () => {
        if (pendingCancelAction) pendingCancelAction();
        closeConfirmModal();
      });
    }

    const bindShowToggle = (input, key) => {
      if (!input) return;
      input.addEventListener("change", () => {
        state[key] = !!input.checked;
        state.showStats = state.showTickerInfo || state.showPctInfo || state.showTimerInfo || state.showSellInfo;
        updateHideButtonsUI();
        state.needsRender = true;
        saveState();
      });
    };
    bindShowToggle(dom.showTickerToggle, "showTickerInfo");
    bindShowToggle(dom.showPctToggle, "showPctInfo");
    bindShowToggle(dom.showTimerToggle, "showTimerInfo");
    bindShowToggle(dom.showSellToggle, "showSellInfo");

    const bindAlpha = (input, key, labelId) => {
      if (!input) return;
      const label = labelId ? document.getElementById(labelId) : null;
      input.addEventListener("input", () => {
        const val = Math.max(0, Math.min(100, Number(input.value) ?? 0));
        state[key] = val / 100;
        if (label) label.textContent = `${val}%`;
        state.needsRender = true;
        saveState();
      });
    };
    bindAlpha(dom.statTextAlpha, "statTextAlpha", "statTextAlphaValue");
    bindAlpha(dom.statBgAlpha, "statBgAlpha", "statBgAlphaValue");

    if (dom.statBaseSize) {
      const label = document.getElementById("statSizeValue");
      dom.statBaseSize.addEventListener("input", () => {
        const raw = Number(dom.statBaseSize.value);
        const val = Math.max(8, Math.min(24, Number.isFinite(raw) ? raw : 14));
        state.statBaseSize = val;
        if (label) label.textContent = `${val}`;
        state.needsRender = true;
        saveState();
        updateHideButtonsUI();
      });
    }

    if (dom.resetSettingsBtn) {
      dom.resetSettingsBtn.addEventListener("click", () => {
        openConfirmModal(
          "Reset settings to defaults?",
          () => {
            state.showTickerInfo = true;
            state.showPctInfo = true;
            state.showTimerInfo = true;
            state.showSellInfo = true;
            state.statBaseSize = 14;
            state.statTextAlpha = 1;
            state.statBgAlpha = 1;
            state.showStats = true;
            updateHideButtonsUI();
            state.needsRender = true;
            saveState();
          },
          "Reset Settings",
          null,
          { confirmVariant: "primary" }
        );
      });
    }
    if (dom.clearCacheBtn && clearCache) {
      dom.clearCacheBtn.addEventListener("click", () => {
        openConfirmModal("Clear all cached data? If you are not logged in your progress will be lost.", clearCache, "Clear Cache", null, {
          confirmText: "Yes",
          cancelText: "No",
          confirmVariant: "danger",
        });
      });
    }
    if (dom.resetFarmBtn) {
      dom.resetFarmBtn.addEventListener("click", () => {
        openConfirmModal("Reset all progress and start fresh? This cannot be undone.", resetFarm, "Reset Progress", null, { confirmText: "Reset", cancelText: "Cancel", confirmVariant: "danger" });
      });
    }

    if (dom.modePlantBtn) dom.modePlantBtn.addEventListener("click", () => setActiveMode("plant"));
    if (dom.modeHarvestBtn) dom.modeHarvestBtn.addEventListener("click", () => setActiveMode("harvest"));
    if (dom.modeBuildBtn) dom.modeBuildBtn.addEventListener("click", () => setActiveMode("build"));

    bindMenuToggle(dom.plantCropButton, "plantCrop");
    bindMenuToggle(dom.plantStockButton, "plantStock");
    bindMenuToggle(dom.plantSizeButton, "plantSize");
    bindMenuToggle(dom.harvestSizeButton, "harvestSize");

    document.addEventListener("click", (e) => {
      const target = e.target;
      const inside = Object.values(menuMap).some((get) => {
        const { button, menu } = get();
        return (button && button.contains(target)) || (menu && menu.contains(target));
      });
      if (!inside) closeAllMenus();
    });
  }

  return {
    bindUIEvents,
    refreshAllUI,
    currentSizeOption,
    updateTotalDisplay,
    updateHideButtonsUI,
    updateModeButtonsUI,
    updateCropStockButtonUI: () => {
      renderCropOptions();
      renderStockOptions();
    },
    updateSizeButtonUI: () => {
      renderSizeMenu();
    },
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

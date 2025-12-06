export function createUIControls({
  dom,
  state,
  crops,
  sizes,
  buildings,
  formatCurrency,
  onMoneyChanged,
  saveState,
  centerView,
  resetFarm,
  clearCache,
}) {
  let pendingConfirmAction = null;
  let pendingCancelAction = null;
  let openMenuKey = null;
  const confirmVariantClasses = {
    primary:
      "py-2 rounded-md bg-sky-600 text-white text-sm font-semibold hover:bg-sky-500 focus:outline-none",
    danger:
      "py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-500 focus:outline-none",
  };
  const defaultCancelBtnClass =
    "py-2 rounded-md border border-neutral-700 bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 focus:outline-none";
  const modeOrder = ["plant", "harvest", "build"];
  let moneyChangeHideTimeout = null;

  const currentSizeOption = () => sizes[state.selectedSizeKey] || sizes.single;

  function formatDurationMs(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const parts = [];
    if (hrs > 0) parts.push(`${hrs}hr`);
    if (hrs > 0 || mins > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);
    return parts.join(" ");
  }

  function formatGrowTime(minutes) {
    if (!Number.isFinite(minutes)) return "";
    if (minutes > 0 && minutes < 1) {
      const secs = Math.round(minutes * 60);
      return `${secs}sec`;
    }
    if (minutes === 60) return "1hr";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0 && mins === 0) return `${hrs}hr`;
    if (hrs > 0) return `${hrs}hr ${mins}m`;
    return `${minutes}m`;
  }

  function formatHarvestText(crop, plantedAt, nowMs) {
    if (!crop || !Number.isFinite(plantedAt)) return null;
    const growMs = Number.isFinite(crop.growTimeMs)
      ? crop.growTimeMs
      : Number.isFinite(crop.growMinutes)
      ? crop.growMinutes * 60 * 1000
      : null;
    if (!growMs || growMs <= 0) return "Ready";
    const remainingMs = Math.max(0, growMs - (nowMs - plantedAt));
    if (remainingMs <= 0) return "Ready";
    return formatDurationMs(remainingMs);
  }

  function getCropStatus(crop, nowMs) {
    if (!crop) return null;
    if (!crop.placed || crop.placed <= 0) return null;
    const plantedAt = Number.isFinite(crop.lastPlantedAt)
      ? crop.lastPlantedAt
      : null;
    if (!plantedAt || plantedAt <= 0) return null;
    const harvestText = formatHarvestText(crop, plantedAt, nowMs);
    if (!harvestText) return null;
    return { count: crop.placed, harvestText };
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

  function openConfirmModal(
    message,
    onConfirm,
    title = "Confirm",
    onCancel = null,
    options = {}
  ) {
    if (
      !dom.confirmModal ||
      !dom.confirmMessage ||
      !dom.confirmConfirm ||
      !dom.confirmCancel
    ) {
      onConfirm();
      return;
    }
    const {
      confirmText = "Confirm",
      cancelText = "Cancel",
      showCancel = true,
      hideClose = false,
      confirmVariant = "primary",
    } = options;
    const confirmBaseClass =
      confirmVariantClasses[confirmVariant] || confirmVariantClasses.primary;
    const confirmWidthClass = showCancel ? "w-full sm:w-1/2" : "w-full";

    if (dom.confirmTitle) dom.confirmTitle.textContent = title;
    dom.confirmMessage.textContent = message;
    dom.confirmConfirm.textContent = confirmText;
    dom.confirmConfirm.className = `${confirmWidthClass} ${confirmBaseClass}`;
    dom.confirmCancel.textContent = cancelText;
    dom.confirmCancel.className = `${
      showCancel ? "w-full sm:w-1/2" : "hidden"
    } ${defaultCancelBtnClass}`;
    dom.confirmClose?.classList.toggle("hidden", hideClose);
    pendingConfirmAction = onConfirm;
    pendingCancelAction = onCancel;
    dom.confirmModal.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    dom.confirmConfirm.focus();
  }

  function updateHideButtonsUI() {
    if (dom.showTimerToggle)
      dom.showTimerToggle.checked = !!state.showTimerInfo;
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
      const fallback =
        state.previousCropKey &&
        crops[state.previousCropKey] &&
        crops[state.previousCropKey].unlocked
          ? crops[state.previousCropKey]
          : null;
      const firstUnlocked =
        fallback || Object.values(crops).find((c) => c && c.unlocked);
      if (firstUnlocked) {
        state.selectedCropKey = firstUnlocked.id;
        state.previousCropKey = firstUnlocked.id;
      }
    }
  }

  function ensureBuildDefaults() {
    if (state.selectedBuildKey === "sell") return;
    if (state.selectedBuildKey && buildings?.[state.selectedBuildKey]) return;
    const first = Object.values(buildings || {}).find((b) => b && b.unlocked);
    state.selectedBuildKey = first ? first.id : "sell";
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
    if (dom.plantDropdowns)
      dom.plantDropdowns.classList.toggle("hidden", active !== "plant");
    if (dom.harvestDropdowns)
      dom.harvestDropdowns.classList.toggle("hidden", active !== "harvest");
    if (dom.buildDropdowns)
      dom.buildDropdowns.classList.toggle("hidden", active !== "build");
  }

  function setActiveMode(nextMode) {
    if (!modeOrder.includes(nextMode)) return;
    if (nextMode === "plant") ensurePlantDefaults();
    if (nextMode === "build") ensureBuildDefaults();
    state.activeMode = nextMode;
    state.hoeSelected = nextMode === "harvest";
    closeAllMenus();
    updateModeButtonsUI();
    renderSizeMenu();
    if (nextMode === "plant") renderCropOptions();
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

  function renderPlantCropMenu(nowMs) {
    if (!dom.plantCropMenu) return;
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    dom.plantCropMenu.innerHTML = "";
    let chainLocked = false;
    Object.values(crops).forEach((crop) => {
      const canAffordUnlock =
        !crop.unlocked &&
        typeof crop.unlockCost === "number" &&
        crop.unlockCost > 0 &&
        state.totalMoney >= crop.unlockCost;
      const gatedLocked = !crop.unlocked && chainLocked;
      const item = document.createElement("button");
      item.type = "button";
      item.className =
        "w-full px-3 py-2 rounded-lg flex items-center gap-3 text-left border border-transparent hover:border-neutral-700 hover:bg-neutral-900/80 transition";
      if (!crop.unlocked && !canAffordUnlock)
        item.classList.add("opacity-50", "cursor-not-allowed");
      if (gatedLocked) item.classList.add("opacity-50", "cursor-not-allowed");
      if (crop.id === state.selectedCropKey)
        item.classList.add("border-emerald-500", "bg-neutral-900/70");

      const img = document.createElement("img");
      img.src = cropThumbSrc(crop.id);
      img.alt = crop.name;
      img.className =
        "w-5 h-5 rounded-sm object-cover border border-neutral-800";
      item.appendChild(img);

      const textWrap = document.createElement("div");
      textWrap.className = "flex-1 min-w-0";
      const title = document.createElement("div");
      title.className = "text-sm font-semibold text-white truncate";
      title.textContent = crop.name;
      const meta = document.createElement("div");
      meta.className = "text-[11px] text-neutral-400 truncate";
      if (crop.id === "grass") meta.textContent = "Free";
      else if (crop.id === "farmland")
        meta.textContent = crop.placed < 4 ? "Free" : formatCurrency(25);
      else {
        const costText =
          typeof crop.placeCost === "number" && crop.placeCost > 0
            ? formatCurrency(crop.placeCost)
            : "Free";
        meta.textContent = `Sell ${formatCurrency(
          crop.baseValue
        )} - ${formatGrowTime(crop.growMinutes)}`;
      }
      textWrap.appendChild(title);
      const status =
        crop.id === "grass" || crop.id === "farmland"
          ? null
          : getCropStatus(crop, now);
      if (status) {
        const statusLine = document.createElement("div");
        statusLine.className = "text-[11px] text-sky-300 truncate";
        statusLine.textContent = `Planted: ${status.count} - Harvest: ${status.harvestText}`;
        textWrap.appendChild(statusLine);
      }
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
    const now = Date.now();
    renderPlantCropMenu(now);
    updateSelectionLabels(now);
  }

  function renderSizeMenuFor(menuEl, variant = "text") {
    if (!menuEl) return;
    menuEl.innerHTML = "";
    let chainLocked = false;
    Object.values(sizes).forEach((size) => {
      const locked = !size.unlocked;
      const canAffordUnlock =
        locked &&
        typeof size.unlockCost === "number" &&
        state.totalMoney >= size.unlockCost;
      const gatedLocked = locked && chainLocked;
      const row = document.createElement("button");
      row.type = "button";
      row.className =
        "w-full px-3 py-2 rounded-lg flex items-center justify-between text-sm border border-transparent hover:border-neutral-700 hover:bg-neutral-900/80 transition";
      if (size.id === state.selectedSizeKey)
        row.classList.add("border-emerald-500", "bg-neutral-900/70");
      if (locked && !canAffordUnlock)
        row.classList.add("opacity-50", "cursor-not-allowed");
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
        cost.className = "text-[11px] font-semibold text-amber-300 ml-3";
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
    ensureBuildDefaults();
    if (!dom.buildSelectMenu) {
      updateBuildLabel();
      return;
    }
    dom.buildSelectMenu.innerHTML = "";

    const setSelected = (id) => {
      state.selectedBuildKey = id;
      updateBuildLabel();
      state.needsRender = true;
      closeAllMenus();
      saveState();
    };

    const renderRow = (item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className =
        "w-full px-3 py-2 rounded-lg flex items-center gap-3 text-left border border-transparent hover:border-neutral-700 hover:bg-neutral-900/80 transition";
      if (item.id === state.selectedBuildKey)
        row.classList.add("border-emerald-500", "bg-neutral-900/70");
      const thumbWrap = document.createElement("div");
      thumbWrap.className = "w-8 h-8 rounded-sm border border-neutral-800 bg-neutral-900/60 flex items-center justify-center overflow-hidden";
      const thumb = document.createElement("img");
      thumb.src = item.image || "images/farmland.jpg";
      thumb.alt = item.name;
      thumb.className = "max-w-full max-h-full object-contain";
      thumbWrap.appendChild(thumb);
      row.appendChild(thumbWrap);

      const text = document.createElement("div");
      text.className = "flex-1 min-w-0";
      const title = document.createElement("div");
      title.className = "text-sm font-semibold text-white truncate";
      title.textContent = item.name;
      const meta = document.createElement("div");
      meta.className = "text-[11px] text-neutral-400 truncate";
      meta.textContent =
        item.id === "sell"
          ? "Remove and refund"
          : `${item.width}x${item.height} | ${formatCurrency(item.cost || 0)}`;
      text.appendChild(title);
      text.appendChild(meta);
      row.appendChild(text);

      row.addEventListener("click", () => setSelected(item.id));
      return row;
    };

    const sellOption = renderRow({
      id: "sell",
      name: "Sell",
      width: 1,
      height: 1,
      cost: 0,
      image:
        "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1d5db'><path d='M9 3h6a1 1 0 0 1 .99.86L16 5h4a1 1 0 1 1 0 2h-1.1l-1.13 12.44A2 2 0 0 1 15.78 21H8.22a2 2 0 0 1-1.99-1.56L5.1 7H4a1 1 0 0 1 0-2h4l.01-1.14A1 1 0 0 1 9 3Zm5.9 4H9.1l1.03 11h4.74L14.9 7Z'/></svg>",
    });
    dom.buildSelectMenu.appendChild(sellOption);

    Object.values(buildings || {})
      .slice()
      .sort((a, b) => {
        const costA = Number.isFinite(a?.cost) ? a.cost : 0;
        const costB = Number.isFinite(b?.cost) ? b.cost : 0;
        return costA - costB;
      })
      .forEach((b) => {
      if (!b) return;
      dom.buildSelectMenu.appendChild(renderRow(b));
    });

    updateBuildLabel();
  }

  function updateBuildLabel() {
    if (dom.buildSelectLabel) {
      if (state.selectedBuildKey === "sell") {
        dom.buildSelectLabel.textContent = "Sell";
      } else {
        const selected = state.selectedBuildKey ? buildings[state.selectedBuildKey] : null;
        dom.buildSelectLabel.textContent = selected ? selected.name : "Select";
      }
    }
    if (dom.buildSelectImage) {
      if (state.selectedBuildKey === "sell") {
        dom.buildSelectImage.src =
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1d5db'><path d='M9 3h6a1 1 0 0 1 .99.86L16 5h4a1 1 0 1 1 0 2h-1.1l-1.13 12.44A2 2 0 0 1 15.78 21H8.22a2 2 0 0 1-1.99-1.56L5.1 7H4a1 1 0 0 1 0-2h4l.01-1.14A1 1 0 0 1 9 3Zm5.9 4H9.1l1.03 11h4.74L14.9 7Z'/></svg>";
        dom.buildSelectImage.alt = "Sell";
      } else {
        const selected = state.selectedBuildKey ? buildings[state.selectedBuildKey] : null;
        dom.buildSelectImage.src = selected?.image || "images/farmland.jpg";
        dom.buildSelectImage.alt = selected?.name || "Build";
      }
    }
  }

  const menuMap = {
    plantCrop: () => ({ button: dom.plantCropButton, menu: dom.plantCropMenu }),
    plantSize: () => ({ button: dom.plantSizeButton, menu: dom.plantSizeMenu }),
    harvestSize: () => ({
      button: dom.harvestSizeButton,
      menu: dom.harvestSizeMenu,
    }),
    buildSelect: () => ({ button: dom.buildSelectButton, menu: dom.buildSelectMenu }),
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
      if (key === "plantCrop") renderCropOptions();
      if (key === "buildSelect") renderBuildOptions();
      entry.menu.classList.remove("hidden");
      openMenuKey = key;
    }
  }

  function updateSelectionLabels(nowMs) {
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
    const cropStatus = crop ? getCropStatus(crop, now) : null;
    if (dom.plantCropLabel) {
      dom.plantCropLabel.classList.remove("truncate");
      dom.plantCropLabel.classList.add("whitespace-normal");
      const base = crop ? crop.name : "Crop";
      if (cropStatus) {
        dom.plantCropLabel.innerHTML = `<span class="block leading-tight">${base}</span><span class="block text-[11px] text-sky-300 leading-tight">Planted: ${cropStatus.count} - Harvest: ${cropStatus.harvestText}</span>`;
      } else {
        dom.plantCropLabel.textContent = base;
      }
      dom.plantCropLabel.title = cropStatus
        ? `${base} - Planted: ${cropStatus.count} - Harvest: ${cropStatus.harvestText}`
        : "";
    }
    if (dom.plantCropImage) {
      dom.plantCropImage.src = cropThumbSrc(crop ? crop.id : null);
      dom.plantCropImage.alt = crop ? crop.name : "Crop";
    }
    const size = currentSizeOption();
    if (dom.plantSizeLabel)
      dom.plantSizeLabel.textContent = size ? size.name : "Size";
    if (dom.harvestSizeLabel)
      dom.harvestSizeLabel.textContent = size ? size.name : "Size";
    ensureBuildDefaults();
    updateBuildLabel();
  }

  function bindMenuToggle(button, key) {
    if (!button) return;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu(key);
    });
  }

  function updateTotalDisplay() {
    if (dom.totalDisplay)
      dom.totalDisplay.textContent = formatCurrency(state.totalMoney, true);
  }

  function showAggregateMoneyChange(amount) {
    const el = dom.moneyChangeDisplay;
    if (!el || amount === 0) return;
    const isGain = amount >= 0;
    const valueText = `${isGain ? "+" : "-"}${formatCurrency(
      Math.abs(amount),
      true
    )}`;
    el.textContent = valueText;
    el.classList.remove("hidden");
    el.classList.remove("text-red-400");
    el.classList.remove("text-emerald-300");
    if (isGain) el.classList.add("text-emerald-300");
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
  }

  function refreshAllUI() {
    ensurePlantDefaults();
    ensureBuildDefaults();
    updateTotalDisplay();
    showAggregateMoneyChange(0);
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
    const clampedY = Math.max(
      12,
      Math.min(window.innerHeight - 12, clientY - 16)
    );
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
    if (dom.navOverlay)
      dom.navOverlay.addEventListener("click", closeOffcanvas);

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
        state.showStats = !!state.showTimerInfo;
        updateHideButtonsUI();
        state.needsRender = true;
        saveState();
      });
    };
    bindShowToggle(dom.showTimerToggle, "showTimerInfo");

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
            state.showTimerInfo = false;
            state.statBaseSize = 14;
            state.statTextAlpha = 1;
            state.statBgAlpha = 1;
            state.showStats = false;
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
        openConfirmModal(
          "Clear all cached data? If you are not logged in your progress will be lost.",
          clearCache,
          "Clear Cache",
          null,
          {
            confirmText: "Yes",
            cancelText: "No",
            confirmVariant: "danger",
          }
        );
      });
    }
    if (dom.resetFarmBtn) {
      dom.resetFarmBtn.addEventListener("click", () => {
        openConfirmModal(
          "Reset all progress and start fresh? This cannot be undone.",
          resetFarm,
          "Reset Progress",
          null,
          {
            confirmText: "Reset",
            cancelText: "Cancel",
            confirmVariant: "danger",
          }
        );
      });
    }

    if (dom.moneyCheatApply && dom.moneyCheatInput) {
      const applyMoney = () => {
        const raw = Number(dom.moneyCheatInput.value);
        if (!Number.isFinite(raw)) return;
        const next = Math.max(0, Math.floor(raw));
        state.totalMoney = next;
        onMoneyChanged();
        saveState();
      };
      dom.moneyCheatApply.addEventListener("click", applyMoney);
      dom.moneyCheatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") applyMoney();
      });
    }

    if (dom.modePlantBtn)
      dom.modePlantBtn.addEventListener("click", () => setActiveMode("plant"));
    if (dom.modeHarvestBtn)
      dom.modeHarvestBtn.addEventListener("click", () =>
        setActiveMode("harvest")
      );
    if (dom.modeBuildBtn)
      dom.modeBuildBtn.addEventListener("click", () => setActiveMode("build"));

    bindMenuToggle(dom.plantCropButton, "plantCrop");
    bindMenuToggle(dom.plantSizeButton, "plantSize");
    bindMenuToggle(dom.harvestSizeButton, "harvestSize");
    bindMenuToggle(dom.buildSelectButton, "buildSelect");

    document.addEventListener("click", (e) => {
      const target = e.target;
      const inside = Object.values(menuMap).some((get) => {
        const { button, menu } = get();
        return (
          (button && button.contains(target)) || (menu && menu.contains(target))
        );
      });
      if (!inside) closeAllMenus();
    });
  }

  // Keep the selected crop label (and open dropdown) fresh every second.
  setInterval(() => {
    const now = Date.now();
    updateSelectionLabels(now);
    if (openMenuKey === "plantCrop") renderPlantCropMenu(now);
  }, 1000);

  return {
    bindUIEvents,
    refreshAllUI,
    currentSizeOption,
    updateTotalDisplay,
    updateHideButtonsUI,
    updateModeButtonsUI,
    showAggregateMoneyChange,
    updateSizeButtonUI: () => {
      renderSizeMenu();
    },
    renderSizeMenu,
    renderCropOptions,
    openConfirmModal,
    closeConfirmModal,
    openOffcanvas,
    closeOffcanvas,
    toggleOffcanvas,
    showActionError,
  };
}



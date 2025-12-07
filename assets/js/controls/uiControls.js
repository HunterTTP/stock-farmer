import { createOverlayControls } from "./ui/overlayControls.js";
import { createCropMenus } from "./ui/cropMenus.js";
import { createStructureMenus } from "./ui/structureMenus.js";
import { createSizeMenus } from "./ui/sizeMenus.js";
import { createFeedback } from "./ui/feedback.js";
import { createMenuState } from "./ui/menuState.js";
export function createUIControls({
  dom,
  state,
  crops,
  sizes,
  buildings,
  landscapes,
  formatCurrency,
  onMoneyChanged,
  saveState,
  centerView,
  resetFarm,
  clearCache,
  resetSettings,
}) {
  const modeOrder = ["plant", "landscape", "build"];
  const sellIconSrc =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d1d5db'><path d='M9 3h6a1 1 0 0 1 .99.86L16 5h4a1 1 0 1 1 0 2h-1.1l-1.13 12.44A2 2 0 0 1 15.78 21H8.22a2 2 0 0 1-1.99-1.56L5.1 7H4a1 1 0 0 1 0-2h4l.01-1.14A1 1 0 0 1 9 3Zm5.9 4H9.1l1.03 11h4.74L14.9 7Z'/></svg>";
  const uiState = {
    openMenuKey: null,
    pendingConfirmAction: null,
    pendingCancelAction: null,
  };
  const menuAPI = {};
  const overlay = createOverlayControls({ dom, uiState });
  const { openOffcanvas, closeOffcanvas, toggleOffcanvas, closeConfirmModal, openConfirmModal, updateHideButtonsUI } = overlay;
  const sizeMenus = createSizeMenus({
    dom,
    state,
    sizes,
    formatCurrency,
    openConfirmModal,
    onMoneyChanged,
    closeAllMenus: () => menuAPI.closeAllMenus && menuAPI.closeAllMenus(),
    saveState,
  });
  const structureMenus = createStructureMenus({
    dom,
    state,
    buildings,
    landscapes,
    formatCurrency,
    openConfirmModal,
    onMoneyChanged,
    closeAllMenus: () => menuAPI.closeAllMenus && menuAPI.closeAllMenus(),
    saveState,
    sellIconSrc,
  });
  const cropMenus = createCropMenus({
    dom,
    state,
    crops,
    formatCurrency,
    onMoneyChanged,
    openConfirmModal,
    closeAllMenus: () => menuAPI.closeAllMenus && menuAPI.closeAllMenus(),
    saveState,
  });
  const feedback = createFeedback({ dom, state, formatCurrency });
  const updateSelectionLabels = (nowMs) => {
    const now = Number.isFinite(nowMs) ? nowMs : Date.now();
    const crop = state.selectedCropKey ? crops[state.selectedCropKey] : null;
    const cropStatus = crop ? cropMenus.getCropStatus(crop, now) : null;
    if (dom.plantCropLabel) {
      dom.plantCropLabel.classList.remove("truncate");
      dom.plantCropLabel.classList.add("whitespace-normal");
      const base = crop ? crop.name : "Crop";
      if (cropStatus) {
        dom.plantCropLabel.innerHTML = `<span class="block leading-tight">${base}</span><span class="block text-[11px] text-accent-soft leading-tight">Planted: ${cropStatus.count} - Harvest: ${cropStatus.harvestText}</span>`;
      } else {
        dom.plantCropLabel.textContent = base;
      }
      dom.plantCropLabel.title = cropStatus ? `${base} - Planted: ${cropStatus.count} - Harvest: ${cropStatus.harvestText}` : "";
    }
    if (dom.plantCropImage) {
      dom.plantCropImage.src = cropMenus.cropThumbSrc(crop ? crop.id : null);
      dom.plantCropImage.alt = crop ? crop.name : "Crop";
    }
    const size = sizeMenus.currentSizeOption();
    if (dom.plantSizeLabel) dom.plantSizeLabel.textContent = size ? size.name : "Size";
    structureMenus.ensureBuildDefaults();
    structureMenus.updateBuildLabel();
    structureMenus.ensureLandscapeDefaults();
    structureMenus.updateLandscapeLabel();
  };
  const renderSizeMenu = () => {
    sizeMenus.renderSizeMenu(updateSelectionLabels);
  };
  const renderCropOptions = () => {
    cropMenus.renderCropOptions();
    updateSelectionLabels();
  };
  const renderBuildOptions = () => {
    structureMenus.renderBuildOptions();
    updateSelectionLabels();
  };
  const renderLandscapeOptions = () => {
    structureMenus.renderLandscapeOptions();
    updateSelectionLabels();
  };
  const menuState = createMenuState({ dom, uiState, renderCropOptions, renderBuildOptions, renderLandscapeOptions });
  const { menuMap, closeAllMenus, toggleMenu, bindMenuToggle } = menuState;
  menuAPI.closeAllMenus = closeAllMenus;
  const renderDropdownGroups = () => {
    const active = state.activeMode || "plant";
    if (dom.plantDropdowns) dom.plantDropdowns.classList.toggle("hidden", active !== "plant");
    if (dom.buildDropdowns) dom.buildDropdowns.classList.toggle("hidden", active !== "build");
    if (dom.landscapeDropdowns) dom.landscapeDropdowns.classList.toggle("hidden", active !== "landscape");
  };

  const updateModeButtonsUI = () => {
    const active = state.activeMode || "plant";
    const entries = [
      { key: "plant", el: dom.modePlantBtn },
      { key: "build", el: dom.modeBuildBtn },
      { key: "landscape", el: dom.modeLandscapeBtn },
    ];
    entries.forEach(({ key, el }) => {
      if (!el) return;
      const isActive = key === active;
      el.classList.toggle("border-accent", isActive);
      el.classList.toggle("shadow-accent", isActive);
      el.classList.toggle("border-neutral-800", !isActive);
      el.classList.add("bg-neutral-900/80", "text-white");
      el.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const setActiveMode = (nextMode) => {
    if (!modeOrder.includes(nextMode)) return;
    if (nextMode === "plant") cropMenus.ensurePlantDefaults();
    if (nextMode === "build") structureMenus.ensureBuildDefaults();
    if (nextMode === "landscape") structureMenus.ensureLandscapeDefaults();
    state.activeMode = nextMode;
    closeAllMenus();
    updateModeButtonsUI();
    renderSizeMenu();
    if (nextMode === "plant") renderCropOptions();
    if (nextMode === "build") renderBuildOptions();
    if (nextMode === "landscape") renderLandscapeOptions();
    renderDropdownGroups();
    state.needsRender = true;
    saveState();
  };

  const refreshAllUI = () => {
    cropMenus.ensurePlantDefaults();
    structureMenus.ensureBuildDefaults();
    structureMenus.ensureLandscapeDefaults();
    feedback.updateTotalDisplay();
    feedback.showAggregateMoneyChange(0);
    renderCropOptions();
    renderSizeMenu();
    renderBuildOptions();
    renderLandscapeOptions();
    updateModeButtonsUI();
    updateHideButtonsUI();
    renderDropdownGroups();
  };

  const bindUIEvents = () => {
    if (dom.navToggle) dom.navToggle.addEventListener("click", toggleOffcanvas);
    if (dom.navClose) dom.navClose.addEventListener("click", closeOffcanvas);
    if (dom.navOverlay) dom.navOverlay.addEventListener("click", closeOffcanvas);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (uiState.pendingCancelAction) uiState.pendingCancelAction();
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
        if (uiState.pendingConfirmAction) uiState.pendingConfirmAction();
        closeConfirmModal();
      });
    }
    if (dom.confirmCancel) {
      dom.confirmCancel.addEventListener("click", () => {
        if (uiState.pendingCancelAction) uiState.pendingCancelAction();
        closeConfirmModal();
      });
    }
    if (dom.confirmClose) {
      dom.confirmClose.addEventListener("click", () => {
        if (uiState.pendingCancelAction) uiState.pendingCancelAction();
        closeConfirmModal();
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
    if (dom.resetSettingsBtn && typeof resetSettings === "function") {
      dom.resetSettingsBtn.addEventListener("click", () => {
        openConfirmModal("Reset settings (like theme and view) and reload?", resetSettings, "Reset Settings", null, {
          confirmText: "Reset",
          cancelText: "Cancel",
          confirmVariant: "danger",
        });
      });
    }
    if (dom.resetFarmBtn) {
      dom.resetFarmBtn.addEventListener("click", () => {
        openConfirmModal("Reset all progress and start fresh? This cannot be undone.", resetFarm, "Reset Progress", null, {
          confirmText: "Reset",
          cancelText: "Cancel",
          confirmVariant: "danger",
        });
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

    if (dom.modePlantBtn) dom.modePlantBtn.addEventListener("click", () => setActiveMode("plant"));
    if (dom.modeBuildBtn) dom.modeBuildBtn.addEventListener("click", () => setActiveMode("build"));
    if (dom.modeLandscapeBtn) dom.modeLandscapeBtn.addEventListener("click", () => setActiveMode("landscape"));

    bindMenuToggle(dom.plantCropButton, "plantCrop");
    bindMenuToggle(dom.plantSizeButton, "plantSize");
    bindMenuToggle(dom.buildSelectButton, "buildSelect");
    bindMenuToggle(dom.landscapeSelectButton, "landscapeSelect");

    document.addEventListener("click", (e) => {
      const target = e.target;
      const inside = Object.values(menuMap).some((get) => {
        const { button, menu } = get();
        return (button && button.contains(target)) || (menu && menu.contains(target));
      });
      if (!inside) closeAllMenus();
    });
  };

  setInterval(() => {
    const now = Date.now();
    updateSelectionLabels(now);
    if (uiState.openMenuKey === "plantCrop") renderCropOptions();
  }, 1000);

  return {
    bindUIEvents,
    refreshAllUI,
    currentSizeOption: sizeMenus.currentSizeOption,
    updateTotalDisplay: feedback.updateTotalDisplay,
    updateHideButtonsUI,
    updateModeButtonsUI,
    showAggregateMoneyChange: feedback.showAggregateMoneyChange,
    updateSizeButtonUI: renderSizeMenu,
    renderSizeMenu,
    renderCropOptions,
    renderLandscapeOptions,
    openConfirmModal,
    closeConfirmModal,
    openOffcanvas,
    closeOffcanvas,
    toggleOffcanvas,
    showActionError: feedback.showActionError,
  };
}

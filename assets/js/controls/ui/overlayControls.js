export function createOverlayControls({ dom, uiState: providedState = null }) {
  const uiState = providedState || {
    pendingConfirmAction: null,
    pendingCancelAction: null,
  };

  const confirmVariantClasses = {
    primary: "py-2 rounded-md btn-accent text-sm font-semibold focus:outline-none",
    accent: "py-2 rounded-md btn-accent text-sm font-semibold focus:outline-none",
    blue: "py-2 rounded-md btn-accent text-sm font-semibold focus:outline-none",
    danger: "py-2 rounded-md bg-red-600 text-white text-sm font-semibold hover:bg-red-500 focus:outline-none",
  };
  const defaultCancelBtnClass = "py-2 rounded-md border border-neutral-700 bg-neutral-800 text-white text-sm font-medium hover:bg-neutral-700 focus:outline-none";

  const openOffcanvas = () => {
    if (!dom.navOffcanvas || !dom.navOverlay || !dom.navToggle) return;
    dom.navOffcanvas.classList.remove("translate-x-full");
    dom.navOverlay.classList.remove("hidden");
    dom.navToggle.setAttribute("aria-expanded", "true");
  };

  const closeOffcanvas = () => {
    if (!dom.navOffcanvas || !dom.navOverlay || !dom.navToggle) return;
    dom.navOffcanvas.classList.add("translate-x-full");
    dom.navOverlay.classList.add("hidden");
    dom.navToggle.setAttribute("aria-expanded", "false");
  };

  const toggleOffcanvas = () => {
    if (!dom.navOffcanvas) return;
    const isClosed = dom.navOffcanvas.classList.contains("translate-x-full");
    if (isClosed) openOffcanvas();
    else closeOffcanvas();
  };

  const closeConfirmModal = () => {
    if (!dom.confirmModal) return;
    dom.confirmModal.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
    uiState.pendingConfirmAction = null;
    uiState.pendingCancelAction = null;
  };

  const openConfirmModal = (message, onConfirm, title = "Confirm", onCancel = null, options = {}) => {
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
    uiState.pendingConfirmAction = onConfirm;
    uiState.pendingCancelAction = onCancel;
    dom.confirmModal.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    dom.confirmConfirm.focus();
  };

  const updateHideButtonsUI = () => { };

  return {
    uiState,
    openOffcanvas,
    closeOffcanvas,
    toggleOffcanvas,
    closeConfirmModal,
    openConfirmModal,
    updateHideButtonsUI,
  };
}

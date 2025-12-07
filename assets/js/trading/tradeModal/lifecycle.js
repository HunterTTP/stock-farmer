export function createTradeLifecycle(context) {
  const { dom, state, modalState, renderers, actions, getShareCount, setShareCount } = context;

  function setActiveTab(tab) {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    if (!dom.tradeSectionEl || !dom.positionsSectionEl || !dom.tradeTabBtn || !dom.positionsTabBtn) return;
    const isBuy = tab === "buy";
    dom.tradeSectionEl.classList.toggle("hidden", !isBuy);
    dom.positionsSectionEl.classList.toggle("hidden", isBuy);
    dom.tradeTabBtn.classList.toggle("bg-accent-soft", isBuy);
    dom.tradeTabBtn.classList.toggle("text-accent", isBuy);
    dom.tradeTabBtn.classList.toggle("text-neutral-400", !isBuy);
    dom.tradeTabBtn.classList.toggle("bg-transparent", !isBuy);
    dom.positionsTabBtn.classList.toggle("bg-accent-soft", !isBuy);
    dom.positionsTabBtn.classList.toggle("text-accent", !isBuy);
    dom.positionsTabBtn.classList.toggle("text-neutral-400", isBuy);
    dom.positionsTabBtn.classList.toggle("bg-transparent", isBuy);
  }

  function initTabs() {
    if (!dom.tradeSectionEl || !dom.positionsSectionEl) return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      dom.tradeSectionEl.classList.remove("hidden");
      dom.positionsSectionEl.classList.remove("hidden");
    } else {
      setActiveTab("buy");
    }
  }

  function openModal() {
    dom.modalEl.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    setShareCount(getShareCount());
    renderers.setTradeMessage("");
    renderers.renderTickers();
    renderers.renderBalances();
    renderers.renderHoldings();
    renderers.updateTradeButtonsLabel();
    initTabs();
  }

  function closeModal() {
    dom.modalEl.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
    state.activeMode = "plant";
    state.needsRender = true;
  }

  function bindEvents() {
    dom.openBtn.addEventListener("click", () => openModal());
    dom.closeBtn?.addEventListener("click", () => closeModal());
    dom.overlayEl?.addEventListener("click", () => closeModal());

    dom.buyBtn.addEventListener("click", () => actions.tradeBuy());
    dom.decSharesBtn?.addEventListener("click", () => setShareCount(getShareCount() - 1));
    dom.incSharesBtn?.addEventListener("click", () => setShareCount(getShareCount() + 1));

    dom.tradeTabBtn?.addEventListener("click", () => setActiveTab("buy"));
    dom.positionsTabBtn?.addEventListener("click", () => setActiveTab("sell"));

    dom.prevPageBtn?.addEventListener("click", () => {
      if (modalState.currentPage > 0) {
        modalState.currentPage -= 1;
        renderers.renderHoldings();
      }
    });
    dom.nextPageBtn?.addEventListener("click", () => {
      modalState.currentPage += 1;
      renderers.renderHoldings();
    });

    window.addEventListener("resize", initTabs);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !dom.modalEl.classList.contains("hidden")) {
        closeModal();
      }
    });
  }

  function init() {
    bindEvents();
    renderers.renderTickers();
    renderers.renderBalances();
    renderers.renderHoldings();
    renderers.updateTradeButtonsLabel();
    initTabs();
    setInterval(actions.updatePrices, 4000);
  }

  return {
    closeModal,
    init,
    openModal,
  };
}

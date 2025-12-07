export function getTradeDomRefs() {
  const modalEl = document.getElementById("tradeModal");
  const overlayEl = document.getElementById("tradeOverlay");
  const closeBtn = document.getElementById("tradeClose");
  const openBtn = document.getElementById("modeTradeBtn");

  const tradeTabBtn = document.getElementById("tradeTab");
  const positionsTabBtn = document.getElementById("positionsTab");
  const tradeSectionEl = document.getElementById("tradeSection");
  const positionsSectionEl = document.getElementById("positionsSection");

  const tickerListEl = document.getElementById("tickerList");
  const shareInputEl = document.getElementById("shareInput");
  const investedValueEl = document.getElementById("investedValue");
  const walletValueEl = document.getElementById("tradeWalletValue");
  const walletChangeEl = document.getElementById("tradeMoneyChange");
  const investChangeEl = document.getElementById("tradeInvestChange");
  const holdingsBodyEl = document.getElementById("holdingsBody");
  const holdingsSummaryEl = document.getElementById("holdingsSummary");
  const tradeMessageEl = document.getElementById("tradeMessage");
  const buyBtn = document.getElementById("buyBtn");
  const decSharesBtn = document.getElementById("decShares");
  const incSharesBtn = document.getElementById("incShares");
  const prevPageBtn = document.getElementById("prevPage");
  const nextPageBtn = document.getElementById("nextPage");
  const pageInfoEl = document.getElementById("pageInfo");

  return {
    buyBtn,
    closeBtn,
    decSharesBtn,
    holdingsBodyEl,
    holdingsSummaryEl,
    incSharesBtn,
    investChangeEl,
    investedValueEl,
    isReady: !!(modalEl && openBtn && tickerListEl && buyBtn),
    modalEl,
    nextPageBtn,
    openBtn,
    overlayEl,
    pageInfoEl,
    positionsSectionEl,
    positionsTabBtn,
    prevPageBtn,
    shareInputEl,
    tickerListEl,
    tradeMessageEl,
    tradeSectionEl,
    tradeTabBtn,
    walletChangeEl,
    walletValueEl,
  };
}

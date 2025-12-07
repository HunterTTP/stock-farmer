function getSelectedTicker(modalState, tickers, getTickerFn) {
  return getTickerFn(modalState.selectedSymbol) || tickers[0] || null;
}

export function createTradeActions(context) {
  const {
    state,
    tickers,
    modalState,
    getTicker,
    fmtCurrency,
    holdingsMap,
    getShareCount,
    sanitizeHoldings,
    onMoneyChanged,
    saveState,
    renderers,
  } = context;

  function tradeBuy() {
    const ticker = getSelectedTicker(modalState, tickers, getTicker);
    const shares = getShareCount();
    if (!ticker || shares <= 0) {
      renderers.setTradeMessage("Enter a valid share amount.", "error");
      return;
    }
    const total = shares * ticker.price;
    if (total > state.totalMoney + 1e-6) {
      renderers.setTradeMessage("Not enough wallet funds for this trade.", "error");
      return;
    }

    const holdings = holdingsMap();
    state.totalMoney -= total;
    if (!holdings[ticker.symbol]) holdings[ticker.symbol] = [];
    const existingLot = holdings[ticker.symbol].find((lot) => Math.abs(lot.price - ticker.price) < 1e-6);
    if (existingLot) existingLot.shares += shares;
    else holdings[ticker.symbol].push({ shares, price: ticker.price });

    state.stockHoldings = sanitizeHoldings(holdings);
    renderers.setTradeMessage(`Buy ${shares} ${ticker.symbol} @ ${fmtCurrency(ticker.price)} filled.`, "success");
    renderers.showWalletDelta(-total);
    renderers.showInvestDelta(total);
    renderers.renderBalances();
    renderers.renderHoldings();
    renderers.updateTradeButtonsLabel();
    if (typeof onMoneyChanged === "function") onMoneyChanged();
    if (typeof saveState === "function") saveState();
  }

  function sellLot(symbol, lotIndex) {
    const holdings = holdingsMap();
    const lots = holdings[symbol] || [];
    const lot = lots[lotIndex];
    const ticker = getTicker(symbol);
    if (!lot || !ticker) return;
    const proceeds = lot.shares * ticker.price;
    const value = proceeds;
    state.totalMoney += proceeds;
    lots.splice(lotIndex, 1);
    if (!lots.length) delete holdings[symbol];
    state.stockHoldings = sanitizeHoldings(holdings);
    renderers.setTradeMessage(`Sell ${lot.shares} ${symbol} @ ${fmtCurrency(ticker.price)} filled.`, "success");
    renderers.showWalletDelta(proceeds);
    renderers.showInvestDelta(-value);
    renderers.renderBalances();
    renderers.renderHoldings();
    renderers.updateTradeButtonsLabel();
    if (typeof onMoneyChanged === "function") onMoneyChanged();
    if (typeof saveState === "function") saveState();
  }

  function handleLotSellClick(btn, symbol, lotIndex) {
    const confirming = btn.dataset.confirm === "true";
    if (confirming) {
      btn.dataset.confirm = "";
      btn.classList.remove("btn-accent");
      btn.classList.add("btn-accent-ghost");
      btn.textContent = "Sell";
      sellLot(symbol, lotIndex);
    } else {
      btn.dataset.confirm = "true";
      btn.classList.remove("btn-accent-ghost");
      btn.classList.add("btn-accent");
      btn.textContent = "Confirm";
    }
  }

  function updatePrices() {
    tickers.forEach((t) => {
      t.prevPrice = t.price;
      const move = Math.random() * 0.04 - 0.02;
      const next = t.price * (1 + move);
      t.price = Math.max(5, next);
    });
    renderers.renderTickers();
    renderers.renderBalances();
    renderers.renderHoldings();
    renderers.updateTradeButtonsLabel();
  }

  return {
    handleLotSellClick,
    tradeBuy,
    updatePrices,
  };
}

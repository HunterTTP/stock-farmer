function getSelectedTicker(modalState, tickers, getTickerFn) {
  return getTickerFn(modalState.selectedSymbol) || tickers[0] || null;
}

export function createTradeRenderers(context) {
  const { dom, state, tickers, PAGE_SIZE, modalState, getTicker, fmtCurrency, holdingsMap, getShareCount } = context;

  function updateTradeButtonsLabel() {
    if (!dom.buyBtn) return;
    const ticker = getSelectedTicker(modalState, tickers, getTicker);
    if (!ticker) {
      dom.buyBtn.textContent = "Buy $0.00";
      return;
    }
    const shares = getShareCount();
    const total = shares * ticker.price;
    dom.buyBtn.textContent = `Buy ${fmtCurrency(total)}`;
  }

  function renderTickers() {
    if (!dom.tickerListEl) return;
    dom.tickerListEl.innerHTML = "";
    tickers.forEach((t) => {
      const diff = t.price - t.prevPrice;
      const pct = (diff / t.prevPrice) * 100 || 0;
      const li = document.createElement("li");
      li.className =
        "flex items-center justify-between px-2.5 py-1.5 active:bg-neutral-800/70 cursor-pointer" +
        (t.symbol === modalState.selectedSymbol ? " bg-neutral-800/80" : "");
      li.dataset.symbol = t.symbol;
      li.innerHTML = `
        <div>
          <div class="text-[0.75rem] font-semibold text-white">${t.symbol}</div>
          <div class="text-[0.65rem] text-neutral-400">${t.name}</div>
        </div>
        <div class="text-right">
          <div class="text-[0.75rem] font-semibold text-white">${fmtCurrency(t.price)}</div>
          <div class="text-[0.6rem] ${pct >= 0 ? "text-emerald-400" : "text-red-400"}">${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%</div>
        </div>
      `;
      li.addEventListener("click", () => {
        modalState.selectedSymbol = t.symbol;
        renderTickers();
        updateTradeButtonsLabel();
      });
      dom.tickerListEl.appendChild(li);
    });
  }

  function computeInvested() {
    const holdings = holdingsMap();
    let invested = 0;
    Object.entries(holdings).forEach(([sym, lots]) => {
      const ticker = getTicker(sym);
      if (!ticker || !Array.isArray(lots)) return;
      lots.forEach((lot) => {
        invested += lot.shares * ticker.price;
      });
    });
    return invested;
  }

  function renderBalances() {
    if (dom.walletValueEl) dom.walletValueEl.textContent = fmtCurrency(state.totalMoney);
    if (dom.investedValueEl) dom.investedValueEl.textContent = fmtCurrency(computeInvested());
  }

  function getAllLots() {
    const holdings = holdingsMap();
    const list = [];
    Object.entries(holdings).forEach(([sym, lots]) => {
      const ticker = getTicker(sym);
      if (!ticker) return;
      lots.forEach((lot, lotIndex) => {
        if (!lot.shares) return;
        list.push({ sym, lot, lotIndex, ticker });
      });
    });
    return list;
  }

  function renderPagination(totalLots, totalPages) {
    if (dom.pageInfoEl) dom.pageInfoEl.textContent = `Page ${totalPages ? modalState.currentPage + 1 : 1} of ${totalPages || 1}`;

    const disablePrev = totalPages <= 1 || modalState.currentPage === 0;
    const disableNext = totalPages <= 1 || modalState.currentPage >= totalPages - 1;

    if (dom.prevPageBtn) {
      dom.prevPageBtn.disabled = disablePrev;
      dom.prevPageBtn.classList.toggle("opacity-40", disablePrev);
      dom.prevPageBtn.classList.toggle("cursor-default", disablePrev);
    }
    if (dom.nextPageBtn) {
      dom.nextPageBtn.disabled = disableNext;
      dom.nextPageBtn.classList.toggle("opacity-40", disableNext);
      dom.nextPageBtn.classList.toggle("cursor-default", disableNext);
    }
  }

  function renderHoldings() {
    if (!dom.holdingsBodyEl) return;
    const allLots = getAllLots();
    const totalLots = allLots.length;
    let totalPages = Math.max(1, Math.ceil(totalLots / PAGE_SIZE));
    if (modalState.currentPage >= totalPages) modalState.currentPage = totalPages - 1;

    dom.holdingsBodyEl.innerHTML = "";

    if (totalLots) {
      const start = modalState.currentPage * PAGE_SIZE;
      const pageLots = allLots.slice(start, start + PAGE_SIZE);
      pageLots.forEach(({ sym, lot, lotIndex, ticker }) => {
        const costPerShare = lot.price;
        const currentPrice = ticker.price;
        const plPerShare = currentPrice - costPerShare;
        const pl = plPerShare * lot.shares;
        const pct = costPerShare ? (plPerShare / costPerShare) * 100 : 0;
        const plClass = pl >= 0 ? "text-emerald-400" : "text-red-400";
        const tr = document.createElement("tr");
        tr.className = "border-b border-neutral-800 last:border-0";
        tr.innerHTML = `
          <td class="px-2 py-1.5">${lot.shares}</td>
          <td class="px-2 py-1.5 font-semibold">${sym}</td>
          <td class="px-2 py-1.5">${fmtCurrency(costPerShare)}</td>
          <td class="px-2 py-1.5">${fmtCurrency(currentPrice)}</td>
          <td class="px-2 py-1.5 ${plClass}">${(pct >= 0 ? "+" : "") + pct.toFixed(2)}%</td>
          <td class="px-2 py-1.5 ${plClass}">${fmtCurrency(pl)}</td>
          <td class="px-2 py-1.5">
            <button class="lot-sell-btn rounded-full btn-accent-ghost px-2.5 py-1 text-[0.65rem] font-medium active:scale-[0.97] transition text-left">
              Sell
            </button>
          </td>
        `;
        const btn = tr.querySelector(".lot-sell-btn");
        if (btn) {
          btn.addEventListener("click", () => context.handleLotSellClick(btn, sym, lotIndex));
        }
        dom.holdingsBodyEl.appendChild(tr);
      });
    } else {
      const tr = document.createElement("tr");
      tr.className = "border-b border-neutral-800 last:border-0";
      tr.innerHTML = `
        <td class="px-2 py-1.5 text-neutral-500">-</td>
        <td class="px-2 py-1.5 text-neutral-500">-</td>
        <td class="px-2 py-1.5 text-neutral-500">-</td>
        <td class="px-2 py-1.5 text-neutral-500">-</td>
        <td class="px-2 py-1.5 text-neutral-500">-</td>
        <td class="px-2 py-1.5 text-neutral-500">-</td>
        <td class="px-2 py-1.5 text-neutral-500">-</td>
      `;
      dom.holdingsBodyEl.appendChild(tr);
      totalPages = 1;
      modalState.currentPage = 0;
    }

    if (dom.holdingsSummaryEl) {
      dom.holdingsSummaryEl.textContent = totalLots ? `${totalLots} open lot${totalLots > 1 ? "s" : ""}` : "No positions";
    }

    renderPagination(totalLots, totalPages);
  }

  function setTradeMessage(text, variant = "muted") {
    if (!dom.tradeMessageEl) return;
    dom.tradeMessageEl.textContent = text;
    dom.tradeMessageEl.classList.remove("text-emerald-400", "text-red-400");
    if (variant === "success") dom.tradeMessageEl.classList.add("text-emerald-400");
    if (variant === "error") dom.tradeMessageEl.classList.add("text-red-400");
  }

  function showWalletDelta(amount) {
    if (!dom.walletChangeEl || !dom.modalEl || dom.modalEl.classList.contains("hidden")) return;
    if (modalState.walletChangeTimeout) {
      clearTimeout(modalState.walletChangeTimeout);
      modalState.walletChangeTimeout = null;
    }
    const isGain = amount >= 0;
    dom.walletChangeEl.textContent = `${isGain ? "+" : "-"}${fmtCurrency(Math.abs(amount))}`;
    dom.walletChangeEl.classList.remove("text-red-400", "text-emerald-300", "opacity-0");
    dom.walletChangeEl.classList.add(isGain ? "text-emerald-300" : "text-red-400");
    requestAnimationFrame(() => {
      dom.walletChangeEl.classList.add("opacity-100");
    });
    modalState.walletChangeTimeout = setTimeout(() => {
      dom.walletChangeEl.classList.remove("opacity-100");
      dom.walletChangeEl.classList.add("opacity-0");
    }, 2000);
  }

  function showInvestDelta(amount) {
    if (!dom.investChangeEl || !dom.modalEl || dom.modalEl.classList.contains("hidden")) return;
    if (modalState.investChangeTimeout) {
      clearTimeout(modalState.investChangeTimeout);
      modalState.investChangeTimeout = null;
    }
    const isGain = amount >= 0;
    dom.investChangeEl.textContent = `${isGain ? "+" : "-"}${fmtCurrency(Math.abs(amount))}`;
    dom.investChangeEl.classList.remove("text-red-400", "text-emerald-300", "opacity-0");
    dom.investChangeEl.classList.add(isGain ? "text-emerald-300" : "text-red-400");
    requestAnimationFrame(() => {
      dom.investChangeEl.classList.add("opacity-100");
    });
    modalState.investChangeTimeout = setTimeout(() => {
      dom.investChangeEl.classList.remove("opacity-100");
      dom.investChangeEl.classList.add("opacity-0");
    }, 2000);
  }

  return {
    renderBalances,
    renderHoldings,
    renderPagination,
    renderTickers,
    setTradeMessage,
    showInvestDelta,
    showWalletDelta,
    updateTradeButtonsLabel,
  };
}

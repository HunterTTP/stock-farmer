import { stocks } from "../data/stocks.js";
import { formatCurrency } from "../utils/helpers.js";

const PAGE_SIZE = 100;

const baseTickers = Array.isArray(stocks) ? stocks : Object.values(stocks || {});
const tickers = baseTickers.map((t) => ({ ...t, prevPrice: t.price }));

function clampShares(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function cleanHoldingShares(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function sanitizeHoldings(raw) {
  const cleaned = {};
  if (!raw || typeof raw !== "object") return cleaned;
  Object.entries(raw).forEach(([sym, lots]) => {
    if (!Array.isArray(lots)) return;
    const filtered = lots
      .map((lot) => ({
        shares: cleanHoldingShares(lot?.shares),
        price: Number.isFinite(lot?.price) ? lot.price : 0,
      }))
      .filter((lot) => lot.shares > 0 && Number.isFinite(lot.price));
    if (filtered.length) cleaned[sym] = filtered;
  });
  return cleaned;
}

export function createTradeModal({ state, onMoneyChanged, saveState }) {
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

  if (!modalEl || !openBtn || !tickerListEl || !buyBtn) {
    return {
      refreshBalances: () => {},
      refreshHoldings: () => {},
    };
  }

  let selectedSymbol = tickers[0]?.symbol || null;
  let currentPage = 0;
  let walletChangeTimeout = null;
  let investChangeTimeout = null;
  state.stockHoldings = sanitizeHoldings(state.stockHoldings);

  const getTicker = (symbol) => tickers.find((t) => t.symbol === symbol);
  const getSelectedTicker = () => getTicker(selectedSymbol) || tickers[0] || null;
  const fmtCurrency = (value) => formatCurrency(Number.isFinite(value) ? value : 0, true);

  function holdingsMap() {
    if (!state.stockHoldings || typeof state.stockHoldings !== "object") state.stockHoldings = {};
    return state.stockHoldings;
  }

  function getShareCount() {
    if (!shareInputEl) return 1;
    const raw = parseInt(shareInputEl.value, 10);
    return clampShares(raw);
  }

  function setShareCount(next) {
    if (!shareInputEl) return;
    const safe = clampShares(next);
    shareInputEl.value = String(safe);
    updateTradeButtonsLabel();
  }

  function updateTradeButtonsLabel() {
    if (!buyBtn) return;
    const ticker = getSelectedTicker();
    if (!ticker) {
      buyBtn.textContent = "Buy $0.00";
      return;
    }
    const shares = getShareCount();
    const total = shares * ticker.price;
    buyBtn.textContent = `Buy ${fmtCurrency(total)}`;
  }

  function renderTickers() {
    if (!tickerListEl) return;
    tickerListEl.innerHTML = "";
    tickers.forEach((t) => {
      const diff = t.price - t.prevPrice;
      const pct = (diff / t.prevPrice) * 100 || 0;
      const li = document.createElement("li");
      li.className = "flex items-center justify-between px-2.5 py-1.5 active:bg-neutral-800/70 cursor-pointer" + (t.symbol === selectedSymbol ? " bg-neutral-800/80" : "");
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
        selectedSymbol = t.symbol;
        renderTickers();
        updateTradeButtonsLabel();
      });
      tickerListEl.appendChild(li);
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
    if (walletValueEl) walletValueEl.textContent = fmtCurrency(state.totalMoney);
    if (investedValueEl) investedValueEl.textContent = fmtCurrency(computeInvested());
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
    if (pageInfoEl) pageInfoEl.textContent = `Page ${totalPages ? currentPage + 1 : 1} of ${totalPages || 1}`;

    const disablePrev = totalPages <= 1 || currentPage === 0;
    const disableNext = totalPages <= 1 || currentPage >= totalPages - 1;

    if (prevPageBtn) {
      prevPageBtn.disabled = disablePrev;
      prevPageBtn.classList.toggle("opacity-40", disablePrev);
      prevPageBtn.classList.toggle("cursor-default", disablePrev);
    }
    if (nextPageBtn) {
      nextPageBtn.disabled = disableNext;
      nextPageBtn.classList.toggle("opacity-40", disableNext);
      nextPageBtn.classList.toggle("cursor-default", disableNext);
    }
  }

  function renderHoldings() {
    if (!holdingsBodyEl) return;
    const allLots = getAllLots();
    const totalLots = allLots.length;
    let totalPages = Math.max(1, Math.ceil(totalLots / PAGE_SIZE));
    if (currentPage >= totalPages) currentPage = totalPages - 1;

    holdingsBodyEl.innerHTML = "";

    if (totalLots) {
      const start = currentPage * PAGE_SIZE;
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
            <button class="lot-sell-btn rounded-full bg-neutral-800 hover:bg-neutral-700 text-white px-2.5 py-1 text-[0.65rem] font-medium active:scale-[0.97] transition text-left">
              Sell
            </button>
          </td>
        `;
        const btn = tr.querySelector(".lot-sell-btn");
        if (btn) {
          btn.addEventListener("click", () => handleLotSellClick(btn, sym, lotIndex));
        }
        holdingsBodyEl.appendChild(tr);
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
      holdingsBodyEl.appendChild(tr);
      totalPages = 1;
      currentPage = 0;
    }

    if (holdingsSummaryEl) {
      holdingsSummaryEl.textContent = totalLots ? `${totalLots} open lot${totalLots > 1 ? "s" : ""}` : "No positions";
    }

    renderPagination(totalLots, totalPages);
  }

  function setTradeMessage(text, variant = "muted") {
    if (!tradeMessageEl) return;
    tradeMessageEl.textContent = text;
    tradeMessageEl.classList.remove("text-emerald-400", "text-red-400");
    if (variant === "success") tradeMessageEl.classList.add("text-emerald-400");
    if (variant === "error") tradeMessageEl.classList.add("text-red-400");
  }

  function showWalletDelta(amount) {
    if (!walletChangeEl || !modalEl || modalEl.classList.contains("hidden")) return;
    if (walletChangeTimeout) {
      clearTimeout(walletChangeTimeout);
      walletChangeTimeout = null;
    }
    const isGain = amount >= 0;
    walletChangeEl.textContent = `${isGain ? "+" : "-"}${fmtCurrency(Math.abs(amount))}`;
    walletChangeEl.classList.remove("text-red-400", "text-emerald-300", "opacity-0");
    walletChangeEl.classList.add(isGain ? "text-emerald-300" : "text-red-400");
    requestAnimationFrame(() => {
      walletChangeEl.classList.add("opacity-100");
    });
    walletChangeTimeout = setTimeout(() => {
      walletChangeEl.classList.remove("opacity-100");
      walletChangeEl.classList.add("opacity-0");
    }, 2000);
  }

  function showInvestDelta(amount) {
    if (!investChangeEl || !modalEl || modalEl.classList.contains("hidden")) return;
    if (investChangeTimeout) {
      clearTimeout(investChangeTimeout);
      investChangeTimeout = null;
    }
    const isGain = amount >= 0;
    investChangeEl.textContent = `${isGain ? "+" : "-"}${fmtCurrency(Math.abs(amount))}`;
    investChangeEl.classList.remove("text-red-400", "text-emerald-300", "opacity-0");
    investChangeEl.classList.add(isGain ? "text-emerald-300" : "text-red-400");
    requestAnimationFrame(() => {
      investChangeEl.classList.add("opacity-100");
    });
    investChangeTimeout = setTimeout(() => {
      investChangeEl.classList.remove("opacity-100");
      investChangeEl.classList.add("opacity-0");
    }, 2000);
  }

  function tradeBuy() {
    const ticker = getSelectedTicker();
    const shares = getShareCount();
    if (!ticker || shares <= 0) {
      setTradeMessage("Enter a valid share amount.", "error");
      return;
    }
    const total = shares * ticker.price;
    if (total > state.totalMoney + 1e-6) {
      setTradeMessage("Not enough wallet funds for this trade.", "error");
      return;
    }

    const holdings = holdingsMap();
    state.totalMoney -= total;
    if (!holdings[ticker.symbol]) holdings[ticker.symbol] = [];
    const existingLot = holdings[ticker.symbol].find((lot) => Math.abs(lot.price - ticker.price) < 1e-6);
    if (existingLot) existingLot.shares += shares;
    else holdings[ticker.symbol].push({ shares, price: ticker.price });

    state.stockHoldings = sanitizeHoldings(holdings);
    setTradeMessage(`Buy ${shares} ${ticker.symbol} @ ${fmtCurrency(ticker.price)} filled.`, "success");
    showWalletDelta(-total);
    showInvestDelta(total);
    renderBalances();
    renderHoldings();
    updateTradeButtonsLabel();
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
    setTradeMessage(`Sell ${lot.shares} ${symbol} @ ${fmtCurrency(ticker.price)} filled.`, "success");
    showWalletDelta(proceeds);
    showInvestDelta(-value);
    renderBalances();
    renderHoldings();
    updateTradeButtonsLabel();
    if (typeof onMoneyChanged === "function") onMoneyChanged();
    if (typeof saveState === "function") saveState();
  }

  function handleLotSellClick(btn, symbol, lotIndex) {
    if (btn.dataset.confirm === "true") {
      btn.dataset.confirm = "";
      btn.classList.remove("bg-emerald-500", "text-neutral-950");
      btn.classList.add("bg-neutral-800", "hover:bg-neutral-700", "text-white");
      sellLot(symbol, lotIndex);
    } else {
      btn.dataset.confirm = "true";
      btn.classList.remove("bg-neutral-800", "hover:bg-neutral-700", "text-white");
      btn.classList.add("bg-emerald-500", "text-neutral-950");
    }
  }

  function updatePrices() {
    tickers.forEach((t) => {
      t.prevPrice = t.price;
      const move = Math.random() * 0.04 - 0.02;
      const next = t.price * (1 + move);
      t.price = Math.max(5, next);
    });
    renderTickers();
    renderBalances();
    renderHoldings();
    updateTradeButtonsLabel();
  }

  function setActiveTab(tab) {
    if (window.matchMedia("(min-width: 768px)").matches) return;
    if (!tradeSectionEl || !positionsSectionEl || !tradeTabBtn || !positionsTabBtn) return;
    const isBuy = tab === "buy";
    tradeSectionEl.classList.toggle("hidden", !isBuy);
    positionsSectionEl.classList.toggle("hidden", isBuy);
    tradeTabBtn.classList.toggle("bg-neutral-800", isBuy);
    tradeTabBtn.classList.toggle("text-white", isBuy);
    tradeTabBtn.classList.toggle("text-neutral-400", !isBuy);
    positionsTabBtn.classList.toggle("bg-neutral-800", !isBuy);
    positionsTabBtn.classList.toggle("text-white", !isBuy);
    positionsTabBtn.classList.toggle("text-neutral-400", isBuy);
  }

  function initTabs() {
    if (!tradeSectionEl || !positionsSectionEl) return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      tradeSectionEl.classList.remove("hidden");
      positionsSectionEl.classList.remove("hidden");
    } else {
      setActiveTab("buy");
    }
  }

  function openModal() {
    modalEl.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
    setShareCount(getShareCount());
    setTradeMessage("");
    renderTickers();
    renderBalances();
    renderHoldings();
    updateTradeButtonsLabel();
    initTabs();
  }

  function closeModal() {
    modalEl.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
  }

  function bindEvents() {
    openBtn.addEventListener("click", () => openModal());
    closeBtn?.addEventListener("click", () => closeModal());
    overlayEl?.addEventListener("click", () => closeModal());

    buyBtn.addEventListener("click", () => tradeBuy());
    decSharesBtn?.addEventListener("click", () => setShareCount(getShareCount() - 1));
    incSharesBtn?.addEventListener("click", () => setShareCount(getShareCount() + 1));

    tradeTabBtn?.addEventListener("click", () => setActiveTab("buy"));
    positionsTabBtn?.addEventListener("click", () => setActiveTab("sell"));

    prevPageBtn?.addEventListener("click", () => {
      if (currentPage > 0) {
        currentPage -= 1;
        renderHoldings();
      }
    });
    nextPageBtn?.addEventListener("click", () => {
      currentPage += 1;
      renderHoldings();
    });

    window.addEventListener("resize", initTabs);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modalEl.classList.contains("hidden")) {
        closeModal();
      }
    });
  }

  function init() {
    bindEvents();
    renderTickers();
    renderBalances();
    renderHoldings();
    updateTradeButtonsLabel();
    initTabs();
    setInterval(updatePrices, 4000);
  }

  init();

  return {
    refreshBalances: renderBalances,
    refreshHoldings: renderHoldings,
  };
}

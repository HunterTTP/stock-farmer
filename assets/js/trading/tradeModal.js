import {
  PAGE_SIZE,
  clampShares,
  fmtCurrency,
  getTicker,
  sanitizeHoldings,
  tickers,
} from "./tradeModal/data.js";
import { getTradeDomRefs } from "./tradeModal/dom.js";
import { createTradeRenderers } from "./tradeModal/renderers.js";
import { createTradeActions } from "./tradeModal/actions.js";
import { createTradeLifecycle } from "./tradeModal/lifecycle.js";

export function createTradeModal({ state, onMoneyChanged, saveState }) {
  const dom = getTradeDomRefs();

  if (!dom.isReady) {
    return {
      refreshBalances: () => {},
      refreshHoldings: () => {},
    };
  }

  state.stockHoldings = sanitizeHoldings(state.stockHoldings);

  const modalState = {
    selectedSymbol: tickers[0]?.symbol || null,
    currentPage: 0,
    walletChangeTimeout: null,
    investChangeTimeout: null,
  };

  const holdingsMap = () => {
    if (!state.stockHoldings || typeof state.stockHoldings !== "object") state.stockHoldings = {};
    return state.stockHoldings;
  };

  const getShareCount = () => {
    if (!dom.shareInputEl) return 1;
    const raw = parseInt(dom.shareInputEl.value, 10);
    return clampShares(raw);
  };

  const context = {
    dom,
    fmtCurrency,
    getShareCount,
    getTicker,
    holdingsMap,
    modalState,
    onMoneyChanged,
    PAGE_SIZE,
    sanitizeHoldings,
    saveState,
    state,
    tickers,
    handleLotSellClick: () => {},
  };

  const renderers = createTradeRenderers(context);

  const setShareCount = (next) => {
    if (!dom.shareInputEl) return;
    const safe = clampShares(next);
    dom.shareInputEl.value = String(safe);
    renderers.updateTradeButtonsLabel();
  };

  const actions = createTradeActions({ ...context, renderers });
  context.handleLotSellClick = actions.handleLotSellClick;

  const lifecycle = createTradeLifecycle({
    ...context,
    actions,
    renderers,
    getShareCount,
    setShareCount,
  });

  lifecycle.init();

  return {
    refreshBalances: renderers.renderBalances,
    refreshHoldings: renderers.renderHoldings,
  };
}

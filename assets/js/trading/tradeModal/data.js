import { stocks } from "../../data/stocks.js";
import { formatCurrency } from "../../utils/helpers.js";

const PAGE_SIZE = 100;

const baseTickers = Array.isArray(stocks) ? stocks : Object.values(stocks || {});
const tickers = baseTickers.map((t) => ({ ...t, prevPrice: t.price }));

const fmtCurrency = (value) => formatCurrency(Number.isFinite(value) ? value : 0, true);
const getTicker = (symbol) => tickers.find((t) => t.symbol === symbol);

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

export {
  PAGE_SIZE,
  clampShares,
  fmtCurrency,
  getTicker,
  sanitizeHoldings,
  tickers,
};

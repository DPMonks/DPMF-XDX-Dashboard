import { detectQuoteUsd, normalizePriceBook } from "../utils/poolSplit.js";

function normalizeWalletPair(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "/");
  if (!raw) return "";
  if (raw === "XRP" || raw === "XRP/XDX") return "XDX/XRP";
  if (raw.startsWith("XDX/")) return raw;
  return `XDX/${raw}`;
}

function tradingFeeRate(tradingFee) {
  const raw = Number(tradingFee);
  if (!(raw > 0)) return 1000 / 100_000;
  return raw > 20 ? raw / 100_000 : raw / 100;
}

export const INCOME_PAGE_DAYS = 10;

export function isXdxAmmPair(value) {
  const pair = normalizeWalletPair(
    typeof value === "object" && value
      ? value.pool || value.pool_name || value.pair
      : value
  );
  return /^XDX\/[A-Z0-9]{2,12}$/.test(pair);
}

export function utcDayKey(value) {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function pairQuote(pair, fallback) {
  const name = normalizeWalletPair(pair || fallback);
  return String(name.split("/")[1] || fallback || "")
    .trim()
    .toUpperCase();
}

function pickUsd(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function priceBookFromArgs(args = {}) {
  const fromPrices = args.prices && typeof args.prices === "object" ? args.prices : {};
  return normalizePriceBook({
    ...fromPrices,
    xdxUsd: pickUsd(fromPrices.xdxUsd, fromPrices.recorded_price, args.xdxUsd),
    xrpUsd: pickUsd(fromPrices.xrpUsd, args.xrpUsd),
    RLUSD: pickUsd(fromPrices.RLUSD, fromPrices.quotes?.RLUSD, args.rlusdUsd) || 1,
  });
}

export function lpTokenUsd(lpTokens, pool = {}, prices = {}) {
  const tokens = num(lpTokens);
  const supply = num(pool.lp_supply);
  const reserveXdx = num(pool.reserve_asset ?? pool.reserve_xdx);
  const reserveQuote = num(pool.reserve_currency ?? pool.reserve_quote);
  if (!(tokens > 0) || !(supply > 0)) return 0;
  const book = normalizePriceBook(prices);
  const quoteId = pairQuote(pool.pool || pool.pool_name || pool.pair, pool.quote);
  const xdxUsd = num(book.xdxUsd ?? prices.xdxUsd ?? prices.recorded_price);
  const quoteUsd = detectQuoteUsd({
    quoteId,
    pool: { ...pool, xdxUsd },
    prices: book,
    allowImplied: true,
  });
  const xdxValue = reserveXdx > 0 && xdxUsd > 0 ? reserveXdx * xdxUsd : 0;
  const quoteValue = reserveQuote > 0 && quoteUsd > 0 ? reserveQuote * quoteUsd : 0;
  if (!(xdxValue > 0) && !(quoteValue > 0)) return 0;
  return (tokens / supply) * (xdxValue + quoteValue);
}

function feeIncomeUsd(feeXdx, position, book) {
  const reserveXdx = num(position?.reserve_asset ?? position?.reserve_xdx);
  const reserveQuote = num(position?.reserve_currency ?? position?.reserve_quote);
  const quoteId = pairQuote(position?.pool || position?.pool_name || position?.pair, position?.quote);
  const xdxUsd = num(book?.xdxUsd ?? book?.recorded_price);
  const quoteUsd = detectQuoteUsd({
    quoteId,
    pool: { ...position, xdxUsd },
    prices: book,
    allowImplied: true,
  });
  if (quoteId === "XRP" || quoteId === "RLUSD") {
    const halfXdx = feeXdx / 2;
    const px = reserveXdx > 0 ? reserveQuote / reserveXdx : 0;
    const quoteMark = quoteUsd || (quoteId === "RLUSD" ? 1 : 0);
    return halfXdx * xdxUsd + (px > 0 ? halfXdx * px * quoteMark : 0);
  }
  return feeXdx * xdxUsd;
}

function lpEquivalent(feeXdx, row) {
  const reserveXdx = num(row?.reserve_asset ?? row?.reserve_xdx);
  const supply = num(row?.lp_supply);
  if (!(reserveXdx > 0) || !(supply > 0) || !(feeXdx > 0)) return 0;
  return (feeXdx / reserveXdx) * supply;
}

export function lpFeeIncomeRows({
  positions = [],
  flows = [],
  xdxUsd = 0,
  xrpUsd = 0,
  rlusdUsd = 1,
  prices,
} = {}) {
  const held = (Array.isArray(positions) ? positions : []).filter(
    (row) => isXdxAmmPair(row) && num(row.lp_share_percent) > 0
  );
  if (!held.length) return [];

  const buckets = new Map();
  for (const flow of Array.isArray(flows) ? flows : []) {
    const day = utcDayKey(flow.timestamp);
    const pair = normalizeWalletPair(flow.pool || flow.pool_name || flow.pair);
    if (!day || !isXdxAmmPair(pair)) continue;
    const key = `${day}|${pair}`;
    const current = buckets.get(key) || { date: day, pair, xdx: 0 };
    current.xdx += Math.abs(Number(flow.xdx) || 0);
    buckets.set(key, current);
  }

  const book = priceBookFromArgs({ xdxUsd, xrpUsd, rlusdUsd, prices });
  const rows = [];
  for (const position of held) {
    const pair = normalizeWalletPair(position.pool || position.pool_name);
    const share = num(position.lp_share_percent) / 100;
    const rate = tradingFeeRate(position.trading_fee);
    for (const bucket of buckets.values()) {
      if (bucket.pair !== pair) continue;
      const feeXdx = bucket.xdx * rate * share;
      if (!(feeXdx > 0)) continue;
      const lpTokens = lpEquivalent(feeXdx, position);
      rows.push({
        date: bucket.date,
        lpTokens,
        pair,
        usd: feeIncomeUsd(feeXdx, position, book),
        kind: "fee",
      });
    }
  }
  return rows;
}

export function lpDepositIncomeRows({
  activity = [],
  positions = [],
  xdxUsd = 0,
  xrpUsd = 0,
  rlusdUsd = 1,
  prices,
} = {}) {
  const byPair = new Map(
    (Array.isArray(positions) ? positions : []).map((row) => [
      normalizeWalletPair(row.pool || row.pool_name),
      row,
    ])
  );
  const book = priceBookFromArgs({ xdxUsd, xrpUsd, rlusdUsd, prices });
  const rows = [];
  for (const item of Array.isArray(activity) ? activity : []) {
    if (item?.side !== "addLp") continue;
    const date = utcDayKey(item.timestamp);
    const pair = normalizeWalletPair(item.pair || item.pool);
    const lpTokens = num(item.lp);
    if (!date || !isXdxAmmPair(pair) || !(lpTokens > 0)) continue;
    rows.push({
      date,
      lpTokens,
      pair,
      usd: lpTokenUsd(lpTokens, byPair.get(pair) || { pair }, book),
      kind: "deposit",
    });
  }
  return rows;
}

export function mergeLpIncomeRows(...lists) {
  const rows = lists.flat().filter((row) => row?.date && row?.pair);
  return rows.sort((left, right) => {
    if (left.date !== right.date) return left.date < right.date ? 1 : -1;
    if (left.pair !== right.pair) return left.pair.localeCompare(right.pair);
    return String(left.kind || "").localeCompare(String(right.kind || ""));
  });
}

export function incomeDayKeys(rows = []) {
  return [...new Set((Array.isArray(rows) ? rows : []).map((row) => row.date).filter(Boolean))];
}

export function pageLpIncome(rows = [], daysShown = INCOME_PAGE_DAYS) {
  const days = incomeDayKeys(rows).slice(0, Math.max(0, Number(daysShown) || 0));
  const keep = new Set(days);
  return (Array.isArray(rows) ? rows : []).filter((row) => keep.has(row.date));
}

export function lpIncomeCsv(rows = []) {
  const lines = ["Date,LP tokens received,Trading pair,USD"];
  for (const row of Array.isArray(rows) ? rows : []) {
    lines.push(
      [row.date, row.lpTokens, row.pair, row.usd]
        .map((value) => {
          const text = value == null ? "" : String(value);
          return text.includes(",") ? `"${text.replaceAll('"', '""')}"` : text;
        })
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

export function downloadTextFile(filename, text, type = "text/csv") {
  if (typeof document === "undefined") return;
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

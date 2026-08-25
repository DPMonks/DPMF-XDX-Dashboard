import { catalogXdxVolume24h, catalogXdxVolume7d } from "../utils/lpVolume.js";
import { detectQuoteUsd, normalizePriceBook } from "../utils/poolSplit.js";

export const DEFAULT_INCOME_PAIR = "XDX/XRP";
export const INCOME_FEATURED_PAIRS = ["XDX/XRP", "XDX/RLUSD", "XDX/XIO", "XDX/XSQUAD"];
export const LP_INCOME_STORE_PREFIX = "dpmf-lp-income-v1:";
const DAY_MS = 24 * 60 * 60 * 1000;
const CATALOG_FILL_DAYS = 7;

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

export function incomePairName(value) {
  return normalizeWalletPair(value) || DEFAULT_INCOME_PAIR;
}

export function incomePairChoices({ positions = [], activity = [], featured = INCOME_FEATURED_PAIRS } = {}) {
  const names = [DEFAULT_INCOME_PAIR, ...(Array.isArray(featured) ? featured : INCOME_FEATURED_PAIRS)];
  for (const row of Array.isArray(positions) ? positions : []) {
    names.push(normalizeWalletPair(row?.pool || row?.pool_name || row?.pair || row));
  }
  for (const row of Array.isArray(activity) ? activity : []) {
    names.push(normalizeWalletPair(row?.pair || row?.pool || row?.pool_name));
  }
  return [...new Set(names.filter((name) => isXdxAmmPair(name)))].sort((left, right) => {
    if (left === DEFAULT_INCOME_PAIR) return -1;
    if (right === DEFAULT_INCOME_PAIR) return 1;
    return left.localeCompare(right);
  });
}

export function filterIncomeByPair(rows = [], pair = DEFAULT_INCOME_PAIR) {
  const want = incomePairName(pair);
  return (Array.isArray(rows) ? rows : []).filter((row) => incomePairName(row?.pair) === want);
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

function preferPositive(...values) {
  for (const value of values) {
    if (value > 0) return value;
  }
  return 0;
}

function preferLargest(...values) {
  return values.reduce((best, value) => (value > best ? value : best), 0);
}

export function poolForIncomePair(pair, positions = [], pools = []) {
  const want = incomePairName(pair);
  const position =
    (Array.isArray(positions) ? positions : []).find(
      (row) => incomePairName(row?.pool || row?.pool_name || row?.pair) === want
    ) || {};
  const catalog =
    (Array.isArray(pools) ? pools : []).find(
      (row) => incomePairName(row?.pool || row?.pool_name || row?.pair) === want
    ) || {};
  const reserveXdx = preferPositive(
    num(catalog.reserve_asset ?? catalog.reserve_xdx),
    num(position.reserve_asset ?? position.reserve_xdx)
  );
  const reserveQuote = preferPositive(
    num(catalog.reserve_currency ?? catalog.reserve_quote),
    num(position.reserve_currency ?? position.reserve_quote)
  );
  const supply = preferLargest(num(catalog.lp_supply), num(position.lp_supply));
  return {
    ...catalog,
    ...position,
    pair: want,
    pool: want,
    pool_name: want,
    quote: position.quote || catalog.quote || want.split("/")[1],
    lp_supply: supply,
    reserve_asset: reserveXdx,
    reserve_xdx: reserveXdx,
    reserve_currency: reserveQuote,
    reserve_quote: reserveQuote,
  };
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
  const quoteUsd =
    quoteId === "RLUSD"
      ? 1
      : detectQuoteUsd({
          quoteId,
          pool: { ...pool, xdxUsd },
          prices: book,
          allowImplied: true,
        });
  let xdxValue = reserveXdx > 0 && xdxUsd > 0 ? reserveXdx * xdxUsd : 0;
  let quoteValue = reserveQuote > 0 && quoteUsd > 0 ? reserveQuote * quoteUsd : 0;
  if (xdxValue > 0 && !(quoteValue > 0)) quoteValue = xdxValue;
  if (quoteValue > 0 && !(xdxValue > 0)) xdxValue = quoteValue;
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

export function earliestHeldDay(pair, activity = [], currentBalance = 0) {
  const want = incomePairName(pair);
  const events = (Array.isArray(activity) ? activity : []).filter((item) => {
    if (!item || incomePairName(item.pair || item.pool) !== want) return false;
    return item.side === "addLp" || item.side === "createPool" || item.side === "removeLp";
  });
  if (!events.length) return "";
  let net = 0;
  let first = "";
  for (const item of events) {
    const day = utcDayKey(item.timestamp);
    const tokens = num(item.lp);
    if (item.side === "removeLp") net -= tokens;
    else {
      net += tokens;
      if (day && (!first || day < first)) first = day;
    }
  }
  if (!first) return "";
  const held = num(currentBalance);
  if (held > 0 && net > 0 && held <= net * 1.08) return first;
  return "";
}

function fillCatalogVolumeDays(buckets, positions = [], now = Date.now()) {
  const today = utcDayKey(now);
  if (!today) return buckets;
  for (const position of Array.isArray(positions) ? positions : []) {
    const pair = normalizeWalletPair(position.pool || position.pool_name || position.pair);
    if (!isXdxAmmPair(pair)) continue;
    const vol24 = catalogXdxVolume24h(position);
    const vol7 = catalogXdxVolume7d(position);
    const todayKey = `${today}|${pair}`;
    const todayBucket = buckets.get(todayKey);
    if (vol24 > 0 && !(todayBucket?.xdx > 0)) {
      buckets.set(todayKey, { date: today, pair, xdx: vol24 });
    }
    if (!(vol7 > vol24)) continue;
    let accounted = todayBucket?.xdx || (vol24 > 0 ? vol24 : 0);
    for (const bucket of buckets.values()) {
      if (bucket.pair !== pair || bucket.date === today) continue;
      const age = Date.parse(`${bucket.date}T00:00:00.000Z`);
      if (Number.isFinite(age) && now - age <= CATALOG_FILL_DAYS * DAY_MS) {
        accounted += bucket.xdx;
      }
    }
    const leftover = Math.max(0, vol7 - accounted);
    const missing = [];
    for (let offset = 1; offset < CATALOG_FILL_DAYS; offset += 1) {
      const date = utcDayKey(now - offset * DAY_MS);
      if (!date) continue;
      const key = `${date}|${pair}`;
      if (!buckets.has(key)) missing.push({ date, key });
    }
    if (!missing.length || !(leftover > 0)) continue;
    const perDay = leftover / missing.length;
    for (const row of missing) {
      buckets.set(row.key, { date: row.date, pair, xdx: perDay });
    }
  }
  return buckets;
}

export function lpFeeIncomeRows({
  positions = [],
  flows = [],
  activity = [],
  xdxUsd = 0,
  xrpUsd = 0,
  rlusdUsd = 1,
  prices,
  now = Date.now(),
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
  fillCatalogVolumeDays(buckets, held, now);

  const book = priceBookFromArgs({ xdxUsd, xrpUsd, rlusdUsd, prices });
  const rows = [];
  for (const position of held) {
    const pair = normalizeWalletPair(position.pool || position.pool_name);
    const share = num(position.lp_share_percent) / 100;
    const rate = tradingFeeRate(position.trading_fee);
    const heldFrom = earliestHeldDay(pair, activity, position.lp_balance);
    for (const bucket of buckets.values()) {
      if (bucket.pair !== pair) continue;
      if (heldFrom && bucket.date < heldFrom) continue;
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
  return dailyLpIncomeTotals(rows);
}

export function lpDepositIncomeRows({
  activity = [],
  positions = [],
  pools = [],
  xdxUsd = 0,
  xrpUsd = 0,
  rlusdUsd = 1,
  prices,
} = {}) {
  const book = priceBookFromArgs({ xdxUsd, xrpUsd, rlusdUsd, prices });
  const rows = [];
  for (const item of Array.isArray(activity) ? activity : []) {
    if (item?.side !== "addLp" && item?.side !== "createPool") continue;
    const date = utcDayKey(item.timestamp);
    const pair = normalizeWalletPair(item.pair || item.pool);
    const lpTokens = num(item.lp);
    if (!date || !isXdxAmmPair(pair) || !(lpTokens > 0)) continue;
    rows.push({
      date,
      lpTokens,
      pair,
      usd: lpTokenUsd(lpTokens, poolForIncomePair(pair, positions, pools), book),
      kind: item.side === "createPool" ? "create" : "deposit",
      txid: item.txid || null,
    });
  }
  return rows;
}

export function mergeLpIncomeRows(...lists) {
  const rows = lists.flat().filter((row) => row?.date && row?.pair);
  return rows.sort((left, right) => {
    if (left.date !== right.date) return left.date < right.date ? 1 : -1;
    if (left.pair !== right.pair) return left.pair.localeCompare(right.pair);
    if ((left.txid || "") !== (right.txid || "")) return String(right.txid || "").localeCompare(String(left.txid || ""));
    return String(left.kind || "").localeCompare(String(right.kind || ""));
  });
}

export function dailyLpIncomeTotals(rows = []) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = utcDayKey(row?.date) || String(row?.date || "");
    const pair = incomePairName(row?.pair);
    if (!date || !isXdxAmmPair(pair)) continue;
    if (row.kind && row.kind !== "fee") continue;
    const key = `${date}|${pair}`;
    const current = map.get(key) || { date, pair, lpTokens: 0, usd: 0, kind: "fee" };
    current.lpTokens += num(row.lpTokens);
    current.usd += Number(row.usd) || 0;
    map.set(key, current);
  }
  return mergeLpIncomeRows([...map.values()]);
}

export function recordedIncomeKey(address) {
  return `${LP_INCOME_STORE_PREFIX}${String(address || "").trim()}`;
}

export function readRecordedLpIncome(address, storage = globalThis.localStorage) {
  const name = String(address || "").trim();
  if (!name || !storage?.getItem) return [];
  try {
    const parsed = JSON.parse(storage.getItem(recordedIncomeKey(name)) || "[]");
    return dailyLpIncomeTotals(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}

export function writeRecordedLpIncome(address, rows, storage = globalThis.localStorage) {
  const name = String(address || "").trim();
  if (!name || !storage?.setItem) return [];
  const next = dailyLpIncomeTotals(rows).slice(0, 400);
  try {
    storage.setItem(recordedIncomeKey(name), JSON.stringify(next));
  } catch {
    // private mode / quota
  }
  return next;
}

export function mergeRecordedLpIncome(...lists) {
  const map = new Map();
  for (const row of lists.flat()) {
    const date = utcDayKey(row?.date) || String(row?.date || "");
    const pair = incomePairName(row?.pair);
    if (!date || !isXdxAmmPair(pair)) continue;
    const key = `${date}|${pair}`;
    const current = map.get(key);
    const next = {
      date,
      pair,
      lpTokens: num(row.lpTokens),
      usd: Number(row.usd) || 0,
      kind: "fee",
    };
    if (!current || next.lpTokens >= current.lpTokens) map.set(key, next);
  }
  return mergeLpIncomeRows([...map.values()]);
}

export function incomeRowsForPair({
  pair = DEFAULT_INCOME_PAIR,
  snapshotRows = [],
  historyActivity = null,
  historyDays = [],
  recordedRows = [],
  positions = [],
  pools = [],
  prices,
  xdxUsd = 0,
  xrpUsd = 0,
  rlusdUsd = 1,
  now = Date.now(),
} = {}) {
  const want = incomePairName(pair);
  const snapshot = filterIncomeByPair(snapshotRows, want);
  const heldFrom = earliestHeldDay(
    want,
    historyActivity,
    (Array.isArray(positions) ? positions : []).find(
      (row) => incomePairName(row?.pool || row?.pool_name || row?.pair) === want
    )?.lp_balance
  );
  let fees = dailyLpIncomeTotals(
    mergeRecordedLpIncome(
      snapshot.filter((row) => !row.kind || row.kind === "fee"),
      filterIncomeByPair(historyDays, want),
      filterIncomeByPair(recordedRows, want)
    )
  ).filter((row) => !heldFrom || row.date >= heldFrom);
  if (!fees.length) {
    fees = lpFeeIncomeRows({
      positions: (Array.isArray(positions) ? positions : []).filter(
        (row) => incomePairName(row?.pool || row?.pool_name || row?.pair) === want
      ),
      flows: [],
      activity: historyActivity || [],
      xdxUsd,
      xrpUsd,
      rlusdUsd,
      prices,
      now,
    });
  }
  const deposits =
    historyActivity == null
      ? snapshot.filter((row) => row.kind && row.kind !== "fee")
      : lpDepositIncomeRows({
          activity: historyActivity,
          positions,
          pools,
          xdxUsd,
          xrpUsd,
          rlusdUsd,
          prices,
        }).filter((row) => incomePairName(row.pair) === want);
  return fees.length ? fees : mergeLpIncomeRows(deposits);
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

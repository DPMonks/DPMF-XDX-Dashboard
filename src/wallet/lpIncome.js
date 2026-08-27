import { catalogXdxVolume24h, catalogXdxVolume7d } from "../utils/lpVolume.js";
import { detectQuoteUsd, normalizePriceBook } from "../utils/poolSplit.js";

export const DEFAULT_INCOME_PAIR = "XDX/XRP";
export const INCOME_ALL_PAIRS = "ALL";
export const INCOME_FEATURED_PAIRS = ["XDX/XRP", "XDX/RLUSD", "XDX/XIO", "XDX/XSQUAD"];
export const LP_INCOME_STORE_PREFIX = "dpmf-lp-income-v1:";
export const HISTORICAL_INCOME_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;
const CATALOG_FILL_DAYS = 7;

export function looksLikeXrplAddress(value) {
  const text = String(value || "").trim();
  if (/^r[1-9A-HJ-NP-Za-km-z]{3,}(?:…|\.\.\.)[1-9A-HJ-NP-Za-km-z]{2,}$/.test(text)) return true;
  const compact = text.replace(/[.…]/g, "");
  return /^r[1-9A-HJ-NP-Za-km-z]{20,34}$/.test(compact);
}

function normalizeWalletPair(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "/");
  if (!raw) return "";
  if (looksLikeXrplAddress(value) || looksLikeXrplAddress(raw) || looksLikeXrplAddress(raw.split("/")[1])) {
    return "";
  }
  if (raw === "XRP" || raw === "XRP/XDX") return "XDX/XRP";
  if (raw.startsWith("XDX/")) return raw;
  return `XDX/${raw}`;
}

export function incomePairName(value) {
  return normalizeWalletPair(value) || DEFAULT_INCOME_PAIR;
}

export function isAllIncomePairs(value) {
  return String(value || "").trim().toUpperCase() === INCOME_ALL_PAIRS;
}

export function incomePairChoices({ positions = [], activity = [], featured = INCOME_FEATURED_PAIRS } = {}) {
  const names = [DEFAULT_INCOME_PAIR, ...(Array.isArray(featured) ? featured : INCOME_FEATURED_PAIRS)];
  for (const row of Array.isArray(positions) ? positions : []) {
    names.push(normalizeWalletPair(row?.pool || row?.pool_name || row?.pair || row));
  }
  for (const row of Array.isArray(activity) ? activity : []) {
    names.push(normalizeWalletPair(row?.pair || row?.pool || row?.pool_name));
  }
  const pairs = [...new Set(names.filter((name) => isXdxAmmPair(name)))].sort((left, right) => {
    if (left === DEFAULT_INCOME_PAIR) return -1;
    if (right === DEFAULT_INCOME_PAIR) return 1;
    return left.localeCompare(right);
  });
  return [INCOME_ALL_PAIRS, ...pairs];
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

export const INCOME_PAGE_DAYS = 14;

export function isXdxAmmPair(value) {
  const pair = normalizeWalletPair(
    typeof value === "object" && value
      ? value.pool || value.pool_name || value.pair
      : value
  );
  return /^XDX\/[A-Z0-9.$]{2,20}$/.test(pair);
}

export function remapIncomeActivity(activity = [], positions = [], pools = []) {
  const catalog = [...(Array.isArray(positions) ? positions : []), ...(Array.isArray(pools) ? pools : [])];
  return (Array.isArray(activity) ? activity : [])
    .map((row) => {
      if (!row) return null;
      const named = normalizeWalletPair(row.pair || row.pool);
      if (isXdxAmmPair(named) && !looksLikeXrplAddress(named.split("/")[1])) {
        return { ...row, pair: named, pool: named };
      }
      const amm = String(row.amm || row.amm_account || "").toLowerCase();
      const hex = String(row.lpCurrency || row.lp_currency || "").toUpperCase();
      const match = catalog.find((item) => {
        const itemAmm = String(item?.amm_account || item?.amm || "").toLowerCase();
        const itemHex = String(item?.lp_currency || item?.lp_currency_hex || "").toUpperCase();
        return (amm && itemAmm === amm) || (hex && itemHex === hex);
      });
      const remapped = normalizeWalletPair(
        match?.pool || match?.pool_name || match?.pair || named
      );
      if (!isXdxAmmPair(remapped) || looksLikeXrplAddress(remapped.split("/")[1])) return null;
      return { ...row, pair: remapped, pool: remapped };
    })
    .filter(Boolean);
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

export function netHeldLp(pair, activity = [], currentBalance = 0) {
  const want = incomePairName(pair);
  let added = 0;
  let removed = 0;
  let first = "";
  for (const item of Array.isArray(activity) ? activity : []) {
    if (!item || incomePairName(item.pair || item.pool) !== want) continue;
    const tokens = num(item.lp);
    const day = utcDayKey(item.timestamp);
    if (item.side === "addLp" || item.side === "createPool") {
      added += tokens;
      if (day && (!first || day < first)) first = day;
    }
    if (item.side === "removeLp") removed += tokens;
  }
  const current = num(currentBalance);
  return {
    first,
    added,
    removed,
    held: current > 0 ? current : Math.max(0, added - removed),
  };
}

export function incomePositionForPair(pair, positions = [], pools = [], activity = []) {
  const want = incomePairName(pair);
  const catalog = poolForIncomePair(want, positions, pools);
  const existing =
    (Array.isArray(positions) ? positions : []).find(
      (row) => incomePairName(row?.pool || row?.pool_name || row?.pair) === want
    ) || {};
  const held = netHeldLp(want, activity, existing.lp_balance);
  const balance = preferPositive(num(existing.lp_balance), held.held, held.added);
  const supply = preferLargest(num(catalog.lp_supply), num(existing.lp_supply));
  const sharePct =
    supply > 0 && balance > 0
      ? (balance / supply) * 100
      : preferPositive(num(existing.lp_share_percent), num(catalog.lp_share_percent));
  if (!(sharePct > 0)) return null;
  return {
    ...catalog,
    ...existing,
    pool: want,
    pool_name: want,
    pair: want,
    quote: existing.quote || catalog.quote || want.split("/")[1],
    lp_balance: balance,
    lp_supply: supply,
    lp_share_percent: sharePct,
    trading_fee: preferPositive(num(existing.trading_fee), num(catalog.trading_fee)) || 1000,
    volume24h: preferPositive(num(existing.volume24h), num(catalog.volume24h), num(existing.volume24hXdx), num(catalog.volume24hXdx)),
    volume24hXdx: preferPositive(num(existing.volume24hXdx), num(catalog.volume24hXdx), num(existing.volume24h), num(catalog.volume24h)),
    volume7d: preferPositive(num(existing.volume7d), num(catalog.volume7d), num(existing.volume7dXdx), num(catalog.volume7dXdx)),
    volume7dXdx: preferPositive(num(existing.volume7dXdx), num(catalog.volume7dXdx), num(existing.volume7d), num(catalog.volume7d)),
  };
}

function volumeDaysFromPools(pools = [], now = Date.now()) {
  const today = utcDayKey(now);
  return (Array.isArray(pools) ? pools : [])
    .map((pool) => {
      const pair = incomePairName(pool?.pool || pool?.pool_name || pool?.pair);
      const xdx = num(pool?.volume24hXdx ?? pool?.volume24h);
      if (!pair || !(xdx > 0) || !today) return null;
      return { pair, pool: pair, xdx, timestamp: `${today}T12:00:00.000Z` };
    })
    .filter(Boolean);
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

function quoteReserveForUsd(reserveQuote, supply) {
  const quote = num(reserveQuote);
  const lp = num(supply);
  if (!(quote > 0)) return 0;
  if (lp > 0 && Math.abs(quote - lp) / Math.max(quote, lp) < 0.05) return 0;
  return quote;
}

export function lpTokenUsd(lpTokens, pool = {}, prices = {}) {
  const tokens = num(lpTokens);
  const supply = num(pool.lp_supply);
  const reserveXdx = num(pool.reserve_asset ?? pool.reserve_xdx);
  const reserveQuote = quoteReserveForUsd(pool.reserve_currency ?? pool.reserve_quote, supply);
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
  const reserveQuote = quoteReserveForUsd(
    position?.reserve_currency ?? position?.reserve_quote,
    position?.lp_supply
  );
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

function overlayVolumeDays(buckets, volumeDays = []) {
  for (const row of Array.isArray(volumeDays) ? volumeDays : []) {
    const day = utcDayKey(row.timestamp || row.date || row.day);
    const pair = normalizeWalletPair(row.pool || row.pool_name || row.pair);
    const xdx = Math.abs(Number(row.xdx) || 0);
    if (!day || !isXdxAmmPair(pair) || !(xdx > 0)) continue;
    const key = `${day}|${pair}`;
    const current = buckets.get(key);
    if (!current || xdx > current.xdx) buckets.set(key, { date: day, pair, xdx });
  }
  return buckets;
}

function volumeOnDay(known, date) {
  if (!known.length) return 0;
  let prev = null;
  let next = null;
  for (const row of known) {
    if (row.date === date) return row.xdx;
    if (row.date < date) prev = row;
    if (row.date > date && !next) next = row;
  }
  if (prev && next) {
    const start = Date.parse(`${prev.date}T00:00:00.000Z`);
    const end = Date.parse(`${next.date}T00:00:00.000Z`);
    const at = Date.parse(`${date}T00:00:00.000Z`);
    if (!(end > start) || !Number.isFinite(at)) return prev.xdx;
    const weight = (at - start) / (end - start);
    return prev.xdx * (1 - weight) + next.xdx * weight;
  }
  return (next || prev)?.xdx || 0;
}

export function priceBookOnDay(date, dailyPrices = {}, fallback = {}) {
  const book = priceBookFromArgs({
    prices: fallback,
    xdxUsd: fallback.xdxUsd,
    xrpUsd: fallback.xrpUsd,
    rlusdUsd: fallback.RLUSD ?? fallback.rlusdUsd,
  });
  const map = dailyPrices && typeof dailyPrices === "object" ? dailyPrices : {};
  const day = utcDayKey(date) || String(date || "");
  if (!day) return book;
  let picked = map[day];
  if (!picked) {
    const earlier = Object.keys(map)
      .filter((key) => key && key <= day)
      .sort();
    picked = map[earlier[earlier.length - 1]];
  }
  if (!picked) return book;
  return priceBookFromArgs({
    prices: { ...book, ...picked },
    xdxUsd: picked.xdxUsd,
    xrpUsd: picked.xrpUsd,
    rlusdUsd: picked.rlusdUsd ?? picked.RLUSD ?? book.RLUSD,
  });
}

export function fillContinuousVolumeDays(buckets, pair, fromDay, toDay) {
  const want = normalizeWalletPair(pair);
  const start = utcDayKey(fromDay);
  const end = utcDayKey(toDay);
  if (!want || !start || !end || start > end) return buckets;
  const known = [...buckets.values()]
    .filter((row) => row.pair === want && row.xdx > 0)
    .sort((left, right) => (left.date < right.date ? -1 : 1));
  if (!known.length) return buckets;
  for (let ts = Date.parse(`${start}T00:00:00.000Z`); ts <= Date.parse(`${end}T00:00:00.000Z`); ts += DAY_MS) {
    const date = utcDayKey(ts);
    if (!date) continue;
    const key = `${date}|${want}`;
    if (buckets.get(key)?.xdx > 0) continue;
    const xdx = volumeOnDay(known, date);
    if (xdx > 0) buckets.set(key, { date, pair: want, xdx });
  }
  return buckets;
}

export function lpFeeIncomeRows({
  positions = [],
  flows = [],
  volumeDays = [],
  activity = [],
  xdxUsd = 0,
  xrpUsd = 0,
  rlusdUsd = 1,
  prices,
  dailyPrices,
  now = Date.now(),
} = {}) {
  const held = (Array.isArray(positions) ? positions : [])
    .map((row) => {
      if (!isXdxAmmPair(row)) return null;
      const supply = num(row.lp_supply);
      const balance = num(row.lp_balance);
      const share = num(row.lp_share_percent) || (supply > 0 && balance > 0 ? (balance / supply) * 100 : 0);
      if (!(share > 0)) return null;
      return {
        ...row,
        lp_share_percent: share,
        trading_fee: num(row.trading_fee) || 1000,
      };
    })
    .filter(Boolean);
  if (!held.length) return [];

  const oldest = utcDayKey(now - HISTORICAL_INCOME_DAYS * DAY_MS);
  const buckets = new Map();
  for (const flow of Array.isArray(flows) ? flows : []) {
    const day = utcDayKey(flow.timestamp);
    const pair = normalizeWalletPair(flow.pool || flow.pool_name || flow.pair);
    if (!day || !isXdxAmmPair(pair) || (oldest && day < oldest)) continue;
    const key = `${day}|${pair}`;
    const current = buckets.get(key) || { date: day, pair, xdx: 0 };
    current.xdx += Math.abs(Number(flow.xdx) || 0);
    buckets.set(key, current);
  }
  overlayVolumeDays(buckets, volumeDays);
  fillCatalogVolumeDays(buckets, held, now);
  const today = utcDayKey(now);
  for (const position of held) {
    const pair = normalizeWalletPair(position.pool || position.pool_name);
    const heldFrom = earliestHeldDay(pair, activity, position.lp_balance);
    const known = [...buckets.values()]
      .filter((row) => row.pair === pair)
      .map((row) => row.date)
      .sort();
    const fromDay = heldFrom
      ? [oldest, heldFrom].filter(Boolean).sort().pop()
      : known[0];
    if (fromDay && today) fillContinuousVolumeDays(buckets, pair, fromDay, today);
  }

  const book = priceBookFromArgs({ xdxUsd, xrpUsd, rlusdUsd, prices });
  const dayBooks =
    (dailyPrices && typeof dailyPrices === "object" && dailyPrices) ||
    (prices?.dailyPrices && typeof prices.dailyPrices === "object" ? prices.dailyPrices : {});
  const rows = [];
  for (const position of held) {
    const pair = normalizeWalletPair(position.pool || position.pool_name);
    const share = num(position.lp_share_percent) / 100;
    const rate = tradingFeeRate(position.trading_fee);
    const heldFrom = earliestHeldDay(pair, activity, position.lp_balance);
    for (const bucket of buckets.values()) {
      if (bucket.pair !== pair) continue;
      if (heldFrom && bucket.date < heldFrom) continue;
      if (oldest && bucket.date < oldest) continue;
      const feeXdx = bucket.xdx * rate * share;
      if (!(feeXdx > 0)) continue;
      const lpTokens = lpEquivalent(feeXdx, position);
      rows.push({
        date: bucket.date,
        lpTokens,
        pair,
        usd: feeIncomeUsd(feeXdx, position, priceBookOnDay(bucket.date, dayBooks, book)),
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
  pair = INCOME_ALL_PAIRS,
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
  historyComplete = false,
} = {}) {
  if (isAllIncomePairs(pair)) {
    const listed = incomePairChoices({
      positions,
      activity: [
        ...(Array.isArray(snapshotRows) ? snapshotRows : []),
        ...(Array.isArray(historyActivity) ? historyActivity : []),
        ...(Array.isArray(recordedRows) ? recordedRows : []),
      ],
    }).filter((name) => !isAllIncomePairs(name));
    return mergeLpIncomeRows(
      ...(listed.length ? listed : [DEFAULT_INCOME_PAIR]).map((name) =>
        incomeRowsForPair({
          pair: name,
          snapshotRows,
          historyActivity,
          historyDays,
          recordedRows,
          positions,
          pools,
          prices,
          xdxUsd,
          xrpUsd,
          rlusdUsd,
          now,
          historyComplete,
        })
      )
    );
  }
  const want = incomePairName(pair);
  const snapshot = filterIncomeByPair(snapshotRows, want);
  const activity = remapIncomeActivity(historyActivity, positions, pools);
  const position = incomePositionForPair(want, positions, pools, activity);
  const reconciled = earliestHeldDay(want, activity, position?.lp_balance);
  const firstSeen = netHeldLp(want, activity, position?.lp_balance).first;
  const heldFrom = reconciled || (historyComplete ? firstSeen : "");
  const rebuilt = lpFeeIncomeRows({
    positions: position ? [position] : [],
    flows: [],
    volumeDays: [...filterIncomeByPair(historyDays, want), ...volumeDaysFromPools(position ? [position] : [], now)],
    activity,
    xdxUsd,
    xrpUsd,
    rlusdUsd,
    prices,
    dailyPrices: prices?.dailyPrices,
    now,
  });
  return dailyLpIncomeTotals(
    mergeRecordedLpIncome(
      snapshot.filter((row) => !row.kind || row.kind === "fee"),
      filterIncomeByPair(historyDays, want),
      filterIncomeByPair(recordedRows, want),
      rebuilt
    )
  ).filter((row) => !heldFrom || row.date >= heldFrom);
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
  const lines = ["Date,LP Balance,Trading pair,USD"];
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

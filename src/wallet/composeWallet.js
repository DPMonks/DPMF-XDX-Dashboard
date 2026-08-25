import { XDX_TOTAL_SUPPLY } from "../constants/ledger.js";
import { fillMissingXdxFiat } from "../utils/fiatFx.js";
import { catalogXdxVolume24h, catalogXdxVolume7d } from "../utils/lpVolume.js";
import { mergeWalletActivity, mergeWalletOrders, pendingFor } from "./ledgerOrders.js";
import {
  isXdxAmmPair,
  lpDepositIncomeRows,
  lpFeeIncomeRows,
  mergeLpIncomeRows,
} from "./lpIncome.js";

export const DROPS = 1_000_000;
export const DEFAULT_RESERVE_BASE_DROPS = 1_000_000;
export const DEFAULT_RESERVE_INC_DROPS = 200_000;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function dropsToXrp(drops) {
  const n = Number(drops);
  if (!Number.isFinite(n)) return null;
  return n / DROPS;
}

function dropsOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function xrpReserveBreakdown({
  balance,
  balanceDrops,
  ownerCount = 0,
  reserveBaseDrops = DEFAULT_RESERVE_BASE_DROPS,
  reserveIncDrops = DEFAULT_RESERVE_INC_DROPS,
} = {}) {
  const drops = dropsOrNull(balanceDrops);
  const fromAccount = drops != null ? drops / DROPS : null;
  const fromBalances = num(balance);
  const total = fromAccount != null ? fromAccount : fromBalances;
  if (total == null) {
    return {
      balance: null,
      spendable: null,
      reserved: null,
      required: null,
      baseReserve: null,
      ownerReserve: null,
      ownerCount: null,
    };
  }
  const base = (num(reserveBaseDrops) ?? DEFAULT_RESERVE_BASE_DROPS) / DROPS;
  const increment = (num(reserveIncDrops) ?? DEFAULT_RESERVE_INC_DROPS) / DROPS;
  const owners = Math.max(0, Number(ownerCount) || 0);
  const ownerReserve = owners * increment;
  const required = base + ownerReserve;
  const reserved = Math.min(total, required);
  return {
    balance: total,
    spendable: Math.max(0, total - reserved),
    reserved,
    required,
    baseReserve: base,
    ownerReserve,
    ownerCount: owners,
  };
}

export function xrpBarPercents({ reserved, spendable, total } = {}, filled = true) {
  if (!filled) return { reservePct: 0, spendPct: 0, totalPct: 0 };
  const hold = Math.max(0, Number(total) || 0);
  if (!(hold > 0)) return { reservePct: 0, spendPct: 0, totalPct: 100 };
  return {
    reservePct: (Math.max(0, Number(reserved) || 0) / hold) * 100,
    spendPct: (Math.max(0, Number(spendable) || 0) / hold) * 100,
    totalPct: 100,
  };
}

export function compareBarPercents(...values) {
  const nums = values.map((value) => Math.max(0, Number(value) || 0));
  const max = Math.max(...nums, 0);
  if (!(max > 0)) return nums.map(() => 0);
  return nums.map((value) => (value / max) * 100);
}

export function sortWalletPairs(names = []) {
  return [...new Set((names || []).map((name) => normalizeWalletPair(name)).filter(Boolean))].sort(
    (left, right) => {
      if (left === "XDX/XRP") return -1;
      if (right === "XDX/XRP") return 1;
      return left.localeCompare(right);
    }
  );
}

export function preferredWalletPair(names = [], current = "") {
  const list = sortWalletPairs(names);
  const wanted = normalizeWalletPair(current);
  if (wanted && wanted !== "XDX/XRP" && list.includes(wanted)) return wanted;
  if (list.includes("XDX/XRP")) return "XDX/XRP";
  return list[0] || "XDX/XRP";
}

export function normalizeWalletPair(value) {
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

function cappedShare(part, total) {
  const bal = num(part);
  const den = num(total);
  if (bal == null || !(den > 0)) return null;
  return Math.min(100, (bal / den) * 100);
}

export function supplyShares(xdx, circulating, totalSupply) {
  return {
    circulatingPct: cappedShare(xdx, circulating),
    supplyPct: cappedShare(xdx, totalSupply),
  };
}

function fiatViaXrp(unitUsd, xrpUsd, xrpFx) {
  if (unitUsd == null || !(num(xrpUsd) > 0) || !(num(xrpFx) > 0)) return null;
  return unitUsd * (Number(xrpFx) / Number(xrpUsd));
}

function fiatAmount(bal, unitPrice, unitUsd, xrpUsd, xrpFx) {
  if (Number(unitPrice) > 0) return bal * Number(unitPrice);
  const via = fiatViaXrp(unitUsd, xrpUsd, xrpFx);
  return via != null ? bal * via : null;
}

export function xdxFiatValues(xdx, prices = {}) {
  const bal = num(xdx);
  const filled = fillMissingXdxFiat(prices);
  const usd = num(filled.xdxUsd ?? filled.recorded_price);
  const xrp = num(filled.xdxXrp ?? filled.xdxPerXrp);
  if (bal == null) {
    return { xdx: null, usd: null, gbp: null, eur: null, jpy: null, xrp: null, rlusd: null };
  }
  const usdValue = usd != null && usd > 0 ? bal * usd : null;
  const rlusdUsd = num(filled.rlusdUsd ?? filled.RLUSD) || 1;
  const viaUsd = (rate) => (usdValue != null && Number(rate) > 0 ? usdValue * Number(rate) : null);
  return {
    xdx: bal,
    usd: usdValue,
    gbp: fiatAmount(bal, filled.xdxGbp, usd, filled.xrpUsd, filled.xrpGbp) ?? viaUsd(filled.usdGbp),
    eur: fiatAmount(bal, filled.xdxEur, usd, filled.xrpUsd, filled.xrpEur) ?? viaUsd(filled.usdEur),
    jpy: fiatAmount(bal, filled.xdxJpy, usd, filled.xrpUsd, filled.xrpJpy) ?? viaUsd(filled.usdJpy),
    xrp: xrp != null ? bal * xrp : null,
    rlusd: usdValue != null ? usdValue / rlusdUsd : null,
  };
}

export function indexPoolsByPair(pools = []) {
  const map = new Map();
  const set = (key, pool) => {
    const name = String(key || "").trim();
    if (!name || map.has(name)) return;
    map.set(name, pool);
  };
  for (const pool of Array.isArray(pools) ? pools : []) {
    set(normalizeWalletPair(pool.pool_name || pool.pool || pool.pair), pool);
    set(normalizeWalletPair(pool.quote), pool);
    set(String(pool.lp_currency || pool.lp_currency_hex || "").toUpperCase(), pool);
    set(String(pool.amm_account || "").toLowerCase(), pool);
  }
  return map;
}

export function mergeLpPoolSource(row = {}, catalogPool = null) {
  if (!catalogPool) return row;
  const catalogSupply = num(catalogPool.lp_supply);
  return {
    ...row,
    ...catalogPool,
    quote: catalogPool.quote || row.quote,
    lp_supply: catalogSupply > 0 ? catalogSupply : num(row.lp_supply),
    reserve_asset:
      num(catalogPool.reserve_asset ?? catalogPool.reserve_xdx) ||
      num(row.reserve_asset ?? row.reserve_xdx),
    reserve_currency:
      num(catalogPool.reserve_currency ?? catalogPool.reserve_quote) ||
      num(row.reserve_currency ?? row.reserve_quote),
    lp_share_percent: catalogSupply > 0 ? undefined : row.lp_share_percent,
    withdraw_estimate_xdx: catalogSupply > 0 ? undefined : row.withdraw_estimate_xdx,
    withdraw_estimate_quote: catalogSupply > 0 ? undefined : row.withdraw_estimate_quote,
    xdx_pct: num(catalogPool.xdx_pct ?? catalogPool.composition_xdx_percent) ?? num(row.xdx_pct),
    quote_pct: num(catalogPool.quote_pct ?? catalogPool.composition_quote_percent) ?? num(row.quote_pct),
  };
}

export function lookupLpPool(row, poolsByPair) {
  const hex = String(row?.lp_currency || row?.lp_currency_hex || "").toUpperCase();
  if (hex && poolsByPair.get(hex)) return poolsByPair.get(hex);
  const name = normalizeWalletPair(row?.pool_name || row?.pool || row?.pair);
  if (name && poolsByPair.get(name)) return poolsByPair.get(name);
  const amm = String(row?.amm_account || "").toLowerCase();
  if (amm && poolsByPair.get(amm)) return poolsByPair.get(amm);
  return null;
}

export function lpPositionFromPool(lpBalance, pool = {}, pairHint = "") {
  const tokens = num(lpBalance);
  if (tokens == null || tokens <= 0) return null;
  const pair =
    normalizeWalletPair(pairHint || pool.pool_name || pool.pool || pool.pair) || "XDX/XRP";
  const supply = num(pool.lp_supply);
  const knownShare = num(pool.lp_share_percent);
  const share = supply > 0 ? tokens / supply : knownShare != null ? knownShare / 100 : 0;
  const reserveXdx = num(pool.reserve_asset ?? pool.reserve_xdx) || 0;
  const reserveQuote = num(pool.reserve_currency ?? pool.reserve_quote) || 0;
  const withdrawXdx =
    share > 0 && reserveXdx > 0 ? share * reserveXdx : num(pool.withdraw_estimate_xdx);
  const withdrawQuote =
    share > 0 && reserveQuote > 0 ? share * reserveQuote : num(pool.withdraw_estimate_quote);
  return {
    pool: pair,
    pool_name: pair,
    quote: pool.quote || pair.split("/")[1] || "XRP",
    lp_balance: tokens,
    lp_supply: supply,
    amm_account: pool.amm_account || null,
    lp_currency: pool.lp_currency || pool.lp_currency_hex || null,
    lp_share_percent: share * 100,
    withdraw_estimate_xdx: withdrawXdx ?? share * reserveXdx,
    withdraw_estimate_quote: withdrawQuote ?? share * reserveQuote,
    fees_earned: num(pool.fees_earned),
    trading_fee: num(pool.trading_fee),
    volume24h: num(pool.volume24h ?? pool.volume_24h ?? pool.volume24hXdx),
    volume24hXdx: num(pool.volume24hXdx ?? pool.volume_24h_xdx),
    volume24hXrp: num(pool.volume24hXrp ?? pool.volume_24h_xrp),
    volume24hUsd: num(pool.volume24hUsd ?? pool.volume_24h_usd),
    volume7d: num(pool.volume7d ?? pool.volume7dXdx),
    volume7dXdx: num(pool.volume7dXdx ?? pool.volume7d),
    volumeUnit: pool.volumeUnit || null,
    xdxUsd: num(pool.xdxUsd),
    xrpUsd: num(pool.xrpUsd),
    xdxPerXrp: num(pool.xdxPerXrp ?? pool.xdx_per_xrp ?? pool.exchXrp),
    composition_xdx_percent: num(pool.xdx_pct ?? pool.composition_xdx_percent),
    composition_quote_percent: num(pool.quote_pct ?? pool.composition_quote_percent),
    xdx_pct: num(pool.xdx_pct ?? pool.composition_xdx_percent),
    quote_pct: num(pool.quote_pct ?? pool.composition_quote_percent),
    reserve_asset: reserveXdx,
    reserve_currency: reserveQuote,
  };
}

export function walletOrdersFromBooks(books, address) {
  const name = String(address || "").trim();
  if (!name) return [];
  const out = [];
  for (const book of Object.values(books?.books || {})) {
    for (const side of ["bids", "asks"]) {
      for (const row of book[side] || []) {
        if (String(row.account || "").toLowerCase() !== name.toLowerCase()) continue;
        out.push({
          pair: book.pair,
          side: side === "asks" ? "ask" : "bid",
          price: Number(row.price),
          amount: Number(row.base_size),
        });
      }
    }
  }
  return out;
}

export function walletActivity(rows, address) {
  const name = String(address || "").trim().toLowerCase();
  if (!name) return [];
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => String(row.account || "").toLowerCase() === name)
    .slice(0, 3);
}

export function tradingFeeRate(tradingFee) {
  const raw = Number(tradingFee);
  if (!(raw > 0)) return 1000 / 100_000;
  return raw > 20 ? raw / 100_000 : raw / 100;
}

export function ammFeePercent(tradingFee) {
  const raw = Number(tradingFee);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return tradingFeeRate(raw) * 100;
}

export function formatAmmFee(tradingFee, locale) {
  const pct = ammFeePercent(tradingFee);
  if (!(pct > 0)) return "0%";
  const digits = pct < 0.01 ? 6 : pct < 1 ? 4 : 2;
  return `${pct.toLocaleString(locale || "en", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })}%`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function volumeByPool(flows = [], windowMs = DAY_MS, now = Date.now()) {
  const cutoff = now - Number(windowMs || DAY_MS);
  const map = new Map();
  for (const row of Array.isArray(flows) ? flows : []) {
    const ts = new Date(row.timestamp).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    const pair = normalizeWalletPair(row.pool || row.pool_name || row.pair);
    if (!isXdxAmmPair(pair)) continue;
    map.set(pair, (map.get(pair) || 0) + Math.abs(Number(row.xdx) || 0));
  }
  return map;
}

export function volume24hByPool(flows = [], now = Date.now()) {
  return volumeByPool(flows, DAY_MS, now);
}

function poolQuoteId(row) {
  return String(row?.quote || normalizeWalletPair(row?.pool || row?.pool_name || "").split("/")[1] || "")
    .trim()
    .toUpperCase();
}

function quoteIsXrp(row) {
  return poolQuoteId(row) === "XRP";
}

function quoteIsRlusd(row) {
  return poolQuoteId(row) === "RLUSD";
}

function quotePerXdx(row, fallback) {
  const reserveXdx = num(row?.reserve_asset ?? row?.reserve_xdx);
  const reserveQuote = num(row?.reserve_currency ?? row?.reserve_quote);
  if (reserveXdx > 0 && reserveQuote > 0) return reserveQuote / reserveXdx;
  return num(fallback);
}

function volumeForWindow(row, flowVol, windowMs) {
  const pair = normalizeWalletPair(row.pool || row.pool_name);
  const fromFlows = flowVol.get(pair) || 0;
  const catalog24h = catalogXdxVolume24h(row);
  const catalog7d = catalogXdxVolume7d(row);
  if (windowMs <= DAY_MS) {
    if (catalog24h > 0) return Math.max(catalog24h, fromFlows);
    return fromFlows;
  }
  if (catalog7d > 0) return Math.max(catalog7d, fromFlows);
  if (fromFlows > 0) return fromFlows;
  if (catalog24h > 0) return catalog24h * (windowMs / DAY_MS);
  return fromFlows;
}

export const FEATURED_EARN_PAIRS = ["XDX/XRP", "XDX/RLUSD"];

function emptyEarnings() {
  return { xdx: 0, xrp: 0, rlusd: 0, usd: null };
}

function emptyPoolEarn(pair) {
  const quote = String(pair || "").split("/")[1] || "";
  return {
    pair,
    quote,
    xdx24h: 0,
    quote24h: 0,
    usd24h: 0,
    xdx7d: 0,
    quote7d: 0,
    usd7d: 0,
  };
}

function splitPoolFee(row, feeXdx, xdxXrp) {
  if (!(feeXdx > 0)) return { xdx: 0, quote: 0, quoteId: poolQuoteId(row) };
  if (quoteIsXrp(row)) {
    const px = quotePerXdx(row, xdxXrp);
    return { xdx: feeXdx / 2, quote: px > 0 ? (feeXdx / 2) * px : 0, quoteId: "XRP" };
  }
  if (quoteIsRlusd(row)) {
    const px = quotePerXdx(row, null);
    return { xdx: feeXdx / 2, quote: px > 0 ? (feeXdx / 2) * px : 0, quoteId: "RLUSD" };
  }
  return { xdx: feeXdx, quote: 0, quoteId: poolQuoteId(row) };
}

function usdForSplit(split, { xdxUsd, xrpUsd, rlusdUsd }) {
  const xdxPart = num(xdxUsd) != null ? split.xdx * Number(xdxUsd) : 0;
  let quotePart = 0;
  if (split.quoteId === "XRP" && num(xrpUsd) != null) quotePart = split.quote * Number(xrpUsd);
  else if (split.quoteId === "RLUSD") quotePart = split.quote * (num(rlusdUsd) || 1);
  return xdxPart + quotePart;
}

export function lpPoolEarnings(
  positions = [],
  { flows = [], xdxUsd = null, xrpUsd = null, rlusdUsd = 1, xdxXrp = null, now = Date.now() } = {}
) {
  const vol24h = volumeByPool(flows, DAY_MS, now);
  const vol7d = volumeByPool(flows, DAY_MS * 7, now);
  const prices = { xdxUsd, xrpUsd, rlusdUsd, xdxXrp };
  const byPair = new Map(
    (Array.isArray(positions) ? positions : [])
      .filter((row) => isXdxAmmPair(row))
      .map((row) => [normalizeWalletPair(row.pool || row.pool_name), row])
  );
  const pools = {};
  for (const pair of FEATURED_EARN_PAIRS) {
    const row = byPair.get(pair);
    if (!row || !((num(row.lp_share_percent) || 0) > 0)) {
      pools[pair] = emptyPoolEarn(pair);
      continue;
    }
    const share = Number(row.lp_share_percent) / 100;
    const rate = tradingFeeRate(row.trading_fee);
    const day = splitPoolFee(row, volumeForWindow(row, vol24h, DAY_MS) * rate * share, xdxXrp);
    const week = splitPoolFee(row, volumeForWindow(row, vol7d, DAY_MS * 7) * rate * share, xdxXrp);
    pools[pair] = {
      pair,
      quote: day.quoteId || pair.split("/")[1],
      xdx24h: day.xdx,
      quote24h: day.quote,
      usd24h: usdForSplit(day, prices),
      xdx7d: week.xdx,
      quote7d: week.quote,
      usd7d: usdForSplit(week, prices),
    };
  }
  return pools;
}

function earningsForWindow(positions, flowVol, windowMs, { xdxUsd, xrpUsd, rlusdUsd, xdxXrp }) {
  const next = emptyEarnings();
  for (const row of Array.isArray(positions) ? positions : []) {
    if (!isXdxAmmPair(row)) continue;
    const share = (num(row.lp_share_percent) || 0) / 100;
    if (!(share > 0)) continue;
    const feeXdx = volumeForWindow(row, flowVol, windowMs) * tradingFeeRate(row.trading_fee) * share;
    if (!(feeXdx > 0)) continue;
    if (quoteIsXrp(row)) {
      const px = quotePerXdx(row, xdxXrp);
      next.xdx += feeXdx / 2;
      if (px > 0) next.xrp += (feeXdx / 2) * px;
    } else if (quoteIsRlusd(row)) {
      const px = quotePerXdx(row, null);
      next.xdx += feeXdx / 2;
      if (px > 0) next.rlusd += (feeXdx / 2) * px;
    } else {
      next.xdx += feeXdx;
    }
  }
  const xdxPart = num(xdxUsd) != null ? next.xdx * Number(xdxUsd) : null;
  const xrpPart = num(xrpUsd) != null ? next.xrp * Number(xrpUsd) : null;
  const rlusdPart = num(rlusdUsd) != null ? next.rlusd * Number(rlusdUsd) : next.rlusd > 0 ? next.rlusd : null;
  if (xdxPart != null || xrpPart != null || rlusdPart != null) {
    next.usd = (xdxPart || 0) + (xrpPart || 0) + (rlusdPart || 0);
  }
  return next;
}

export function lpFeeEarnings(
  positions = [],
  { flows = [], xdxUsd = null, xrpUsd = null, rlusdUsd = 1, xdxXrp = null, now = Date.now() } = {}
) {
  const vol24h = volumeByPool(flows, DAY_MS, now);
  const vol7d = volumeByPool(flows, DAY_MS * 7, now);
  let xdx = 0;
  let stake = 0;
  for (const row of Array.isArray(positions) ? positions : []) {
    if (!isXdxAmmPair(row)) continue;
    const share = (num(row.lp_share_percent) || 0) / 100;
    if (!(share > 0)) continue;
    xdx += volumeForWindow(row, vol24h, DAY_MS) * tradingFeeRate(row.trading_fee) * share;
    stake += num(row.withdraw_estimate_xdx) || 0;
  }
  const prices = {
    xdxUsd,
    xrpUsd: num(xrpUsd) ?? (num(xdxUsd) > 0 && num(xdxXrp) > 0 ? Number(xdxUsd) / Number(xdxXrp) : null),
    rlusdUsd: num(rlusdUsd) ?? 1,
    xdxXrp,
  };
  const day = earningsForWindow(positions, vol24h, DAY_MS, prices);
  const week = earningsForWindow(positions, vol7d, DAY_MS * 7, prices);
  const usd = num(xdxUsd) != null ? xdx * Number(xdxUsd) : null;
  return {
    xdx,
    usd,
    pct24h: stake > 0 ? Math.min(100, (xdx / stake) * 100) : xdx > 0 ? null : 0,
    earnings: {
      xdx24h: day.xdx,
      xrp24h: day.xrp,
      rlusd24h: day.rlusd,
      usd24h: day.usd,
      xdx7d: week.xdx,
      xrp7d: week.xrp,
      rlusd7d: week.rlusd,
      usd7d: week.usd,
      pools: lpPoolEarnings(positions, { flows, xdxUsd, xrpUsd, rlusdUsd, xdxXrp, now }),
    },
  };
}

export function walletAvailableAmounts({ balances = {}, account = {}, lines = [], quote } = {}) {
  const xrp = xrpReserveBreakdown({
    balance: balances.xrp ?? balances.raw?.xrp,
    balanceDrops: account.balance_drops ?? account.Balance ?? balances.raw?.balance_drops,
    ownerCount: account.owner_count ?? account.OwnerCount,
    reserveBaseDrops: account.reserve_base_drops,
    reserveIncDrops: account.reserve_inc_drops,
  });
  const xdx = num(balances.xdx);
  const quoteIsXrp = !quote?.issuer || quote?.currency === "XRP";
  const lineRows = Array.isArray(lines) && lines.length ? lines : balances.raw?.lines || [];
  const quoteAmt = quoteIsXrp
    ? xrp.spendable ?? xrp.balance
    : num(
        lineRows.find((row) => {
          const currency = String(row.currency || row.ticker || "").toUpperCase();
          const issuer = String(row.issuer || row.account || "").toUpperCase();
          const wantIss = String(quote?.issuer || "").toUpperCase();
          const names = [quote?.currency, quote?.hex, quote?.id, quote?.label]
            .filter(Boolean)
            .map((name) => String(name).toUpperCase());
          if (wantIss && issuer && issuer !== wantIss) return false;
          return names.some((name) => currency === name || currency.includes(name));
        })?.balance
      );
  return {
    xrp: xrp.spendable ?? xrp.balance,
    xdx,
    quote: quoteAmt,
  };
}

export function emptyWalletSnapshot(address = null) {
  return {
    address,
    signedIn: Boolean(address),
    filled: false,
    xrp: xrpReserveBreakdown({}),
    xdx: xdxFiatValues(null),
    holdings: { xdx: null, xrp: null, rlusd: null },
    supply: { circulatingPct: null, supplyPct: null, circulating: null, totalSupply: null },
    fees: {
      xdx: null,
      usd: null,
      pct24h: null,
      earnings: {
        xdx24h: null,
        xrp24h: null,
        rlusd24h: null,
        usd24h: null,
        xdx7d: null,
        xrp7d: null,
        rlusd7d: null,
        usd7d: null,
        pools: {
          "XDX/XRP": emptyPoolEarn("XDX/XRP"),
          "XDX/RLUSD": emptyPoolEarn("XDX/RLUSD"),
        },
      },
    },
    lp: [],
    income: [],
    rank: null,
    book: null,
    orders: [],
    activity: [],
  };
}

export function composeWalletSnapshot({
  address,
  balances = {},
  account = {},
  networth = {},
  prices = {},
  token = {},
  pools = [],
  lpRows = [],
  rank = null,
  books = null,
  flows = [],
  offers = [],
  ledgerActivity = [],
} = {}) {
  if (!address) return emptyWalletSnapshot(null);

  const xrp = xrpReserveBreakdown({
    balance: balances.xrp ?? balances.raw?.xrp,
    balanceDrops: account.balance_drops ?? account.Balance ?? balances.raw?.balance_drops,
    ownerCount: account.owner_count ?? account.OwnerCount,
    reserveBaseDrops: account.reserve_base_drops,
    reserveIncDrops: account.reserve_inc_drops,
  });
  const xdxBal = num(balances.xdx);
  const xdxPerXrp = num(token.xdxPerXrp ?? prices.xdxPerXrp);
  const fiat = xdxFiatValues(xdxBal, {
    xdxUsd: prices.xdxUsd ?? prices.recorded_price ?? token.xdxUsd,
    xdxGbp: prices.xdxGbp,
    xdxEur: prices.xdxEur,
    xdxJpy: prices.xdxJpy,
    xrpUsd: prices.xrpUsd,
    xrpGbp: prices.xrpGbp,
    xrpEur: prices.xrpEur,
    xrpJpy: prices.xrpJpy,
    usdGbp: prices.usdGbp,
    usdEur: prices.usdEur,
    usdJpy: prices.usdJpy,
    xdxXrp: xdxPerXrp,
    rlusdUsd: prices.RLUSD ?? prices.quotes?.RLUSD ?? 1,
  });
  if (fiat.usd == null && num(networth.totalUsd)) fiat.usd = Number(networth.totalUsd);
  if (fiat.gbp == null && num(networth.totalGbp)) fiat.gbp = Number(networth.totalGbp);
  if (fiat.eur == null && num(networth.totalEur)) fiat.eur = Number(networth.totalEur);
  if (fiat.jpy == null && num(networth.totalJpy)) fiat.jpy = Number(networth.totalJpy);

  const circulating = num(token.circulating);
  const totalSupply = num(token.totalSupply ?? token.total_supply) || XDX_TOTAL_SUPPLY;
  const shares = supplyShares(xdxBal, circulating, totalSupply);

  const poolByName = indexPoolsByPair(pools);
  const lpByPair = new Map();
  for (const row of Array.isArray(lpRows) ? lpRows : []) {
    const name = normalizeWalletPair(row.pool_name || row.pool || row.pair);
    const position = lpPositionFromPool(
      row.lp_balance ?? row.lp,
      mergeLpPoolSource(row, lookupLpPool(row, poolByName)),
      name
    );
    if (!position) continue;
    const previous = lpByPair.get(position.pool);
    if (!previous || position.lp_balance > previous.lp_balance) {
      lpByPair.set(position.pool, position);
    }
  }
  const lp = [...lpByPair.values()];

  const xrpBook = books?.books?.["XDX/XRP"] || null;
  const pending = pendingFor(address, { offersKnown: true });
  const orders = mergeWalletOrders(offers, walletOrdersFromBooks(books, address), pending.orders);
  const activity = mergeWalletActivity(
    ledgerActivity,
    walletActivity(flows, address),
    pending.activity
  ).slice(0, 3);
  const xdxUsd = num(prices.xdxUsd ?? prices.recorded_price ?? token.xdxUsd);
  const xrpUsd = num(prices.xrpUsd);
  const rlusdUsd = num(prices.RLUSD ?? prices.quotes?.RLUSD) ?? 1;
  const priceBook = {
    ...prices,
    xdxUsd,
    xrpUsd,
    RLUSD: rlusdUsd,
  };
  const income = mergeLpIncomeRows(
    lpFeeIncomeRows({
      positions: lp,
      flows,
      xdxUsd,
      xrpUsd,
      rlusdUsd,
      prices: priceBook,
    }),
    lpDepositIncomeRows({
      activity: mergeWalletActivity(ledgerActivity, pending.activity),
      positions: lp,
      xdxUsd,
      xrpUsd,
      rlusdUsd,
      prices: priceBook,
    })
  );
  return {
    address,
    signedIn: true,
    filled: xdxBal != null || xrp.balance != null || lp.length > 0 || orders.length > 0 || activity.length > 0,
    xrp,
    xdx: fiat,
    holdings: {
      xdx: xdxBal,
      xrp: xrp.balance,
      rlusd: num(balances.rlusd),
    },
    supply: {
      ...shares,
      circulating,
      totalSupply,
    },
    fees: lpFeeEarnings(lp, {
      flows,
      xdxUsd,
      xrpUsd,
      rlusdUsd,
      xdxXrp: xdxPerXrp,
    }),
    lp,
    income,
    rank: num(rank ?? token.rank ?? balances.rank),
    book: xrpBook
      ? {
          bestBid: xrpBook.best_bid,
          bestAsk: xrpBook.best_ask,
          mid: xrpBook.mid,
          spreadBps: xrpBook.spread_bps,
          ammDepth: Number(xrpBook.asks?.[0]?.amm_opposing || xrpBook.bids?.[0]?.amm_opposing || 0),
        }
      : null,
    orders,
    activity,
  };
}

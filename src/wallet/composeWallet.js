import { XDX_TOTAL_SUPPLY } from "../constants/ledger.js";

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

export function xrpReserveBreakdown({
  balance,
  balanceDrops,
  ownerCount = 0,
  reserveBaseDrops = DEFAULT_RESERVE_BASE_DROPS,
  reserveIncDrops = DEFAULT_RESERVE_INC_DROPS,
} = {}) {
  const fromAccount = Number.isFinite(Number(balanceDrops)) ? Number(balanceDrops) / DROPS : null;
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

export function xdxFiatValues(xdx, prices = {}) {
  const bal = num(xdx);
  const usd = num(prices.xdxUsd ?? prices.recorded_price);
  const gbp = num(prices.xdxGbp);
  const xrp = num(prices.xdxXrp ?? prices.xdxPerXrp);
  if (bal == null) {
    return { xdx: null, usd: null, gbp: null, xrp: null };
  }
  return {
    xdx: bal,
    usd: usd != null ? bal * usd : null,
    gbp: gbp != null ? bal * gbp : usd != null && num(prices.xrpGbp) && num(prices.xrpUsd)
      ? bal * usd * (Number(prices.xrpGbp) / Number(prices.xrpUsd))
      : null,
    xrp: xrp != null ? bal * xrp : null,
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
    volume24h: num(pool.volume24h ?? pool.volume_24h),
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

export function volume24hByPool(flows = [], now = Date.now()) {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const map = new Map();
  for (const row of Array.isArray(flows) ? flows : []) {
    const ts = new Date(row.timestamp).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    const pair = normalizeWalletPair(row.pool || row.pool_name || row.pair);
    if (!pair) continue;
    map.set(pair, (map.get(pair) || 0) + Math.abs(Number(row.xdx) || 0));
  }
  return map;
}

export function lpFeeEarnings(positions = [], { flows = [], xdxUsd = null, now = Date.now() } = {}) {
  const vol = volume24hByPool(flows, now);
  let xdx = 0;
  let stake = 0;
  for (const row of Array.isArray(positions) ? positions : []) {
    const share = (num(row.lp_share_percent) || 0) / 100;
    if (!(share > 0)) continue;
    const volume = num(row.volume24h) || vol.get(normalizeWalletPair(row.pool || row.pool_name)) || 0;
    xdx += volume * tradingFeeRate(row.trading_fee) * share;
    stake += num(row.withdraw_estimate_xdx) || 0;
  }
  const usd = num(xdxUsd) != null ? xdx * Number(xdxUsd) : null;
  return {
    xdx,
    usd,
    pct24h: stake > 0 ? Math.min(100, (xdx / stake) * 100) : xdx > 0 ? null : 0,
  };
}

export function emptyWalletSnapshot(address = null) {
  return {
    address,
    signedIn: Boolean(address),
    filled: false,
    xrp: xrpReserveBreakdown({}),
    xdx: xdxFiatValues(null),
    supply: { circulatingPct: null, supplyPct: null, circulating: null, totalSupply: null },
    fees: { xdx: null, usd: null, pct24h: null },
    lp: [],
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
} = {}) {
  if (!address) return emptyWalletSnapshot(null);

  const xrp = xrpReserveBreakdown({
    balance: balances.xrp,
    balanceDrops: account.balance_drops,
    ownerCount: account.owner_count,
    reserveBaseDrops: account.reserve_base_drops,
    reserveIncDrops: account.reserve_inc_drops,
  });
  const xdxBal = num(balances.xdx);
  const xdxPerXrp = num(token.xdxPerXrp ?? prices.xdxPerXrp);
  const fiat = xdxFiatValues(xdxBal, {
    xdxUsd: prices.xdxUsd ?? prices.recorded_price ?? token.xdxUsd,
    xdxGbp: prices.xdxGbp,
    xrpUsd: prices.xrpUsd,
    xrpGbp: prices.xrpGbp,
    xdxXrp: xdxPerXrp,
  });
  if (fiat.usd == null && num(networth.totalUsd)) fiat.usd = Number(networth.totalUsd);
  if (fiat.gbp == null && num(networth.totalGbp)) fiat.gbp = Number(networth.totalGbp);

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
  return {
    address,
    signedIn: true,
    filled: xdxBal != null || xrp.balance != null || lp.length > 0,
    xrp,
    xdx: fiat,
    supply: {
      ...shares,
      circulating,
      totalSupply,
    },
    fees: lpFeeEarnings(lp, {
      flows,
      xdxUsd: num(prices.xdxUsd ?? prices.recorded_price ?? token.xdxUsd),
    }),
    lp,
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
    orders: walletOrdersFromBooks(books, address),
    activity: walletActivity(flows, address),
  };
}

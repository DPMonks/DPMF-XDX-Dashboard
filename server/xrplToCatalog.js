import {
  POOLS,
  XDX_HEX,
  XDX_ISSUER,
  XDX_RLUSD_LP_XRPL_TO_MD5,
  XDX_XRPL_TO_MD5,
  XDX_XRP_LP_XRPL_TO_MD5,
  XRP_XRPL_TO_MD5,
  xrplToMd5ForLpPool,
} from "../src/constants/ledger.js";
import { rowsFromXrplToGraph } from "../src/activityHistory.js";
import { pairFromTradeLegs } from "../src/utils/lpVolume.js";
import { parseXrplToToken, XRPL_TO_TOKEN_URL } from "../src/utils/xrplToToken.js";
import { poolsFromXrplToAmm } from "../src/utils/xrplToAmm.js";
import { normalizeLpPool } from "../src/todayLpOwners.js";

const HISTORY_URL = `https://api.xrpl.to/v1/history`;

export const FREE_API_HEADERS = {
  accept: "application/json",
  "user-agent": "DPMF-XDX-Dashboard/1.1",
};

function holdersUrl(md5) {
  return `https://api.xrpl.to/v1/holders/list/${md5 || XDX_XRPL_TO_MD5}`;
}

function graphUrl(md5) {
  return `https://api.xrpl.to/v1/holders/graph/${md5 || XDX_XRPL_TO_MD5}`;
}

function ohlcUrl(md5) {
  return `https://api.xrpl.to/v1/ohlc/${md5 || XDX_XRPL_TO_MD5}`;
}

function tokenUrl(md5) {
  return `https://api.xrpl.to/v1/token/${md5 || XDX_XRPL_TO_MD5}`;
}

function jsonFetch(url, options = {}) {
  return (options.fetchImpl || fetch)(url, {
    headers: { ...FREE_API_HEADERS, ...(options.headers || {}) },
    signal: AbortSignal.timeout(Number(options.timeoutMs) || 6000),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`xrpl.to ${res.status}`);
    return res.json();
  });
}

function transientXrplToError(err) {
  return /429|502|503|504|timeout|TIMEOUT|ECONNRESET|aborted|fetch failed/i.test(String(err?.message || err));
}

export function holdersFromXrplTo(payload = {}, offset = 0) {
  const rows = Array.isArray(payload.richList) ? payload.richList : [];
  const holders = rows.map((row, index) => ({
    rank: Number(row.rank) || offset + index + 1,
    account: row.account,
    balance: Number(row.balance) || 0,
    frozen: Boolean(row.freeze || row.frozen),
  }));
  return {
    holders,
    rows: holders,
    count: Number(payload.length) || holders.length,
    as_of: new Date().toISOString(),
    source: "xrpl.to",
    present: holders.length > 0,
    catching_up: false,
  };
}

export function lpOwnersFromXrplTo(payload = {}, { offset = 0, pool = "XDX/XRP" } = {}) {
  const page = holdersFromXrplTo(payload, offset);
  const holders = page.holders.map((row) => ({
    ...row,
    lp_balance: row.balance,
    pool_name: pool,
    pool,
  }));
  return {
    ...page,
    holders,
    rows: holders,
    pool,
    source: "xrpl.to",
  };
}

export function candlesFromOhlc(payload = {}, asset = "XDX") {
  const rows = Array.isArray(payload.ohlc) ? payload.ohlc : [];
  return rows
    .map((row) => {
      const time = Number(row?.[0]);
      const close = Number(row?.[4]);
      if (!Number.isFinite(time) || !(close > 0)) return null;
      return {
        timestamp: new Date(time > 1e12 ? time : time * 1000).toISOString(),
        price_usd: close,
        asset,
      };
    })
    .filter(Boolean);
}

export function xrpSparkFromCoinGecko(payload = {}) {
  const rows = Array.isArray(payload.prices) ? payload.prices : [];
  return rows
    .map((row) => {
      const time = Number(row?.[0]);
      const price = Number(row?.[1]);
      if (!Number.isFinite(time) || !(price > 0)) return null;
      return {
        timestamp: new Date(time).toISOString(),
        price_usd: price,
        asset: "XRP",
      };
    })
    .filter(Boolean);
}

function isXdxLeg(leg) {
  const currency = String(leg?.currency || "").toUpperCase();
  return currency === "XDX" || currency === XDX_HEX;
}

export function flowsFromXrplToHistory(payload = {}) {
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const out = [];
  for (const row of rows) {
    const paid = row.paid || {};
    const got = row.got || {};
    const bought = isXdxLeg(got) ? Number(got.value) : 0;
    const sold = isXdxLeg(paid) ? Number(paid.value) : 0;
    if (!(bought > 0) && !(sold > 0)) continue;
    const xdx = bought || sold;
    const pair = pairFromTradeLegs(paid, got) || "XDX/XRP";
    out.push({
      timestamp: row.time
        ? new Date(row.time > 1e12 ? row.time : Number(row.time) * 1000).toISOString()
        : new Date().toISOString(),
      pool: pair,
      pair,
      side: bought > 0 ? "buy" : "sell",
      xdx,
      price: Number(row.price) || 0,
      account: row.taker || row.maker || null,
      hash: row.hash || null,
      source: "xrpl.to",
    });
  }
  return out;
}

export function lpChartFromGraph(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    day: String(row.timestamp || "").slice(0, 10) || null,
    lp_holder_count: row.holders ?? row.holder_count ?? null,
    lp_trustline_count: row.trustlines ?? row.trustline_count ?? null,
  }));
}

export async function loadXrplToHolders(options = {}) {
  const limit = Math.min(Number(options.limit) || 100, 200);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const md5 = options.md5 || XDX_XRPL_TO_MD5;
  const payload = await jsonFetch(`${holdersUrl(md5)}?limit=${limit}&offset=${offset}`, options);
  return holdersFromXrplTo(payload, offset);
}

export async function loadXrplToHolderGraph(options = {}) {
  const range = options.range || "ALL";
  const md5 = options.md5 || XDX_XRPL_TO_MD5;
  const payload = await jsonFetch(`${graphUrl(md5)}?range=${encodeURIComponent(range)}`, options);
  return rowsFromXrplToGraph(payload);
}

export async function loadXrplToCandles(options = {}) {
  const range = options.range || "1M";
  const interval = options.interval || "1h";
  const vs = options.vs || "USD";
  const md5 = options.md5 || XDX_XRPL_TO_MD5;
  const payload = await jsonFetch(
    `${ohlcUrl(md5)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&vs_currency=${encodeURIComponent(vs)}`,
    options
  );
  return candlesFromOhlc(payload, options.asset || (md5 === XRP_XRPL_TO_MD5 ? "XRP" : "XDX"));
}

export async function loadXrpSparkline(options = {}) {
  try {
    const days = options.days || 30;
    const payload = await jsonFetch(
      `https://api.coingecko.com/api/v3/coins/ripple/market_chart?vs_currency=usd&days=${days}`,
      options
    );
    const rows = xrpSparkFromCoinGecko(payload);
    if (rows.length) return rows;
  } catch {
    // xrpl.to XRP OHLC is the second source
  }
  return loadXrplToCandles({ ...options, md5: XRP_XRPL_TO_MD5, asset: "XRP" }).catch(() => []);
}

export async function loadXrplToFlows(options = {}) {
  const limit = Math.min(Number(options.limit) || 200, 200);
  const payload = await jsonFetch(
    `${HISTORY_URL}?md5=${XDX_XRPL_TO_MD5}&limit=${limit}`,
    options
  );
  return flowsFromXrplToHistory(payload);
}

export async function loadXrplToTokenCard(md5, options = {}) {
  const payload = await jsonFetch(tokenUrl(md5 || XDX_XRPL_TO_MD5), options);
  return parseXrplToToken(payload);
}

export async function loadXrplToLpOwners(options = {}) {
  const limit = Math.min(Number(options.limit) || 100, 200);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const pair = normalizeLpPool(options.pool || options.pair || "XDX/XRP");
  if (!pair) {
    const pages = await Promise.all(
      POOLS.map((spec) =>
        loadXrplToLpOwners({
          ...options,
          pool: spec.pair,
          limit: 200,
          offset: 0,
        }).catch(() => ({ holders: [], count: 0, pool: spec.pair }))
      )
    );
    const holders = pages
      .flatMap((page) => page.holders || [])
      .sort((left, right) => Number(right.lp_balance) - Number(left.lp_balance))
      .map((row, index) => ({ ...row, rank: index + 1 }));
    const sliced = holders.slice(offset, offset + limit);
    return {
      holders: sliced,
      rows: sliced,
      count: holders.length,
      as_of: new Date().toISOString(),
      source: "xrpl.to",
      present: holders.length > 0,
      catching_up: false,
      pool: "all",
    };
  }
  const md5 = options.md5 || xrplToMd5ForLpPool(pair);
  const payload = await jsonFetch(`${holdersUrl(md5)}?limit=${limit}&offset=${offset}`, options);
  return lpOwnersFromXrplTo(payload, { offset, pool: pair });
}

export async function loadXrplToLpChart(options = {}) {
  const pair = normalizeLpPool(options.pool || options.pair || "XDX/XRP") || "XDX/XRP";
  const rows = await loadXrplToHolderGraph({
    ...options,
    md5: xrplToMd5ForLpPool(pair),
  });
  return lpChartFromGraph(rows);
}

export async function loadXrplToLpCounts(options = {}) {
  const pair = normalizeLpPool(options.pool || options.pair || "all");
  const md5s = pair
    ? [xrplToMd5ForLpPool(pair)]
    : [XDX_XRP_LP_XRPL_TO_MD5, XDX_RLUSD_LP_XRPL_TO_MD5];
  const cards = await Promise.all(
    md5s.map((md5) => loadXrplToTokenCard(md5, options).catch(() => ({ holders: 0, trustlines: 0 })))
  );
  const holders = cards.reduce((sum, card) => sum + (Number(card.holders) || 0), 0);
  const trustlines = cards.reduce((sum, card) => sum + (Number(card.trustlines) || 0), 0);
  return {
    holders,
    trustlines,
    pool: pair || "all",
    source: "xrpl.to",
    catching_up: !holders,
  };
}

export function xrplToAmmListUrl({
  issuer = XDX_ISSUER,
  currency = "XDX",
  status = "all",
  limit = 100,
  offset = 0,
} = {}) {
  const params = new URLSearchParams({
    issuer: String(issuer || XDX_ISSUER),
    currency: String(currency || "XDX"),
    status: status || "all",
    limit: String(Math.min(Math.max(Number(limit) || 100, 1), 100)),
    offset: String(Math.max(Number(offset) || 0, 0)),
  });
  return `https://api.xrpl.to/v1/amm?${params}`;
}

let xdxAmmCache = { at: 0, rows: null };
let xdxAmmRawCache = { at: 0, payload: null };
let xdxAmmInflight = null;
let xdxAmmDiscoveryError = "";
const XDX_AMM_MS = 60_000;

export function resetXrplToXdxAmmCache() {
  xdxAmmCache = { at: 0, rows: null };
  xdxAmmRawCache = { at: 0, payload: null };
  xdxAmmInflight = null;
  xdxAmmDiscoveryError = "";
}

export function xrplToAmmDiscoveryStatus() {
  const count = Array.isArray(xdxAmmRawCache.payload?.pools) ? xdxAmmRawCache.payload.pools.length : 0;
  return { count, error: xdxAmmDiscoveryError || null };
}

async function fetchXrplToAmmPage(offset, options) {
  const url = xrplToAmmListUrl({ offset, limit: 100 });
  const timeoutMs = Number(options.timeoutMs) || 8000;
  try {
    return await jsonFetch(url, { ...options, timeoutMs });
  } catch (err) {
    if (!transientXrplToError(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 400));
    return jsonFetch(url, { ...options, timeoutMs });
  }
}

// Start this before the other catalog calls. A late call is the one xrpl.to drops.
export function loadXrplToXdxAmmRaw(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && xdxAmmRawCache.payload && now - xdxAmmRawCache.at < XDX_AMM_MS) {
    return Promise.resolve(xdxAmmRawCache.payload);
  }
  if (xdxAmmInflight && !options.fresh) return xdxAmmInflight;
  xdxAmmInflight = (async () => {
    const pools = [];
    let total = 0;
    try {
      for (let offset = 0; offset < 500; offset += 100) {
        const payload = await fetchXrplToAmmPage(offset, options);
        const page = Array.isArray(payload?.pools) ? payload.pools : [];
        total = Number(payload?.total) || total;
        pools.push(...page);
        if (!page.length || page.length < 100 || (total && pools.length >= total)) break;
      }
    } catch (err) {
      xdxAmmDiscoveryError = String(err?.message || err || "xrpl.to amm list failed");
      if (xdxAmmRawCache.payload) return xdxAmmRawCache.payload;
      return { pools: [], total: 0, error: xdxAmmDiscoveryError };
    }
    if (pools.length) {
      xdxAmmDiscoveryError = "";
      xdxAmmRawCache = { at: now, payload: { pools, total: total || pools.length } };
    }
    return xdxAmmRawCache.payload || { pools, total, error: xdxAmmDiscoveryError || null };
  })().finally(() => {
    xdxAmmInflight = null;
  });
  return xdxAmmInflight;
}

export async function loadXrplToXdxAmmPools(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && xdxAmmCache.rows && now - xdxAmmCache.at < XDX_AMM_MS) {
    return xdxAmmCache.rows;
  }
  const rate = Number(options.xrpPerXdx) || 0;
  const xdxUsd = Number(options.xdxUsd) || 0;
  const xrpUsd = Number(options.xrpUsd) || 0;
  const payload = await loadXrplToXdxAmmRaw(options);
  const rows = [];
  const seen = new Set();
  for (const row of poolsFromXrplToAmm(payload, { xrpPerXdx: rate, xdxUsd, xrpUsd })) {
    const key = String(row.amm_account || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  if (rows.length) xdxAmmCache = { at: now, rows };
  return rows.length ? rows : xdxAmmCache.rows || [];
}

export async function loadXrplToRank(address, options = {}) {
  const needle = String(address || "").toLowerCase();
  if (!needle) return { account: address, rank: null, source: "xrpl.to" };
  const pageSize = 200;
  const maxScan = 2000;
  for (let offset = 0; offset < maxScan; offset += pageSize) {
    const page = await loadXrplToHolders({ ...options, limit: pageSize, offset });
    const hit = page.holders.find((row) => String(row.account || "").toLowerCase() === needle);
    if (hit) return { account: address, rank: hit.rank, source: "xrpl.to" };
    if (!page.holders.length || page.holders.length < pageSize) break;
  }
  return { account: address, rank: null, source: "xrpl.to" };
}

export {
  XRPL_TO_TOKEN_URL,
  XDX_XRP_LP_XRPL_TO_MD5,
  XDX_RLUSD_LP_XRPL_TO_MD5,
  holdersUrl as HOLDERS_URL,
  graphUrl as GRAPH_URL,
  ohlcUrl as OHLC_URL,
};

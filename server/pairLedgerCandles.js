/**
 * Per-pair ledger OHLC for the Trading chart.
 *
 * XDX/XRP comes from the dashboard's own ledger candles (account_tx on the
 * XDX/XRP AMM, stored in xdx_ledger_candles). Every other XDX pool comes from
 * the rows aim-market-data writes into the same table, one `pair` per pool.
 * Buckets with no trades have no row, so the chart shows a gap there instead
 * of a flat candle carried from the last close.
 */
import { loadCexXrpUsdCandles } from "./cexOhlc.js";
import { loadLedgerCandles } from "./ledgerCandles.js";
import { queryIndexerDb } from "./readIndexerDb.js";

const CACHE_MS = 60_000;
const HOUR_KEEP_MS = 400 * 86_400_000;
const MINUTE_KEEP_MS = 7 * 86_400_000;
const INTERVALS = ["1m", "1h", "1d"];
const USD_QUOTES = new Set(["RLUSD", "USD", "USDC"]);

const cache = new Map();

export function resetPairLedgerCache() {
  cache.clear();
}

export function normalizeLedgerPair(pair) {
  const name = String(pair || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "/")
    .toUpperCase();
  return /^XDX\/[A-Z0-9$]{2,20}$/.test(name) ? name : "";
}

function sig(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toPrecision(7));
}

/** [t, o, h, l, c, volume_xdx, trades] rows, oldest first, inside the keep window. */
export function compactCandleRows(rows = [], interval = "1h", now = Date.now()) {
  const keep = interval === "1m" ? MINUTE_KEEP_MS : interval === "1h" ? HOUR_KEEP_MS : 0;
  const cutoff = keep ? Number(now) - keep : -Infinity;
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const t = Number(row?.bucket ?? row?.t);
    const close = Number(row?.close ?? row?.c);
    if (!Number.isFinite(t) || t < cutoff || !(close > 0)) continue;
    const open = Number(row?.open ?? row?.o) > 0 ? Number(row?.open ?? row?.o) : close;
    const high = Math.max(Number(row?.high ?? row?.h) || 0, open, close);
    const lowRaw = Number(row?.low ?? row?.l);
    const low = Math.min(lowRaw > 0 ? lowRaw : close, open, close);
    out.push([t, sig(open), sig(high), sig(low), sig(close), sig(row?.volume_xdx ?? row?.v ?? 0), Number(row?.trades ?? row?.n) || 0]);
  }
  out.sort((left, right) => left[0] - right[0]);
  return out;
}

function summary(rows) {
  if (!rows.length) return { count: 0, oldest: null, newest: null };
  return {
    count: rows.length,
    oldest: new Date(rows[0][0]).toISOString(),
    newest: new Date(rows[rows.length - 1][0]).toISOString(),
  };
}

/**
 * aim-market-data keeps the token's own spelling (XDX/AiCat, XDX/POWDER KEG),
 * while chart pair names are upper case with no spaces. Match on that form.
 */
async function readStoredPair(pair, queryImpl) {
  const result = await queryImpl(
    `SELECT interval, EXTRACT(EPOCH FROM bucket) * 1000 AS bucket, open, high, low, close, volume_xdx, trades
     FROM xdx_ledger_candles
     WHERE upper(replace(pair, ' ', '')) = $1 AND interval IN ('1m', '1h', '1d')
     ORDER BY bucket ASC`,
    [pair]
  );
  const grouped = { "1m": [], "1h": [], "1d": [] };
  if (!result?.ok) return { grouped, reason: result?.reason || "error" };
  for (const row of result.rows || []) {
    const interval = String(row.interval || "");
    if (grouped[interval]) grouped[interval].push(row);
  }
  return { grouped, reason: "ok" };
}

async function loadPairUncached(pair, options) {
  const now = Number(options.now) || Date.now();
  const queryImpl = options.queryImpl || queryIndexerDb;
  let grouped;
  let reason = "ok";
  let stale = false;
  let partial = false;
  if (pair === "XDX/XRP") {
    const ledger = await (options.loadXrpCandles || loadLedgerCandles)({
      fetchImpl: options.fetchImpl,
      deadlineMs: 5_000,
    }).catch(() => null);
    grouped = ledger?.candles || { "1m": [], "1h": [], "1d": [] };
    stale = Boolean(ledger?.stale);
    partial = Boolean(ledger?.partial);
    if (!ledger) reason = "unavailable";
  } else {
    const stored = await readStoredPair(pair, queryImpl);
    grouped = stored.grouped;
    reason = stored.reason;
  }
  const ohlc = {};
  const intervals = {};
  for (const interval of INTERVALS) {
    ohlc[interval] = compactCandleRows(grouped[interval], interval, now);
    intervals[interval] = summary(ohlc[interval]);
  }
  return { pair, source: "xrpl-ledger", reason, stale, partial, intervals, ohlc };
}

export async function loadPairLedgerCandles(pair, options = {}) {
  const name = normalizeLedgerPair(pair);
  if (!name) return null;
  const now = Number(options.now) || Date.now();
  const hit = cache.get(name);
  if (!options.fresh && hit && now - hit.at < CACHE_MS) return hit.body;
  const body = await loadPairUncached(name, { ...options, now });
  cache.set(name, { at: now, body });
  return body;
}

/** Daily XRP/USD closes [t, c] so an XDX/XRP candle can be shown in RLUSD. */
async function loadXrpUsdDaily(options) {
  try {
    const payload = await (options.loadXrpUsd || loadCexXrpUsdCandles)({ interval: "1D", limit: 450 });
    return (payload?.candles || [])
      .map((row) => [Number(row.t), sig(row.c)])
      .filter(([t, c]) => Number.isFinite(t) && c > 0);
  } catch {
    return [];
  }
}

/**
 * Chart payload for one XDX pair: the pool's own candles, plus the XDX/XRP
 * candles and the quote leg needed to cross them when the pool has no row.
 */
export async function buildLedgerChartPayload(pair, options = {}) {
  const name = normalizeLedgerPair(pair) || "XDX/XRP";
  const quote = name.split("/")[1];
  const [native, xrp, xrpUsd] = await Promise.all([
    loadPairLedgerCandles(name, options),
    name === "XDX/XRP" ? null : loadPairLedgerCandles("XDX/XRP", options),
    USD_QUOTES.has(quote) ? loadXrpUsdDaily(options) : [],
  ]);
  return {
    ok: true,
    view: "ledger",
    pair: name,
    source: "xrpl-ledger",
    fields: ["t", "o", "h", "l", "c", "volume_xdx", "trades"],
    native,
    xrp: xrp || native,
    fx: xrpUsd.length ? { "XRP/USD": xrpUsd } : {},
  };
}

/**
 * Ledger OHLC for the XIO-base chart pairs (XIO/XRP, XIO/RLUSD).
 *
 * The XIO exchange lock (`/api/chart/candles` on the XIO host) is a fixed
 * daily snapshot that ends on 13 Sep 2026. Nothing appends to it, so the chart
 * stopped there. This module reads the swaps on each XIO AMM with account_tx
 * and buckets them into 1m / 1h / 1d candles from the lock date onward.
 *
 * Read only: public XRPL account_tx, kept in memory on a warm instance. No
 * database, no writes, no env vars. A bucket with no swap has no candle.
 */
import { RLUSD_HEX, RLUSD_ISSUER, XIO_ISSUER, XIO_RLUSD_AMM, XIO_XRP_AMM } from "../src/constants/ledger.js";
import { rippleCloseIso } from "../src/utils/ammSwapVolume.js";
import { aggregatePrints } from "../src/utils/ledgerPrints.js";
import { xrplRpc } from "./xrplBookOffers.js";

/** First UTC day of ledger candles: the last day of the XIO exchange lock. */
export const XIO_LEDGER_FROM_MS = Date.parse("2026-09-13T00:00:00.000Z");

export const XIO_LEDGER_POOLS = {
  "XIO/XRP": { account: XIO_XRP_AMM, quote: "XRP" },
  "XIO/RLUSD": { account: XIO_RLUSD_AMM, quote: "RLUSD", quoteHex: RLUSD_HEX, quoteIssuer: RLUSD_ISSUER },
};

const INTERVALS = ["1m", "1h", "1d"];
const CACHE_MS = 60_000;
const PAGE_LIMIT = 400;
const COLD_PAGES = 12;
const WARM_PAGES = 3;
const RIPPLE_EPOCH = 946_684_800;

const memory = new Map();
const inflight = new Map();

export function resetXioLedgerCache() {
  memory.clear();
  inflight.clear();
}

export function normalizeXioLedgerPair(pair) {
  const name = String(pair || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "/")
    .toUpperCase();
  return XIO_LEDGER_POOLS[name] ? name : "";
}

function nodeBody(wrap) {
  return wrap?.ModifiedNode || wrap?.CreatedNode || wrap?.DeletedNode || null;
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isXioCode(code) {
  return String(code || "").toUpperCase() === "XIO";
}

/** Signed change of one issued token on `account`'s trust line, seen from `account`. */
function lineDelta(meta, account, match) {
  let delta = 0;
  let seen = false;
  for (const wrap of Array.isArray(meta?.AffectedNodes) ? meta.AffectedNodes : []) {
    const node = nodeBody(wrap);
    if (!node || node.LedgerEntryType !== "RippleState") continue;
    const final = node.FinalFields || node.NewFields || {};
    const balance = final.Balance || {};
    const high = String(final.HighLimit?.issuer || "");
    const low = String(final.LowLimit?.issuer || "");
    if (high !== account && low !== account) continue;
    const other = high === account ? low : high;
    if (!match(String(balance.currency || ""), other)) continue;
    const after = finite(balance.value);
    const before = finite(node.PreviousFields?.Balance?.value ?? (wrap.CreatedNode ? 0 : null));
    if (after == null || before == null) continue;
    const raw = after - before;
    delta += low === account ? raw : -raw;
    seen = true;
  }
  return seen ? delta : null;
}

function xrpDelta(meta, account) {
  for (const wrap of Array.isArray(meta?.AffectedNodes) ? meta.AffectedNodes : []) {
    const node = nodeBody(wrap);
    if (!node || node.LedgerEntryType !== "AccountRoot") continue;
    const final = node.FinalFields || node.NewFields || {};
    if (String(final.Account || "") !== account) continue;
    const after = finite(final.Balance);
    const before = finite(node.PreviousFields?.Balance ?? final.Balance);
    if (after == null || before == null) return null;
    return (after - before) / 1_000_000;
  }
  return null;
}

/**
 * One swap on an XIO AMM as a print: price is quote per XIO, read from the
 * AMM account's own balance changes. Deposits, withdrawals and votes are not
 * prints. Both legs must move in opposite directions.
 */
export function xioTradePrintFromTx(row, pool) {
  const tx = row?.tx || row?.tx_json || row || {};
  const type = String(tx.TransactionType || "");
  if (type !== "Payment" && type !== "OfferCreate") return null;
  const meta = row?.meta || row?.metaData || {};
  if (meta.TransactionResult && meta.TransactionResult !== "tesSUCCESS") return null;
  const account = pool?.account;
  if (!account) return null;
  const xio = lineDelta(meta, account, (code, other) => isXioCode(code) && other === XIO_ISSUER);
  if (!(Math.abs(xio || 0) > 0)) return null;
  const quote =
    pool.quote === "XRP"
      ? xrpDelta(meta, account)
      : lineDelta(
          meta,
          account,
          (code, other) => code.toUpperCase() === String(pool.quoteHex || "").toUpperCase() && other === pool.quoteIssuer
        );
  if (!(Math.abs(quote || 0) > 0)) return null;
  if (Math.sign(quote) === Math.sign(xio)) return null;
  const price = Math.abs(quote) / Math.abs(xio);
  if (!(price > 0) || !Number.isFinite(price)) return null;
  const timestamp = rippleCloseIso(row);
  if (!timestamp) return null;
  return {
    timestamp,
    hash: row.hash || tx.hash || null,
    type,
    xio: Math.abs(xio),
    quote: Math.abs(quote),
    quoteCurrency: pool.quote,
    price,
    side: xio < 0 ? "buy" : "sell",
    source: "xrpl-amm",
  };
}

function txTimeMs(row) {
  const tx = row?.tx || row?.tx_json || row || {};
  const date = Number(tx.date ?? row?.date);
  return Number.isFinite(date) ? (date + RIPPLE_EPOCH) * 1000 : NaN;
}

function emptyState() {
  return { at: 0, prints: new Map(), partial: true, resume: null, stale: true, reason: "ok" };
}

function sig(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toPrecision(7)) : 0;
}

/** [t, o, h, l, c, volume_xio, trades] rows, oldest first. 1m keeps 7 days. */
export function xioCandleRows(prints = [], interval = "1h", now = Date.now()) {
  const rows = aggregatePrints(
    prints.map((print) => ({ ...print, xdx: print.xio })),
    interval,
    now
  );
  return rows.map((row) => [
    row.bucket,
    sig(row.open),
    sig(row.high),
    sig(row.low),
    sig(row.close),
    sig(row.volume_xdx),
    row.trades,
  ]);
}

async function readPage(pool, marker, options, deadline) {
  const params = {
    account: pool.account,
    ledger_index_min: -1,
    ledger_index_max: -1,
    limit: PAGE_LIMIT,
    binary: false,
    forward: false,
  };
  if (marker) params.marker = marker;
  const page = await xrplRpc("account_tx", params, {
    fetchImpl: options.fetchImpl,
    rpcUrl: options.rpcUrl,
    timeoutMs: Math.max(1_000, Math.min(8_000, deadline - Date.now())),
  });
  if (page?.error) throw new Error(String(page.error));
  return page;
}

/** Fold one page. Returns whether it reached the lock date or a print already held. */
function foldPage(state, pool, txs, from) {
  let knownHit = false;
  let olderThanFrom = false;
  for (const row of txs) {
    const t = txTimeMs(row);
    if (Number.isFinite(t) && t < from) {
      olderThanFrom = true;
      continue;
    }
    const print = xioTradePrintFromTx(row, pool);
    if (!print) continue;
    const key = print.hash || `${print.timestamp}:${print.price}:${print.xio}`;
    if (state.prints.has(key)) knownHit = true;
    else state.prints.set(key, print);
  }
  return { knownHit, olderThanFrom };
}

/**
 * Newest pages first (account_tx forward:false). A warm call stops at the
 * first page that overlaps what it already holds. A cold call that runs out of
 * time keeps its marker and carries on from there next time.
 */
async function ingest(pair, state, options) {
  const pool = XIO_LEDGER_POOLS[pair];
  const from = Number(options.fromMs) > 0 ? Number(options.fromMs) : XIO_LEDGER_FROM_MS;
  const deadline = Date.now() + (Number(options.deadlineMs) > 0 ? Number(options.deadlineMs) : 8_000);
  let failed = false;
  let pages = 0;
  try {
    if (state.prints.size) {
      let marker = null;
      while (pages < WARM_PAGES && Date.now() < deadline) {
        const page = await readPage(pool, marker, options, deadline);
        pages += 1;
        const seen = foldPage(state, pool, Array.isArray(page?.transactions) ? page.transactions : [], from);
        marker = page?.marker || null;
        if (!marker || seen.knownHit || seen.olderThanFrom) break;
      }
    }
    if (state.partial) {
      let marker = state.resume || null;
      while (pages < COLD_PAGES && Date.now() < deadline) {
        const page = await readPage(pool, marker, options, deadline);
        pages += 1;
        const seen = foldPage(state, pool, Array.isArray(page?.transactions) ? page.transactions : [], from);
        marker = page?.marker || null;
        state.resume = marker;
        if (!marker || seen.olderThanFrom) {
          state.partial = false;
          state.resume = null;
          break;
        }
      }
    }
  } catch {
    failed = true;
  }
  state.stale = failed || state.partial;
  state.reason = failed && !state.prints.size ? "unavailable" : "ok";
  state.at = Number(options.now) || Date.now();
}

function summary(rows) {
  if (!rows.length) return { count: 0, oldest: null, newest: null };
  return {
    count: rows.length,
    oldest: new Date(rows[0][0]).toISOString(),
    newest: new Date(rows[rows.length - 1][0]).toISOString(),
  };
}

function poolBody(pair, state, now) {
  const prints = [...state.prints.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const ohlc = {};
  const intervals = {};
  for (const interval of INTERVALS) {
    ohlc[interval] = xioCandleRows(prints, interval, now);
    intervals[interval] = summary(ohlc[interval]);
  }
  return {
    pair,
    source: "xrpl-ledger",
    amm: XIO_LEDGER_POOLS[pair].account,
    from: new Date(XIO_LEDGER_FROM_MS).toISOString(),
    reason: state.reason,
    stale: state.stale,
    partial: state.partial,
    intervals,
    ohlc,
  };
}

/** Pool candles for one XIO pair, cached for a minute on a warm instance. */
export async function loadXioPoolCandles(pair, options = {}) {
  const name = normalizeXioLedgerPair(pair);
  if (!name) return null;
  const now = Number(options.now) || Date.now();
  const state = memory.get(name) || emptyState();
  memory.set(name, state);
  if (!options.fresh && state.at && now - state.at < CACHE_MS) return poolBody(name, state, now);
  if (!inflight.has(name)) {
    inflight.set(
      name,
      ingest(name, state, { ...options, now }).finally(() => inflight.delete(name))
    );
  }
  await inflight.get(name);
  return poolBody(name, state, now);
}

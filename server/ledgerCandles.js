import { XDX_XRP_AMM } from "../src/constants/ledger.js";
import {
  aggregatePrints,
  change24hFromCandles,
  mergeCandleRows,
  printsFromAccountTx,
  pruneCandles,
  volumeSince,
} from "../src/utils/ledgerPrints.js";
import { queryIndexerDb } from "./readIndexerDb.js";
import { xrplRpc } from "./xrplBookOffers.js";

const INTERVALS = ["1m", "1h", "1d"];
const CACHE_MS = 60_000;
const PAGE_LIMIT = 200;
const PAGES_PER_CALL = 2;

let memory = emptyMemory();
let inflight = null;
let writesDisabled = false;

function emptyMemory() {
  return {
    at: 0,
    partial: true,
    stale: true,
    stored: "memory",
    marker: null,
    hydrated: false,
    loaded: false,
    pruned: null,
    seen: new Set(),
    prints: [],
    candles: { "1m": [], "1h": [], "1d": [] },
  };
}

function emptyDirty() {
  return { "1m": new Set(), "1h": new Set(), "1d": new Set() };
}

let dirty = emptyDirty();

export function resetLedgerCandleCache() {
  memory = emptyMemory();
  dirty = emptyDirty();
  inflight = null;
  writesDisabled = false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rateLimited(error) {
  return /402|429|tooBusy|slowDown|serverBusy/i.test(String(error || ""));
}

function foldPrints(prints, now) {
  const fresh = [];
  for (const print of prints) {
    const hash = String(print.hash || "");
    if (hash && memory.seen.has(hash)) continue;
    if (hash) memory.seen.add(hash);
    fresh.push(print);
  }
  if (memory.seen.size > 8000) {
    memory.seen = new Set([...memory.seen].slice(-4000));
  }
  if (!fresh.length) return;
  memory.prints.push(...fresh);
  for (const interval of INTERVALS) {
    const next = aggregatePrints(fresh, interval, now);
    for (const row of next) dirty[interval].add(Number(row.bucket));
    const prior = new Set((memory.candles[interval] || []).map((row) => Number(row.bucket)));
    const added = memory.hydrated
      ? next.filter((row) => !prior.has(Number(row.bucket)))
      : next;
    const priced = memory.hydrated
      ? next.filter((row) => prior.has(Number(row.bucket))).map((row) => ({ ...row, volume_xdx: 0, trades: 0 }))
      : [];
    memory.candles[interval] = pruneCandles(
      mergeCandleRows(memory.candles[interval], [...added, ...priced]),
      interval,
      now
    );
  }
}

async function readStoredCandles() {
  if (writesDisabled) return false;
  const result = await queryIndexerDb(
    `SELECT interval, EXTRACT(EPOCH FROM bucket) * 1000 AS bucket, open, high, low, close, volume_xdx, trades
     FROM xdx_ledger_candles
     WHERE pair = $1`,
    ["XDX/XRP"]
  );
  if (!result.ok) {
    if (result.reason === "read-only") writesDisabled = true;
    return false;
  }
  const grouped = { "1m": [], "1h": [], "1d": [] };
  for (const row of result.rows) {
    const interval = String(row.interval || "");
    if (!grouped[interval]) continue;
    grouped[interval].push({
      bucket: Number(row.bucket),
      open: Number(row.open),
      high: Number(row.high),
      low: Number(row.low),
      close: Number(row.close),
      volume_xdx: Number(row.volume_xdx) || 0,
      trades: Number(row.trades) || 0,
    });
  }
  for (const interval of INTERVALS) {
    memory.candles[interval] = pruneCandles(
      mergeCandleRows(memory.candles[interval], grouped[interval]),
      interval
    );
  }
  memory.stored = "postgres";
  memory.hydrated = INTERVALS.some((interval) => memory.candles[interval].length > 0);
  return true;
}

async function readStoredState() {
  const result = await queryIndexerDb(
    `SELECT marker, partial FROM xdx_ledger_candle_state WHERE pair = $1`,
    ["XDX/XRP"]
  );
  if (!result.ok) {
    if (result.reason === "read-only") writesDisabled = true;
    return;
  }
  const row = result.rows[0];
  if (!row) return;
  memory.marker = row.marker || null;
  if (row.partial === false) memory.partial = false;
}

async function ensureCandleTable() {
  const created = await queryIndexerDb(
    `CREATE TABLE IF NOT EXISTS xdx_ledger_candles (
      pair text NOT NULL,
      interval text NOT NULL,
      bucket timestamptz NOT NULL,
      open double precision NOT NULL,
      high double precision NOT NULL,
      low double precision NOT NULL,
      close double precision NOT NULL,
      volume_xdx double precision NOT NULL DEFAULT 0,
      trades integer NOT NULL DEFAULT 0,
      PRIMARY KEY (pair, interval, bucket)
    )`
  );
  if (!created.ok) {
    writesDisabled = true;
    return false;
  }
  const state = await queryIndexerDb(
    `CREATE TABLE IF NOT EXISTS xdx_ledger_candle_state (
      pair text PRIMARY KEY,
      marker jsonb,
      partial boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
  );
  if (!state.ok) {
    writesDisabled = true;
    return false;
  }
  return true;
}

async function upsertCandles(interval, rows) {
  const chunk = 80;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const values = [];
    const params = [];
    slice.forEach((row, index) => {
      const base = index * 9;
      values.push(
        `($${base + 1}, $${base + 2}, to_timestamp($${base + 3} / 1000.0), $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`
      );
      params.push(row.pair, row.interval, row.bucket, row.open, row.high, row.low, row.close, row.volume_xdx, row.trades);
    });
    const saved = await queryIndexerDb(
      `INSERT INTO xdx_ledger_candles
        (pair, interval, bucket, open, high, low, close, volume_xdx, trades)
       VALUES ${values.join(", ")}
       ON CONFLICT (pair, interval, bucket) DO UPDATE SET
        open = xdx_ledger_candles.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        volume_xdx = EXCLUDED.volume_xdx,
        trades = EXCLUDED.trades`,
      params
    );
    if (!saved.ok) {
      writesDisabled = true;
      memory.stored = "memory";
      return false;
    }
  }
  return true;
}

async function storeCandles(now) {
  if (writesDisabled) return;
  const ready = await ensureCandleTable();
  if (!ready) return;
  for (const interval of INTERVALS) {
    const rows = pruneCandles(memory.candles[interval], interval, now);
    memory.candles[interval] = rows;
    const touched = rows.filter((row) => dirty[interval].has(Number(row.bucket))).slice(0, 400);
    dirty[interval] = new Set(
      [...dirty[interval]].filter((bucket) => !touched.some((row) => Number(row.bucket) === Number(bucket)))
    );
    if (!touched.length) continue;
    const ok = await upsertCandles(
      interval,
      touched.map((row) => ({ ...row, pair: "XDX/XRP", interval }))
    );
    if (!ok) return;
  }
  const pruned = await queryIndexerDb(
    `DELETE FROM xdx_ledger_candles
     WHERE pair = $1 AND interval = '1m' AND bucket < now() - interval '7 days'`,
    ["XDX/XRP"]
  );
  if (!pruned.ok && pruned.reason !== "missing-table") {
    writesDisabled = true;
    memory.stored = "memory";
    return;
  }
  const saved = await queryIndexerDb(
    `INSERT INTO xdx_ledger_candle_state (pair, marker, partial, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (pair) DO UPDATE SET
      marker = EXCLUDED.marker,
      partial = EXCLUDED.partial,
      updated_at = now()`,
    ["XDX/XRP", memory.marker ? JSON.stringify(memory.marker) : null, Boolean(memory.partial)]
  );
  if (!saved.ok) {
    writesDisabled = true;
    memory.stored = "memory";
    return;
  }
  memory.stored = "postgres";
  memory.pruned = "1m-7d";
}

async function readPage(options, marker) {
  const params = {
    account: options.account || XDX_XRP_AMM,
    ledger_index_min: -1,
    ledger_index_max: -1,
    limit: PAGE_LIMIT,
    binary: false,
    forward: false,
  };
  if (marker) params.marker = marker;
  return xrplRpc("account_tx", params, {
    fetchImpl: options.fetchImpl,
    rpcUrl: options.rpcUrl,
    timeoutMs: Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 8000,
  });
}

async function ingest(options, now) {
  if (!memory.loaded && !options.skipStore) {
    await readStoredCandles();
    await readStoredState();
    memory.loaded = true;
  }
  let marker = memory.marker;
  let pages = 0;
  let limited = false;
  const started = Date.now();
  const deadline = Number(options.deadlineMs) > 0 ? Number(options.deadlineMs) : memory.hydrated ? 4_000 : 12_000;
  const pageCap = memory.hydrated ? 1 : PAGES_PER_CALL;
  while (pages < pageCap && Date.now() - started < deadline) {
    let page;
    try {
      page = await readPage({ ...options, timeoutMs: Math.min(8000, deadline) }, marker);
    } catch (err) {
      limited = rateLimited(err?.message || err);
      memory.stale = true;
      break;
    }
    if (page?.error) {
      limited = rateLimited(page.error);
      memory.stale = true;
      if (limited) await sleep(1200);
      break;
    }
    const txs = Array.isArray(page?.transactions) ? page.transactions : [];
    foldPrints(printsFromAccountTx(txs, { account: options.account || XDX_XRP_AMM }), now);
    pages += 1;
    marker = page?.marker || null;
    memory.marker = marker;
    if (!marker) {
      memory.partial = false;
      break;
    }
    if (pages < PAGES_PER_CALL) await sleep(limited ? 1200 : 300);
  }
  if (marker) memory.partial = true;
  memory.stale = Boolean(memory.partial || limited);
  memory.at = now;
  if (!options.skipStore) await storeCandles(now);
}

function intervalSummary(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { count: 0, oldest: null, newest: null };
  return {
    count: list.length,
    oldest: new Date(list[0].bucket).toISOString(),
    newest: new Date(list[list.length - 1].bucket).toISOString(),
  };
}

function candlePayload(now, xrpUsd) {
  const fx = Number(xrpUsd) > 0 ? Number(xrpUsd) : 0;
  const hourly = memory.candles["1h"];
  const rows = hourly.map((row) => ({
    timestamp: new Date(row.bucket).toISOString(),
    price_xrp: row.close,
    price_usd: fx ? row.close * fx : null,
    volume_xdx: row.volume_xdx,
    trades: row.trades,
    asset: "XDX",
    source: "xrpl-ledger",
  }));
  return {
    source: "xrpl-ledger",
    stored: memory.stored,
    stale: memory.stale || !rows.length,
    partial: memory.partial,
    pair: "XDX/XRP",
    price_usd_basis: fx ? "live-xrp-usd" : "xrp-per-xdx",
    change24h: change24hFromCandles(hourly, now),
    volume24hXdx: volumeSince(memory.candles["1m"].length ? memory.candles["1m"] : hourly, now),
    pruned: memory.pruned,
    intervals: {
      "1m": intervalSummary(memory.candles["1m"]),
      "1h": intervalSummary(memory.candles["1h"]),
      "1d": intervalSummary(memory.candles["1d"]),
    },
    candles: memory.candles,
    price_history: rows,
    rows,
  };
}

async function loadUncached(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && memory.at && now - memory.at < CACHE_MS) {
    return candlePayload(now, options.xrpUsd);
  }
  await ingest(options, now);
  return candlePayload(now, options.xrpUsd);
}

export function loadLedgerCandles(options = {}) {
  if (inflight && !options.fresh) return inflight;
  inflight = loadUncached(options).finally(() => {
    inflight = null;
  });
  return inflight;
}

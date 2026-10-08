/**
 * Ledger OHLC for XDX pair charts.
 *
 * `/api/chart/candles?view=ledger&pair=XDX/...` returns the pool's own candles
 * (`native`), the XDX/XRP candles (`xrp`) and the XRP/USD daily leg (`fx`).
 * A bucket with no trade has no candle. Nothing here carries a close forward,
 * so a quiet pool shows a gap instead of a run of flat candles.
 */
import quoteXrpDaily from "../data/quoteXrpDaily.json" with { type: "json" };
import { resampleCandles, ticksToCandles } from "./candles.js";
import { intervalMs, isDailyOrLonger } from "./intervals.js";
import { crossXrpCandle } from "./pairQuote.js";

const DAY = 86_400_000;
const USD_QUOTES = new Set(["RLUSD", "USD", "USDC"]);
/** A quote leg older than this is not used to price an XDX candle. */
const FX_MAX_AGE = { usd: 3 * DAY, token: 10 * DAY };
/** Live quote marks only price buckets this close to now. */
const LIVE_FX_WINDOW = 36 * 3_600_000;

export function emptyLedgerSet() {
  return { "1m": [], "1h": [], "1d": [] };
}

/** Compact [t, o, h, l, c, v, n] rows to chart candles. */
export function ledgerCandlesFromRows(rows = [], source = "ledger") {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const [t, o, h, l, c, v, n] = Array.isArray(row)
      ? row
      : [row?.t ?? row?.bucket, row?.o ?? row?.open, row?.h ?? row?.high, row?.l ?? row?.low, row?.c ?? row?.close, row?.v ?? row?.volume_xdx, row?.n ?? row?.trades];
    const time = Number(t);
    const close = Number(c);
    if (!Number.isFinite(time) || !(close > 0)) continue;
    const open = Number(o) > 0 ? Number(o) : close;
    const high = Math.max(Number(h) || 0, open, close);
    const low = Math.min(Number(l) > 0 ? Number(l) : close, open, close);
    out.push({ t: time, o: open, h: high, l: low, c: close, v: Number(v) || 0, n: Number(n) || 0, source });
  }
  out.sort((left, right) => left.t - right.t);
  return out;
}

function setFromPayload(node, source) {
  const set = emptyLedgerSet();
  const ohlc = node?.ohlc || {};
  for (const key of Object.keys(set)) set[key] = ledgerCandlesFromRows(ohlc[key], source);
  return set;
}

export function parseLedgerPayload(body) {
  if (!body || typeof body !== "object" || body.view !== "ledger") return null;
  const pair = String(body.pair || "").toUpperCase();
  const native = setFromPayload(body.native, "ledger");
  const xrp = pair === "XDX/XRP" ? native : setFromPayload(body.xrp, "ledger");
  const xrpUsd = (Array.isArray(body.fx?.["XRP/USD"]) ? body.fx["XRP/USD"] : [])
    .map(([t, c]) => ({ t: Number(t), c: Number(c) }))
    .filter((row) => Number.isFinite(row.t) && row.c > 0)
    .sort((left, right) => left.t - right.t);
  return { pair, native, xrp, xrpUsd, at: Date.now() };
}

export async function fetchLedgerPairCandles(pair, { fetchImpl = fetch } = {}) {
  const name = String(pair || "").toUpperCase();
  const response = await fetchImpl(`/api/chart/candles?view=ledger&pair=${encodeURIComponent(name)}`, {
    headers: { Accept: "application/json" },
  });
  if (!response?.ok) throw new Error(`ledger candles ${response?.status || "failed"}`);
  return parseLedgerPayload(await response.json());
}

export function hasLedgerData(ledger) {
  if (!ledger) return false;
  return ["native", "xrp"].some((side) => ["1m", "1h", "1d"].some((key) => ledger[side]?.[key]?.length));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Drop a candle whose close sits more than `factor` times away from the median
 * close of its neighbours. One dust fill at a silly price is a real ledger
 * print, but it is not the market.
 */
export function dropCloseOutliers(candles = [], { window = 12, factor = 3 } = {}) {
  const list = Array.isArray(candles) ? candles : [];
  return list.filter((row, index) => {
    const around = [];
    for (let j = Math.max(0, index - window); j <= Math.min(list.length - 1, index + window); j += 1) {
      if (j !== index) around.push(list[j].c);
    }
    if (around.length < 4) return true;
    const ref = median(around);
    return row.c <= ref * factor && row.c >= ref / factor;
  });
}

/** Close at or before `t`, no older than `maxAge`. */
export function fxAt(series = [], t, maxAge = 3 * DAY) {
  let lo = 0;
  let hi = series.length - 1;
  let hit = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].t <= t) {
      hit = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (hit < 0) return null;
  const row = series[hit];
  return t - row.t <= maxAge && row.c > 0 ? row.c : null;
}

function mergeSeries(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      const t = Number(row?.t);
      const c = Number(row?.c);
      if (Number.isFinite(t) && c > 0) map.set(t, { t, c });
    }
  }
  return [...map.values()].sort((left, right) => left.t - right.t);
}

/** Quote leg for a crossed pair: XRP/USD for dollar quotes, quote/XRP for tokens. */
export function quoteLeg(pair, { locked = {}, ledger = null, prices = {} } = {}) {
  const quote = String(pair || "").split("/")[1] || "";
  if (USD_QUOTES.has(quote)) {
    return {
      mode: "usd",
      series: mergeSeries(locked?.xrpUsd, ledger?.xrpUsd),
      live: Number(prices?.xrpUsd) || null,
    };
  }
  const key = `${quote}/XRP`;
  return {
    mode: "token",
    series: mergeSeries(quoteXrpDaily?.pairs?.[key]?.candles, locked?.pairs?.[key]?.candles),
    live: Number(prices?.[`${quote}Xrp`] ?? prices?.[`${quote.toLowerCase()}Xrp`]) || null,
  };
}

/** XDX/XRP ledger candles priced in the pair's quote. No quote price, no candle. */
export function crossLedgerCandles(xrpCandles = [], leg, now = Date.now()) {
  if (!leg) return [];
  const maxAge = FX_MAX_AGE[leg.mode] || DAY;
  const out = [];
  for (const row of Array.isArray(xrpCandles) ? xrpCandles : []) {
    let fx = fxAt(leg.series, row.t, maxAge);
    if (!(fx > 0) && leg.live > 0 && now - row.t <= LIVE_FX_WINDOW) fx = leg.live;
    if (!(fx > 0)) continue;
    if (leg.mode === "usd") {
      out.push({ ...row, o: row.o * fx, h: row.h * fx, l: row.l * fx, c: row.c * fx, source: "ledger-cross" });
    } else {
      const unit = { t: row.t, o: fx, h: fx, l: fx, c: fx };
      const crossed = crossXrpCandle(row, unit, "ledger-cross");
      if (crossed) out.push({ ...crossed, n: row.n || 0 });
    }
  }
  return out;
}

export function ledgerSourceInterval(intervalId) {
  if (isDailyOrLonger(intervalId)) return "1d";
  return intervalMs(intervalId) < 3_600_000 ? "1m" : "1h";
}

/**
 * Real ledger candles for `pair` at `intervalId`. The pool's own candles win
 * from the first bucket it has; earlier buckets are XDX/XRP crossed with the
 * quote leg. Buckets with no trade stay empty.
 */
export function ledgerPairCandles({ pair, intervalId = "1h", ledger, locked = {}, prices = {}, now = Date.now() } = {}) {
  if (!ledger) return [];
  const name = String(pair || "").toUpperCase();
  const src = ledgerSourceInterval(intervalId);
  const native = dropCloseOutliers(ledger.native?.[src] || []);
  let rows = native;
  if (name !== "XDX/XRP") {
    const startNative = native.length ? native[0].t : Infinity;
    const crossed = crossLedgerCandles(
      dropCloseOutliers(ledger.xrp?.[src] || []),
      quoteLeg(name, { locked, ledger, prices }),
      now
    ).filter((row) => row.t < startNative);
    rows = [...crossed, ...native];
  }
  if (!rows.length) return [];
  if (src === "1d") {
    return intervalId === "1D" ? rows : resampleCandles(rows, intervalId);
  }
  if ((src === "1h" && intervalId === "1h") || (src === "1m" && intervalId === "1m")) return rows;
  return ticksToCandles(rows, intervalId, { continuous: false }).map((row) => ({ ...row, source: row.source || "ledger" }));
}

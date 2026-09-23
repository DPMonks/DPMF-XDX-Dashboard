/**
 * Proxy the XIO exchange locked chart into XDX `/api/chart/candles`.
 * Uses `/api/chart/candles` on the XIO host (not `/api/candles`, which needs a database).
 * Warm Vercel instances keep the snapshot in memory for a few minutes.
 */
import {
  isXioBasePair,
  liveQuotesFromXioPrices,
  mergeXioPairs,
  normalizeChartPair,
  normalizeLockedCandles,
  xioPairFromText,
} from "../src/chart/xioHistory.js";

export const DEFAULT_XIO_EXCHANGE_ORIGIN = "https://xio-exchange.dpmf.technology";
export const XIO_CANDLE_TTL_MS = 5 * 60_000;
export const XIO_PRICE_TTL_MS = 60_000;

const cache = {
  candles: { at: 0, origin: "", body: null },
  prices: { at: 0, origin: "", body: null },
};
const inflight = { candles: null, prices: null };

export function xioExchangeOrigin(env = process.env) {
  const raw = String(env?.XIO_EXCHANGE_ORIGIN || DEFAULT_XIO_EXCHANGE_ORIGIN).trim();
  return raw.replace(/\/$/, "") || DEFAULT_XIO_EXCHANGE_ORIGIN;
}

export function resetXioCandleCache() {
  cache.candles = { at: 0, origin: "", body: null };
  cache.prices = { at: 0, origin: "", body: null };
  inflight.candles = null;
  inflight.prices = null;
}

function abortAfter(ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  if (typeof timer.unref === "function") timer.unref();
  return ctrl.signal;
}

async function readJson(response) {
  if (!response?.ok) {
    throw new Error(`XIO chart HTTP ${response?.status || "failed"}`);
  }
  const body = await response.json();
  if (!body || typeof body !== "object") throw new Error("XIO chart payload was empty");
  return body;
}

async function loadCached(kind, { origin, ttl, now, fetchImpl, path }) {
  const slot = cache[kind];
  if (slot.body && slot.origin === origin && now - slot.at < ttl) return slot.body;
  if (inflight[kind] && inflight[kind].origin === origin) return inflight[kind].promise;
  const promise = (async () => {
    const response = await fetchImpl(`${origin}${path}`, {
      headers: { Accept: "application/json", "User-Agent": "DPMF-XDX-Dashboard" },
      signal: abortAfter(8000),
    });
    const body = await readJson(response);
    cache[kind] = { at: Date.now(), origin, body };
    return body;
  })();
  inflight[kind] = { origin, promise };
  try {
    return await promise;
  } finally {
    if (inflight[kind]?.promise === promise) inflight[kind] = null;
  }
}

export function loadXioLockedSnapshot({
  fetchImpl = fetch,
  now = Date.now(),
  env = process.env,
  ttl = XIO_CANDLE_TTL_MS,
} = {}) {
  const origin = xioExchangeOrigin(env);
  return loadCached("candles", {
    origin,
    ttl,
    now,
    fetchImpl,
    path: "/api/chart/candles",
  });
}

export function loadXioLivePrices({
  fetchImpl = fetch,
  now = Date.now(),
  env = process.env,
  ttl = XIO_PRICE_TTL_MS,
} = {}) {
  const origin = xioExchangeOrigin(env);
  return loadCached("prices", {
    origin,
    ttl,
    now,
    fetchImpl,
    path: "/api/prices",
  });
}

export function pairFromRequest(req) {
  const queryPair = req?.query?.pair;
  if (typeof queryPair === "string" && queryPair.trim()) return normalizeChartPair(queryPair);
  if (Array.isArray(queryPair) && queryPair[0]) return normalizeChartPair(queryPair[0]);
  try {
    const url = new URL(req?.url || "/", "http://localhost");
    return normalizeChartPair(url.searchParams.get("pair") || "");
  } catch {
    return "";
  }
}

/**
 * Existing XDX lock, plus XIO-base pairs when the request asks for one.
 * XDX/XRP (and any non-XIO pair) does not call the XIO host.
 */
export async function buildChartCandlesPayload({
  pair = "",
  locked,
  db = null,
  fetchImpl = fetch,
  now = Date.now(),
  env = process.env,
} = {}) {
  const name = normalizeChartPair(pair);
  const snapshot = locked && typeof locked === "object" ? locked : { pairs: {} };
  if (name && !isXioBasePair(name)) {
    return { locked: true, snapshot, db };
  }
  if (!name) {
    return { locked: true, snapshot, db };
  }

  let xioSnap = null;
  let live;
  let error = null;
  try {
    xioSnap = await loadXioLockedSnapshot({ fetchImpl, now, env });
  } catch (err) {
    error = String(err?.message || err).slice(0, 180);
  }
  try {
    const prices = await loadXioLivePrices({ fetchImpl, now, env });
    live = liveQuotesFromXioPrices(prices);
  } catch {
    live = {};
  }

  const merged = xioSnap ? mergeXioPairs(snapshot, xioSnap.snapshot || xioSnap) : snapshot;
  const xioNames = Object.keys(merged.pairs || {}).filter((key) => isXioBasePair(key));
  return {
    locked: true,
    snapshot: merged,
    db,
    xio: {
      ok: Boolean(xioSnap) && xioNames.length > 0,
      source: "xio-exchange",
      endpoint: "/api/chart/candles",
      pairs: xioNames,
      live,
      ...(error ? { error } : {}),
    },
  };
}

export function summarizeXioCandles(pair, candles, live) {
  const rows = normalizeLockedCandles(candles);
  if (!rows.length) return null;
  const name = normalizeChartPair(pair);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const livePrice = Number(live);
  return {
    pair: name,
    source: "xio-exchange",
    proxy: `/api/chart/candles?pair=${encodeURIComponent(name)}`,
    interval: "1D",
    count: rows.length,
    first_t: first.t,
    last_t: last.t,
    first_close: first.c,
    last_close: last.c,
    live: livePrice > 0 ? livePrice : null,
    recent: rows.slice(-64).map((row) => ({
      t: row.t,
      o: row.o,
      h: row.h,
      l: row.l,
      c: row.c,
    })),
  };
}

export function resolveXioHistoryPair(chartPair, question) {
  const fromChart = normalizeChartPair(chartPair);
  if (isXioBasePair(fromChart)) return fromChart;
  const fromText = xioPairFromText(question);
  return isXioBasePair(fromText) ? fromText : "";
}

/**
 * When Commander or the desk reads an XIO pair, attach the XIO lock.
 * A thin client candle list (the single live print) is replaced with the locked series.
 */
export async function attachXioChartHistory(chartContext, question, { load } = {}) {
  const pair = resolveXioHistoryPair(chartContext?.pair, question);
  if (!pair) return { chartContext: chartContext || null, xioChart: null };
  const loader =
    load ||
    (async (name) => {
      const [snap, prices] = await Promise.all([
        loadXioLockedSnapshot().catch(() => null),
        loadXioLivePrices().catch(() => null),
      ]);
      const merged = mergeXioPairs({ pairs: {} }, snap?.snapshot || snap || {});
      const liveMap = liveQuotesFromXioPrices(prices);
      return summarizeXioCandles(name, merged.pairs?.[name]?.candles, liveMap[name]);
    });
  let summary;
  try {
    summary = await loader(pair);
  } catch {
    summary = null;
  }
  if (!summary || !(summary.count > 1)) {
    return { chartContext: chartContext || null, xioChart: null };
  }
  const have = Array.isArray(chartContext?.candles) ? chartContext.candles.length : 0;
  if (have >= 8) {
    return { chartContext, xioChart: publicXioChart(summary) };
  }
  const next = {
    ...(chartContext && typeof chartContext === "object" ? chartContext : {}),
    pair: chartContext?.pair || pair,
    candles: summary.recent.slice(-64),
    price: {
      ...(chartContext?.price && typeof chartContext.price === "object" ? chartContext.price : {}),
      last_close: chartContext?.price?.last_close ?? summary.last_close,
      live: chartContext?.price?.live ?? summary.live ?? summary.last_close,
    },
  };
  return { chartContext: next, xioChart: publicXioChart(summary) };
}

function publicXioChart(summary) {
  return {
    pair: summary.pair,
    source: summary.source,
    proxy: summary.proxy,
    interval: summary.interval,
    count: summary.count,
    first_t: summary.first_t,
    last_t: summary.last_t,
    first_close: summary.first_close,
    last_close: summary.last_close,
    live: summary.live,
    recent: summary.recent.slice(-8).map((row) => ({ t: row.t, c: row.c })),
  };
}

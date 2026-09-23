/** XIO-base pair helpers. History itself comes from the XIO exchange lock, not this file. */

export function normalizeChartPair(pair) {
  return String(pair || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "/")
    .toUpperCase();
}

/** True for XIO/XRP, XIO/RLUSD, and any other XIO/* the chart lists. XDX/XIO is not a base-XIO pair. */
export function isXioBasePair(pair) {
  const name = normalizeChartPair(pair);
  const [base, quote] = name.split("/");
  return base === "XIO" && /^[A-Z0-9$]{2,12}$/.test(quote || "");
}

export function xioPairFromText(text) {
  const match = String(text || "")
    .toUpperCase()
    .match(/\bXIO\s*[/-]\s*([A-Z0-9$]{2,12})\b/);
  if (!match) return "";
  return normalizeChartPair(`XIO/${match[1]}`);
}

/** Keep locked OHLC. Drop rows that are not a real print. Do not fill gaps here. */
export function normalizeLockedCandles(rows) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const t = Number(row?.t);
    const c = Number(row?.c);
    const o = Number(row?.o);
    if (!(t > 0) || (!(c > 0) && !(o > 0))) continue;
    const close = c > 0 ? c : o;
    const open = o > 0 ? o : close;
    const high = Number(row?.h);
    const low = Number(row?.l);
    out.push({
      t,
      o: open,
      h: high > 0 ? Math.max(high, open, close) : Math.max(open, close),
      l: low > 0 ? Math.min(low, open, close) : Math.min(open, close),
      c: close,
      v: Number(row?.v) || 0,
      source: String(row?.source || "xio-exchange").slice(0, 64),
    });
  }
  out.sort((left, right) => left.t - right.t);
  return out;
}

/**
 * Copy XIO-base pairs from an XIO locked snapshot onto an XDX snapshot.
 * XDX pair arrays are left as-is (same references).
 */
export function mergeXioPairs(snapshot, xioSnapshot) {
  const base = snapshot && typeof snapshot === "object" ? snapshot : { pairs: {} };
  const pairs = { ...(base.pairs || {}) };
  const incoming = xioSnapshot?.pairs && typeof xioSnapshot.pairs === "object" ? xioSnapshot.pairs : {};
  for (const [key, row] of Object.entries(incoming)) {
    const name = normalizeChartPair(key);
    if (!isXioBasePair(name)) continue;
    const candles = normalizeLockedCandles(row?.candles);
    if (!candles.length) continue;
    pairs[name] = {
      quote: String(row?.quote || name.split("/")[1] || "").slice(0, 16),
      source: String(row?.source || "xio-exchange").slice(0, 64),
      candles,
    };
  }
  return { ...base, pairs };
}

/**
 * Live quote-per-base marks from the XIO prices payload.
 * XIO/XRP lock is XRP per XIO (`xio_per_xrp`). XIO/RLUSD lock is USD per XIO (RLUSD ~ $1).
 */
export function liveQuotesFromXioPrices(prices) {
  if (!prices || typeof prices !== "object") return {};
  const out = {};
  const xrp = Number(prices.xio_per_xrp ?? prices.xioPerXrp);
  const usd = Number(prices.xioUsd ?? prices.recorded_price);
  if (xrp > 0) out["XIO/XRP"] = xrp;
  if (usd > 0) out["XIO/RLUSD"] = usd;
  return out;
}

export async function fetchXioChartOverlay(pair, { fetchImpl = fetch } = {}) {
  const name = normalizeChartPair(pair);
  const query = name ? `?pair=${encodeURIComponent(name)}` : "";
  const response = await fetchImpl(`/api/chart/candles${query}`, {
    headers: { Accept: "application/json" },
  });
  if (!response?.ok) {
    throw new Error(`chart candles ${response?.status || "failed"}`);
  }
  const body = await response.json();
  const snapshot = body?.snapshot && typeof body.snapshot === "object" ? body.snapshot : null;
  return {
    snapshot,
    live: body?.xio?.live && typeof body.xio.live === "object" ? body.xio.live : {},
    ok: body?.xio?.ok !== false && Boolean(snapshot?.pairs),
    at: Date.now(),
  };
}

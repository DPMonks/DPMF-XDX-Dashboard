import { RLUSD_HEX, XDX_HEX } from "../constants/ledger.js";

const DAY_MS = 24 * 60 * 60 * 1000;
// Token 24h XDX volume is millions. A raw card number under this is XRP or USD, not XDX.
const XDX_VOLUME_FLOOR = 10_000;

function numPos(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function hexCurrencyLabel(hex) {
  const clean = String(hex || "").replace(/0+$/g, "");
  let out = "";
  for (let i = 0; i < clean.length; i += 2) {
    const code = Number.parseInt(clean.slice(i, i + 2), 16);
    if (!Number.isFinite(code) || code < 32 || code > 126) continue;
    out += String.fromCharCode(code);
  }
  return out || "";
}

export function tickerFromCurrency(leg = {}) {
  const currency = String(leg.currency || leg.ticker || "").trim();
  const upper = currency.toUpperCase();
  if (!upper || upper === "XRP") return "XRP";
  if (upper === "XDX" || upper === XDX_HEX) return "XDX";
  if (upper === "RLUSD" || upper === RLUSD_HEX) return "RLUSD";
  if (/^[A-Z0-9]{3}$/.test(upper)) return upper;
  if (/^[A-F0-9]{40}$/i.test(currency)) {
    const label = hexCurrencyLabel(currency);
    return label ? label.toUpperCase() : "IOU";
  }
  return upper.slice(0, 12);
}

export function pairFromTradeLegs(paid = {}, got = {}) {
  const sold = tickerFromCurrency(paid);
  const bought = tickerFromCurrency(got);
  if (sold === "XDX" && bought !== "XDX") return `XDX/${bought}`;
  if (bought === "XDX" && sold !== "XDX") return `XDX/${sold}`;
  return "";
}

export function xrpPerXdxFrom(row = {}, fallback) {
  const reserveXdx = numPos(row.reserve_asset ?? row.reserve_xdx);
  const reserveQuote = numPos(row.reserve_currency ?? row.reserve_quote);
  const quote = String(row.quote || "").toUpperCase();
  if (reserveXdx > 0 && reserveQuote > 0 && (!quote || quote === "XRP")) {
    return reserveQuote / reserveXdx;
  }
  return numPos(fallback ?? row.xdxPerXrp ?? row.xdx_per_xrp ?? row.exchXrp);
}

export function xdxFromXrpVolume(xrpVolume, xrpPerXdx) {
  const vol = numPos(xrpVolume);
  const px = numPos(xrpPerXdx);
  return vol && px ? vol / px : 0;
}

export function xdxFromUsdVolume(usdVolume, xdxUsd) {
  const vol = numPos(usdVolume);
  const px = numPos(xdxUsd);
  return vol && px ? vol / px : 0;
}

export function looksLikeXdxVolume(value) {
  return numPos(value) >= XDX_VOLUME_FLOOR;
}

export function looksLikeUsdOrXrpVolume(value) {
  const n = numPos(value);
  return n > 0 && n < XDX_VOLUME_FLOOR;
}

export function xdxVolumeFromTokenCard(token = {}, xrpPerXdx) {
  const px = numPos(xrpPerXdx) || numPos(token.exchXrp);
  return xdxFromXrpVolume(token.vol24hXrp, px);
}

export function xrpVolumeFromOhlc(rows = [], { now = Date.now(), windowMs = DAY_MS } = {}) {
  const cutoff = now - Number(windowMs || DAY_MS);
  let sum = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const time = Number(Array.isArray(row) ? row[0] : row?.time ?? row?.timestamp);
    const vol = Number(Array.isArray(row) ? row[5] : row?.volume ?? row?.vol);
    const ts = time > 1e12 ? time : time * 1000;
    if (!Number.isFinite(ts) || ts < cutoff || !(vol > 0)) continue;
    sum += vol;
  }
  return sum;
}

export function dailyXdxFlowsFromOhlc(
  rows = [],
  { xrpPerXdx, pair = "XDX/XRP", now = Date.now(), maxDays = 365 } = {}
) {
  const px = numPos(xrpPerXdx);
  const cutoff = Number(now) - Math.max(1, Number(maxDays) || 365) * DAY_MS;
  const byDay = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const time = Number(Array.isArray(row) ? row[0] : Date.parse(row?.timestamp || row?.time || row?.day || 0));
    const vol = Number(Array.isArray(row) ? row[5] : row?.volume ?? row?.vol);
    const ts = time > 1e12 ? time : time * 1000;
    if (!Number.isFinite(ts) || ts < cutoff || !(vol > 0)) continue;
    const xdx = xdxFromXrpVolume(vol, px);
    if (!(xdx > 0)) continue;
    const timestamp = new Date(ts).toISOString();
    const day = timestamp.slice(0, 10);
    const current = byDay.get(day);
    if (!current || xdx > current.xdx) {
      byDay.set(day, { timestamp, pool: pair, pair, xdx, source: "ohlc" });
    }
  }
  return [...byDay.values()].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

export function xdxVolumeFromDexscreenerPair(pair = {}, xdxUsd) {
  const usd = numPos(pair?.volume?.h24 ?? pair?.volume24h);
  const price = numPos(pair?.priceUsd) || numPos(xdxUsd);
  return xdxFromUsdVolume(usd, price);
}

export function xdxVolumeFromGeckoPool(pool = {}, xdxUsd) {
  const attrs = pool?.attributes && typeof pool.attributes === "object" ? pool.attributes : pool;
  const usd = numPos(attrs?.volume_usd?.h24 ?? attrs?.volume24h);
  const price = numPos(attrs?.base_token_price_usd) || numPos(xdxUsd);
  return xdxFromUsdVolume(usd, price);
}

/**
 * 24h XDX volume on a pool/catalog row.
 * volume24h must stay XDX for lpFeeEarnings. USD (volXrp * XRPUSD) and raw XRP
 * card numbers are converted, never used as XDX.
 */
export function catalogXdxVolume24h(row = {}) {
  const tagged = numPos(row.volume24hXdx ?? row.volume_24h_xdx);
  if (tagged) return tagged;

  const xrpVol = numPos(row.volume24hXrp ?? row.volume_24h_xrp);
  const xrpPer = numPos(row.xdxPerXrp ?? row.xdx_per_xrp ?? row.exchXrp) || xrpPerXdxFrom(row);
  if (xrpVol && xrpPer) return xdxFromXrpVolume(xrpVol, xrpPer);

  const usdVol = numPos(row.volume24hUsd ?? row.volume_24h_usd);
  const xdxUsd = numPos(row.xdxUsd);
  if (usdVol && xdxUsd) return xdxFromUsdVolume(usdVol, xdxUsd);

  const raw = numPos(row.volume24h ?? row.volume_24h);
  if (!raw) return 0;
  const unit = String(row.volumeUnit || "").toLowerCase();
  if (unit === "usd" && xdxUsd) return xdxFromUsdVolume(raw, xdxUsd);
  if (unit === "xrp" && xrpPer) return xdxFromXrpVolume(raw, xrpPer);
  const xrpUsd = numPos(row.xrpUsd);
  if (xrpVol && xrpUsd) {
    const asUsd = xrpVol * xrpUsd;
    if (asUsd > 0 && Math.abs(raw - asUsd) / asUsd < 0.08) {
      return xrpPer ? xdxFromXrpVolume(xrpVol, xrpPer) : 0;
    }
  }
  if (looksLikeXdxVolume(raw) || (!xrpVol && !usdVol && unit !== "usd" && unit !== "xrp")) {
    return raw;
  }
  return 0;
}

export function catalogXdxVolume7d(row = {}) {
  return numPos(row.volume7dXdx ?? row.volume_7d_xdx ?? row.volume7d ?? row.volume_7d);
}

/**
 * Complete pair-level sources beat a 200-trade tape even when the tape is smaller.
 * Among complete sources, take the largest so we do not understate AMM flow.
 */
export function pickBestXdxVolume(candidates = []) {
  const usable = (Array.isArray(candidates) ? candidates : [])
    .map((row) => ({
      value: numPos(row?.value),
      complete: row?.complete !== false,
      source: row?.source || "unknown",
    }))
    .filter((row) => row.value > 0);
  if (!usable.length) return { value: 0, source: "empty", complete: false };
  const complete = usable.filter((row) => row.complete);
  const pool = complete.length ? complete : usable;
  let best = pool[0];
  for (const row of pool) {
    if (row.value > best.value) best = row;
  }
  return best;
}

export function volumeCoverage({ rows = [], now = Date.now(), windowMs = DAY_MS, cap = 200 } = {}) {
  const cutoff = now - Number(windowMs || DAY_MS);
  const times = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const ts = new Date(row.timestamp || row.time).getTime();
    if (Number.isFinite(ts)) times.push(ts);
  }
  times.sort((a, b) => a - b);
  if (!times.length) return { complete: false, count: 0, capped: false, oldest: null };
  const inWindow = times.filter((ts) => ts >= cutoff);
  const oldest = times[0];
  const capped = times.length >= cap;
  // A capped tape still covers the window when the oldest row is older than the cutoff.
  return {
    complete: inWindow.length > 0 && oldest < cutoff,
    count: inWindow.length,
    capped,
    oldest,
  };
}

/**
 * XDX/XRP pool volume. The xrpl.to token card is token-wide (every XDX pair),
 * so pair APIs and a window-covering tape beat it for this AMM.
 */
export function pickXrpPoolXdxVolume({
  tokenXdx = 0,
  ohlcXdx = 0,
  dexXdx = 0,
  geckoXdx = 0,
  histXdx = 0,
  histComplete = false,
} = {}) {
  const pair = pickBestXdxVolume([
    { value: dexXdx, complete: true, source: "dexscreener" },
    { value: geckoXdx, complete: true, source: "geckoterminal" },
    { value: histXdx, complete: histComplete, source: "xrpl.to-history" },
  ]);
  if (pair.value > 0 && (pair.source !== "xrpl.to-history" || histComplete)) {
    return pair;
  }
  return pickBestXdxVolume([
    { value: tokenXdx, complete: true, source: "xrpl.to-token" },
    { value: ohlcXdx, complete: true, source: "xrpl.to-ohlc" },
    pair,
  ]);
}

export function sumFlowXdx(rows = [], { now = Date.now(), windowMs = DAY_MS, pair } = {}) {
  const cutoff = now - Number(windowMs || DAY_MS);
  const want = String(pair || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "/");
  let sum = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const ts = new Date(row.timestamp || row.time).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    if (want) {
      const name = String(row.pool || row.pool_name || row.pair || "")
        .trim()
        .toUpperCase()
        .replace(/-/g, "/");
      if (name !== want) continue;
    }
    sum += Math.abs(Number(row.xdx) || 0);
  }
  return sum;
}

export function xdxPairKey(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "/");
  if (!raw) return "";
  if (raw.startsWith("XDX/")) return raw;
  if (/^[A-Z0-9]{2,12}$/.test(raw)) return `XDX/${raw}`;
  return raw;
}

export function volumesFromFlows(flows = [], { now = Date.now(), windowMs = DAY_MS } = {}) {
  const cutoff = now - Number(windowMs || DAY_MS);
  const byPair = {};
  for (const row of Array.isArray(flows) ? flows : []) {
    const ts = new Date(row.timestamp || row.time).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    const pair = xdxPairKey(row.pool || row.pool_name || row.pair);
    if (!/^XDX\/[A-Z0-9]{2,12}$/.test(pair)) continue;
    byPair[pair] = (byPair[pair] || 0) + Math.abs(Number(row.xdx) || 0);
  }
  return byPair;
}

export function overlayPoolFlowVolumes(pools = [], flows = [], now = Date.now()) {
  const byPair = volumesFromFlows(flows, { now });
  return (Array.isArray(pools) ? pools : []).map((pool) => {
    const pair = xdxPairKey(pool.pool || pool.pool_name || pool.pair);
    const fromFlow = byPair[pair] || 0;
    const current = Number(pool.volume24h ?? pool.volume24hXdx);
    const next = Number.isFinite(current) && current > 0 ? Math.max(current, fromFlow) : fromFlow;
    return {
      ...pool,
      volume24h: next,
      volume24hXdx: next,
      volumeUnit: "xdx",
      volumeSource: fromFlow > 0 && !(current > fromFlow) ? "xdx-flows" : pool.volumeSource || "recorded",
    };
  });
}

export function attachPoolVolumes(pool = {}, volumes = {}) {
  const incoming = Number(volumes.volume24hXdx);
  const existing = numPos(pool.volume24hXdx) || numPos(pool.volume24h);
  const volume24hXdx = incoming > 0 ? incoming : existing || (Number.isFinite(incoming) && incoming >= 0 ? incoming : 0);
  const volume7dXdx = numPos(volumes.volume7dXdx);
  const volume24hXrp = numPos(volumes.volume24hXrp);
  const volume24hUsd = numPos(volumes.volume24hUsd);
  const recorded = Number.isFinite(volume24hXdx) ? volume24hXdx : 0;
  return {
    ...pool,
    volume24h: recorded,
    volume24hXdx: recorded,
    volume24hXrp: volume24hXrp || null,
    volume24hUsd: volume24hUsd || null,
    volume7d: volume7dXdx || null,
    volume7dXdx: volume7dXdx || null,
    volumeUnit: "xdx",
    volumeSource: volumes.source || pool.volumeSource || "recorded",
  };
}

export function preferRailwayXdxVolume(dbRow = {}, liveRow = {}) {
  const dbXdx = catalogXdxVolume24h(dbRow);
  const liveXdx = catalogXdxVolume24h(liveRow);
  const db7d = catalogXdxVolume7d(dbRow);
  const live7d = catalogXdxVolume7d(liveRow);
  if (looksLikeXdxVolume(dbXdx)) {
    return {
      volume24h: dbXdx,
      volume24hXdx: numPos(dbRow.volume24hXdx) || dbXdx,
      volume24hXrp: numPos(dbRow.volume24hXrp) || numPos(liveRow.volume24hXrp) || null,
      volume24hUsd: numPos(dbRow.volume24hUsd) || numPos(liveRow.volume24hUsd) || null,
      volume7d: db7d || live7d || null,
      volume7dXdx: db7d || live7d || null,
      volumeUnit: "xdx",
      volumeSource: dbRow.volumeSource || "db",
    };
  }
  if (liveXdx) {
    return {
      volume24h: liveXdx,
      volume24hXdx: numPos(liveRow.volume24hXdx) || liveXdx,
      volume24hXrp: numPos(liveRow.volume24hXrp) || null,
      volume24hUsd: numPos(liveRow.volume24hUsd) || null,
      volume7d: live7d || null,
      volume7dXdx: live7d || null,
      volumeUnit: "xdx",
      volumeSource: liveRow.volumeSource || "xrpl.to",
    };
  }
  return {};
}

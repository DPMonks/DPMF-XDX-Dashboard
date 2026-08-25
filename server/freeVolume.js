import { XDX_XRPL_TO_MD5 } from "../src/constants/ledger.js";
import {
  attachPoolVolumes,
  pickBestXdxVolume,
  pickXrpPoolXdxVolume,
  sumFlowXdx,
  volumeCoverage,
  xdxFromXrpVolume,
  xdxPairKey,
  xdxVolumeFromDexscreenerPair,
  xdxVolumeFromGeckoPool,
  xdxVolumeFromTokenCard,
  xrpVolumeFromOhlc,
} from "../src/utils/lpVolume.js";
import { FREE_API_HEADERS, loadXrplToFlows } from "./xrplToCatalog.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const VOLUME_MS = 45_000;

let volumeCache = { at: 0, byPair: null };

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function jsonFetch(url, options = {}) {
  const res = await (options.fetchImpl || fetch)(url, {
    headers: { ...FREE_API_HEADERS, ...(options.headers || {}) },
    signal: AbortSignal.timeout(Number(options.timeoutMs) || 5000),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

export async function loadDexscreenerSearch(query = "XDX", options = {}) {
  return jsonFetch(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
    options
  );
}

export async function loadGeckoXrplPools(query = "XDX", options = {}) {
  return jsonFetch(
    `https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(query)}&network=xrpl`,
    options
  );
}

export async function loadOhlcRaw(md5 = XDX_XRPL_TO_MD5, options = {}) {
  const range = options.range || "7D";
  const interval = options.interval || "1h";
  return jsonFetch(
    `https://api.xrpl.to/v1/ohlc/${md5}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&vs_currency=USD`,
    { ...options, timeoutMs: 6000 }
  );
}

function isXrplPair(pair) {
  const chain = String(pair?.chainId || pair?.chain || "").toLowerCase();
  return !chain || chain === "xrpl";
}

function pairHasXdx(pair) {
  const base = String(pair?.baseToken?.symbol || "").toUpperCase();
  const quote = String(pair?.quoteToken?.symbol || "").toUpperCase();
  return base === "XDX" || quote === "XDX";
}

export function dexscreenerPairForQuote(payload = {}, quote) {
  const want = String(quote || "").toUpperCase();
  const rows = Array.isArray(payload?.pairs) ? payload.pairs : [];
  return (
    rows.find((row) => {
      if (!isXrplPair(row) || !pairHasXdx(row)) return false;
      if (!want) return true;
      const base = String(row.baseToken?.symbol || "").toUpperCase();
      const q = String(row.quoteToken?.symbol || "").toUpperCase();
      return q === want || base === want;
    }) || null
  );
}

export function geckoPoolForQuote(payload = {}, quote) {
  const want = String(quote || "").toUpperCase();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return (
    rows.find((row) => {
      const name = String(row?.attributes?.name || row?.name || "").toUpperCase();
      if (!name.includes("XDX")) return false;
      return want ? name.includes(want) : true;
    }) || null
  );
}

function xrpPerXdxFromSources({ token, reserveXdx, reserveXrp, xdxUsd, xrpUsd } = {}) {
  return (
    num(token?.exchXrp) ||
    (num(reserveXdx) && num(reserveXrp) ? reserveXrp / reserveXdx : 0) ||
    (num(xdxUsd) && num(xrpUsd) ? xdxUsd / xrpUsd : 0)
  );
}

export async function loadPoolXdxVolumes(args = {}) {
  const now = Number(args.now) || Date.now();
  if (!args.fresh && volumeCache.byPair && now - volumeCache.at < VOLUME_MS) {
    return volumeCache.byPair;
  }
  const xrpPerXdx = xrpPerXdxFromSources(args);
  const xdxUsd = num(args.xdxUsd);
  const options = { fetchImpl: args.fetchImpl, now };

  const [ohlc, dex, dexRlusdSearch, gecko, geckoRlusdSearch, flows] = await Promise.all([
    loadOhlcRaw(XDX_XRPL_TO_MD5, { ...options, range: "7D", interval: "1h" }).catch(() => ({ ohlc: [] })),
    loadDexscreenerSearch("XDX", options).catch(() => ({ pairs: [] })),
    loadDexscreenerSearch("XDX RLUSD", options).catch(() => ({ pairs: [] })),
    loadGeckoXrplPools("XDX", options).catch(() => ({ data: [] })),
    loadGeckoXrplPools("XDX RLUSD", options).catch(() => ({ data: [] })),
    Array.isArray(args.flows) ? Promise.resolve(args.flows) : loadXrplToFlows(options).catch(() => []),
  ]);

  const ohlcRows = Array.isArray(ohlc?.ohlc) ? ohlc.ohlc : [];
  const ohlc24Xrp = xrpVolumeFromOhlc(ohlcRows, { now, windowMs: DAY_MS });
  const ohlc7Xrp = xrpVolumeFromOhlc(ohlcRows, { now, windowMs: DAY_MS * 7 });
  const tokenXdx = xdxVolumeFromTokenCard(args.token, xrpPerXdx);
  const ohlc24Xdx = xdxFromXrpVolume(ohlc24Xrp, xrpPerXdx);
  const ohlc7Xdx = xdxFromXrpVolume(ohlc7Xrp, xrpPerXdx);

  const dexXrp = dexscreenerPairForQuote(dex, "XRP");
  const dexRlusd = dexscreenerPairForQuote(dex, "RLUSD") || dexscreenerPairForQuote(dexRlusdSearch, "RLUSD");
  const geckoXrp = geckoPoolForQuote(gecko, "XRP");
  const geckoRlusd = geckoPoolForQuote(gecko, "RLUSD") || geckoPoolForQuote(geckoRlusdSearch, "RLUSD");

  const xrpHist = sumFlowXdx(flows, { now, windowMs: DAY_MS, pair: "XDX/XRP" });
  const xrpHist7 = sumFlowXdx(flows, { now, windowMs: DAY_MS * 7, pair: "XDX/XRP" });
  const rlusdHist = sumFlowXdx(flows, { now, windowMs: DAY_MS, pair: "XDX/RLUSD" });
  const rlusdHist7 = sumFlowXdx(flows, { now, windowMs: DAY_MS * 7, pair: "XDX/RLUSD" });
  const tape24 = volumeCoverage({ rows: flows, now, windowMs: DAY_MS });
  const tape7 = volumeCoverage({ rows: flows, now, windowMs: DAY_MS * 7 });
  const xrpCover = tape24;
  const xrpCover7 = tape7;
  const rlusdCover = tape24;
  const rlusdCover7 = tape7;

  const xrp24 = pickXrpPoolXdxVolume({
    tokenXdx,
    ohlcXdx: ohlc24Xdx,
    dexXdx: xdxVolumeFromDexscreenerPair(dexXrp, xdxUsd || num(dexXrp?.priceUsd)),
    geckoXdx: xdxVolumeFromGeckoPool(geckoXrp, xdxUsd),
    histXdx: xrpHist,
    histComplete: xrpCover.complete,
  });

  const ohlc24Reliable = ohlc24Xdx > 0 && xrp24.value > 0 && ohlc24Xdx / xrp24.value >= 0.5;
  const xrp7 = pickBestXdxVolume([
    { value: ohlc7Xdx, complete: true, source: "xrpl.to-ohlc" },
    {
      value: ohlc24Reliable ? xrp24.value * (ohlc7Xdx / ohlc24Xdx) : 0,
      complete: true,
      source: "ohlc-scale",
    },
    { value: xrpHist7, complete: xrpCover7.complete, source: "xrpl.to-history" },
    { value: xrp24.value ? xrp24.value * 7 : 0, complete: false, source: "24h-times-7" },
  ]);

  const rlusd24 = pickBestXdxVolume([
    {
      value: xdxVolumeFromDexscreenerPair(dexRlusd, xdxUsd || num(dexRlusd?.priceUsd)),
      complete: true,
      source: "dexscreener",
    },
    { value: xdxVolumeFromGeckoPool(geckoRlusd, xdxUsd), complete: true, source: "geckoterminal" },
    { value: rlusdHist, complete: rlusdCover.complete, source: "xrpl.to-history" },
  ]);
  const rlusd7 = pickBestXdxVolume([
    { value: rlusdHist7, complete: rlusdCover7.complete, source: "xrpl.to-history" },
    { value: rlusd24.value ? rlusd24.value * 7 : 0, complete: false, source: "24h-times-7" },
  ]);

  const byPair = {
    "XDX/XRP": {
      volume24hXdx: xrp24.value,
      volume7dXdx: xrp7.value,
      volume24hXrp: xrpPerXdx ? xrp24.value * xrpPerXdx : num(args.token?.vol24hXrp) || ohlc24Xrp,
      volume24hUsd: xdxUsd ? xrp24.value * xdxUsd : 0,
      source: xrp24.source,
    },
    "XDX/RLUSD": {
      volume24hXdx: rlusd24.value,
      volume7dXdx: rlusd7.value,
      volume24hXrp: 0,
      volume24hUsd: xdxUsd ? rlusd24.value * xdxUsd : 0,
      source: rlusd24.source,
    },
  };

  const extraPairs = collectVolumePairs(args.pairs, dex, gecko, flows);
  for (const pair of extraPairs) {
    if (byPair[pair]) continue;
    const quote = pair.split("/")[1];
    const hist = sumFlowXdx(flows, { now, windowMs: DAY_MS, pair });
    const hist7 = sumFlowXdx(flows, { now, windowMs: DAY_MS * 7, pair });
    const picked = pickBestXdxVolume([
      {
        value: xdxVolumeFromDexscreenerPair(dexscreenerPairForQuote(dex, quote), xdxUsd || num(dexscreenerPairForQuote(dex, quote)?.priceUsd)),
        complete: true,
        source: "dexscreener",
      },
      { value: xdxVolumeFromGeckoPool(geckoPoolForQuote(gecko, quote), xdxUsd), complete: true, source: "geckoterminal" },
      { value: hist, complete: tape24.complete, source: "xrpl.to-history" },
    ]);
    byPair[pair] = {
      volume24hXdx: picked.value || 0,
      volume7dXdx: hist7 || (picked.value ? picked.value * 7 : 0),
      volume24hXrp: 0,
      volume24hUsd: xdxUsd && picked.value ? picked.value * xdxUsd : 0,
      source: picked.source || "recorded",
    };
  }
  volumeCache = { at: now, byPair };
  return byPair;
}

function pairFromDexRow(row) {
  const base = String(row?.baseToken?.symbol || "").toUpperCase();
  const quote = String(row?.quoteToken?.symbol || "").toUpperCase();
  if (base === "XDX" && quote) return xdxPairKey(`XDX/${quote}`);
  if (quote === "XDX" && base) return xdxPairKey(`XDX/${base}`);
  return "";
}

function pairFromGeckoRow(row) {
  const name = String(row?.attributes?.name || row?.name || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  const match = name.match(/XDX\/([A-Z0-9]{2,12})/);
  return match ? `XDX/${match[1]}` : "";
}

function collectVolumePairs(requested = [], dex = {}, gecko = {}, flows = []) {
  const pairs = new Set();
  for (const value of Array.isArray(requested) ? requested : []) {
    const pair = xdxPairKey(value);
    if (/^XDX\/[A-Z0-9]{2,12}$/.test(pair)) pairs.add(pair);
  }
  for (const row of Array.isArray(dex?.pairs) ? dex.pairs : []) {
    const pair = pairFromDexRow(row);
    if (pair) pairs.add(pair);
  }
  for (const row of Array.isArray(gecko?.data) ? gecko.data : []) {
    const pair = pairFromGeckoRow(row);
    if (pair) pairs.add(pair);
  }
  for (const row of Array.isArray(flows) ? flows : []) {
    const pair = xdxPairKey(row.pool || row.pool_name || row.pair);
    if (/^XDX\/[A-Z0-9]{2,12}$/.test(pair)) pairs.add(pair);
  }
  return [...pairs];
}

export function applyPoolVolumes(pools = [], byPair = {}) {
  return (Array.isArray(pools) ? pools : []).map((pool) => {
    const key = xdxPairKey(pool.pool || pool.pool_name || pool.pair);
    const vol = byPair[key] || { volume24hXdx: 0, source: "recorded" };
    return attachPoolVolumes(pool, vol);
  });
}

export function resetVolumeCache() {
  volumeCache = { at: 0, byPair: null };
}

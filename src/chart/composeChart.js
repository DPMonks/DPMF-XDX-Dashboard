import lockedCandles from "../data/lockedCandles.json" with { type: "json" };
import { appendLiveClose, resampleCandles, ticksToCandles, windowCandles } from "./candles.js";
import { quotePerXdx, stitchRlusdCandles } from "./pairQuote.js";

export function lockedSnapshot() {
  return lockedCandles && typeof lockedCandles === "object" ? lockedCandles : { pairs: {}, xrpUsd: [] };
}

export function lockedPairCandles(pair = "XDX/RLUSD") {
  const snap = lockedSnapshot();
  const key = String(pair || "").toUpperCase();
  const rows = snap.pairs?.[key]?.candles || snap.pairs?.[pair]?.candles || [];
  return Array.isArray(rows) ? rows : [];
}

export function ticksFromSparkline(rows = [], pair, prices = {}) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const t = Date.parse(row.timestamp || row.t);
      const usd = Number(row.price_usd ?? row.price ?? row.c);
      const price = quotePerXdx({
        pair,
        xdxUsd: usd,
        xrpUsd: prices.xrpUsd,
        xdxXrp: pair === "XDX/XRP" ? usd / Number(prices.xrpUsd || 0) : null,
        xdxRlusd: pair === "XDX/RLUSD" ? usd : null,
      });
      if (!Number.isFinite(t) || !(price > 0)) return null;
      return { t, p: price, source: "sparkline" };
    })
    .filter(Boolean);
}

export function ticksFromTrades(rows = [], pair) {
  const want = String(pair || "").toUpperCase();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const pool = String(row.pool || row.pool_name || "").toUpperCase();
      return !pool || pool === want || (want === "XDX/XRP" && (!pool || pool.includes("XRP")));
    })
    .map((row) => {
      const t = Date.parse(row.timestamp || row.t);
      const price = Number(row.price);
      if (!Number.isFinite(t) || !(price > 0)) return null;
      return { t, p: price, v: Number(row.xdx) || 0, source: "trade" };
    })
    .filter(Boolean);
}

export function composePairCandles({
  pair = "XDX/RLUSD",
  interval = "1D",
  range = "1M",
  locked = lockedSnapshot(),
  sparkline = [],
  trades = [],
  prices = {},
  livePrice,
  now = Date.now(),
} = {}) {
  const name = String(pair || "XDX/RLUSD").toUpperCase();
  let base = locked.pairs?.[name]?.candles || [];

  if (name === "XDX/RLUSD" && !base.length) {
    base = stitchRlusdCandles({
      xrpCandles: locked.pairs?.["XDX/XRP"]?.candles || [],
      xrpUsd: locked.xrpUsd || [],
      native: [],
    });
  }

  const liveTicks = [
    ...ticksFromSparkline(sparkline, name, { xrpUsd: prices.xrpUsd || latestLockedUsd() }),
    ...ticksFromTrades(trades, name),
  ];
  const live = ticksToCandles(liveTicks, interval, { continuous: false });
  const history = interval === "1W" ? resampleCandles(base, "1W") : base;
  const merged = new Map(history.map((row) => [row.t, row]));
  for (const row of live) merged.set(row.t, { ...merged.get(row.t), ...row, source: row.source || "live" });
  let candles = [...merged.values()].sort((left, right) => left.t - right.t);
  candles = appendLiveClose(candles, livePrice, now, interval === "1W" ? "1D" : interval);
  if (interval === "1W") candles = resampleCandles(candles, "1W");
  return windowCandles(candles, range, now);
}

export function latestLockedUsd() {
  const rows = lockedSnapshot().xrpUsd || [];
  return Number(rows[rows.length - 1]?.c) || null;
}

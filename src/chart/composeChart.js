import lockedCandles from "../data/lockedCandles.json" with { type: "json" };
import {
  appendLiveClose,
  candlesFromMarketData,
  expandDailyToInterval,
  fillDailyGaps,
  resampleCandles,
  ticksToCandles,
  windowCandles,
} from "./candles.js";
import { CHART_MA_PAD, CHART_VISIBLE_BARS, intervalMs, isDailyOrLonger } from "./intervals.js";
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
  windowed = true,
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
  const dbHistory = candlesFromMarketData(locked.dbMarket?.[name] || [], "db");
  if (dbHistory.length) {
    const map = new Map(base.map((row) => [row.t, row]));
    for (const row of dbHistory) map.set(row.t, row);
    base = [...map.values()].sort((left, right) => left.t - right.t);
  }

  const liveInterval = isDailyOrLonger(interval) ? (interval === "1W" || interval === "3D" || interval === "1M" ? "1D" : interval) : interval;
  const live = ticksToCandles(liveTicks, liveInterval, { continuous: false });
  let daily = fillDailyGaps(base, base[0]?.t, now);
  const merged = new Map(daily.map((row) => [row.t, row]));
  for (const row of live) {
    const prev = merged.get(row.t);
    merged.set(row.t, prev ? { ...prev, ...row, o: prev.o, source: row.source || "live" } : row);
  }
  let candles = [...merged.values()].sort((left, right) => left.t - right.t);
  candles = appendLiveClose(candles, livePrice, now, liveInterval);
  if (interval === "1D") candles = fillDailyGaps(candles, candles[0]?.t, now);
  if (interval === "1W" || interval === "3D" || interval === "1M") {
    candles = resampleCandles(candles, interval);
  }
  if (!isDailyOrLonger(interval)) {
    const step = intervalMs(interval);
    const from = now - (CHART_VISIBLE_BARS + CHART_MA_PAD) * step;
    candles = expandDailyToInterval(candles, interval, from, now);
    const intra = ticksToCandles(liveTicks, interval, { continuous: false });
    const intraMap = new Map(candles.map((row) => [row.t, row]));
    for (const row of intra) {
      const prev = intraMap.get(row.t);
      intraMap.set(row.t, prev ? { ...prev, ...row, o: prev.o, source: row.source || "live" } : row);
    }
    candles = [...intraMap.values()].sort((left, right) => left.t - right.t);
    candles = appendLiveClose(candles, livePrice, now, interval);
  }
  return windowed ? windowCandles(candles, range, now) : candles;
}

export function latestLockedUsd() {
  const rows = lockedSnapshot().xrpUsd || [];
  return Number(rows[rows.length - 1]?.c) || null;
}

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
import { CHART_MA_PAD, intervalMs, isDailyOrLonger, visibleBarsForInterval } from "./intervals.js";
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

export function medianPrice(values = []) {
  const nums = (Array.isArray(values) ? values : [])
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export function isSanePriceTick(price, median, maxRatio = 2.5) {
  const p = Number(price);
  const mid = Number(median);
  if (!(p > 0)) return false;
  if (!(mid > 0)) return true;
  return p <= mid * maxRatio && p >= mid / maxRatio;
}

export function filterSpikeTicks(ticks = [], { maxRatio = 2.5, window = 24, seed } = {}) {
  const rows = (Array.isArray(ticks) ? ticks : []).filter((row) => Number(row?.p ?? row?.price) > 0);
  if (!rows.length) return [];
  const accepted = [];
  const recent = Number(seed) > 0 ? [Number(seed)] : [];
  for (const tick of [...rows].sort((left, right) => left.t - right.t)) {
    const price = Number(tick.p ?? tick.price);
    const mid = medianPrice(recent.slice(-window));
    if (!isSanePriceTick(price, mid, maxRatio)) continue;
    accepted.push(tick);
    recent.push(price);
  }
  return accepted;
}

export function clipCandleSpikes(candles = [], { maxRatio = 2.5 } = {}) {
  const rows = Array.isArray(candles) ? candles : [];
  if (rows.length < 3) return rows;
  return rows.map((row, index) => {
    const around = rows.slice(Math.max(0, index - 8), index + 9).map((item) => item.c);
    const mid = medianPrice(around);
    if (!(mid > 0)) return row;
    const close = isSanePriceTick(row.c, mid, maxRatio) ? row.c : mid;
    const open = isSanePriceTick(row.o, mid, maxRatio) ? row.o : close;
    let high = Math.max(open, close, Number(row.h) || 0);
    let low = Math.min(open, close, Number(row.l) || open);
    if (high > mid * maxRatio) high = Math.max(open, close);
    if (low > 0 && low < mid / maxRatio) low = Math.min(open, close);
    return { ...row, o: open, h: high, l: low, c: close };
  });
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
  lookbackBars,
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

  const liveTicks = filterSpikeTicks(
    [
      ...ticksFromSparkline(sparkline, name, { xrpUsd: prices.xrpUsd || latestLockedUsd() }),
      ...ticksFromTrades(trades, name),
    ],
    { seed: base[base.length - 1]?.c }
  );
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
    const need = Math.min(
      4000,
      Math.max(visibleBarsForInterval(interval) + CHART_MA_PAD, Math.trunc(Number(lookbackBars) || 0))
    );
    const from = now - need * step;
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
  candles = clipCandleSpikes(candles);
  return windowed ? windowCandles(candles, range, now) : candles;
}

export function latestLockedUsd() {
  const rows = lockedSnapshot().xrpUsd || [];
  return Number(rows[rows.length - 1]?.c) || null;
}

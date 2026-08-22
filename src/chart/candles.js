import { bucketTime, intervalMs, isDailyOrLonger, tickMs } from "./intervals.js";

export function candlePrice(row) {
  const close = Number(row?.c ?? row?.close ?? row?.price ?? row?.p);
  return close > 0 ? close : null;
}

export function normalizeCandle(row, intervalId = "1D") {
  const t = bucketTime(tickMs(row), intervalId);
  const o = Number(row?.o ?? row?.open);
  const h = Number(row?.h ?? row?.high);
  const l = Number(row?.l ?? row?.low);
  const c = Number(row?.c ?? row?.close ?? row?.price ?? row?.p);
  const v = Number(row?.v ?? row?.volume ?? row?.xdx ?? 0) || 0;
  if (t == null || (!(c > 0) && !(o > 0))) return null;
  const close = c > 0 ? c : o;
  const open = o > 0 ? o : close;
  const high = h > 0 ? Math.max(h, open, close) : Math.max(open, close);
  const low = l > 0 ? Math.min(l, open, close) : Math.min(open, close);
  return {
    t,
    o: open,
    h: high,
    l: low,
    c: close,
    v,
    source: row?.source || "tick",
  };
}

export function ticksToCandles(ticks = [], intervalId = "1D", { continuous = true } = {}) {
  const buckets = new Map();

  for (const tick of Array.isArray(ticks) ? ticks : []) {
    const ready = normalizeCandle(tick, intervalId);
    const price = Number(tick?.p ?? tick?.price ?? tick?.c ?? tick?.close);
    const t = ready?.t ?? bucketTime(tickMs(tick), intervalId);
    if (t == null) continue;

    if (ready && (Number(tick?.o) > 0 || Number(tick?.h) > 0 || Number(tick?.l) > 0)) {
      const prev = buckets.get(t);
      if (!prev) {
        buckets.set(t, { ...ready });
      } else {
        buckets.set(t, {
          t,
          o: prev.o,
          h: Math.max(prev.h, ready.h),
          l: Math.min(prev.l, ready.l),
          c: ready.c,
          v: prev.v + ready.v,
          source: ready.source || prev.source,
        });
      }
      continue;
    }

    if (!(price > 0)) continue;
    const vol = Number(tick?.v ?? tick?.volume ?? tick?.xdx ?? 0) || 0;
    const prev = buckets.get(t);
    if (!prev) {
      buckets.set(t, { t, o: price, h: price, l: price, c: price, v: vol, source: tick?.source || "tick" });
    } else {
      prev.h = Math.max(prev.h, price);
      prev.l = Math.min(prev.l, price);
      prev.c = price;
      prev.v += vol;
    }
  }

  const candles = [...buckets.values()].sort((left, right) => left.t - right.t);
  if (!continuous || candles.length < 2) return candles;

  for (let i = 1; i < candles.length; i += 1) {
    const open = candles[i - 1].c;
    candles[i] = {
      ...candles[i],
      o: open,
      h: Math.max(candles[i].h, open, candles[i].c),
      l: Math.min(candles[i].l, open, candles[i].c),
    };
  }
  return candles;
}

export function resampleCandles(candles = [], intervalId = "1D") {
  if (!isDailyOrLonger(intervalId) && intervalId !== "1D") {
    return ticksToCandles(candles, intervalId, { continuous: false });
  }
  const buckets = new Map();
  for (const row of candles) {
    const t = bucketTime(row.t, intervalId);
    if (t == null || !(Number(row.c) > 0)) continue;
    const prev = buckets.get(t);
    if (!prev) {
      buckets.set(t, {
        t,
        o: Number(row.o) > 0 ? Number(row.o) : Number(row.c),
        h: Number(row.h) > 0 ? Number(row.h) : Number(row.c),
        l: Number(row.l) > 0 ? Number(row.l) : Number(row.c),
        c: Number(row.c),
        v: Number(row.v) || 0,
        source: row.source || "locked",
      });
    } else {
      prev.h = Math.max(prev.h, Number(row.h) || Number(row.c));
      prev.l = Math.min(prev.l, Number(row.l) || Number(row.c));
      prev.c = Number(row.c);
      prev.v += Number(row.v) || 0;
    }
  }
  return [...buckets.values()].sort((left, right) => left.t - right.t);
}

export function mergeCandleSets(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      const candle = normalizeCandle(row, "1D") || normalizeCandle({ ...row, t: row.t }, "1m");
      if (!candle) continue;
      const key = candle.t;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, candle);
        continue;
      }
      map.set(key, {
        t: key,
        o: prev.o,
        h: Math.max(prev.h, candle.h),
        l: Math.min(prev.l, candle.l),
        c: candle.c,
        v: (prev.v || 0) + (candle.v || 0),
        source: candle.source || prev.source,
      });
    }
  }
  return [...map.values()].sort((left, right) => left.t - right.t);
}

export function sma(values, period) {
  const n = Math.trunc(Number(period));
  const out = new Array(values.length).fill(null);
  if (!(n > 1) || values.length < n) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += Number(values[i]) || 0;
    if (i >= n) sum -= Number(values[i - n]) || 0;
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function trueRange(candles = []) {
  return candles.map((row, index) => {
    const high = Number(row.h);
    const low = Number(row.l);
    const prev = Number(candles[index - 1]?.c);
    if (!(high > 0) || !(low > 0)) return 0;
    if (!(prev > 0)) return high - low;
    return Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev));
  });
}

export function atr(candles = [], period = 14) {
  const ranges = trueRange(candles);
  return sma(ranges, period);
}

export function appendLiveClose(candles, price, at = Date.now(), intervalId = "1D") {
  if (!(Number(price) > 0)) return candles;
  const t = bucketTime(at, intervalId);
  if (t == null) return candles;
  const list = candles.map((row) => ({ ...row }));
  const last = list[list.length - 1];
  if (last && last.t === t) {
    last.h = Math.max(last.h, price);
    last.l = Math.min(last.l, price);
    last.c = price;
    return list;
  }
  const open = last?.c > 0 ? last.c : price;
  list.push({
    t,
    o: open,
    h: Math.max(open, price),
    l: Math.min(open, price),
    c: price,
    v: 0,
    source: "live",
  });
  return list;
}

export function windowCandles(candles, rangeId, now = Date.now()) {
  if (!candles.length) return candles;
  if (rangeId === "Max") return candles;
  const days = {
    "1D": 1,
    "5D": 5,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
    "5Y": 365 * 5,
  }[rangeId];
  if (!days) return candles;
  const start = now - days * 86_400_000;
  const inside = candles.filter((row) => row.t >= start);
  if (inside.length) return inside;
  return candles.slice(-Math.max(2, days));
}

export function intervalMsOf(id) {
  return intervalMs(id);
}

const DAY_MS = 86_400_000;

export function candlesFromMarketData(rows = [], source = "inftf") {
  return (Array.isArray(rows) ? rows : [])
    .map((row) =>
      normalizeCandle(
        {
          t: Date.parse(row.timestamp || row.t || row.time),
          o: row.open ?? row.o,
          h: row.high ?? row.h,
          l: row.low ?? row.l,
          c: row.close ?? row.c,
          v: row.base_volume ?? row.vb ?? row.v ?? 0,
          source,
        },
        "1D"
      )
    )
    .filter(Boolean)
    .sort((left, right) => left.t - right.t);
}

export function fillDailyGaps(candles = [], fromMs, toMs) {
  const list = (Array.isArray(candles) ? candles : [])
    .map((row) => normalizeCandle(row, "1D"))
    .filter(Boolean)
    .sort((left, right) => left.t - right.t);
  if (!list.length) return [];
  const start = bucketTime(fromMs ?? list[0].t, "1D");
  const end = bucketTime(toMs ?? list[list.length - 1].t, "1D");
  if (start == null || end == null || end < start) return list;
  const map = new Map(list.map((row) => [row.t, row]));
  const out = [];
  let prev = null;
  for (let t = start; t <= end; t += DAY_MS) {
    const row = map.get(t);
    if (row) {
      prev = row;
      out.push(row);
    } else if (prev) {
      out.push({
        t,
        o: prev.c,
        h: prev.c,
        l: prev.c,
        c: prev.c,
        v: 0,
        source: "carry",
      });
    }
  }
  return out;
}

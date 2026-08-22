import { bucketTime, CHART_VISIBLE_BARS, intervalMs, isDailyOrLonger, tickMs } from "./intervals.js";

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

export function ema(values, period) {
  const n = Math.trunc(Number(period));
  const out = new Array(values.length).fill(null);
  if (!(n > 1) || values.length < n) return out;
  const k = 2 / (n + 1);
  let prev = null;
  let seed = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = Number(values[i]) || 0;
    if (i < n - 1) {
      seed += value;
      continue;
    }
    if (prev == null) {
      prev = (seed + value) / n;
    } else {
      prev = value * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

export function wma(values, period) {
  const n = Math.trunc(Number(period));
  const out = new Array(values.length).fill(null);
  const denom = (n * (n + 1)) / 2;
  if (!(n > 1) || values.length < n || !(denom > 0)) return out;
  for (let i = n - 1; i < values.length; i += 1) {
    let sum = 0;
    for (let weight = 1; weight <= n; weight += 1) {
      sum += (Number(values[i - n + weight]) || 0) * weight;
    }
    out[i] = sum / denom;
  }
  return out;
}

export function smma(values, period) {
  const n = Math.trunc(Number(period));
  const out = new Array(values.length).fill(null);
  if (!(n > 1) || values.length < n) return out;
  let prev = null;
  let seed = 0;
  for (let i = 0; i < values.length; i += 1) {
    const value = Number(values[i]) || 0;
    if (i < n - 1) {
      seed += value;
      continue;
    }
    prev = prev == null ? (seed + value) / n : (prev * (n - 1) + value) / n;
    out[i] = prev;
  }
  return out;
}

export function vwma(values, volumes = [], period) {
  const n = Math.trunc(Number(period));
  const out = new Array(values.length).fill(null);
  if (!(n > 1) || values.length < n) return out;
  for (let i = n - 1; i < values.length; i += 1) {
    let priceVol = 0;
    let vol = 0;
    for (let j = 0; j < n; j += 1) {
      const close = Number(values[i - n + 1 + j]) || 0;
      const size = Number(volumes[i - n + 1 + j]) || 0;
      priceVol += close * size;
      vol += size;
    }
    out[i] = vol > 0 ? priceVol / vol : null;
  }
  return out;
}

export function hma(values, period) {
  const n = Math.trunc(Number(period));
  const out = new Array(values.length).fill(null);
  if (!(n > 1) || values.length < n) return out;
  const half = Math.max(2, Math.round(n / 2));
  const root = Math.max(2, Math.round(Math.sqrt(n)));
  const wmaHalf = wma(values, half);
  const wmaFull = wma(values, n);
  const raw = values.map((_, index) =>
    wmaHalf[index] == null || wmaFull[index] == null ? null : 2 * wmaHalf[index] - wmaFull[index]
  );
  const denom = (root * (root + 1)) / 2;
  for (let i = root - 1; i < raw.length; i += 1) {
    let sum = 0;
    let ok = true;
    for (let weight = 1; weight <= root; weight += 1) {
      const value = raw[i - root + weight];
      if (value == null) {
        ok = false;
        break;
      }
      sum += value * weight;
    }
    if (ok) out[i] = sum / denom;
  }
  return out;
}

export const MA_TYPES = [
  { id: "sma", short: "SMA", labelKey: "chartSma" },
  { id: "ema", short: "EMA", labelKey: "chartEma" },
  { id: "wma", short: "WMA", labelKey: "chartWma" },
  { id: "smma", short: "SMMA", labelKey: "chartSmma" },
  { id: "vwma", short: "VWMA", labelKey: "chartVwma" },
  { id: "hma", short: "HMA", labelKey: "chartHma" },
];

export const MA_PERIODS = [
  { period: 9, color: "#ffe14a" },
  { period: 20, color: "#00eaff" },
  { period: 50, color: "#c770ff" },
  { period: 200, color: "#ff9a3c" },
];

export function movingAverage(type, values, period, volumes = []) {
  if (type === "ema") return ema(values, period);
  if (type === "wma") return wma(values, period);
  if (type === "smma") return smma(values, period);
  if (type === "vwma") return vwma(values, volumes, period);
  if (type === "hma") return hma(values, period);
  return sma(values, period);
}

export function seedSeriesForAverages(series = []) {
  const list = Array.isArray(series) ? series : [];
  const out = [];
  for (const row of list) {
    const prev = out[out.length - 1];
    if (prev && row?.source === "carry" && Number(prev.c) === Number(row.c)) continue;
    out.push(row);
  }
  return out.length ? out : list;
}

export function interpolateAverage(knots = [], time) {
  const points = (Array.isArray(knots) ? knots : []).filter(
    (row) => Number.isFinite(row?.t) && Number.isFinite(row?.v)
  );
  if (!points.length || !Number.isFinite(time)) return null;
  if (time < points[0].t) return null;
  if (time === points[0].t) return points[0].v;
  const last = points[points.length - 1];
  if (time >= last.t) return last.v;
  let hi = 1;
  while (hi < points.length && points[hi].t < time) hi += 1;
  const left = points[hi - 1];
  const right = points[hi];
  const span = right.t - left.t;
  const mu = span > 0 ? (time - left.t) / span : 0;
  const ease = (1 - Math.cos(mu * Math.PI)) / 2;
  return left.v * (1 - ease) + right.v * ease;
}

export function averagesForWindow({
  series = [],
  visible = [],
  type = "sma",
  periods = [],
  periodMeta = MA_PERIODS,
} = {}) {
  const source = seedSeriesForAverages(series);
  const closes = source.map((row) => row.c);
  const volumes = source.map((row) => row.v);
  return periods.map((period) => {
    const values = movingAverage(type, closes, period, volumes);
    const knots = source
      .map((row, index) => ({ t: row.t, v: values[index] }))
      .filter((row) => Number.isFinite(row.v));
    const color = periodMeta.find((row) => row.period === period)?.color || "#00eaff";
    return {
      id: `${type}-${period}`,
      color,
      values: (Array.isArray(visible) ? visible : []).map((row) => interpolateAverage(knots, row.t)),
    };
  });
}

export function candleBodyWidth({ innerW, candles = [], start, end, stepMs = 86_400_000 } = {}) {
  const width = Number(innerW) || 0;
  const span = Math.max(Number(end) - Number(start), 1);
  let slot = (Number(stepMs) || 86_400_000) / span * width;
  if (candles.length >= 2) {
    const dt = (candles[candles.length - 1].t - candles[0].t) / (candles.length - 1);
    slot = (dt / span) * width;
  }
  return Math.max(1.2, Math.min(slot * 0.23, width * 0.055));
}

export function windowLastBars(candles = [], bars = CHART_VISIBLE_BARS) {
  const n = Math.max(1, Math.trunc(Number(bars) || CHART_VISIBLE_BARS));
  if (!Array.isArray(candles) || candles.length <= n) return candles;
  return candles.slice(-n);
}

export function expandDailyToInterval(daily = [], intervalId, fromMs, toMs) {
  const step = intervalMs(intervalId);
  const start = bucketTime(fromMs ?? daily[0]?.t, intervalId);
  const end = bucketTime(toMs ?? daily[daily.length - 1]?.t, intervalId);
  if (start == null || end == null || end < start || !(step > 0)) return daily;
  const byDay = new Map(
    (Array.isArray(daily) ? daily : [])
      .map((row) => [bucketTime(row.t, "1D"), row])
      .filter(([key]) => key != null)
  );
  const out = [];
  let prev = null;
  const limit = start + step * 1200;
  for (let t = start; t <= end && t <= limit; t += step) {
    const dayKey = bucketTime(t, "1D");
    const dayRow = byDay.get(dayKey);
    if (dayRow && t === dayKey) {
      prev = { ...dayRow, t, source: dayRow.source || "locked" };
      out.push(prev);
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

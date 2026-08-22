export const RSI_PERIODS = [7, 9, 14, 21, 25];
export const RSI_OVERBOUGHT = [60, 70, 80];
export const RSI_OVERSOLD = [20, 30, 40];

export function rsi(closes = [], period = 14) {
  const values = Array.isArray(closes) ? closes.map((value) => Number(value)) : [];
  const n = Math.trunc(Number(period));
  const out = new Array(values.length).fill(null);
  if (!(n > 1) || values.length <= n) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  let avgGain = gain / n;
  let avgLoss = loss / n;
  out[n] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = n + 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    const up = delta > 0 ? delta : 0;
    const down = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (n - 1) + up) / n;
    avgLoss = (avgLoss * (n - 1) + down) / n;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function rsiForWindow({ series = [], visible = [], period = 14 } = {}) {
  const values = rsi(
    (Array.isArray(series) ? series : []).map((row) => row.c),
    period
  );
  const byTime = new Map((Array.isArray(series) ? series : []).map((row, index) => [row.t, values[index]]));
  return (Array.isArray(visible) ? visible : []).map((row) => (byTime.has(row.t) ? byTime.get(row.t) : null));
}

export function smoothWave(values = [], period = 6) {
  const list = Array.isArray(values) ? values : [];
  const n = Math.max(1, Math.trunc(Number(period)) || 1);
  return list.map((_, index) => {
    const from = Math.max(0, index - n + 1);
    let sum = 0;
    let count = 0;
    for (let i = from; i <= index; i += 1) {
      sum += Number(list[i]) || 0;
      count += 1;
    }
    return count ? sum / count : 0;
  });
}

export function volumeWaveValues(candles = [], { smooth = 6 } = {}) {
  const list = Array.isArray(candles) ? candles : [];
  const raw = list.map((row) => Math.max(0, Number(row.v) || 0));
  const byDay = new Map();
  list.forEach((row, index) => {
    const day = Math.floor(Number(row.t) / 86_400_000);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(index);
  });
  const spread = raw.slice();
  for (const indexes of byDay.values()) {
    const total = indexes.reduce((sum, index) => sum + raw[index], 0);
    const hits = indexes.filter((index) => raw[index] > 0).length;
    if (total > 0 && hits === 1 && indexes.length > 1) {
      const each = total / indexes.length;
      for (const index of indexes) spread[index] = each;
    }
  }
  return smoothWave(spread, smooth);
}

export function wavePath(points = []) {
  const rows = Array.isArray(points) ? points.filter((row) => Number.isFinite(row?.x) && Number.isFinite(row?.y)) : [];
  if (!rows.length) return "";
  let d = `M${rows[0].x} ${rows[0].y}`;
  for (let i = 0; i < rows.length - 1; i += 1) {
    const p0 = rows[i - 1] || rows[i];
    const p1 = rows[i];
    const p2 = rows[i + 1];
    const p3 = rows[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

export function waveArea(points = [], baseline) {
  const line = wavePath(points);
  if (!line || !points.length || !Number.isFinite(baseline)) return "";
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${last.x} ${baseline} L${first.x} ${baseline} Z`;
}

export const DRIFT_MS = 900;
export const DRIFT_POINTS = 80;

export function easeInOutCubic(t) {
  const x = Math.min(1, Math.max(0, Number(t) || 0));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

export function lerp(from, to, t) {
  return from + (to - from) * t;
}

export function lerpPair(from, to, t) {
  const a = Array.isArray(from) ? from : to;
  const b = Array.isArray(to) ? to : from;
  if (!a || !b) return b || a || [0, 1];
  return [lerp(Number(a[0]), Number(b[0]), t), lerp(Number(a[1]), Number(b[1]), t)];
}

function plotOf(row) {
  const value = Number(row?.plot);
  return Number.isFinite(value) ? value : null;
}

function tsOf(row) {
  const value = Number(row?.ts);
  return Number.isFinite(value) ? value : null;
}

export function resamplePlot(rows, count = DRIFT_POINTS) {
  const list = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const ts = tsOf(row);
      const plot = plotOf(row);
      return ts == null || plot == null ? null : { ts, plot };
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);
  const size = Math.max(2, Number(count) || DRIFT_POINTS);
  if (!list.length) return [];
  if (list.length === 1) {
    return Array.from({ length: size }, () => ({ ...list[0] }));
  }

  const start = list[0].ts;
  const end = list[list.length - 1].ts;
  const span = Math.max(end - start, 1);
  const out = [];
  let j = 0;
  for (let i = 0; i < size; i += 1) {
    const ts = start + (span * i) / (size - 1);
    while (j < list.length - 2 && list[j + 1].ts < ts) j += 1;
    const a = list[j];
    const b = list[Math.min(j + 1, list.length - 1)];
    const dt = b.ts - a.ts || 1;
    const u = Math.min(1, Math.max(0, (ts - a.ts) / dt));
    out.push({ ts, plot: lerp(a.plot, b.plot, u) });
  }
  return out;
}

export function driftPlot(fromRows, toRows, t, count = DRIFT_POINTS) {
  const progress = easeInOutCubic(t);
  const from = resamplePlot(fromRows, count);
  const to = resamplePlot(toRows, count);
  if (!from.length) return to;
  if (!to.length) return from;
  return from.map((a, i) => ({
    ts: lerp(a.ts, to[i].ts, progress),
    plot: lerp(a.plot, to[i].plot, progress),
  }));
}

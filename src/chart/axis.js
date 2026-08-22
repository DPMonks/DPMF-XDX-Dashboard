import { bucketTime, isDailyOrLonger } from "./intervals.js";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_STEPS = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, HOUR_MS, 4 * HOUR_MS];

export function niceStep(span, count = 6) {
  const raw = Number(span) / Math.max(2, Number(count) - 1);
  if (!(raw > 0) || !Number.isFinite(raw)) return 0;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((n) => n * mag).find((n) => n >= raw);
  return step || raw;
}

export function priceTicks(min, max, count = 6) {
  const lo = Number(min);
  const hi = Number(max);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi <= lo) return [lo];
  const step = niceStep(hi - lo, count);
  if (!(step > 0)) return [lo, hi];
  const start = Math.ceil((lo - step * 1e-9) / step) * step;
  const ticks = [];
  for (let value = start; value <= hi + step * 1e-9; value += step) {
    ticks.push(Number(value.toPrecision(12)));
    if (ticks.length > 12) break;
  }
  return ticks.length ? ticks : [lo, hi];
}

function monthStartUtc(year, month) {
  return Date.UTC(year, month, 1);
}

function monthTicks(start, end, stepMonths) {
  const first = new Date(start);
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth();
  if (first.getUTCDate() !== 1 || first.getUTCHours() || first.getUTCMinutes()) {
    month += 1;
  }
  month = Math.ceil(month / stepMonths) * stepMonths;
  if (month > 11) {
    year += Math.floor(month / 12);
    month %= 12;
  }
  const ticks = [];
  for (;;) {
    const t = monthStartUtc(year, month);
    if (t > end) break;
    if (t >= start) ticks.push(t);
    month += stepMonths;
    if (month > 11) {
      year += Math.floor(month / 12);
      month %= 12;
    }
    if (ticks.length > 14) break;
  }
  return ticks;
}

function steppedTicks(start, end, step, align = (t) => Math.ceil(t / step) * step) {
  if (!(step > 0)) return [];
  const ticks = [];
  for (let t = align(start); t <= end; t += step) {
    if (t >= start) ticks.push(t);
    if (ticks.length > 14) break;
  }
  return ticks;
}

export function timeTicks(start, end, { count = 6, intervalId = "1D" } = {}) {
  const from = Number(start);
  const to = Number(end);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [];
  if (to <= from) return [from];
  const span = to - from;
  const target = span / Math.max(2, Number(count) - 1);

  if (target >= 80 * DAY_MS) return monthTicks(from, to, target >= 200 * DAY_MS ? 12 : 3);
  if (target >= 20 * DAY_MS) return monthTicks(from, to, 1);
  if (target >= 4 * DAY_MS) {
    return steppedTicks(from, to, 7 * DAY_MS, (t) => bucketTime(t, "1W") ?? t);
  }
  if (target >= 10 * HOUR_MS || isDailyOrLonger(intervalId)) {
    return steppedTicks(from, to, DAY_MS, (t) => bucketTime(t, "1D") ?? t);
  }
  const step = MINUTE_STEPS.find((ms) => ms >= target) || MINUTE_STEPS[MINUTE_STEPS.length - 1];
  return steppedTicks(from, to, step);
}

export function formatPriceLabel(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toFixed(6);
}

export function formatAxisPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  if (num === 0) return "0";
  const abs = Math.abs(num);
  if (abs >= 1) return abs >= 100 ? num.toFixed(2) : num.toFixed(4).replace(/\.?0+$/, "");
  const digits = Math.max(4, Math.min(8, Math.ceil(-Math.log10(abs)) + 2));
  return num.toFixed(digits);
}

export function formatAxisTime(t, { spanMs = 30 * DAY_MS, intervalId = "1D", locale = "en" } = {}) {
  const date = new Date(t);
  if (Number.isNaN(date.getTime())) return "—";
  const span = Number(spanMs) || 0;
  if (span >= 80 * DAY_MS) {
    return date.toLocaleDateString(locale, { month: "short", year: "numeric", timeZone: "UTC" });
  }
  if (span >= 2 * DAY_MS || isDailyOrLonger(intervalId)) {
    return date.toLocaleDateString(locale, { day: "2-digit", month: "short", timeZone: "UTC" });
  }
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
}

export function formatCursorWhen(t, locale = "en") {
  const date = new Date(t);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

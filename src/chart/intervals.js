export const CHART_PAIRS = ["XDX/RLUSD", "XDX/XRP"];

export const INTERVALS = [
  { id: "1m", label: "1m", ms: 60_000 },
  { id: "5m", label: "5m", ms: 300_000 },
  { id: "15m", label: "15m", ms: 900_000 },
  { id: "1h", label: "1h", ms: 3_600_000 },
  { id: "4h", label: "4h", ms: 14_400_000 },
  { id: "1D", label: "D", ms: 86_400_000 },
  { id: "1W", label: "W", ms: 7 * 86_400_000 },
];

export const RANGE_WINDOWS = {
  "1D": 1,
  "5D": 5,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "5Y": 365 * 5,
  Max: null,
};

export function intervalMs(id) {
  return INTERVALS.find((row) => row.id === id)?.ms || 86_400_000;
}

export function isDailyOrLonger(id) {
  return id === "1D" || id === "1W" || id === "D" || id === "W";
}

// UTC buckets. Daily = 00:00 UTC. Weekly = Monday 00:00 UTC (crypto convention).
export function bucketTime(ts, intervalId = "1D") {
  const time = Number(ts);
  if (!Number.isFinite(time)) return null;
  const id = String(intervalId || "1D");

  if (id === "1D" || id === "D") {
    const date = new Date(time);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  if (id === "1W" || id === "W") {
    const date = new Date(time);
    const day = date.getUTCDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    return Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() - mondayOffset
    );
  }

  const ms = intervalMs(id);
  if (!(ms > 0)) return null;
  return Math.floor(time / ms) * ms;
}

export function tickMs(row) {
  if (row == null) return null;
  if (Number.isFinite(Number(row.t))) {
    const raw = Number(row.t);
    return raw < 1e12 ? raw * 1000 : raw;
  }
  if (Number.isFinite(Number(row.time))) {
    const raw = Number(row.time);
    return raw < 1e12 ? raw * 1000 : raw;
  }
  const parsed = Date.parse(row.timestamp || row.date || row.as_of || "");
  return Number.isFinite(parsed) ? parsed : null;
}

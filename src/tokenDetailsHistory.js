import { downsampleSeries } from "./activityHistory.js";

export const TOKEN_DETAIL_METRICS = [
  "price",
  "xdxPerXrp",
  "xrplMarketCap",
  "circulatingMarketCap",
  "ammMarketCap",
  "circulating",
  "burnedSupply",
  "holders",
  "trustlines",
  "lpHolders",
  "lpTrustlines",
  "lpSupply",
];

export const TOKEN_DETAIL_RANGES = ["1H", "4H", "12H", "24H", "1W", "1M", "3M", "1Y", "Max"];

export const TOKEN_DETAIL_LABEL_KEYS = {
  price: "price",
  xdxPerXrp: "xdxPerXrp",
  xrplMarketCap: "xrplMarketCap",
  circulatingMarketCap: "circulatingMarketCap",
  ammMarketCap: "ammMarketCap",
  circulating: "circulating",
  burnedSupply: "burnedSupply",
  holders: "holders",
  trustlines: "trustlines",
  lpHolders: "lpHoldersCount",
  lpTrustlines: "lpTrustlinesCount",
  lpSupply: "lpSupply",
};

export function tokenDetailLabel(t, metric) {
  const key = TOKEN_DETAIL_LABEL_KEYS[metric] || metric;
  return t?.[key] || t?.[metric] || metric;
}

export const TOKEN_DETAIL_RANGE_MS = {
  "1H": 3600000,
  "4H": 4 * 3600000,
  "12H": 12 * 3600000,
  "24H": 86400000,
  "1W": 7 * 86400000,
  "1M": 30 * 86400000,
  "3M": 90 * 86400000,
  "1Y": 365 * 86400000,
};

const METRIC_KEYS = {
  price: ["price", "recorded_price", "xdxUsd", "xdx_usd", "price_usd"],
  xdxPerXrp: ["xdxPerXrp", "xdx_per_xrp"],
  xrplMarketCap: ["xrplMarketCap", "market_cap", "fdv"],
  circulatingMarketCap: ["circulatingMarketCap", "circ_mc"],
  ammMarketCap: ["ammMarketCap", "tvl_usd", "tvl"],
  circulating: ["circulating", "circulating_supply", "xdx_supply"],
  burnedSupply: ["burnedSupply", "burned_supply", "issuer_locked", "issuerLocked"],
  holders: ["holders", "holder_count"],
  trustlines: ["trustlines", "trustline_count"],
  lpHolders: ["lpHolders", "lp_holder_count", "lp_holders"],
  lpTrustlines: ["lpTrustlines", "lp_trustline_count", "lp_trustlines"],
  lpSupply: ["lpSupply", "lp_supply"],
};

function rawNumber(value) {
  if (value == null || value === "") return null;
  const num = Number(typeof value === "object" ? value.value ?? value.amount : value);
  return Number.isFinite(num) ? num : null;
}

export function tokenDetailMetricNumber(row, metric) {
  const keys = METRIC_KEYS[metric] || [metric];
  for (const key of keys) {
    const num = rawNumber(row?.[key]);
    if (num != null) return num;
  }
  return null;
}

export function namedHistoryRows(rows, metric) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const value =
        tokenDetailMetricNumber(row, metric) ?? rawNumber(row?.count) ?? rawNumber(row?.value);
      return value == null ? null : mapHistoryRow(row, { [metric]: value });
    })
    .filter(Boolean);
}

function rowTs(row) {
  const raw = row?.timestamp ?? row?.day ?? row?.date ?? row?.time ?? row?.ts ?? row?.t;
  if (raw == null || raw === "") return null;
  const ms = typeof raw === "number" ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function mapHistoryRow(row = {}, fields = {}) {
  const ts = rowTs(row);
  if (ts == null) return null;
  return {
    timestamp: new Date(ts).toISOString(),
    ts,
    ...fields,
  };
}

export function mergeTokenDetailRows(...lists) {
  const merged = new Map();
  for (const list of lists) {
    for (const row of list || []) {
      if (!row || typeof row !== "object") continue;
      const ts = row.ts || rowTs(row);
      if (ts == null) continue;
      const iso = new Date(ts).toISOString();
      const current = merged.get(iso) || { timestamp: iso, ts };
      for (const metric of TOKEN_DETAIL_METRICS) {
        const value = tokenDetailMetricNumber(row, metric);
        if (value != null) current[metric] = value;
      }
      merged.set(iso, current);
    }
  }
  return [...merged.values()].sort((a, b) => a.ts - b.ts);
}

export function carryTokenDetailMetrics(rows = []) {
  const last = {};
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const next = { ...row };
    for (const metric of TOKEN_DETAIL_METRICS) {
      const value = tokenDetailMetricNumber(row, metric);
      if (value != null) last[metric] = value;
      if (last[metric] != null) next[metric] = last[metric];
    }
    return next;
  });
}

export function liveTokenDetailTip(live) {
  if (!live || typeof live !== "object") return null;
  const tip = mapHistoryRow({ timestamp: live.timestamp || Date.now() }, live);
  if (!tip) return null;
  const hasValue = TOKEN_DETAIL_METRICS.some((metric) => tokenDetailMetricNumber(tip, metric) != null);
  return hasValue ? tip : null;
}

function sparkMetricRows(sparkline, live) {
  const totalSupply = rawNumber(live?.totalSupply ?? live?.total_supply);
  const circulating = tokenDetailMetricNumber(live, "circulating") ?? rawNumber(live?.circulating);
  const xrpUsd = rawNumber(live?.xrpUsd ?? live?.xrp_usd);
  return (Array.isArray(sparkline) ? sparkline : [])
    .map((row) => {
      const price = rawNumber(row.price_usd ?? row.price ?? row.c ?? row.xdxUsd);
      if (price == null) return null;
      const fields = { price };
      if (totalSupply != null) fields.xrplMarketCap = price * totalSupply;
      if (circulating != null) fields.circulatingMarketCap = price * circulating;
      if (xrpUsd != null && xrpUsd > 0) fields.xdxPerXrp = price / xrpUsd;
      return mapHistoryRow(row, fields);
    })
    .filter(Boolean);
}

export function composeTokenDetailHistory({
  holders = [],
  trustlines = [],
  tvl = [],
  lpHolders = [],
  lpTrustlines = [],
  sparkline = [],
  live = null,
} = {}) {
  return carryTokenDetailMetrics(
    mergeTokenDetailRows(
      namedHistoryRows(holders, "holders"),
      namedHistoryRows(trustlines, "trustlines"),
      namedHistoryRows(tvl, "ammMarketCap"),
      namedHistoryRows(lpHolders, "lpHolders"),
      namedHistoryRows(lpTrustlines, "lpTrustlines"),
      sparkMetricRows(sparkline, live),
      [liveTokenDetailTip(live)]
    )
  );
}

export function windowedTokenSeries(rows, range, now, metric) {
  const all = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const ts = row.ts || rowTs(row);
      return ts == null ? null : { ...row, ts };
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);
  if (!all.length) return [];

  let lastKnown = null;
  const filled = all.map((row) => {
    const value = tokenDetailMetricNumber(row, metric);
    if (value != null) lastKnown = value;
    return { ...row, plot: lastKnown };
  });
  const usable = filled.filter((row) => Number.isFinite(row.plot));
  if (!usable.length) return [];
  if (range === "Max") return downsampleSeries(usable);

  const windowMs = TOKEN_DETAIL_RANGE_MS[range];
  if (!windowMs) return downsampleSeries(usable);
  const start = now - windowMs;
  const inside = usable.filter((row) => row.ts >= start && row.ts <= now);
  const lastBefore = [...usable].reverse().find((row) => row.ts < start);
  const seed = lastBefore || (inside[0] ? null : usable[usable.length - 1]);
  const out = [...inside];
  if (seed) out.unshift({ ...seed, timestamp: new Date(start).toISOString(), ts: start });
  else if (out[0] && out[0].ts > start) {
    out.unshift({ ...out[0], timestamp: new Date(start).toISOString(), ts: start });
  }
  const last = out[out.length - 1];
  if (last && last.ts < now) {
    out.push({ ...last, timestamp: new Date(now).toISOString(), ts: now });
  }
  return downsampleSeries(out.filter((row) => Number.isFinite(row.plot)));
}

export function tokenDetailYDomain(values) {
  const nums = (values || []).filter((value) => Number.isFinite(value));
  if (!nums.length) return [0, 1];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) {
    const pad = Math.abs(min) * 0.08 || 1;
    return [Math.max(0, min - pad), max + pad];
  }
  const pad = (max - min) * 0.08;
  return [Math.max(0, min - pad), max + pad];
}

export function tokenDetailIsIntraday(range) {
  return range === "1H" || range === "4H" || range === "12H" || range === "24H";
}

export function tokenDetailDecimals(metric) {
  if (metric === "price" || metric === "xdxPerXrp") return 8;
  if (
    metric === "xrplMarketCap" ||
    metric === "circulatingMarketCap" ||
    metric === "ammMarketCap"
  ) {
    return 2;
  }
  return 0;
}

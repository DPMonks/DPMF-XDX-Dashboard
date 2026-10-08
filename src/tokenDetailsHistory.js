import { collapseUnchangedPlot, downsampleSeries } from "./activityHistory.js";

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

/** Stock / level metrics: step-hold across the window; never invent false zeros. */
export const TOKEN_DETAIL_LEVEL_METRICS = new Set([
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
]);

export const TOKEN_DETAIL_LP_METRICS = new Set(["lpHolders", "lpTrustlines", "lpSupply"]);

/**
 * Metrics read straight off the price tape. When the tape has a hole we show a
 * break, not the last price stretched flat across days we have no trades for.
 */
export const TOKEN_DETAIL_PRICE_METRICS = new Set([
  "price",
  "xdxPerXrp",
  "xrplMarketCap",
  "circulatingMarketCap",
]);

/** Longer than this between real price samples counts as missing data. */
export const TOKEN_DETAIL_PRICE_GAP_MS = 3 * 86400000;

export function tokenDetailShowsGaps(metric) {
  return TOKEN_DETAIL_PRICE_METRICS.has(metric);
}

export function tokenDetailIsLevelMetric(metric) {
  return TOKEN_DETAIL_LEVEL_METRICS.has(metric);
}

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
  circulatingMarketCap: ["circulatingMarketCap", "usd_mc"],
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

/** Drop unconfirmed zeros for LP level samples (missing scan ≠ empty pool). */
function levelSample(value, { allowZero = false } = {}) {
  const num = rawNumber(value);
  if (num == null) return null;
  if (!allowZero && num === 0) return null;
  return num;
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
  const allowZero = !TOKEN_DETAIL_LP_METRICS.has(metric);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const value =
        levelSample(tokenDetailMetricNumber(row, metric), { allowZero }) ??
        levelSample(row?.count, { allowZero }) ??
        levelSample(row?.value, { allowZero });
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
      if (row.__lpConfirmedEmpty) current.__lpConfirmedEmpty = true;
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
      let value = tokenDetailMetricNumber(row, metric);
      // History zeros on LP series are almost always missing/partial scans.
      if (
        TOKEN_DETAIL_LP_METRICS.has(metric) &&
        value === 0 &&
        !row.__lpConfirmedEmpty
      ) {
        value = null;
      }
      if (value != null) {
        last[metric] = value;
      } else if (last[metric] != null) {
        next[metric] = last[metric];
        next.__carried = { ...(next.__carried || {}), [metric]: true };
      }
    }
    return next;
  });
}

export function liveTokenDetailTip(live) {
  if (!live || typeof live !== "object") return null;
  const tip = mapHistoryRow({ timestamp: live.timestamp || Date.now() }, live);
  if (!tip) return null;
  const hasValue = TOKEN_DETAIL_METRICS.some((metric) => tokenDetailMetricNumber(tip, metric) != null);
  if (!hasValue) return null;
  // Live overview may legitimately report empty LP; allow those zeros through carry.
  tip.__lpConfirmedEmpty = true;
  return tip;
}

function sparkMetricRows(sparkline, live) {
  const totalSupply = rawNumber(live?.totalSupply ?? live?.total_supply);
  const circulating = tokenDetailMetricNumber(live, "circulating") ?? rawNumber(live?.circulating);
  const burned =
    tokenDetailMetricNumber(live, "burnedSupply") ??
    rawNumber(live?.burnedSupply ?? live?.issuerLocked ?? live?.issuer_locked);
  const xrpUsd = rawNumber(live?.xrpUsd ?? live?.xrp_usd);
  return (Array.isArray(sparkline) ? sparkline : [])
    .map((row) => {
      const asset = String(row.asset || row.token || "XDX").toUpperCase();
      if (asset && asset !== "XDX") return null;
      const price = rawNumber(row.price_usd ?? row.price ?? row.c ?? row.xdxUsd);
      if (price == null) return null;
      const fields = { price };
      if (totalSupply != null) fields.xrplMarketCap = price * totalSupply;
      if (circulating != null) {
        fields.circulating = circulating;
        fields.circulatingMarketCap = price * circulating;
      }
      if (burned != null) fields.burnedSupply = burned;
      const priceXrp = rawNumber(row.price_xrp);
      if (priceXrp != null && priceXrp > 0) fields.xdxPerXrp = priceXrp;
      else if (xrpUsd != null && xrpUsd > 0) fields.xdxPerXrp = price / xrpUsd;
      return mapHistoryRow(row, fields);
    })
    .filter(Boolean);
}

export function rowsFromOhlc(payload, asset = "XDX") {
  const rows = Array.isArray(payload?.ohlc)
    ? payload.ohlc
    : Array.isArray(payload)
      ? payload
      : [];
  return rows
    .map((row) => {
      if (Array.isArray(row)) {
        const time = Number(row[0]);
        const close = Number(row[4] ?? row[1]);
        if (!Number.isFinite(time) || !(close > 0)) return null;
        const volume = Number(row[5] ?? row.volume ?? row.vol);
        return {
          timestamp: new Date(time > 1e12 ? time : time * 1000).toISOString(),
          price_usd: close,
          asset,
          volume: Number.isFinite(volume) && volume > 0 ? volume : null,
        };
      }
      const price = rawNumber(row?.price_usd ?? row?.price ?? row?.c);
      if (price == null) return null;
      return { ...row, price_usd: price, asset: row.asset || asset };
    })
    .filter(Boolean);
}

function priceTape(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node.price_history) && node.price_history.length) return node.price_history;
  if (Array.isArray(node.rows) && node.rows.length) return node.rows;
  if (Array.isArray(node.ohlc)) return rowsFromOhlc(node);
  return [];
}

/**
 * XDX price rows from the candles payload. `/api/chart/candles` nests the
 * ledger candles under `db` (next to the locked snapshot), so read both levels.
 * price_history and rows carry the same candles; take one of them, not both.
 */
export function xdxPriceHistoryRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : [...priceTape(payload), ...priceTape(payload?.db)];
  return rows.filter((row) => {
    const asset = String(row?.asset || row?.token || "XDX").toUpperCase();
    return !asset || asset === "XDX";
  });
}

function candlePrice(row) {
  const xrp = rawNumber(row?.price_xrp);
  if (xrp != null && xrp > 0) return xrp;
  const usd = rawNumber(row?.price_usd ?? row?.price);
  return usd != null && usd > 0 ? usd : null;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Hourly ledger candles average every fill in the hour, so a dust trade at a
 * silly price (89 XRP per XDX against a 0.0001 market) turns a candle into a
 * spike thousands of times the real price. Drop a candle that sits more than
 * `factor` times away from the median of its neighbours.
 */
export function dropPriceOutliers(rows, { window = 12, factor = 3 } = {}) {
  const list = (Array.isArray(rows) ? rows : [])
    .map((row) => ({ row, ts: rowTs(row), price: candlePrice(row) }))
    .filter((item) => item.ts != null)
    .sort((a, b) => a.ts - b.ts);
  const prices = list.map((item) => item.price);
  return list
    .filter((item, index) => {
      if (item.price == null) return false;
      const around = [];
      for (let j = Math.max(0, index - window); j <= Math.min(list.length - 1, index + window); j += 1) {
        if (j !== index && prices[j] != null) around.push(prices[j]);
      }
      if (around.length < 4) return true;
      const ref = median(around);
      return item.price <= ref * factor && item.price >= ref / factor;
    })
    .map((item) => item.row);
}

function dayKey(ms) {
  return Math.floor(ms / 86400000);
}

/** Daily XRP/USD closes from the locked snapshot, keyed by UTC day. */
export function xrpUsdByDay(locked) {
  const map = new Map();
  for (const row of Array.isArray(locked?.xrpUsd) ? locked.xrpUsd : []) {
    const t = Number(row?.t ?? row?.time ?? row?.timestamp);
    const close = rawNumber(row?.c ?? row?.close ?? row?.price);
    if (!Number.isFinite(t) || !(close > 0)) continue;
    map.set(dayKey(t < 1e12 ? t * 1000 : t), close);
  }
  return map;
}

/**
 * Ledger candles store USD at today's XRP rate. Where the snapshot has that
 * day's XRP/USD close, reprice from price_xrp so older history is in the USD of
 * its own day.
 */
export function repriceWithDailyXrpUsd(rows, byDay) {
  if (!byDay?.size) return rows;
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const priceXrp = rawNumber(row?.price_xrp);
    const ts = rowTs(row);
    if (priceXrp == null || !(priceXrp > 0) || ts == null) return row;
    const xrpUsd = byDay.get(dayKey(ts));
    if (!(xrpUsd > 0)) return row;
    return { ...row, price_usd: priceXrp * xrpUsd, price_usd_basis: "daily-xrp-usd" };
  });
}

/**
 * Locked Trading-chart daily closes as USD rows. The XDX/XRP candles are quoted
 * in XRP, so each close is multiplied by that day's XRP/USD close. A day with
 * no XRP/USD close is skipped rather than plotted in the wrong unit.
 */
export function rowsFromLockedCandles(locked, pair = "XDX/XRP") {
  const key = String(pair || "XDX/XRP").toUpperCase();
  const entry = locked?.pairs?.[key] || locked?.pairs?.[pair] || null;
  const candles = entry?.candles || (Array.isArray(locked) ? locked : []);
  const quote = String(entry?.quote || key.split("/")[1] || "").toUpperCase();
  const byDay = quote === "XRP" ? xrpUsdByDay(locked) : null;
  return (Array.isArray(candles) ? candles : [])
    .map((row) => {
      const t = Number(row?.t ?? row?.time ?? row?.timestamp);
      const close = rawNumber(row?.c ?? row?.price_usd ?? row?.price);
      if (!Number.isFinite(t) || !(close > 0)) return null;
      const ms = t < 1e12 ? t * 1000 : t;
      let priceUsd = close;
      let priceXrp = null;
      if (quote === "XRP") {
        const xrpUsd = byDay?.get(dayKey(ms));
        if (!(xrpUsd > 0)) return null;
        priceXrp = close;
        priceUsd = close * xrpUsd;
      }
      return {
        timestamp: new Date(ms).toISOString(),
        price_usd: priceUsd,
        ...(priceXrp != null ? { price_xrp: priceXrp } : {}),
        asset: "XDX",
        source: row?.source || "locked",
      };
    })
    .filter(Boolean);
}

function ammHistoryRows(rows, live) {
  const price = tokenDetailMetricNumber(live, "price");
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const pair = String(row.pool_name || row.pool || row.pair || "XDX/XRP")
        .replace(/\s+/g, "")
        .toUpperCase();
      if (pair && pair !== "XDX/XRP") return null;
      const usd = rawNumber(row.tvl_usd ?? row.ammMarketCap);
      const tvl = rawNumber(row.tvl);
      const reserve = rawNumber(row.reserve_asset ?? row.reserve_xdx);
      let ammMarketCap = usd;
      if (ammMarketCap == null && tvl != null) {
        ammMarketCap = tvl > 1_000_000 && price > 0 ? tvl * price : tvl;
      }
      if (ammMarketCap == null && reserve != null && price > 0) ammMarketCap = reserve * price;
      // Never treat a missing/empty AMM sample as LP supply zero.
      const lpSupply = levelSample(row.lp_supply ?? row.lpSupply);
      if (ammMarketCap == null && lpSupply == null) return null;
      return mapHistoryRow(row, {
        ...(ammMarketCap != null && ammMarketCap !== 0 ? { ammMarketCap } : {}),
        ...(lpSupply != null ? { lpSupply } : {}),
      });
    })
    .filter(Boolean);
}

/**
 * Aggregate LP chart scans. Partial per-pool snapshots must not become global zeros:
 * carry last known per pool, then sum across pools at each timestamp.
 */
export function aggregateLpChartRows(rows = []) {
  const byPool = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const pool = String(row.pool_name || row.pool || row.pair || "XDX/XRP")
      .replace(/\s+/g, "")
      .toUpperCase() || "XDX/XRP";
    const mapped = mapHistoryRow(row, {
      lpHolders: levelSample(row.lp_holder_count ?? row.lpHolders ?? row.holders),
      lpTrustlines: levelSample(row.trustline_count ?? row.lp_trustline_count ?? row.lpTrustlines),
      lpSupply: levelSample(row.lp_supply ?? row.lpSupply),
    });
    if (!mapped) continue;
    if (mapped.lpHolders == null && mapped.lpTrustlines == null && mapped.lpSupply == null) continue;
    const list = byPool.get(pool) || [];
    list.push(mapped);
    byPool.set(pool, list);
  }

  if (!byPool.size) return [];

  const carried = new Map();
  const allTs = new Set();
  for (const [pool, list] of byPool) {
    list.sort((a, b) => a.ts - b.ts);
    let last = { lpHolders: null, lpTrustlines: null, lpSupply: null };
    const series = [];
    for (const row of list) {
      if (row.lpHolders != null) last.lpHolders = row.lpHolders;
      if (row.lpTrustlines != null) last.lpTrustlines = row.lpTrustlines;
      if (row.lpSupply != null) last.lpSupply = row.lpSupply;
      series.push({
        ts: row.ts,
        timestamp: row.timestamp,
        lpHolders: last.lpHolders,
        lpTrustlines: last.lpTrustlines,
        lpSupply: last.lpSupply,
      });
      allTs.add(row.ts);
    }
    carried.set(pool, series);
  }

  const timestamps = [...allTs].sort((a, b) => a - b);
  const cursors = new Map([...carried.keys()].map((pool) => [pool, 0]));
  const lastByPool = new Map();
  const out = [];

  for (const ts of timestamps) {
    for (const [pool, series] of carried) {
      let index = cursors.get(pool) || 0;
      while (index < series.length && series[index].ts <= ts) {
        lastByPool.set(pool, series[index]);
        index += 1;
      }
      cursors.set(pool, index);
    }
    let lpHolders = null;
    let lpTrustlines = null;
    let lpSupply = null;
    for (const sample of lastByPool.values()) {
      if (!sample) continue;
      if (sample.lpHolders != null) lpHolders = (lpHolders || 0) + sample.lpHolders;
      if (sample.lpTrustlines != null) lpTrustlines = (lpTrustlines || 0) + sample.lpTrustlines;
      // LP supply is pool-scoped (XDX/XRP primary); prefer XDX/XRP, else first known.
      if (sample.lpSupply != null && lpSupply == null) lpSupply = sample.lpSupply;
    }
    if (lpHolders == null && lpTrustlines == null && lpSupply == null) continue;
    out.push({
      timestamp: new Date(ts).toISOString(),
      ts,
      ...(lpHolders != null ? { lpHolders } : {}),
      ...(lpTrustlines != null ? { lpTrustlines } : {}),
      ...(lpSupply != null ? { lpSupply } : {}),
    });
  }
  return out;
}

export function composeTokenDetailHistory({
  holders = [],
  trustlines = [],
  tvl = [],
  lpHolders = [],
  lpTrustlines = [],
  sparkline = [],
  candles = [],
  amm = [],
  lockedCandles = null,
  live = null,
} = {}) {
  const priceRows = repriceWithDailyXrpUsd(
    dropPriceOutliers(xdxPriceHistoryRows(candles)),
    xrpUsdByDay(lockedCandles)
  );
  const firstLedgerTs = priceRows.reduce((min, row) => {
    const ts = rowTs(row);
    return ts != null && ts < min ? ts : min;
  }, Infinity);
  // The locked daily tape only fills time before the ledger candles begin.
  const lockedRows = rowsFromLockedCandles(lockedCandles).filter((row) => rowTs(row) < firstLedgerTs);
  const sparkSource = priceRows.length || lockedRows.length ? [...lockedRows, ...priceRows] : sparkline;
  return carryTokenDetailMetrics(
    mergeTokenDetailRows(
      namedHistoryRows(holders, "holders"),
      namedHistoryRows(trustlines, "trustlines"),
      namedHistoryRows(lpHolders, "lpHolders"),
      aggregateLpChartRows(lpTrustlines),
      sparkMetricRows(sparkSource, live),
      ammHistoryRows(amm, live),
      ammHistoryRows(tvl, live),
      [liveTokenDetailTip(live)]
    )
  );
}

function isRealSample(row, metric) {
  return !(row?.__carried && row.__carried[metric]);
}

function gapBreak(ts) {
  return { timestamp: new Date(ts).toISOString(), ts, plot: null, gap: true };
}

/** Downsample each unbroken run on its own and join the runs with a null break. */
function joinSegments(segments, maxPoints) {
  const total = segments.reduce((sum, seg) => sum + seg.length, 0) || 1;
  const out = [];
  segments.forEach((seg, index) => {
    if (!seg.length) return;
    const share = maxPoints ? Math.max(2, Math.round((seg.length / total) * maxPoints)) : undefined;
    const thinned = collapseUnchangedPlot(share ? downsampleSeries(seg, share) : downsampleSeries(seg));
    if (index > 0 && out.length) {
      out.push(gapBreak(Math.round((out[out.length - 1].ts + thinned[0].ts) / 2)));
    }
    out.push(...thinned);
  });
  return out;
}

function windowedPriceSeries(all, range, now, metric) {
  // Only real price samples count. A value carried in from a holders row is not
  // a trade, so it may bridge short quiet spells but never a multi day hole.
  const real = all
    .map((row) => ({ row, value: tokenDetailMetricNumber(row, metric) }))
    .filter(({ row, value }) => value != null && isRealSample(row, metric))
    .map(({ row, value }) => ({ ...row, plot: value }));
  if (!real.length) return [];

  const windowMs = TOKEN_DETAIL_RANGE_MS[range];
  const start = range === "Max" || !windowMs ? -Infinity : now - windowMs;
  const inside = real.filter((row) => row.ts >= start && row.ts <= now);
  const lastBefore = [...real].reverse().find((row) => row.ts < start);
  const series = [...inside];
  if (lastBefore && Number.isFinite(start)) {
    const firstTs = series[0]?.ts ?? now;
    // Hold the last trade into the window only if the hold is a short one.
    if (firstTs - lastBefore.ts <= TOKEN_DETAIL_PRICE_GAP_MS) {
      series.unshift({ ...lastBefore, timestamp: new Date(start).toISOString(), ts: start });
    }
  } else if (
    series.length &&
    tokenDetailIsIntraday(range) &&
    Number.isFinite(start) &&
    series[0].ts > start
  ) {
    // Intraday windows only: start the line at the window edge from the first
    // trade inside it. This spans hours at most, never days.
    series.unshift({ ...series[0], timestamp: new Date(start).toISOString(), ts: start });
  }
  if (!series.length) return [];

  const segments = [[series[0]]];
  for (let i = 1; i < series.length; i += 1) {
    if (series[i].ts - series[i - 1].ts > TOKEN_DETAIL_PRICE_GAP_MS) segments.push([]);
    segments[segments.length - 1].push(series[i]);
  }
  return joinSegments(segments);
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
  if (tokenDetailShowsGaps(metric)) return windowedPriceSeries(all, range, now, metric);

  let lastKnown = null;
  const filled = all.map((row) => {
    let value = tokenDetailMetricNumber(row, metric);
    if (
      TOKEN_DETAIL_LP_METRICS.has(metric) &&
      value === 0 &&
      !row.__lpConfirmedEmpty
    ) {
      value = null;
    }
    if (value != null) lastKnown = value;
    return { ...row, plot: lastKnown };
  });
  const usable = filled.filter((row) => Number.isFinite(row.plot));
  if (!usable.length) return [];
  if (range === "Max") return collapseUnchangedPlot(downsampleSeries(usable));

  const windowMs = TOKEN_DETAIL_RANGE_MS[range];
  if (!windowMs) return downsampleSeries(usable);
  const start = now - windowMs;
  const inside = usable.filter((row) => row.ts >= start && row.ts <= now);
  const lastBefore = [...usable].reverse().find((row) => row.ts < start);
  const out = [...inside];
  if (lastBefore) {
    out.unshift({ ...lastBefore, timestamp: new Date(start).toISOString(), ts: start });
  } else if (out.length && out[0].ts > start) {
    // Fill empty left of the selected window for level metrics on intraday TFs
    // (even a single live tip becomes a flat step).
    if (tokenDetailIsIntraday(range)) {
      out.unshift({ ...out[0], timestamp: new Date(start).toISOString(), ts: start });
    }
  }
  return collapseUnchangedPlot(downsampleSeries(out.filter((row) => Number.isFinite(row.plot))));
}

export function tokenDetailYDomain(values) {
  const nums = (values || []).filter((value) => value != null && value !== "" && Number.isFinite(Number(value))).map(Number);
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

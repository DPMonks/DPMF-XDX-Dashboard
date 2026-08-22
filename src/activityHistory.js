export const ACTIVITY_PLOT_POINTS = 400;
export const RECENT_SCAN_DAYS = 14;

export function utcDayKey(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function rowsFromXrplToGraph(payload) {
  const history = Array.isArray(payload?.history)
    ? payload.history
    : Array.isArray(payload)
      ? payload
      : [];
  const rows = [];
  for (const point of history) {
    const ms = Number(point?.time ?? point?.timestamp);
    if (!Number.isFinite(ms)) continue;
    const timestamp = new Date(ms > 1e12 ? ms : ms * 1000).toISOString();
    const holders = Number(point?.holders);
    const trustlines = Number(point?.length ?? point?.trustlines);
    if (!(holders > 0) && !(trustlines > 0)) continue;
    rows.push({
      timestamp,
      holders: holders > 0 ? holders : null,
      holder_count: holders > 0 ? holders : null,
      trustlines: trustlines > 0 ? trustlines : null,
      trustline_count: trustlines > 0 ? trustlines : null,
      source: "issued",
    });
  }
  return rows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export function mergeActivityRows(...lists) {
  const merged = new Map();
  for (const list of lists) {
    for (const row of list || []) {
      if (!row || typeof row !== "object") continue;
      const timestamp = row.timestamp || row.day || row.date;
      if (!timestamp) continue;
      const iso = new Date(timestamp).toISOString();
      if (!Number.isFinite(new Date(iso).getTime())) continue;
      const current = merged.get(iso) || { timestamp: iso };
      const holders = Number(row.holders ?? row.holder_count);
      const trustlines = Number(row.trustlines ?? row.trustline_count);
      const traders = Number(row.traders ?? row.trader_count);
      if (Number.isFinite(holders) && holders > 0) {
        current.holders = holders;
        current.holder_count = holders;
      }
      if (Number.isFinite(trustlines) && trustlines > 0) {
        current.trustlines = trustlines;
        current.trustline_count = trustlines;
      }
      if (Number.isFinite(traders)) {
        current.traders = traders;
        current.trader_count = traders;
      }
      if (row.source && !current.source) current.source = row.source;
      merged.set(iso, current);
    }
  }
  return [...merged.values()].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
}

// XDX history only: xrpl.to issuance series plus a live tip. Do not merge
// token_holders_history scan timestamps — those are when rows entered our DB.
export function issuedActivitySeries(issuedRows, live = null) {
  const issued = Array.isArray(issuedRows) ? issuedRows : [];
  if (!live || typeof live !== "object") return mergeActivityRows(issued);
  const liveTs = new Date(live.timestamp || Date.now()).getTime();
  const last = issued[issued.length - 1];
  const lastTs = last ? new Date(last.timestamp).getTime() : 0;
  if (!Number.isFinite(liveTs)) return mergeActivityRows(issued);
  if (issued.length && Number.isFinite(lastTs) && liveTs < lastTs) {
    return mergeActivityRows(issued);
  }
  return mergeActivityRows(issued, [live]);
}

export function downsampleSeries(rows, maxPoints = ACTIVITY_PLOT_POINTS) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length <= maxPoints) return list;
  const out = [];
  const last = list.length - 1;
  const seen = new Set();
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round((i * last) / (maxPoints - 1));
    if (seen.has(index)) continue;
    seen.add(index);
    out.push(list[index]);
  }
  if (out[out.length - 1] !== list[last]) out.push(list[last]);
  return out;
}

export function dailyLastPoints(rows) {
  const byDay = new Map();
  for (const row of rows || []) {
    const key = utcDayKey(row.timestamp || row.ts || row.day);
    if (!key) continue;
    byDay.set(key, row);
  }
  return [...byDay.values()].sort((a, b) => {
    const left = new Date(a.timestamp || a.ts || a.day).getTime();
    const right = new Date(b.timestamp || b.ts || b.day).getTime();
    return left - right;
  });
}

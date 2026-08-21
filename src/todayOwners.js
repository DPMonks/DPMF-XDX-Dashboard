// Mirrors dpmf-xdx-indexer src/todayOwners.js (PR #5, 219e859).
// Dashboard stays SELECT-only. No Postgres import here so node --test can run.

export function utcDay(value = new Date()) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function asIso(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const asUtc = new Date(`${String(value).replace(" ", "T")}Z`);
  return Number.isNaN(asUtc.getTime()) ? null : asUtc.toISOString();
}

export function isSameUtcDay(value, today = utcDay()) {
  const day = utcDay(value);
  return Boolean(day && today && day === today);
}

export function wantsTodaySnapshot(query = {}) {
  const raw = String(
    typeof query.get === "function"
      ? query.get("snapshot") || query.get("as_of") || ""
      : query.snapshot ?? query.as_of ?? ""
  ).toLowerCase();
  return raw === "today" || raw === "1" || raw === "true";
}

export function currentOwners(holders) {
  return (holders || []).filter((row) => row?.account && Number(row.balance) > 0);
}

export function pickTodayOwnerSource({
  latestTs = null,
  latestCount = 0,
  historyTs = null,
  historyCount = 0,
  now = new Date(),
} = {}) {
  const today = utcDay(now);
  if (Number(latestCount) > 0 && latestTs && isSameUtcDay(latestTs, today)) {
    return { kind: "token_holders_latest", ts: latestTs, count: Number(latestCount), present: true };
  }
  if (Number(historyCount) > 0 && historyTs && isSameUtcDay(historyTs, today)) {
    return { kind: "token_holders_history", ts: historyTs, count: Number(historyCount), present: true };
  }
  const lastTs =
    [latestTs, historyTs]
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
  return { kind: "none", ts: lastTs, count: 0, present: false };
}

export function buildTodayOwnersPayload({ source, holders = [], offset = 0 } = {}) {
  const asOf = asIso(source?.ts);
  if (!source?.present) {
    return {
      holders: [],
      as_of: asOf,
      snapshot_day: utcDay(asOf),
      present: false,
      catching_up: true,
      count: 0,
      source: source?.kind || "none",
    };
  }

  return {
    holders: holders.map((row, index) => ({
      rank: Number(row.rank) || offset + index + 1,
      account: row.account,
      balance: Number(row.balance),
      frozen: Boolean(row.frozen),
    })),
    as_of: asOf,
    snapshot_day: utcDay(asOf),
    present: true,
    catching_up: false,
    count: Number(source.count || holders.length),
    source: source.kind,
  };
}

import {
  asIso,
  pickTodayOwnerSource,
  utcDay,
} from "./todayOwners.js";

export function normalizeLpPool(value) {
  const raw = String(value || "XDX/XRP")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "/");
  if (raw === "ALL" || raw === "*") return null;
  if (raw === "XRP") return "XDX/XRP";
  if (raw === "RLUSD") return "XDX/RLUSD";
  if (raw.startsWith("XDX/")) return raw;
  return `XDX/${raw}`;
}

export function remapLpSourceKind(kind) {
  if (kind === "token_holders_latest") return "lp_holders_latest";
  if (kind === "token_holders_history") return "lp_holders_history";
  return kind || "none";
}

export function buildTodayLpOwnersPayload({
  source,
  holders = [],
  offset = 0,
  pool = "XDX/XRP",
} = {}) {
  const asOf = asIso(source?.ts);
  const mapRow = (row, index) => {
    const lp = Number(row.lp_balance ?? row.balance);
    return {
      rank: Number(row.rank) || offset + index + 1,
      account: row.account,
      lp_balance: lp,
      balance: lp,
      frozen: Boolean(row.frozen),
      pool_name: row.pool_name || pool,
    };
  };

  if (!source?.present) {
    return {
      holders: [],
      as_of: asOf,
      snapshot_day: utcDay(asOf),
      present: false,
      catching_up: true,
      count: 0,
      source: source?.kind || "none",
      pool,
    };
  }

  return {
    holders: holders.map(mapRow),
    as_of: asOf,
    snapshot_day: utcDay(asOf),
    present: true,
    catching_up: false,
    count: Number(source.count || holders.length),
    source: source.kind,
    pool,
  };
}

export function pickTodayLpSource(input) {
  const picked = pickTodayOwnerSource(input);
  return {
    ...picked,
    kind: remapLpSourceKind(picked.kind),
  };
}

export function pickAllPoolCount(latestCount, historyCount) {
  const latest = Number(latestCount) || 0;
  const history = Number(historyCount) || 0;
  return history > latest ? history : latest;
}

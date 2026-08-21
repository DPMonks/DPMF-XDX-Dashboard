import pg from "pg";
import {
  issuerLockedFromIssued,
  XDX_ISSUER,
  XDX_RLUSD_AMM,
  XDX_TOTAL_SUPPLY,
  XDX_XRP_AMM,
} from "../src/constants/ledger.js";
import {
  looksLikeXrpUsd,
  pickTrustlineCount,
  recordedXdxUsdFromPrices,
  xrpPerXdx,
} from "../src/utils/recordedPrice.js";
import {
  asIso,
  buildTodayOwnersPayload,
  isSameUtcDay,
  pickTodayOwnerSource,
  utcDay,
  wantsTodaySnapshot,
} from "../src/todayOwners.js";

let pool = null;

// Same XDX-only tables the live indexer SELECTs. This process never imports
// startIndexer and never starts or resets workers (those have staggered delays).
const CATALOG = {
  status: "online",
  service: "XRPL Indexer",
  source: "db",
  note: "Read-only SELECT on XDX tables. Workers were not started or reset.",
  endpoints: {
    health: "/health",
    overview: "/api/overview",
    amm: "/api/amm",
    pools: "/api/pools",
    topHolders: "/api/top-holders",
    topHoldersToday: "/api/top-holders?snapshot=today",
    topHoldersV2: "/api/top-holders-v2",
    topLp: "/api/top-lp",
    holdersCount: "/api/holders/count",
    holdersCountToday: "/api/holders/count?snapshot=today",
    trustlinesCount: "/api/trustlines/count",
    lpHoldersCount: "/api/lp-holders/count",
    tvlHistory: "/api/charts/tvl",
    holdersHistory: "/api/charts/holders",
    lpHoldersHistory: "/api/charts/lp-holders",
    trustlinesHistory: "/api/charts/trustlines",
    activityHistory: "/api/charts/activity",
    tradersHistory: "/api/charts/traders",
    trades: "/api/trades",
    xdxFlows: "/api/xdx-flows",
    walletBalances: "/api/wallet/balances/:address",
    prices: "/api/prices",
    priceChange: "/api/prices/change24h",
    networth: "/api/wallet/networth/:address",
    sparkline: "/api/sparkline/:asset",
    issuerLocked: "/api/issuer-locked",
  },
};

function rawDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function separatePassword() {
  return process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || "";
}

export function applyConnectionOverrides(raw) {
  const password = separatePassword();
  const user = process.env.PGUSER || "";
  const host = process.env.PGHOST || "";
  const port = process.env.PGPORT || "";
  const dbname = process.env.PGDATABASE || "";
  if (!raw && host) {
    const authUser = encodeURIComponent(user || "postgres");
    const auth = password
      ? `${authUser}:${encodeURIComponent(password)}`
      : authUser;
    return `postgres://${auth}@${host}:${port || "5432"}/${dbname || "railway"}`;
  }
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const decode = (value, fallback) => {
      try {
        return decodeURIComponent(value || "") || fallback;
      } catch {
        return value || fallback;
      }
    };
    const finalUser = user || decode(url.username, "postgres");
    const finalPass = password || decode(url.password, "");
    const finalHost = host || url.hostname;
    const finalPort = port || url.port || "5432";
    const finalDb = dbname || url.pathname.replace(/^\//, "") || "railway";
    const auth = finalPass
      ? `${encodeURIComponent(finalUser)}:${encodeURIComponent(finalPass)}`
      : encodeURIComponent(finalUser);
    return sanitizeDatabaseUrl(
      `postgres://${auth}@${finalHost}:${finalPort}/${finalDb}${url.search}`
    );
  } catch {
    return raw;
  }
}

export function databaseUrlKind() {
  const raw = rawDatabaseUrl().trim();
  if (/^postgres(ql)?:\/\//i.test(raw)) return "postgres";
  if (process.env.PGHOST && separatePassword()) return "postgres";
  if (!raw) return "missing";
  if (/^https?:\/\//i.test(raw)) return "http";
  return "invalid";
}

function databaseUrl() {
  return databaseUrlKind() === "postgres"
    ? applyConnectionOverrides(rawDatabaseUrl().trim())
    : "";
}

export function hasIndexerDatabase() {
  return databaseUrlKind() === "postgres";
}

export function databaseUrlHint() {
  const kind = databaseUrlKind();
  if (kind === "http") {
    return "DATABASE_URL is the indexer HTTP host (*.up.railway.app). That belongs in VITE_API_BASE only. DATABASE_URL must be postgres://USER:PASS@HOST:PORT/DB for the public TCP proxy, with no ?sslmode=require.";
  }
  if (kind === "invalid") {
    return "DATABASE_URL is set but is not a postgres:// connection string.";
  }
  if (kind === "missing") {
    return "DATABASE_URL is unset on this Vercel deploy. In DPMF-XDX-Dashboard → Settings → Environment Variables, add postgres://USER:PASS@acela.proxy.rlwy.net:48994/railway for Preview AND Production (no VITE_, no ?sslmode=require), then Redeploy this preview.";
  }
  return "";
}

const VERIFY_SSLMODES = new Set(["require", "verify-full", "verify-ca"]);

function decodePart(value, fallback = "") {
  try {
    return decodeURIComponent(value || "") || fallback;
  } catch {
    return value || fallback;
  }
}

// Railway's public TCP proxy presents a cert chain node-pg rejects when the
// URL (or PGSSLMODE) is sslmode=require. That flag is parsed AFTER Pool.ssl
// and overwrites rejectUnauthorized:false. Strip it. Keep no-verify only when
// another query param is still required.
export function sanitizeDatabaseUrl(raw) {
  if (!raw) return "";
  const text = String(raw);
  try {
    const url = new URL(text);
    const mode = String(url.searchParams.get("sslmode") || "").toLowerCase();
    if (VERIFY_SSLMODES.has(mode)) url.searchParams.delete("sslmode");
    const ssl = String(url.searchParams.get("ssl") || "").toLowerCase();
    if (ssl === "true" || ssl === "1" || ssl === "require") {
      url.searchParams.delete("ssl");
    }
    if (!url.searchParams.size) {
      url.search = "";
      return url.toString();
    }
    if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "no-verify");
    return url.toString();
  } catch {
    let next = text.replace(/[?&]sslmode=(require|verify-full|verify-ca)\b/gi, "");
    next = next.replace(/[?&]ssl=(true|1|require)\b/gi, "");
    next = next.replace(/\?&/, "?").replace(/[?&]$/, "");
    if (next.includes("?") && !/[?&]sslmode=/i.test(next)) {
      next += `${next.includes("?") ? "&" : "?"}sslmode=no-verify`;
    }
    return next;
  }
}

export function postgresPoolOptions(raw) {
  const connectionString = sanitizeDatabaseUrl(raw);
  const ssl = { rejectUnauthorized: false };
  try {
    const url = new URL(connectionString);
    const password = decodePart(url.password);
    return {
      host: decodePart(url.hostname),
      port: Number(url.port || 5432),
      user: decodePart(url.username, "postgres"),
      ...(password ? { password } : {}),
      database: decodePart(url.pathname.replace(/^\//, ""), "railway"),
      ssl,
      max: 2,
    };
  } catch {
    return { connectionString, ssl, max: 2 };
  }
}

function safePgMessage(error) {
  return String(error?.message || "Postgres error")
    .replace(/:[^:@/]+@/g, ":***@")
    .replace(/password=[^&\s]+/gi, "password=***");
}

function isConnectError(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "ECONNREFUSED" ||
    error?.code === "ENOTFOUND" ||
    error?.code === "ETIMEDOUT" ||
    /ssl|certificate|self-signed|pg_hba|password authentication|timeout/i.test(
      message
    )
  );
}

function connectHint(error) {
  const message = safePgMessage(error);
  if (/password authentication failed/i.test(message)) {
    return "Postgres rejected the password. On Vercel set POSTGRES_PASSWORD to the Railway Postgres password (plain text, no URL encoding) and keep DATABASE_URL as postgres://postgres@acela.proxy.rlwy.net:48994/railway with no password and no ?sslmode=require. Preview + Production, then Redeploy. Password is not logged.";
  }
  if (/ssl|certificate|self-signed/i.test(message)) {
    return "Postgres TLS failed. DATABASE_URL must not use sslmode=require (Railway proxy cert). Use no query param or sslmode=no-verify. Password is not logged.";
  }
  return "Postgres connect failed. Check host acela.proxy.rlwy.net:48994, user postgres, database railway, and the current password. Password is not logged.";
}

function logDbError(error) {
  console.error("Indexer Postgres failed (password redacted)", {
    code: error?.code || null,
    message: safePgMessage(error),
  });
}

function getPool() {
  const raw = databaseUrl();
  if (!raw) return null;
  if (!pool) {
    if (VERIFY_SSLMODES.has(String(process.env.PGSSLMODE || "").toLowerCase())) {
      process.env.PGSSLMODE = "no-verify";
    }
    pool = new pg.Pool(postgresPoolOptions(raw));
    pool.on("error", (error) => logDbError(error));
  }
  return pool;
}

function ok(body) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
    source: "postgres",
  };
}

function searchParams(search) {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

async function tryQuery(db, sql, params) {
  try {
    return await db.query(sql, params);
  } catch (error) {
    if (isConnectError(error)) {
      logDbError(error);
      throw error;
    }
    return { rows: [] };
  }
}

async function lastSameTimeScan(db, table) {
  const stamp = await tryQuery(
    db,
    `SELECT MAX(timestamp) AS ts
     FROM ${table}
     WHERE ABS(balance::numeric) > 0`
  );
  const ts = stamp.rows[0]?.ts || null;
  if (!ts) return { ts: null, count: 0 };
  const count = await tryQuery(
    db,
    `SELECT COUNT(*)::int AS n
     FROM ${table}
     WHERE timestamp = $1 AND ABS(balance::numeric) > 0`,
    [ts]
  );
  return { ts, count: Number(count.rows[0]?.n || 0) };
}

async function pageSameTimeScan(db, table, ts, limit, offset) {
  const withFrozen = await tryQuery(
    db,
    `SELECT ROW_NUMBER() OVER (ORDER BY ABS(balance::numeric) DESC) AS rank,
            account,
            ABS(balance::numeric) AS balance,
            COALESCE(frozen, false) AS frozen,
            timestamp
     FROM ${table}
     WHERE timestamp = $1 AND ABS(balance::numeric) > 0
     ORDER BY ABS(balance::numeric) DESC
     LIMIT $2 OFFSET $3`,
    [ts, limit, offset]
  );
  if (withFrozen.rows.length) return withFrozen.rows;
  const plain = await tryQuery(
    db,
    `SELECT ROW_NUMBER() OVER (ORDER BY ABS(balance::numeric) DESC) AS rank,
            account,
            ABS(balance::numeric) AS balance,
            timestamp
     FROM ${table}
     WHERE timestamp = $1 AND ABS(balance::numeric) > 0
     ORDER BY ABS(balance::numeric) DESC
     LIMIT $2 OFFSET $3`,
    [ts, limit, offset]
  );
  return plain.rows;
}

async function loadTodayOwners(db, { limit = 200, offset = 0, includeHolders = true } = {}) {
  // SELECT-only: if origin/main TRUNCATEd latest, serve the same-time history
  // scan (235 XDX accounts when last probed). Do not INSERT/hydrate writes.
  const latest = await lastSameTimeScan(db, "token_holders_latest");
  const history = await lastSameTimeScan(db, "token_holders_history");

  const source = pickTodayOwnerSource({
    latestTs: latest.ts,
    latestCount: latest.count,
    historyTs: history.ts,
    historyCount: history.count,
  });

  let holders = [];
  if (includeHolders && source.present) {
    holders = await pageSameTimeScan(db, source.kind, source.ts, limit, offset);
  }

  return buildTodayOwnersPayload({ source, holders, offset });
}

function mapHolderRows(rows, offset, asOf) {
  return rows.map((row, index) => ({
    rank: Number(row.rank) || offset + index + 1,
    account: row.account,
    balance: Number(row.balance),
    frozen: Boolean(row.frozen),
    updated: row.timestamp || row.updated || asOf || null,
  }));
}

function freshnessOf(asOf, { liveTable = false, todayOnly = false } = {}) {
  const iso = asIso(asOf);
  const snapshotDay = utcDay(iso);
  const today = utcDay();
  if (!iso) {
    return {
      as_of: null,
      snapshot_day: liveTable ? today : null,
      present: liveTable,
      catching_up: !liveTable,
      age_seconds: null,
    };
  }
  const ageMs = Date.now() - new Date(iso).getTime();
  const present = todayOnly
    ? isSameUtcDay(iso, today)
    : ageMs >= 0 && ageMs <= 36 * 3600 * 1000;
  return {
    as_of: iso,
    snapshot_day: snapshotDay,
    present,
    catching_up: !present,
    age_seconds: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 1000)) : null,
  };
}

async function probeCountAsOf(db, sqls) {
  for (const sql of sqls) {
    const result = await tryQuery(db, sql);
    const row = result.rows[0];
    if (!row) continue;
    return {
      count: Number(row.count || 0),
      as_of: row.as_of || null,
    };
  }
  return { count: 0, as_of: null };
}

async function pickHolderSource(db, { todayOnly = false } = {}) {
  const latest = await probeCountAsOf(db, [
    `SELECT COUNT(*) FILTER (WHERE ABS(balance::numeric) > 0) AS count,
            MAX(timestamp) AS as_of
     FROM token_holders_latest`,
    `SELECT COUNT(*) FILTER (WHERE ABS(balance::numeric) > 0) AS count,
            MAX(updated_at) AS as_of
     FROM token_holders_latest`,
    `SELECT COUNT(*) AS count, NULL::timestamptz AS as_of
     FROM token_holders_latest
     WHERE ABS(balance::numeric) > 0`,
  ]);
  const history = await probeCountAsOf(db, [
    `SELECT COUNT(*) FILTER (WHERE ABS(balance::numeric) > 0) AS count,
            MAX(timestamp) AS as_of
     FROM token_holders_history
     WHERE timestamp = (SELECT MAX(timestamp) FROM token_holders_history)`,
  ]);
  const latestTs = latest.as_of ? new Date(latest.as_of).getTime() : 0;
  const historyTs = history.as_of ? new Date(history.as_of).getTime() : 0;
  const historyFresh = freshnessOf(history.as_of);

  if (todayOnly) {
    const today = await loadTodayOwners(db, { includeHolders: false });
    return {
      kind: today.source,
      count: today.count,
      as_of: today.as_of,
      snapshot_day: today.snapshot_day,
      present: today.present,
      catching_up: today.catching_up,
    };
  }

  if (latest.count > 0 && latestTs && (!historyTs || latestTs >= historyTs)) {
    return {
      kind: "token_holders_latest",
      count: latest.count,
      ...freshnessOf(latest.as_of, { liveTable: true }),
    };
  }
  if (history.count > 0 && historyTs && (!latestTs || historyTs > latestTs)) {
    if (!latestTs && latest.count > 0 && historyFresh.catching_up) {
      return {
        kind: "token_holders_latest",
        count: latest.count,
        ...freshnessOf(null, { liveTable: true }),
      };
    }
    return {
      kind: "token_holders_history",
      count: history.count,
      ...historyFresh,
    };
  }
  if (latest.count > 0) {
    return {
      kind: "token_holders_latest",
      count: latest.count,
      ...freshnessOf(latest.as_of, { liveTable: true }),
    };
  }
  return { kind: "none", count: 0, ...freshnessOf(null) };
}

async function freshTokenHolders(db, limit, offset, options = {}) {
  const source = await pickHolderSource(db, options);
  let rows = [];

  if (source.kind === "token_holders_latest") {
    const withTs = await tryQuery(
      db,
      `SELECT account, ABS(balance::numeric) AS balance, timestamp
       FROM token_holders_latest
       WHERE ABS(balance::numeric) > 0
       ORDER BY ABS(balance::numeric) DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    rows = withTs.rows;
    if (!rows.length) {
      const plain = await tryQuery(
        db,
        `SELECT account, ABS(balance::numeric) AS balance
         FROM token_holders_latest
         WHERE ABS(balance::numeric) > 0
         ORDER BY ABS(balance::numeric) DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      rows = plain.rows;
    }
  } else if (source.kind === "token_holders_history") {
    const snapshot = await tryQuery(
      db,
      `SELECT account, ABS(balance::numeric) AS balance, timestamp
       FROM token_holders_history
       WHERE timestamp = (SELECT MAX(timestamp) FROM token_holders_history)
         AND ABS(balance::numeric) > 0
       ORDER BY ABS(balance::numeric) DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    rows = snapshot.rows;
  }

  return {
    holders: mapHolderRows(rows, offset, source.as_of),
    as_of: source.as_of,
    snapshot_day: source.snapshot_day || utcDay(source.as_of),
    source: source.kind,
    present: source.present,
    catching_up: source.catching_up,
    age_seconds: source.age_seconds,
    count: source.count,
  };
}

async function tokenHolderCount(db) {
  const source = await pickHolderSource(db);
  return source.count;
}

async function tokenTrustlineSnapshot(db) {
  const latest = await tryQuery(
    db,
    `SELECT COUNT(*)::int AS count, MAX(timestamp) AS as_of
     FROM token_holders_latest`
  );
  const history = await tryQuery(
    db,
    `SELECT COUNT(*)::int AS count, MAX(timestamp) AS as_of
     FROM token_holders_history
     WHERE timestamp = (SELECT MAX(timestamp) FROM token_holders_history)`
  );
  const historyCount = Number(history.rows[0]?.count || 0);
  const latestCount = Number(latest.rows[0]?.count || 0);
  const count = pickTrustlineCount(latestCount, historyCount);
  const asOf = historyCount > 0 ? history.rows[0]?.as_of : latest.rows[0]?.as_of;
  return { count, as_of: asIso(asOf) };
}

async function tokenTrustlineCount(db) {
  return (await tokenTrustlineSnapshot(db)).count;
}

async function tokenHoldersPage(db, limit, offset, options = {}) {
  const page = options.todayOnly
    ? await loadTodayOwners(db, { limit, offset, includeHolders: true })
    : await freshTokenHolders(db, limit, offset, options);
  return {
    ...page,
    rows: page.holders,
  };
}

const NON_TRADER_ACCOUNTS = [XDX_ISSUER, XDX_XRP_AMM, XDX_RLUSD_AMM];

async function nativeSnapshotSeries(db) {
  const scans = await tryQuery(
    db,
    `SELECT timestamp,
            COUNT(*) FILTER (WHERE ABS(balance::numeric) > 0) AS holders,
            COUNT(*) AS trustlines
     FROM token_holders_history
     GROUP BY timestamp
     ORDER BY timestamp`
  );
  const scanMax = Math.max(0, ...scans.rows.map((row) => Number(row.holders || 0)));
  if (scans.rows.length && scanMax >= 10) return scans.rows;

  const daily = await tryQuery(
    db,
    `SELECT day AS timestamp, holder_count AS holders, NULL::numeric AS trustlines
     FROM holders_history
     ORDER BY day`
  );
  return daily.rows;
}

async function nativeTraderSeries(db) {
  const hourly = await tryQuery(
    db,
    `WITH ordered AS (
       SELECT account, timestamp, ABS(balance::numeric) AS balance,
              LAG(ABS(balance::numeric)) OVER (PARTITION BY account ORDER BY timestamp) AS prev
       FROM token_holders_history
       WHERE account <> ALL($1::text[])
     )
     SELECT date_trunc('hour', timestamp) AS timestamp,
            COUNT(DISTINCT account) FILTER (WHERE prev IS NOT NULL AND balance <> prev) AS traders,
            COUNT(*) FILTER (WHERE prev IS NOT NULL AND balance > prev) AS buys,
            COUNT(*) FILTER (WHERE prev IS NOT NULL AND balance < prev) AS sells,
            COALESCE(SUM(ABS(balance - prev)) FILTER (WHERE prev IS NOT NULL AND balance <> prev), 0) AS volume
     FROM ordered
     GROUP BY 1
     ORDER BY 1`,
    [NON_TRADER_ACCOUNTS]
  );
  return hourly.rows;
}

async function nativeActivitySeries(db) {
  const [snaps, traders, holders, trustlines] = await Promise.all([
    nativeSnapshotSeries(db),
    nativeTraderSeries(db),
    tokenHolderCount(db),
    tokenTrustlineCount(db),
  ]);
  const merged = new Map();
  for (const row of snaps) {
    if (!row.timestamp) continue;
    const timestamp = new Date(row.timestamp).toISOString();
    merged.set(timestamp, {
      timestamp,
      holders: Number(row.holders || 0) || null,
      trustlines: Number(row.trustlines || 0) || null,
    });
  }
  for (const row of traders) {
    if (!row.timestamp) continue;
    const timestamp = new Date(row.timestamp).toISOString();
    const current = merged.get(timestamp) || { timestamp };
    current.traders = Number(row.traders || 0);
    current.buys = Number(row.buys || 0);
    current.sells = Number(row.sells || 0);
    current.volume = Number(row.volume || 0);
    merged.set(timestamp, current);
  }
  merged.set(new Date().toISOString(), {
    timestamp: new Date().toISOString(),
    holders,
    trustlines,
  });
  return [...merged.values()].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
}

async function nativeXdxFlows(db) {
  const result = await tryQuery(
    db,
    `WITH ordered AS (
       SELECT account, timestamp, ABS(balance::numeric) AS balance,
              LAG(ABS(balance::numeric)) OVER (PARTITION BY account ORDER BY timestamp) AS prev
       FROM token_holders_history
       WHERE account <> ALL($1::text[])
     )
     SELECT timestamp, account, balance, (balance - prev) AS delta
     FROM ordered
     WHERE prev IS NOT NULL AND ABS(balance - prev) > 1e-8
     ORDER BY timestamp DESC
     LIMIT 500`,
    [NON_TRADER_ACCOUNTS]
  );
  return result.rows.map((row) => ({
    timestamp: row.timestamp,
    account: row.account,
    side: Number(row.delta) > 0 ? "buy" : "sell",
    xdx: Math.abs(Number(row.delta || 0)),
    balance: Number(row.balance || 0),
  }));
}

const ISSUER_POLL_MS = 30_000;
let issuerLockedCache = { at: 0, issued: 0, locked: 0, source: null, as_of: null };

async function issuedXdxFromHolders(db) {
  const history = await tryQuery(
    db,
    `SELECT COALESCE(SUM(ABS(balance::numeric)), 0) AS issued
     FROM token_holders_history
     WHERE timestamp = (SELECT MAX(timestamp) FROM token_holders_history)
       AND ABS(balance::numeric) > 0
       AND account <> $1`,
    [XDX_ISSUER]
  );
  const latest = await tryQuery(
    db,
    `SELECT COALESCE(SUM(ABS(balance::numeric)), 0) AS issued
     FROM token_holders_latest
     WHERE ABS(balance::numeric) > 0
       AND account <> $1`,
    [XDX_ISSUER]
  );
  const historyIssued = Number(history.rows[0]?.issued || 0);
  const latestIssued = Number(latest.rows[0]?.issued || 0);
  return historyIssued > 0 ? historyIssued : latestIssued;
}

async function issuedXdxFromIssuerAccount() {
  const url = process.env.XRPL_STATE_URL || "https://s1.ripple.com";
  const res = await fetch(url, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      method: "gateway_balances",
      params: [{ account: XDX_ISSUER, ledger_index: "validated", hotwallet: [] }],
    }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`issuer gateway_balances HTTP ${res.status}`);
  const body = await res.json();
  const issued = Number(body?.result?.obligations?.XDX || 0);
  if (!(issued > 0)) throw new Error("issuer obligation empty");
  return issued;
}

async function loadIssuerLocked(db) {
  if (Date.now() - issuerLockedCache.at < ISSUER_POLL_MS && issuerLockedCache.locked > 0) {
    return issuerLockedCache;
  }
  let issued;
  let source;
  try {
    issued = await issuedXdxFromIssuerAccount();
    source = "issuer";
  } catch {
    issued = db ? await issuedXdxFromHolders(db) : 0;
    source = "db";
  }
  const locked = issuerLockedFromIssued(issued);
  issuerLockedCache = {
    at: Date.now(),
    issued,
    locked,
    source,
    as_of: new Date().toISOString(),
  };
  return issuerLockedCache;
}

async function tokenBalanceFor(db, address) {
  const latest = await tryQuery(
    db,
    "SELECT balance FROM token_holders_latest WHERE account = $1 LIMIT 1",
    [address]
  );
  if (latest.rows[0]) return Number(latest.rows[0].balance || 0);
  const history = await tryQuery(
    db,
    `SELECT balance
     FROM token_holders_history
     WHERE account = $1
     ORDER BY timestamp DESC
     LIMIT 1`,
    [address]
  );
  return Number(history.rows[0]?.balance || 0);
}

let xrpQuote = { at: 0, usd: 0, gbp: 0 };

async function loadXrpQuote(db) {
  if (Date.now() - xrpQuote.at < 300_000 && xrpQuote.usd) return xrpQuote;
  const latest = await tryQuery(
    db,
    `SELECT price_usd, price_gbp FROM price_latest
     WHERE asset IN ('XRP', 'xrp')
     ORDER BY timestamp DESC NULLS LAST
     LIMIT 1`
  );
  const all = await tryQuery(
    db,
    `SELECT price_usd, price_gbp FROM price_latest_all
     WHERE currency IN ('XRP', 'xrp')
     ORDER BY timestamp DESC NULLS LAST
     LIMIT 1`
  );
  const hist = await tryQuery(
    db,
    `SELECT price_usd FROM price_history
     WHERE asset IN ('XRP', 'xrp')
     ORDER BY timestamp DESC LIMIT 1`
  );
  const row = latest.rows[0] || all.rows[0] || {};
  let usd = Number(row.price_usd || hist.rows[0]?.price_usd || 0);
  let gbp = Number(row.price_gbp || 0);
  if (!looksLikeXrpUsd(usd)) usd = 0;
  if (!usd) {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd,gbp",
        { signal: AbortSignal.timeout(2500) }
      );
      const body = await res.json();
      usd = Number(body?.ripple?.usd || 0);
      gbp = Number(body?.ripple?.gbp || 0);
    } catch {
      usd = usd || 0;
    }
  }
  xrpQuote = { at: Date.now(), usd, gbp };
  return xrpQuote;
}

async function loadRecordedXdxUsd(db, xrpUsd) {
  const latestCol = await tryQuery(
    db,
    `SELECT xdx_usd FROM price_latest
     ORDER BY timestamp DESC NULLS LAST
     LIMIT 1`
  );
  const fromLatest = recordedXdxUsdFromPrices(
    { recorded_price: latestCol.rows[0]?.xdx_usd, xdxUsd: latestCol.rows[0]?.xdx_usd, xrpUsd },
    xrpUsd
  );
  if (fromLatest > 0) return fromLatest;

  const latestAsset = await tryQuery(
    db,
    `SELECT price_usd FROM price_latest
     WHERE asset IN ('XDX', 'xdx')
     ORDER BY timestamp DESC NULLS LAST
     LIMIT 1`
  );
  const all = await tryQuery(
    db,
    `SELECT price_usd FROM price_latest_all
     WHERE currency IN ('XDX', 'xdx')
     ORDER BY timestamp DESC NULLS LAST
     LIMIT 1`
  );
  const hist = await tryQuery(
    db,
    `SELECT price_usd FROM price_history
     WHERE asset IN ('XDX', 'xdx')
     ORDER BY timestamp DESC
     LIMIT 1`
  );
  return recordedXdxUsdFromPrices(
    {
      xdxUsd:
        latestAsset.rows[0]?.price_usd ||
        all.rows[0]?.price_usd ||
        hist.rows[0]?.price_usd ||
        0,
      xrpUsd,
    },
    xrpUsd
  );
}

async function hydrateAmm(db) {
  const latest = await tryQuery(
    db,
    `SELECT * FROM amm_pool_latest WHERE pool_name = 'XDX/XRP' LIMIT 1`
  );
  const row = { ...(latest.rows[0] || {}) };
  if (!(Number(row.reserve_currency) > 0)) {
    const hist = await tryQuery(
      db,
      `SELECT reserve_asset, reserve_currency, lp_supply, price, timestamp
       FROM amm_pool_history
       WHERE pool_name = 'XDX/XRP' AND reserve_currency::numeric > 0
       ORDER BY timestamp DESC
       LIMIT 1`
    );
    if (hist.rows[0]) {
      row.reserve_currency = hist.rows[0].reserve_currency;
      if (!Number(row.reserve_asset)) row.reserve_asset = hist.rows[0].reserve_asset;
      if (!Number(row.price)) row.price = hist.rows[0].price;
      row.reserve_source = "amm_pool_history";
    }
  }
  return row;
}

function poolKey(row, fallback) {
  return String(row?.amm_account || row?.pool_name || row?.pool || fallback || "").toLowerCase();
}

function poolTvlUsd(name, asset, quote, xdxUsd, xrpUsd) {
  if (/\/XRP$/i.test(String(name || "")) && quote > 0 && xrpUsd > 0) {
    return quote * 2 * xrpUsd;
  }
  if (asset > 0 && xdxUsd > 0) return asset * 2 * xdxUsd;
  return 0;
}

function presentPool(row, xdxUsd, xrpUsd) {
  const reserveAsset = Number(row.reserve_asset || 0);
  const reserveCurrency = Number(row.reserve_currency || 0);
  const name = row.pool_name || row.pool || "XDX/XRP";
  const tvl = poolTvlUsd(name, reserveAsset, reserveCurrency, xdxUsd, xrpUsd);
  return {
    pool: name,
    pool_name: name,
    amm_account: row.amm_account || row.amm || null,
    tvl,
    tvl_usd: tvl,
    price: xdxUsd,
    reserve_asset: reserveAsset,
    reserve_currency: reserveCurrency,
    lp_supply: Number(row.lp_supply || 0),
    trading_fee: Number(row.trading_fee || 0) || null,
    apr: Number(row.apr || 0) || null,
    volume24h: Number(row.volume24h || row.volume_24h || 0) || null,
    updated: row.timestamp || row.updated || null,
  };
}

async function listXdxPools(db) {
  const latest = await tryQuery(db, "SELECT * FROM amm_pool_latest");
  const history = await tryQuery(
    db,
    `SELECT pool_name, reserve_asset, reserve_currency, lp_supply, price, timestamp
     FROM amm_pool_history
     ORDER BY timestamp DESC
     LIMIT 4000`
  );
  const byKey = new Map();

  const take = (row, overwrite) => {
    let key = poolKey(row);
    if (!key) {
      key = `anon-${byKey.size}-${Number(row.reserve_asset || 0)}-${Number(row.lp_supply || 0)}`;
    }
    const prev = byKey.get(key);
    if (!prev || overwrite) {
      byKey.set(key, { ...prev, ...row });
      return;
    }
    const next = { ...prev };
    if (!(Number(next.reserve_asset) > 0) && Number(row.reserve_asset) > 0) {
      next.reserve_asset = row.reserve_asset;
    }
    if (!(Number(next.reserve_currency) > 0) && Number(row.reserve_currency) > 0) {
      next.reserve_currency = row.reserve_currency;
    }
    if (!(Number(next.lp_supply) > 0) && Number(row.lp_supply) > 0) {
      next.lp_supply = row.lp_supply;
    }
    if (!(Number(next.price) > 0) && Number(row.price) > 0) {
      next.price = row.price;
    }
    byKey.set(key, next);
  };

  for (const row of latest.rows) take(row, true);
  for (const row of history.rows) {
    const key = poolKey(row);
    if (!key) continue;
    if (!byKey.has(key)) take(row, true);
    else take(row, false);
  }

  return [...byKey.values()];
}

function inferTradesFromHistory(rows) {
  const prev = new Map();
  const trades = [];
  for (const row of rows) {
    const key = String(row.pool_name || row.pool || "pool");
    const asset = Number(row.reserve_asset || 0);
    const quote = Number(row.reserve_currency || 0);
    const last = prev.get(key);
    if (last) {
      const dAsset = asset - last.asset;
      const dQuote = quote - last.quote;
      if (Math.abs(dAsset) > 1e-8 || Math.abs(dQuote) > 1e-8) {
        const side = dAsset < 0 ? "buy" : dAsset > 0 ? "sell" : dQuote > 0 ? "buy" : "sell";
        trades.push({
          timestamp: row.timestamp,
          pool: key,
          side,
          xdx: Math.abs(dAsset),
          quote: Math.abs(dQuote),
          price: Number(row.price || 0),
        });
      }
    }
    prev.set(key, { asset, quote });
  }
  return trades.reverse();
}

async function readAmmTrades(db) {
  const named = await tryQuery(
    db,
    `SELECT timestamp, pool_name, side, amount, xdx, price, account
     FROM trades
     ORDER BY timestamp DESC
     LIMIT 500`
  );
  if (named.rows.length) {
    return named.rows.map((row) => ({
      timestamp: row.timestamp,
      pool: row.pool_name || "XDX/XRP",
      side: String(row.side || "").toLowerCase() === "sell" ? "sell" : "buy",
      xdx: Number(row.xdx || row.amount || 0),
      quote: Number(row.quote || 0),
      price: Number(row.price || 0),
    }));
  }

  const history = await tryQuery(
    db,
    `SELECT timestamp, pool_name, reserve_asset::numeric AS reserve_asset,
            reserve_currency::numeric AS reserve_currency, price
     FROM amm_pool_history
     ORDER BY pool_name, timestamp ASC
     LIMIT 4000`
  );
  return inferTradesFromHistory(history.rows);
}

async function buildSnapshot(db) {
  const [amm, quote, holders, trustlines, lp, issuerLocked, ammXdx] = await Promise.all([
    hydrateAmm(db),
    loadXrpQuote(db),
    tokenHolderCount(db),
    tokenTrustlineCount(db),
    tryQuery(db, "SELECT COUNT(*) AS lp_holder_count FROM lp_holders_latest"),
    loadIssuerLocked(db),
    tokenBalanceFor(db, XDX_XRP_AMM),
  ]);

  const reserveAsset = Number(amm.reserve_asset || 0);
  const reserveCurrency = Number(amm.reserve_currency || 0);
  const xrpUsd = Number(quote.usd || 0);
  const xdxUsd = await loadRecordedXdxUsd(db, xrpUsd);
  const tvlUsd = reserveCurrency > 0 && xrpUsd > 0 ? reserveCurrency * 2 * xrpUsd : 0;
  const totalSupply = XDX_TOTAL_SUPPLY;
  const burned = Number(issuerLocked.locked || 0);
  const circulating = Math.max(totalSupply - burned, 0);
  const pools = (await listXdxPools(db)).map((row) => presentPool(row, xdxUsd, xrpUsd));
  const ammMarketCap = pools.reduce((sum, pool) => sum + Number(pool.tvl || 0), 0) || tvlUsd;

  return {
    pool: amm.pool_name || "XDX/XRP",
    tvl: tvlUsd || reserveCurrency || 0,
    tvl_usd: tvlUsd,
    price: xdxUsd,
    xdxUsd,
    recorded_price: xdxUsd,
    xdxGbp: xdxUsd > 0 && quote.gbp && xrpUsd > 0 ? xdxUsd * (quote.gbp / xrpUsd) : 0,
    xrpUsd,
    xrpGbp: Number(quote.gbp || 0),
    xdx_per_xrp: xrpPerXdx(xdxUsd, xrpUsd),
    xdxPerXrp: xrpPerXdx(xdxUsd, xrpUsd),
    apr: Number(amm.apr || 0),
    volume24h: Number(amm.volume24h || 0),
    reserve_asset: reserveAsset,
    reserve_currency: reserveCurrency,
    lp_supply: Number(amm.lp_supply || 0),
    trading_fee: Number(amm.trading_fee || 0) || null,
    holder_count: holders,
    lp_holder_count: Number(lp.rows[0]?.lp_holder_count || 0),
    circulating,
    circulating_supply: circulating,
    total_supply: totalSupply,
    burned_supply: burned,
    issuer_locked: burned,
    issued_xdx: Number(issuerLocked.issued || 0),
    issuer_source: issuerLocked.source,
    amm_xdx: Number(ammXdx || reserveAsset || 0),
    trustlines,
    trustline_count: trustlines,
    ammMarketCap,
    xrplMarketCap: totalSupply * xdxUsd,
    circulatingMarketCap: circulating * xdxUsd,
    pools,
    issuer: XDX_ISSUER,
    amm_account: XDX_XRP_AMM,
    updated: amm.timestamp,
    reserve_source: amm.reserve_source || "amm_pool_latest",
    source: "db",
  };
}

export async function readIndexerDb(suffix, search = "") {
  const db = getPool();
  if (!db) return null;

  const params = searchParams(search);
  const limit = Math.min(Number(params.get("limit") || 200) || 200, 2000);
  const offset = Math.max(Number(params.get("offset") || 0) || 0, 0);

  try {
    if (
      !suffix ||
      suffix === "api" ||
      /handshake$/i.test(suffix) ||
      suffix.startsWith("cluster/")
    ) {
      return ok(CATALOG);
    }

    if (suffix === "health") {
      await db.query("SELECT 1");
      return ok({
        status: "ok",
        source: "db",
        timestamp: new Date().toISOString(),
        note: "Read-only SELECT on XDX tables. Workers were not started or reset.",
      });
    }

    if (suffix === "health/xrpl") {
      return ok({
        source: "db",
        onV1: null,
        note: "Dashboard is SELECT-only. XRPL RPC stays on indexer worker 1. Workers were not started from here.",
      });
    }

    if (suffix === "overview" || suffix === "token-details") {
      return ok(await buildSnapshot(db));
    }

    if (suffix === "issuer-locked") {
      const snap = await loadIssuerLocked(db);
      return ok({
        issuer: XDX_ISSUER,
        issuer_locked: snap.locked,
        burned_supply: snap.locked,
        issued: snap.issued,
        circulating: Math.max(XDX_TOTAL_SUPPLY - snap.locked, 0),
        as_of: snap.as_of,
        source: snap.source,
      });
    }

    if (suffix === "amm") {
      return ok(await buildSnapshot(db));
    }

    if (suffix === "holders/count") {
      if (wantsTodaySnapshot(params)) {
        return ok(await loadTodayOwners(db, { includeHolders: false }));
      }
      const source = await pickHolderSource(db);
      return ok({
        count: source.count,
        as_of: source.as_of,
        snapshot_day: source.snapshot_day || utcDay(source.as_of),
        present: source.present,
        catching_up: source.catching_up,
        source: source.kind,
      });
    }

    if (suffix === "trustlines/count") {
      const snap = await tokenTrustlineSnapshot(db);
      return ok({
        count: snap.count,
        as_of: snap.as_of,
        source: "db",
      });
    }

    if (suffix === "lp-holders/count") {
      const result = await tryQuery(db, "SELECT COUNT(*) FROM lp_holders_latest");
      return ok({ count: Number(result.rows[0]?.count || 0), source: "db" });
    }

    if (suffix === "top-holders" || suffix === "top-holders-v2") {
      return ok(
        await tokenHoldersPage(db, limit, offset, {
          todayOnly: wantsTodaySnapshot(params),
        })
      );
    }

    if (suffix === "top-lp") {
      const probe = await probeCountAsOf(db, [
        `SELECT COUNT(*) AS count, MAX(timestamp) AS as_of FROM lp_holders_latest`,
        `SELECT COUNT(*) AS count, MAX(updated_at) AS as_of FROM lp_holders_latest`,
        `SELECT COUNT(*) AS count, NULL::timestamptz AS as_of FROM lp_holders_latest`,
      ]);
      const fresh = freshnessOf(probe.as_of, { liveTable: true });
      const result = await tryQuery(
        db,
        `SELECT ROW_NUMBER() OVER (ORDER BY lp_balance::numeric DESC) AS rank,
                account, lp_balance::numeric AS lp_balance, timestamp
         FROM lp_holders_latest
         ORDER BY lp_balance::numeric DESC
         LIMIT $1 OFFSET $2`,
        [Math.min(limit, 50) || 50, offset]
      );
      const rows = (result.rows.length
        ? result
        : await tryQuery(
            db,
            `SELECT ROW_NUMBER() OVER (ORDER BY lp_balance::numeric DESC) AS rank,
                    account, lp_balance::numeric AS lp_balance
             FROM lp_holders_latest
             ORDER BY lp_balance::numeric DESC
             LIMIT $1 OFFSET $2`,
            [Math.min(limit, 50) || 50, offset]
          )
      ).rows.map((row) => ({
        ...row,
        updated: row.timestamp || fresh.as_of,
      }));
      return ok({
        rows,
        holders: rows,
        as_of: fresh.as_of,
        source: "lp_holders_latest",
        present: fresh.present,
        catching_up: fresh.catching_up,
        age_seconds: fresh.age_seconds,
        count: probe.count,
      });
    }

    if (suffix === "charts/tvl") {
      const history = await tryQuery(
        db,
        `SELECT timestamp, reserve_asset::numeric + reserve_currency::numeric AS tvl
         FROM amm_pool_history
         WHERE pool_name = 'XDX/XRP'
         ORDER BY timestamp ASC`
      );
      if (history.rows.length) return ok(history.rows);
      const fallback = await tryQuery(
        db,
        `SELECT timestamp, tvl FROM tvl_history ORDER BY timestamp ASC`
      );
      return ok(fallback.rows);
    }

    if (suffix === "charts/holders") {
      const result = await tryQuery(
        db,
        `SELECT day, holder_count FROM holders_history ORDER BY day ASC`
      );
      if (result.rows.length) return ok(result.rows);
      const byScan = await tryQuery(
        db,
        `SELECT timestamp, COUNT(*) AS holder_count
         FROM token_holders_history
         WHERE ABS(balance::numeric) > 0
         GROUP BY timestamp
         ORDER BY timestamp`
      );
      const scanMax = Math.max(0, ...byScan.rows.map((row) => Number(row.holder_count || 0)));
      if (byScan.rows.length && scanMax >= 10) return ok(byScan.rows);
      const fromLedger = await tryQuery(
        db,
        `SELECT day, COUNT(*) AS holder_count
         FROM (
           SELECT DISTINCT ON (date_trunc('day', timestamp), account)
                  date_trunc('day', timestamp)::date AS day,
                  account,
                  balance
           FROM token_holders_history
           ORDER BY date_trunc('day', timestamp), account, timestamp DESC
         ) latest
         WHERE ABS(balance::numeric) > 0
         GROUP BY day
         ORDER BY day`
      );
      if (fromLedger.rows.length) return ok(fromLedger.rows);
      const count = await tokenHolderCount(db);
      return ok(count ? [{ timestamp: new Date().toISOString(), holder_count: count }] : []);
    }

    if (suffix === "charts/trustlines") {
      const byScan = await tryQuery(
        db,
        `SELECT timestamp, COUNT(*) AS trustline_count
         FROM token_holders_history
         GROUP BY timestamp
         ORDER BY timestamp`
      );
      const scanMax = Math.max(0, ...byScan.rows.map((row) => Number(row.trustline_count || 0)));
      if (byScan.rows.length && scanMax >= 10) return ok(byScan.rows);
      const fromLedger = await tryQuery(
        db,
        `SELECT day, COUNT(*) AS trustline_count
         FROM (
           SELECT DISTINCT ON (date_trunc('day', timestamp), account)
                  date_trunc('day', timestamp)::date AS day,
                  account
           FROM token_holders_history
           ORDER BY date_trunc('day', timestamp), account, timestamp DESC
         ) latest
         GROUP BY day
         ORDER BY day`
      );
      if (fromLedger.rows.length) return ok(fromLedger.rows);
      const count = await tokenTrustlineCount(db);
      return ok(count ? [{ timestamp: new Date().toISOString(), trustline_count: count }] : []);
    }

    if (suffix === "charts/activity") {
      return ok(await nativeActivitySeries(db));
    }

    if (suffix === "charts/traders") {
      return ok(await nativeTraderSeries(db));
    }

    if (suffix === "xdx-flows") {
      return ok(await nativeXdxFlows(db));
    }

    if (suffix === "charts/trades" || suffix === "trades") {
      const flows = await nativeXdxFlows(db);
      if (flows.length) return ok(flows);
      const trades = await readAmmTrades(db);
      if (suffix === "trades") return ok(trades);
      return ok(
        trades.map((row) => ({
          timestamp: row.timestamp,
          trades: 1,
          volume: row.xdx,
          side: row.side,
        }))
      );
    }

    if (suffix === "charts/lp-holders") {
      const result = await tryQuery(
        db,
        `SELECT day, lp_holder_count
         FROM lp_holders_history_daily
         ORDER BY day ASC`
      );
      if (result.rows.length) return ok(result.rows);
      const latest = await tryQuery(
        db,
        "SELECT COUNT(*) AS lp_holder_count FROM lp_holders_latest"
      );
      const count = Number(latest.rows[0]?.lp_holder_count || 0);
      return ok(count ? [{ day: new Date().toISOString(), lp_holder_count: count }] : []);
    }

    if (suffix === "pools") {
      const snap = await buildSnapshot(db);
      return ok({
        ...snap,
        pools: snap.pools || [],
      });
    }

    if (suffix === "prices") {
      const snap = await buildSnapshot(db);
      return ok({
        xrpUsd: snap.xrpUsd,
        xrpGbp: snap.xrpGbp,
        xdxUsd: snap.xdxUsd,
        recorded_price: snap.xdxUsd,
        xdxGbp: snap.xdxGbp,
        source: "db",
      });
    }

    if (suffix === "prices/change24h") {
      const pinned = await tryQuery(
        db,
        `SELECT asset, percent_change
         FROM price_change_24h
         WHERE timestamp = date_trunc('day', now()) + interval '20 hours'`
      );
      const latest = pinned.rows.length
        ? pinned
        : await tryQuery(
            db,
            `SELECT asset, percent_change
             FROM price_change_24h
             ORDER BY timestamp DESC`
          );
      const map = {};
      for (const row of latest.rows) {
        const key = String(row.asset || "").toUpperCase();
        if (map[key] == null) map[key] = Number(row.percent_change);
      }
      return ok({
        xrp: map.XRP || 0,
        xdx: map.XDX || 0,
        lp: map.LP || 0,
      });
    }

    const wallet = suffix.match(/^(?:wallet\/)?balances\/([^/]+)$/);
    if (wallet) {
      const address = decodeURIComponent(wallet[1]);
      const xrp = await tryQuery(
        db,
        "SELECT balance FROM xrp_balances_latest WHERE account = $1 LIMIT 1",
        [address]
      );
      const xdxBalance = await tokenBalanceFor(db, address);
      const lp = await tryQuery(
        db,
        "SELECT lp_balance FROM lp_holders_latest WHERE account = $1 LIMIT 1",
        [address]
      );
      return ok({
        xrp: Number(xrp.rows[0]?.balance || 0),
        xdx: xdxBalance,
        lp: Number(lp.rows[0]?.lp_balance || 0),
        source: "db",
      });
    }

    const networth = suffix.match(/^wallet\/networth\/([^/]+)$/);
    if (networth) {
      const address = decodeURIComponent(networth[1]);
      let trustlines = await tryQuery(
        db,
        `SELECT currency, balance::numeric AS balance
         FROM token_holders_latest
         WHERE account = $1`,
        [address]
      );
      if (!trustlines.rows.length) {
        trustlines = await tryQuery(
          db,
          `SELECT DISTINCT ON (account) 'XDX' AS currency, balance::numeric AS balance
           FROM token_holders_history
           WHERE account = $1
           ORDER BY account, timestamp DESC`,
          [address]
        );
      }
      const prices = await tryQuery(
        db,
        "SELECT currency, price_usd, price_gbp FROM price_latest_all"
      );
      const priceMap = Object.fromEntries(
        prices.rows.map((row) => [
          row.currency,
          { usd: Number(row.price_usd), gbp: Number(row.price_gbp) },
        ])
      );
      let totalUsd = 0;
      let totalGbp = 0;
      for (const line of trustlines.rows) {
        const price = priceMap[line.currency] || { usd: 0, gbp: 0 };
        totalUsd += Number(line.balance) * price.usd;
        totalGbp += Number(line.balance) * price.gbp;
      }
      return ok({ totalUsd, totalGbp, source: "db" });
    }

    const spark = suffix.match(/^sparkline\/([^/]+)$/);
    if (spark) {
      const asset = decodeURIComponent(spark[1]);
      const result = await tryQuery(
        db,
        `SELECT timestamp, price_usd
         FROM price_history
         WHERE asset = $1
         ORDER BY timestamp DESC
         LIMIT 50`,
        [asset]
      );
      return ok(result.rows.reverse());
    }

    return null;
  } catch (error) {
    logDbError(error);
    return {
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: safePgMessage(error),
        source: "db",
        hint: connectHint(error),
      }),
      source: "postgres",
    };
  }
}

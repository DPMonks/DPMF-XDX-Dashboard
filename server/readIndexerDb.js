import pg from "pg";
import { XDX_ISSUER, XDX_XRP_AMM } from "../src/constants/ledger.js";

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
    topHoldersV2: "/api/top-holders-v2",
    topLp: "/api/top-lp",
    holdersCount: "/api/holders/count",
    lpHoldersCount: "/api/lp-holders/count",
    tvlHistory: "/api/charts/tvl",
    holdersHistory: "/api/charts/holders",
    lpHoldersHistory: "/api/charts/lp-holders",
    walletBalances: "/api/wallet/balances/:address",
    prices: "/api/prices",
    priceChange: "/api/prices/change24h",
    networth: "/api/wallet/networth/:address",
    sparkline: "/api/sparkline/:asset",
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
    return `postgres://${auth}@${finalHost}:${finalPort}/${finalDb}${url.search}`;
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

// Railway's public TCP proxy uses a cert chain node-pg rejects when the URL
// carries sslmode=require (that flag overrides ssl.rejectUnauthorized=false).
export function sanitizeDatabaseUrl(raw) {
  if (!raw) return "";
  return String(raw).replace(
    /([?&])sslmode=(require|verify-full|verify-ca)\b/gi,
    "$1sslmode=no-verify"
  );
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
    pool = new pg.Pool({
      connectionString: sanitizeDatabaseUrl(raw),
      ssl: { rejectUnauthorized: false },
      max: 2,
    });
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

function mapHolderRows(rows, offset) {
  return rows.map((row, index) => ({
    rank: offset + index + 1,
    account: row.account,
    balance: Number(row.balance),
    frozen: false,
  }));
}

async function freshTokenHolders(db, limit, offset) {
  const snapCount = await tryQuery(
    db,
    `SELECT COUNT(*) AS count
     FROM token_holders_history
     WHERE timestamp = (SELECT MAX(timestamp) FROM token_holders_history)
       AND ABS(balance::numeric) > 0`
  );
  const useSnapshot = Number(snapCount.rows[0]?.count || 0) >= 20;
  const snapshot = useSnapshot
    ? await tryQuery(
        db,
        `SELECT account, ABS(balance::numeric) AS balance
         FROM token_holders_history
         WHERE timestamp = (SELECT MAX(timestamp) FROM token_holders_history)
           AND ABS(balance::numeric) > 0
         ORDER BY ABS(balance::numeric) DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
    : { rows: [] };
  if (snapshot.rows.length) return mapHolderRows(snapshot.rows, offset);

  const newest = await tryQuery(
    db,
    `SELECT account, ABS(balance::numeric) AS balance
     FROM (
       SELECT DISTINCT ON (account) account, balance
       FROM token_holders_history
       WHERE ABS(balance::numeric) > 0
       ORDER BY account, timestamp DESC
     ) current
     ORDER BY ABS(balance::numeric) DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  if (newest.rows.length) return mapHolderRows(newest.rows, offset);

  const latest = await tryQuery(
    db,
    `SELECT account, ABS(balance::numeric) AS balance
     FROM token_holders_latest
     WHERE ABS(balance::numeric) > 0
     ORDER BY ABS(balance::numeric) DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return mapHolderRows(latest.rows, offset);
}

async function tokenHolderCount(db) {
  const snapshot = await tryQuery(
    db,
    `SELECT COUNT(*) AS count
     FROM token_holders_history
     WHERE timestamp = (SELECT MAX(timestamp) FROM token_holders_history)
       AND ABS(balance::numeric) > 0`
  );
  const snapCount = Number(snapshot.rows[0]?.count || 0);
  if (snapCount > 0) return snapCount;

  const distinct = await tryQuery(
    db,
    `SELECT COUNT(*) AS count FROM (
       SELECT DISTINCT ON (account) account, balance
       FROM token_holders_history
       WHERE ABS(balance::numeric) > 0
       ORDER BY account, timestamp DESC
     ) current`
  );
  const distinctCount = Number(distinct.rows[0]?.count || 0);
  if (distinctCount > 0) return distinctCount;

  const latest = await tryQuery(
    db,
    `SELECT COUNT(*) AS count
     FROM token_holders_latest
     WHERE ABS(balance::numeric) > 0`
  );
  return Number(latest.rows[0]?.count || 0);
}

async function tokenHoldersPage(db, limit, offset) {
  return freshTokenHolders(db, limit, offset);
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
    "SELECT price_usd, price_gbp FROM price_latest LIMIT 1"
  );
  const hist = await tryQuery(
    db,
    `SELECT price_usd FROM price_history
     WHERE asset IN ('XRP', 'xrp')
     ORDER BY timestamp DESC LIMIT 1`
  );
  let usd = Number(latest.rows[0]?.price_usd || hist.rows[0]?.price_usd || 0);
  let gbp = Number(latest.rows[0]?.price_gbp || 0);
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

async function buildSnapshot(db) {
  const [amm, quote, holders, lp, totals, issuer, ammHeld] = await Promise.all([
    hydrateAmm(db),
    loadXrpQuote(db),
    tokenHolderCount(db),
    tryQuery(db, "SELECT COUNT(*) AS lp_holder_count FROM lp_holders_latest"),
    tryQuery(
      db,
      "SELECT COALESCE(SUM(ABS(balance::numeric)), 0) AS total FROM token_holders_latest"
    ),
    tryQuery(
      db,
      "SELECT COALESCE(ABS(balance::numeric), 0) AS balance FROM token_holders_latest WHERE account = $1 LIMIT 1",
      [XDX_ISSUER]
    ),
    tryQuery(
      db,
      "SELECT COALESCE(ABS(balance::numeric), 0) AS balance FROM token_holders_latest WHERE account = $1 LIMIT 1",
      [XDX_XRP_AMM]
    ),
  ]);

  const reserveAsset = Number(amm.reserve_asset || 0);
  const reserveCurrency = Number(amm.reserve_currency || 0);
  const xdxPerXrp =
    reserveAsset > 0 && reserveCurrency > 0
      ? reserveCurrency / reserveAsset
      : Number(amm.price || 0);
  const xrpUsd = Number(quote.usd || 0);
  const xdxUsd = xdxPerXrp > 0 && xrpUsd > 0 ? xdxPerXrp * xrpUsd : 0;
  const tvlUsd = reserveCurrency > 0 && xrpUsd > 0 ? reserveCurrency * 2 * xrpUsd : 0;
  const totalSupply = Number(totals.rows[0]?.total || 0);
  const issuerLocked = Number(issuer.rows[0]?.balance || 0);
  const ammXdx = Number(ammHeld.rows[0]?.balance || reserveAsset || 0);
  const circulating = Math.max(totalSupply - issuerLocked, 0);

  return {
    pool: amm.pool_name || "XDX/XRP",
    tvl: tvlUsd || reserveCurrency || 0,
    tvl_usd: tvlUsd,
    price: xdxUsd || xdxPerXrp,
    xdxUsd,
    xdxGbp: xdxPerXrp > 0 && quote.gbp ? xdxPerXrp * quote.gbp : 0,
    xrpUsd,
    xrpGbp: Number(quote.gbp || 0),
    xdx_per_xrp: xdxPerXrp,
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
    burned_supply: issuerLocked,
    issuer_locked: issuerLocked,
    amm_xdx: ammXdx,
    trustlines: holders,
    trustline_count: holders,
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

    if (suffix === "amm") {
      return ok(await buildSnapshot(db));
    }

    if (suffix === "holders/count") {
      return ok({ count: await tokenHolderCount(db), source: "db" });
    }

    if (suffix === "lp-holders/count") {
      const result = await tryQuery(db, "SELECT COUNT(*) FROM lp_holders_latest");
      return ok({ count: Number(result.rows[0]?.count || 0), source: "db" });
    }

    if (suffix === "top-holders" || suffix === "top-holders-v2") {
      return ok(await tokenHoldersPage(db, limit, offset));
    }

    if (suffix === "top-lp") {
      const result = await tryQuery(
        db,
        `SELECT ROW_NUMBER() OVER (ORDER BY lp_balance::numeric DESC) AS rank,
                account, lp_balance::numeric AS lp_balance
         FROM lp_holders_latest
         ORDER BY lp_balance::numeric DESC
         LIMIT $1 OFFSET $2`,
        [Math.min(limit, 50) || 50, offset]
      );
      return ok(result.rows);
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
      const fromLedger = await tryQuery(
        db,
        `SELECT date_trunc('day', timestamp)::date AS day,
                COUNT(DISTINCT account) AS holder_count
         FROM token_holders_history
         GROUP BY 1
         ORDER BY 1`
      );
      if (fromLedger.rows.length) return ok(fromLedger.rows);
      const count = await tokenHolderCount(db);
      return ok(count ? [{ day: new Date().toISOString(), holder_count: count }] : []);
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
      const allPools = await tryQuery(db, "SELECT * FROM amm_pool_latest");
      return ok({
        ...snap,
        pools: allPools.rows.map((item) => ({
          pool: item.pool_name,
          tvl:
            item.pool_name === "XDX/XRP"
              ? snap.tvl
              : Number(item.reserve_asset || 0) + Number(item.reserve_currency || 0),
          price: item.pool_name === "XDX/XRP" ? snap.price : Number(item.price || 0),
          reserve_asset: Number(item.reserve_asset || 0),
          reserve_currency:
            item.pool_name === "XDX/XRP"
              ? snap.reserve_currency
              : Number(item.reserve_currency || 0),
          lp_supply: Number(item.lp_supply || 0),
          trading_fee: Number(item.trading_fee || 0) || null,
          updated: item.timestamp,
        })),
      });
    }

    if (suffix === "prices") {
      const snap = await buildSnapshot(db);
      return ok({
        xrpUsd: snap.xrpUsd,
        xrpGbp: snap.xrpGbp,
        xdxUsd: snap.xdxUsd,
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

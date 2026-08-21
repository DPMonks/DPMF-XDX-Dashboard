import pg from "pg";

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

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function hasIndexerDatabase() {
  return Boolean(databaseUrl());
}

function getPool() {
  const url = databaseUrl();
  if (!url) return null;
  if (!pool) {
    pool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 2,
    });
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
  } catch {
    return { rows: [] };
  }
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

    if (suffix === "overview") {
      const amm = await tryQuery(
        db,
        `SELECT reserve_asset, reserve_currency, lp_supply
         FROM amm_pool_latest
         WHERE pool_name = 'XDX/XRP'
         LIMIT 1`
      );
      const holders = await tryQuery(
        db,
        "SELECT COUNT(*) AS holder_count FROM token_holders_latest"
      );
      const lp = await tryQuery(
        db,
        "SELECT COUNT(*) AS lp_holder_count FROM lp_holders_latest"
      );
      const row = amm.rows[0] || {};
      return ok({
        tvl: Number(row.reserve_asset || 0) + Number(row.reserve_currency || 0),
        lp_supply: Number(row.lp_supply || 0),
        holder_count: Number(holders.rows[0]?.holder_count || 0),
        lp_holder_count: Number(lp.rows[0]?.lp_holder_count || 0),
        source: "db",
      });
    }

    if (suffix === "amm") {
      const result = await tryQuery(
        db,
        `SELECT *
         FROM amm_pool_latest
         WHERE pool_name = 'XDX/XRP'
         LIMIT 1`
      );
      return ok(result.rows[0] || {});
    }

    if (suffix === "holders/count") {
      const result = await tryQuery(db, "SELECT COUNT(*) FROM token_holders_latest");
      return ok({ count: Number(result.rows[0]?.count || 0), source: "db" });
    }

    if (suffix === "lp-holders/count") {
      const result = await tryQuery(db, "SELECT COUNT(*) FROM lp_holders_latest");
      return ok({ count: Number(result.rows[0]?.count || 0), source: "db" });
    }

    if (suffix === "top-holders" || suffix === "top-holders-v2") {
      const result = await tryQuery(
        db,
        `SELECT ROW_NUMBER() OVER (ORDER BY ABS(balance::numeric) DESC) AS rank,
                account, ABS(balance::numeric) AS balance, frozen
         FROM token_holders_latest
         ORDER BY ABS(balance::numeric) DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return ok(result.rows);
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
      return ok(result.rows);
    }

    if (suffix === "charts/lp-holders") {
      const result = await tryQuery(
        db,
        `SELECT day, lp_holder_count
         FROM lp_holders_history_daily
         ORDER BY day ASC`
      );
      return ok(result.rows);
    }

    if (suffix === "pools") {
      const amm = await tryQuery(
        db,
        `SELECT *
         FROM amm_pool_latest
         WHERE pool_name = 'XDX/XRP'
         LIMIT 1`
      );
      const holders = await tryQuery(
        db,
        "SELECT COUNT(*) AS holder_count FROM token_holders_latest"
      );
      const lp = await tryQuery(
        db,
        "SELECT COUNT(*) AS lp_holder_count FROM lp_holders_latest"
      );
      const allPools = await tryQuery(db, "SELECT * FROM amm_pool_latest");
      const row = amm.rows[0] || {};
      const tvl =
        Number(row.reserve_asset || 0) + Number(row.reserve_currency || 0);
      return ok({
        pool: row.pool_name || "XDX/XRP",
        tvl,
        price: Number(row.price || 0),
        apr: Number(row.apr || 0),
        volume24h: Number(row.volume24h || 0),
        reserve_asset: Number(row.reserve_asset || 0),
        reserve_currency: Number(row.reserve_currency || 0),
        lp_supply: Number(row.lp_supply || 0),
        holder_count: Number(holders.rows[0]?.holder_count || 0),
        lp_holder_count: Number(lp.rows[0]?.lp_holder_count || 0),
        updated: row.timestamp,
        source: "db",
        pools: allPools.rows.map((item) => ({
          pool: item.pool_name,
          tvl:
            Number(item.reserve_asset || 0) + Number(item.reserve_currency || 0),
          price: Number(item.price || 0),
          reserve_asset: Number(item.reserve_asset || 0),
          reserve_currency: Number(item.reserve_currency || 0),
          lp_supply: Number(item.lp_supply || 0),
          updated: item.timestamp,
        })),
      });
    }

    if (suffix === "prices") {
      const price = await tryQuery(
        db,
        "SELECT price_usd, price_gbp FROM price_latest LIMIT 1"
      );
      const xdx = await tryQuery(
        db,
        `SELECT price_usd, price_gbp
         FROM price_latest_all
         WHERE currency IN ('XDX', 'xdx')
         LIMIT 1`
      );
      const row = price.rows[0] || {};
      const xdxRow = xdx.rows[0] || {};
      const xrpUsd = Number(row.price_usd || 0);
      const xrpGbp = Number(row.price_gbp || 0);
      return ok({
        xrpUsd,
        xrpGbp,
        xdxUsd: Number(xdxRow.price_usd || xrpUsd * 0.000001 || 0),
        xdxGbp: Number(xdxRow.price_gbp || xrpGbp * 0.000001 || 0),
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
      const xdx = await tryQuery(
        db,
        "SELECT balance FROM token_holders_latest WHERE account = $1 LIMIT 1",
        [address]
      );
      const lp = await tryQuery(
        db,
        "SELECT lp_balance FROM lp_holders_latest WHERE account = $1 LIMIT 1",
        [address]
      );
      return ok({
        xrp: Number(xrp.rows[0]?.balance || 0),
        xdx: Number(xdx.rows[0]?.balance || 0),
        lp: Number(lp.rows[0]?.lp_balance || 0),
        source: "db",
      });
    }

    const networth = suffix.match(/^wallet\/networth\/([^/]+)$/);
    if (networth) {
      const address = decodeURIComponent(networth[1]);
      const trustlines = await tryQuery(
        db,
        `SELECT currency, balance::numeric AS balance
         FROM token_holders_latest
         WHERE account = $1`,
        [address]
      );
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
    return {
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: error.message, source: "db" }),
      source: "postgres",
    };
  }
}

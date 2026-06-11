// ------------------------------------------------------
// EARLY DIAGNOSTIC LOGS
// ------------------------------------------------------
console.log("Server starting…");

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection:", err);
});

// ------------------------------------------------------
// IMPORTS
// ------------------------------------------------------
import express from "express";
import cors from "cors";
import pool from "./db.js";
import { getHealthStatus } from "./health.js";

// IMPORTANT: import startIndexer, DO NOT RUN IT HERE
import { startIndexer } from "./indexer.js";

// ------------------------------------------------------
// EXPRESS SETUP
// ------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

console.log("🚀 Booting XRPL Indexer API…");
console.log("📦 Environment:", process.env.NODE_ENV || "development");
console.log("🔧 Port:", PORT);

// ------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------
app.get("/health", (req, res) => {
  res.json(getHealthStatus());
});

// ------------------------------------------------------
// ROOT ENDPOINT
// ------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "XRPL Indexer",
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
      sparkline: "/api/sparkline/:asset"
    }
  });
});

// ------------------------------------------------------
// OVERVIEW CARD DATA
// ------------------------------------------------------
app.get("/api/overview", async (req, res) => {
  try {
    const amm = await pool.query(
      `SELECT reserve_asset, reserve_currency, lp_supply
       FROM amm_pool_latest
       WHERE pool_name = 'XDX/XRP'
       LIMIT 1;`
    );

    const holders = await pool.query(
      "SELECT COUNT(*) AS holder_count FROM token_holders_latest;"
    );

    const lpHolders = await pool.query(
      "SELECT COUNT(*) AS lp_holder_count FROM lp_holders_latest;"
    );

    const row = amm.rows[0] || {
      reserve_asset: "0",
      reserve_currency: "0",
      lp_supply: "0"
    };

    const tvl =
      Number(row.reserve_asset || 0) +
      Number(row.reserve_currency || 0);

    res.json({
      tvl,
      lp_supply: Number(row.lp_supply || 0),
      holder_count: Number(holders.rows[0]?.holder_count || 0),
      lp_holder_count: Number(lpHolders.rows[0]?.lp_holder_count || 0)
    });
  } catch (err) {
    console.error("Error in /api/overview:", err);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

// ------------------------------------------------------
// AMM SNAPSHOT (LATEST)
// ------------------------------------------------------
app.get("/api/amm", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM amm_pool_latest
       WHERE pool_name = 'XDX/XRP'
       LIMIT 1;`
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error("Error in /api/amm:", err);
    res.status(500).json({ error: "Failed to fetch AMM state" });
  }
});

// ------------------------------------------------------
// HOLDER COUNT
// ------------------------------------------------------
app.get("/api/holders/count", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM token_holders_latest;"
    );
    res.json({ count: Number(result.rows[0].count) });
  } catch (err) {
    console.error("Error in /api/holders/count:", err);
    res.status(500).json({ error: "Failed to fetch holder count" });
  }
});

// ------------------------------------------------------
// LP HOLDER COUNT
// ------------------------------------------------------
app.get("/api/lp-holders/count", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM lp_holders_latest;"
    );
    res.json({ count: Number(result.rows[0].count) });
  } catch (err) {
    console.error("Error in /api/lp-holders/count:", err);
    res.status(500).json({ error: "Failed to fetch LP holder count" });
  }
});

// ------------------------------------------------------
// PAGINATED TOKEN HOLDERS (v1)
// ------------------------------------------------------
app.get("/api/top-holders", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);

    const result = await pool.query(
      `SELECT 
         account, 
         balance::numeric AS balance,
         frozen
       FROM token_holders_latest
       ORDER BY balance::numeric DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/top-holders:", err);
    res.status(500).json({ error: "Failed to fetch top holders" });
  }
});

// ------------------------------------------------------
// PAGINATED TOKEN HOLDERS (v2 alias)
// ------------------------------------------------------
app.get("/api/top-holders-v2", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);

    const result = await pool.query(
      `SELECT 
         account, 
         balance::numeric AS balance,
         frozen
       FROM token_holders_latest
       ORDER BY balance::numeric DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/top-holders-v2:", err);
    res.status(500).json({ error: "Failed to fetch top holders v2" });
  }
});

// ------------------------------------------------------
// PAGINATED LP HOLDERS (WITH RANKING)
// ------------------------------------------------------
app.get("/api/top-lp", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);

    const result = await pool.query(
      `SELECT 
         ROW_NUMBER() OVER (ORDER BY lp_balance::numeric DESC) AS rank,
         account,
         lp_balance::numeric AS lp_balance
       FROM lp_holders_latest
       ORDER BY lp_balance::numeric DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/top-lp:", err);
    res.status(500).json({ error: "Failed to fetch top LP holders" });
  }
});

// ------------------------------------------------------
// TVL HISTORY
// ------------------------------------------------------
app.get("/api/charts/tvl", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT timestamp, reserve_asset::numeric + reserve_currency::numeric AS tvl
       FROM amm_pool_history
       WHERE pool_name = 'XDX/XRP'
       ORDER BY timestamp ASC;`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/charts/tvl:", err);
    res.status(500).json({ error: "Failed to fetch TVL history" });
  }
});

// ------------------------------------------------------
// HOLDER COUNT HISTORY
// ------------------------------------------------------
app.get("/api/charts/holders", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT day, holder_count
       FROM holders_history
       ORDER BY day ASC;`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/charts/holders:", err);
    res.status(500).json({ error: "Failed to fetch holders history" });
  }
});

// ------------------------------------------------------
// LP HOLDER COUNT HISTORY
// ------------------------------------------------------
app.get("/api/charts/lp-holders", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT day, lp_holder_count
       FROM lp_holders_history_daily
       ORDER BY day ASC;`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/charts/lp-holders:", err);
    res.status(500).json({ error: "Failed to fetch LP holders history" });
  }
});

// ------------------------------------------------------
// POOL STATS
// ------------------------------------------------------
app.get("/api/pools", async (req, res) => {
  try {
    const amm = await pool.query(
      `SELECT *
       FROM amm_pool_latest
       WHERE pool_name = 'XDX/XRP'
       LIMIT 1;`
    );

    const holders = await pool.query(
      "SELECT COUNT(*) AS holder_count FROM token_holders_latest;"
    );

    const lpHolders = await pool.query(
      "SELECT COUNT(*) AS lp_holder_count FROM lp_holders_latest;"
    );

    const row = amm.rows[0] || {
      reserve_asset: "0",
      reserve_currency: "0",
      lp_supply: "0",
      price: "0",
      volume24h: "0",
      apr: "0"
    };

    const tvl =
      Number(row.reserve_asset || 0) +
      Number(row.reserve_currency || 0);

    res.json({
      pool: "XDX/XRP",
      tvl,
      price: Number(row.price || 0),
      apr: Number(row.apr || 0),
      volume24h: Number(row.volume24h || 0),
      reserve_asset: Number(row.reserve_asset || 0),
      reserve_currency: Number(row.reserve_currency || 0),
      lp_supply: Number(row.lp_supply || 0),
      holder_count: Number(holders.rows[0]?.holder_count || 0),
      lp_holder_count: Number(lpHolders.rows[0]?.lp_holder_count || 0),
      updated: row.timestamp
    });
  } catch (err) {
    console.error("Error in /api/pools:", err);
    res.status(500).json({ error: "Failed to fetch pool stats" });
  }
});

// ------------------------------------------------------
// NEW: WALLET BALANCES (XRP, XDX, LP)
// ------------------------------------------------------
app.get("/api/wallet/balances/:address", async (req, res) => {
  const { address } = req.params;

  try {
    const xrp = await pool.query(
      `SELECT balance FROM xrp_balances_latest WHERE account = $1 LIMIT 1`,
      [address]
    );

    const xdx = await pool.query(
      `SELECT balance FROM token_holders_latest WHERE account = $1 LIMIT 1`,
      [address]
    );

    const lp = await pool.query(
      `SELECT lp_balance FROM lp_holders_latest WHERE account = $1 LIMIT 1`,
      [address]
    );

    res.json({
      xrp: Number(xrp.rows[0]?.balance || 0),
      xdx: Number(xdx.rows[0]?.balance || 0),
      lp: Number(lp.rows[0]?.lp_balance || 0)
    });
  } catch (err) {
    console.error("Error in /api/wallet/balances:", err);
    res.status(500).json({ error: "Failed to fetch wallet balances" });
  }
});

// ------------------------------------------------------
// NEW: PRICE FEED (USD + GBP)
// ------------------------------------------------------
app.get("/api/prices", async (req, res) => {
  try {
    const price = await pool.query(
      `SELECT price_usd, price_gbp FROM price_latest LIMIT 1`
    );

    const row = price.rows[0] || { price_usd: 0, price_gbp: 0 };

    res.json({
      xrpUsd: row.price_usd,
      xrpGbp: row.price_gbp,
      xdxUsd: row.price_usd * 0.000001,
      xdxGbp: row.price_gbp * 0.000001
    });
  } catch (err) {
    console.error("Error in /api/prices:", err);
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

// ------------------------------------------------------
// NEW: DAILY % CHANGE SINCE 20:00 GMT
// ------------------------------------------------------
app.get("/api/prices/change24h", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT asset, percent_change
       FROM price_change_24h
       WHERE timestamp = date_trunc('day', now()) + interval '20 hours'`
    );

    const map = {};
    result.rows.forEach(r => {
      map[r.asset] = Number(r.percent_change);
    });

    res.json({
      xrp: map["XRP"] || 0,
      xdx: map["XDX"] || 0,
      lp: map["LP"] || 0
    });
  } catch (err) {
    console.error("Error in /api/prices/change24h:", err);
    res.status(500).json({ error: "Failed to fetch change data" });
  }
});

// ------------------------------------------------------
// NEW: WALLET NET WORTH (ALL TRUSTLINES)
// ------------------------------------------------------
app.get("/api/wallet/networth/:address", async (req, res) => {
  const { address } = req.params;

  try {
    const trustlines = await pool.query(
      `SELECT currency, balance::numeric AS balance
       FROM token_holders_latest
       WHERE account = $1`,
      [address]
    );

    const prices = await pool.query(
      `SELECT currency, price_usd, price_gbp
       FROM price_latest_all`
    );

    const priceMap = {};
    prices.rows.forEach(p => {
      priceMap[p.currency] = {
        usd: Number(p.price_usd),
        gbp: Number(p.price_gbp)
      };
    });

    let totalUsd = 0;
    let totalGbp = 0;

    trustlines.rows.forEach(t => {
      const p = priceMap[t.currency] || { usd: 0, gbp: 0 };
      totalUsd += t.balance * p.usd;
      totalGbp += t.balance * p.gbp;
    });

    res.json({
      totalUsd,
      totalGbp
    });
  } catch (err) {
    console.error("Net worth error:", err);
    res.status(500).json({ error: "Failed to fetch net worth" });
  }
});

// ------------------------------------------------------
// NEW: SPARKLINE MINI-CHART DATA
// ------------------------------------------------------
app.get("/api/sparkline/:asset", async (req, res) => {
  const { asset } = req.params;

  try {
    const result = await pool.query(
      `SELECT timestamp, price_usd
       FROM price_history
       WHERE asset = $1
       ORDER BY timestamp DESC
       LIMIT 50`,
      [asset]
    );

    res.json(result.rows.reverse());
  } catch (err) {
    console.error("Sparkline error:", err);
    res.status(500).json({ error: "Failed to fetch sparkline" });
  }
});

// ------------------------------------------------------
// START SERVER + SAFE INDEXER START
// ------------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ API server running on port ${PORT}`);

  // Start indexer AFTER server is healthy
  startIndexer();
});
// test

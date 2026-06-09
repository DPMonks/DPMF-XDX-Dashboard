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

// START INDEXER LOOP
import "./indexer.js";

// ------------------------------------------------------
// EXPRESS SETUP
// ------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

// ------------------------------------------------------
// STARTUP LOGS
// ------------------------------------------------------
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
      topLp: "/api/top-lp",
      holdersCount: "/api/holders/count",
      lpHoldersCount: "/api/lp-holders/count",
      tvlHistory: "/api/charts/tvl",
      holdersHistory: "/api/charts/holders",
      lpHoldersHistory: "/api/charts/lp-holders"
    }
  });
});

// ------------------------------------------------------
// OVERVIEW CARDS
// ------------------------------------------------------
app.get("/api/overview", async (req, res) => {
  try {
    const amm = await pool.query(
      "SELECT reserve_asset, reserve_currency, lp_supply FROM amm_pool_latest WHERE pool_name = 'XDX';"
    );
    const holders = await pool.query(
      "SELECT COUNT(*) AS holder_count FROM token_holders_latest;"
    );
    const lpHolders = await pool.query(
      "SELECT COUNT(*) AS lp_holder_count FROM lp_holders_latest;"
    );

    const row = amm.rows[0] || {
      reserve_asset: 0,
      reserve_currency: 0,
      lp_supply: 0
    };

    const tvl =
      Number(row.reserve_asset || 0) + Number(row.reserve_currency || 0);

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
// AMM SNAPSHOT
// ------------------------------------------------------
app.get("/api/amm", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM amm_pool_latest WHERE pool_name = 'XDX';"
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error("Error in /api/amm:", err);
    res.status(500).json({ error: "Failed to fetch AMM state" });
  }
});

// ------------------------------------------------------
// HOLDER COUNT (NEW)
// ------------------------------------------------------
app.get("/api/holders/count", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM token_holders_latest;");
    res.json({ count: Number(result.rows[0].count) });
  } catch (err) {
    console.error("Error in /api/holders/count:", err);
    res.status(500).json({ error: "Failed to fetch holder count" });
  }
});

// ------------------------------------------------------
// LP HOLDER COUNT (NEW)
// ------------------------------------------------------
app.get("/api/lp-holders/count", async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM lp_holders_latest;");
    res.json({ count: Number(result.rows[0].count) });
  } catch (err) {
    console.error("Error in /api/lp-holders/count:", err);
    res.status(500).json({ error: "Failed to fetch LP holder count" });
  }
});

// ------------------------------------------------------
// PAGINATED TOKEN HOLDERS (UPDATED)
// ------------------------------------------------------
app.get("/api/top-holders", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);

    const result = await pool.query(
      `SELECT account, balance, frozen
       FROM token_holders_latest
       ORDER BY balance DESC
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
// PAGINATED LP HOLDERS (UPDATED)
// ------------------------------------------------------
app.get("/api/top-lp", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 50);
    const offset = Number(req.query.offset || 0);

    const result = await pool.query(
      `SELECT account, lp_balance
       FROM lp_holders_latest
       ORDER BY lp_balance DESC
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
      `SELECT 
         timestamp,
         reserve_asset + reserve_currency AS tvl
       FROM amm_pool_history
       WHERE pool_name = 'XDX'
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
      `SELECT 
         DATE(timestamp) AS day,
         COUNT(*) AS holder_count
       FROM token_holders_history
       GROUP BY day
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
      `SELECT 
         DATE(timestamp) AS day,
         COUNT(*) AS lp_holder_count
       FROM lp_holders_history
       GROUP BY day
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
      "SELECT * FROM amm_pool_latest WHERE pool_name = 'XDX';"
    );
    const holders = await pool.query(
      "SELECT COUNT(*) AS holder_count FROM token_holders_latest;"
    );
    const lpHolders = await pool.query(
      "SELECT COUNT(*) AS lp_holder_count FROM lp_holders_latest;"
    );

    const row = amm.rows[0] || {
      reserve_asset: 0,
      reserve_currency: 0,
      lp_supply: 0,
      price: 0,
      volume24h: 0,
      apr: 0
    };

    const tvl =
      Number(row.reserve_asset || 0) + Number(row.reserve_currency || 0);

    res.json({
      pool: "XDX",
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
// START SERVER
// ------------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ API server running on port ${PORT}`);
});

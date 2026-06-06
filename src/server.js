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

// START INDEXER (IMPORTANT — FIXES LOOP)
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
      topHolders: "/api/top-holders",
      topLp: "/api/top-lp",
      tvlHistory: "/api/charts/tvl",
      holdersHistory: "/api/charts/holders",
      lpHoldersHistory: "/api/charts/lp-holders"
    }
  });
});

// ------------------------------------------------------
// DASHBOARD API ENDPOINTS
// ------------------------------------------------------

// Overview cards
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

// AMM snapshot
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

// Top token holders
app.get("/api/top-holders", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const result = await pool.query(
      "SELECT account, balance, frozen FROM token_holders_latest ORDER BY balance DESC LIMIT $1;",
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/top-holders:", err);
    res.status(500).json({ error: "Failed to fetch top holders" });
  }
});

// Top LP holders
app.get("/api/top-lp", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const result = await pool.query(
      "SELECT account, lp_balance FROM lp_holders_latest ORDER BY lp_balance DESC LIMIT $1;",
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /api/top-lp:", err);
    res.status(500).json({ error: "Failed to fetch top LP holders" });
  }
});

// TVL history
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

// Holder count over time
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

// LP holder count over time
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
// START SERVER (IMPORTANT: BIND TO 0.0.0.0 FOR RAILWAY)
// ------------------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ API server running on port ${PORT}`);
});

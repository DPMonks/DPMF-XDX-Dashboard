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
import { startIndexerLoop } from "./indexer.js";
import pool from "./db.js";
import { getHealthStatus } from "./health.js";   // <-- UPDATED

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
// HEALTH CHECK (UPDATED)
// ------------------------------------------------------
app.get("/health", (req, res) => {
  res.json(getHealthStatus());   // <-- UPDATED
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
      latest: "/latest",
      amm: "/amm",
      holders: "/holders",
      lp: "/lp"
    }
  });
});

// ------------------------------------------------------
// INDEXER DATA ENDPOINTS (PostgreSQL-backed)
// ------------------------------------------------------

// Latest snapshot (AMM + holders + LP)
app.get("/latest", async (req, res) => {
  try {
    const amm = await pool.query("SELECT * FROM amm_pool LIMIT 1");
    const holders = await pool.query("SELECT * FROM token_holders ORDER BY balance DESC");
    const lp = await pool.query("SELECT * FROM lp_holders ORDER BY lp_balance DESC");

    res.json({
      amm: amm.rows[0] || null,
      holders: holders.rows,
      lp_holders: lp.rows
    });
  } catch (err) {
    console.error("Error in /latest:", err);
    res.status(500).json({ error: "Failed to fetch latest snapshot" });
  }
});

// AMM pool
app.get("/amm", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM amm_pool LIMIT 1");
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error("Error in /amm:", err);
    res.status(500).json({ error: "Failed to fetch AMM state" });
  }
});

// Token holders
app.get("/holders", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM token_holders ORDER BY balance DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /holders:", err);
    res.status(500).json({ error: "Failed to fetch holders" });
  }
});

// LP holders
app.get("/lp", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM lp_holders ORDER BY lp_balance DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error in /lp:", err);
    res.status(500).json({ error: "Failed to fetch LP holders" });
  }
});

// ------------------------------------------------------
// START SERVER
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ API server running on port ${PORT}`);
  console.log("🔄 Starting indexer");
  startIndexerLoop();
});

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

    const
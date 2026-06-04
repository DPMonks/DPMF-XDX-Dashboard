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

// Import storage functions (MUST be at top)
import {
  getLatestSnapshot,
  getAmmState,
  getHolders,
  getLpHolders
} from "./storage.js";

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
  res.json({
    status: "ok",
    timestamp: Date.now(),
    message: "XRPL Indexer API is running"
  });
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
// INDEXER DATA ENDPOINTS
// ------------------------------------------------------

// Latest ledger snapshot
app.get("/latest", async (req, res) => {
  try {
    const latest = await getLatestSnapshot();
    res.json(latest);
  } catch (err) {
    console.error("Error in /latest:", err);
    res.status(500).json({ error: "Failed to fetch latest snapshot" });
  }
});

// AMM pool state
app.get("/amm", async (req, res) => {
  try {
    const amm = await getAmmState();
    res.json(amm);
  } catch (err) {
    console.error("Error in /amm:", err);
    res.status(500).json({ error: "Failed to fetch AMM state" });
  }
});

// Token holders
app.get("/holders", async (req, res) => {
  try {
    const holders = await getHolders();
    res.json(holders);
  } catch (err) {
    console.error("Error in /holders:", err);
    res.status(500).json({ error: "Failed to fetch holders" });
  }
});

// LP holders
app.get("/lp", async (req, res) => {
  try {
    const lp = await getLpHolders();
    res.json(lp);
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


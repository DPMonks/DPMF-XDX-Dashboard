import express from "express";
import cors from "cors";
import { startIndexerLoop } from "./indexer.js";
import { pool } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------------------------------
// API ENDPOINTS
// ------------------------------------------------------

// Get AMM pool info
app.get("/api/amm", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM amm_pool LIMIT 1");
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error("AMM API error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get XDX token holders
app.get("/api/holders", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM token_holders ORDER BY balance DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Holders API error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// Get LP token holders
app.get("/api/lp", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM lp_holders ORDER BY lp_balance DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("LP API error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ------------------------------------------------------
// START SERVER + INDEXER
// ------------------------------------------------------

// Railway will inject PORT dynamically
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

// Start the indexer loop
startIndexerLoop();

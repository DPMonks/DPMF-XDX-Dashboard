import express from "express";
import { pool } from "./db.js";

export const router = express.Router();

// --- AMM POOL ---
router.get("/amm", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM amm_pool LIMIT 1");
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error("Error fetching AMM pool:", err);
    res.status(500).json({ error: "Failed to fetch AMM pool" });
  }
});

// --- XDX HOLDERS ---
router.get("/holders", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT address, balance FROM token_holders ORDER BY balance DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching holders:", err);
    res.status(500).json({ error: "Failed to fetch holders" });
  }
});

// --- LP HOLDERS ---
router.get("/lp", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT address, lp_balance, share_percent FROM lp_holders ORDER BY share_percent DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching LP holders:", err);
    res.status(500).json({ error: "Failed to fetch LP holders" });
  }
});

// --- STATS ---
router.get("/stats", async (req, res) => {
  try {
    const amm = await pool.query("SELECT * FROM amm_pool LIMIT 1");
    const holders = await pool.query("SELECT COUNT(*) FROM token_holders");
    const lp = await pool.query("SELECT COUNT(*) FROM lp_holders");

    res.json({
      amm_pool: amm.rows[0] || {},
      total_holders: Number(holders.rows[0].count),
      total_lp_holders: Number(lp.rows[0].count)
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

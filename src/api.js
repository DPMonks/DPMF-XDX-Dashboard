// /src/api.js

import express from "express";
import pool from "./db.js";

export const router = express.Router();

/* ------------------------------------------------------
   AMM SNAPSHOT (LATEST)
------------------------------------------------------ */
router.get("/amm", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM amm_pool_latest WHERE pool_name = 'XDX';"
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error("Error fetching AMM snapshot:", err);
    res.status(500).json({ error: "Failed to fetch AMM snapshot" });
  }
});

/* ------------------------------------------------------
   TOP TOKEN HOLDERS (LATEST)
------------------------------------------------------ */
router.get("/holders", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const result = await pool.query(
      "SELECT account, balance, frozen FROM token_holders_latest ORDER BY balance DESC LIMIT $1;",
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching holders:", err);
    res.status(500).json({ error: "Failed to fetch holders" });
  }
});

/* ------------------------------------------------------
   TOP LP HOLDERS (LATEST)
------------------------------------------------------ */
router.get("/lp", async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const result = await pool.query(
      "SELECT account, lp_balance FROM lp_holders_latest ORDER BY lp_balance DESC LIMIT $1;",
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching LP holders:", err);
    res.status(500).json({ error: "Failed to fetch LP holders" });
  }
});

/* ------------------------------------------------------
   DASHBOARD OVERVIEW
------------------------------------------------------ */
router.get("/stats", async (req, res) => {
  try {
    const amm = await pool.query(
      "SELECT reserve_asset, reserve_currency, lp_supply FROM amm_pool_latest WHERE pool_name = 'XDX';"
    );
    const holders = await pool.query(
      "SELECT COUNT(*) AS holder_count FROM token_holders_latest;"
    );
    const lp = await pool.query(
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
      lp_holder_count: Number(lp.rows[0]?.lp_holder_count || 0)
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/* ------------------------------------------------------
   TVL HISTORY (CHART)
------------------------------------------------------ */
router.get("/charts/tvl", async (req, res) => {
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
    console.error("Error fetching TVL history:", err);
    res.status(500).json({ error: "Failed to fetch TVL history" });
  }
});

/* ------------------------------------------------------
   TOKEN HOLDER COUNT HISTORY (CHART)
------------------------------------------------------ */
router.get("/charts/holders", async (req, res) => {
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
    console.error("Error fetching holders history:", err);
    res.status(500).json({ error: "Failed to fetch holders history" });
  }
});

/* ------------------------------------------------------
   LP HOLDER COUNT HISTORY (CHART)
------------------------------------------------------ */
router.get("/charts/lp-holders", async (req, res) => {
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
    console.error("Error fetching LP holders history:", err);
    res.status(500).json({ error: "Failed to fetch LP holders history" });
  }
});

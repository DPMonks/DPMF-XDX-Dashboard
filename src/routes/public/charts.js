import express from "express";
import db from "../../db.js"; // adjust path if needed

const router = express.Router();

/**
 * HOLDERS HISTORY
 * Returns daily holder count
 */
router.get("/holders", async (req, res) => {
  try {
    const rows = await db`
      SELECT day, holder_count
      FROM holders_history
      ORDER BY day ASC
    `;
    res.json(rows);
  } catch (err) {
    console.error("Holders history error:", err);
    res.status(500).json({ error: "Failed to load holders history" });
  }
});

/**
 * LP HOLDERS HISTORY
 * Returns daily LP holder count
 */
router.get("/lp-holders", async (req, res) => {
  try {
    const rows = await db`
      SELECT day, lp_holder_count
      FROM lp_holders_history
      ORDER BY day ASC
    `;
    res.json(rows);
  } catch (err) {
    console.error("LP holders history error:", err);
    res.status(500).json({ error: "Failed to load LP holders history" });
  }
});

/**
 * TVL HISTORY
 * Returns daily TVL values
 */
router.get("/tvl", async (req, res) => {
  try {
    const rows = await db`
      SELECT day, tvl
      FROM tvl_history
      ORDER BY day ASC
    `;
    res.json(rows);
  } catch (err) {
    console.error("TVL history error:", err);
    res.status(500).json({ error: "Failed to load TVL history" });
  }
});

export default router;

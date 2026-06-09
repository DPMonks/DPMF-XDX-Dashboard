import pool from "./db.js";

export async function getState(key) {
  const res = await pool.query(
    "SELECT value FROM indexer_state WHERE key = $1",
    [key]
  );
  return res.rows[0]?.value || null;
}

export async function setState(key, value) {
  await pool.query(
    `INSERT INTO indexer_state (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`,
    [key, value]
  );
}

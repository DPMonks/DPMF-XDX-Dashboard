import pool from "./db.js";
import { logger } from "./utils/logger.js";

// ------------------------------------------------------
// AMM SNAPSHOT WRITER
// ------------------------------------------------------
export async function writeAmmSnapshot(poolName, amm) {
  if (!amm) return;

  try {
    const rA = amm.reserve_asset || "0";
    const rC = amm.reserve_currency || "0";
    const lp = amm.lp_supply || "0";
    const fee = amm.trading_fee || "0";

    // LATEST
    await pool.query(
      `INSERT INTO amm_pool_latest 
        (pool_name, asset, currency, reserve_asset, reserve_currency, lp_supply, trading_fee, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
       ON CONFLICT (pool_name)
       DO UPDATE SET 
         asset = EXCLUDED.asset,
         currency = EXCLUDED.currency,
         reserve_asset = EXCLUDED.reserve_asset,
         reserve_currency = EXCLUDED.reserve_currency,
         lp_supply = EXCLUDED.lp_supply,
         trading_fee = EXCLUDED.trading_fee,
         timestamp = NOW();`,
      [
        poolName,
        amm.asset,
        amm.currency,
        rA,
        rC,
        lp,
        fee
      ]
    );

    // HISTORY
    await pool.query(
      `INSERT INTO amm_pool_history 
        (pool_name, asset, currency, reserve_asset, reserve_currency, lp_supply, trading_fee, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW());`,
      [
        poolName,
        amm.asset,
        amm.currency,
        rA,
        rC,
        lp,
        fee
      ]
    );

    logger.info("DB", `AMM snapshot written for ${poolName}`);
  } catch (err) {
    logger.error("DB", `Error writing AMM snapshot for ${poolName}`, err);
  }
}

// ------------------------------------------------------
// TOKEN HOLDERS WRITER
// ------------------------------------------------------
export async function writeTokenHolders(holders) {
  if (!holders || holders.length === 0) return;

  try {
    // UPSERT LATEST
    for (const h of holders) {
      await pool.query(
        `INSERT INTO token_holders_latest (account, balance, frozen, timestamp)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (account)
         DO UPDATE SET 
           balance = EXCLUDED.balance,
           frozen = EXCLUDED.frozen,
           timestamp = NOW();`,
        [
          h.account,
          h.balance || "0",          // 🔥 keep as string (15 decimals safe)
          Boolean(h.frozen) || false
        ]
      );
    }

    // HISTORY (batch insert)
    const values = holders
      .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3}, NOW())`)
      .join(",");

    const params = holders.flatMap(h => [
      h.account,
      h.balance || "0",             // 🔥 keep as string
      Boolean(h.frozen) || false
    ]);

    await pool.query(
      `INSERT INTO token_holders_history (account, balance, frozen, timestamp)
       VALUES ${values};`,
      params
    );

    logger.info("DB", `Token holders written: ${holders.length}`);
  } catch (err) {
    logger.error("DB", "Error writing token holders", err);
  }
}

// ------------------------------------------------------
// LP HOLDERS WRITER
// ------------------------------------------------------
export async function writeLpHolders(lpHolders) {
  if (!lpHolders || lpHolders.length === 0) return;

  try {
    // UPSERT LATEST
    for (const h of lpHolders) {
      await pool.query(
        `INSERT INTO lp_holders_latest (account, lp_balance, timestamp)
         VALUES ($1,$2,NOW())
         ON CONFLICT (account)
         DO UPDATE SET 
           lp_balance = EXCLUDED.lp_balance,
           timestamp = NOW();`,
        [
          h.account,
          h.lp_balance || "0"        // 🔥 keep as string
        ]
      );
    }

    // HISTORY (batch insert)
    const values = lpHolders
      .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2}, NOW())`)
      .join(",");

    const params = lpHolders.flatMap(h => [
      h.account,
      h.lp_balance || "0"           // 🔥 keep as string
    ]);

    await pool.query(
      `INSERT INTO lp_holders_history (account, lp_balance, timestamp)
       VALUES ${values};`,
      params
    );

    logger.info("DB", `LP holders written: ${lpHolders.length}`);
  } catch (err) {
    logger.error("DB", "Error writing LP holders", err);
  }
}

// ------------------------------------------------------
// DAILY HOLDERS HISTORY
// ------------------------------------------------------
export async function writeHoldersHistory(count) {
  try {
    await pool.query(
      `INSERT INTO holders_history (day, holder_count)
       VALUES (CURRENT_DATE, $1)
       ON CONFLICT (day)
       DO UPDATE SET holder_count = EXCLUDED.holder_count;`,
      [count]
    );

    logger.info("DB", `Holders history updated: ${count}`);
  } catch (err) {
    logger.error("DB", "Error writing holders history", err);
  }
}

// ------------------------------------------------------
// DAILY LP HOLDERS HISTORY
// ------------------------------------------------------
export async function writeLpHoldersHistory(count) {
  try {
    await pool.query(
      `INSERT INTO lp_holders_history_daily (day, lp_holder_count)
       VALUES (CURRENT_DATE, $1)
       ON CONFLICT (day)
       DO UPDATE SET lp_holder_count = EXCLUDED.lp_holder_count;`,
      [count]
    );

    logger.info("DB", `LP holders history updated: ${count}`);
  } catch (err) {
    logger.error("DB", "Error writing LP holders history", err);
  }
}

// ------------------------------------------------------
// DAILY TVL HISTORY
// ------------------------------------------------------
export async function writeTvlHistory(tvl) {
  try {
    await pool.query(
      `INSERT INTO tvl_history (day, tvl)
       VALUES (CURRENT_DATE, $1)
       ON CONFLICT (day)
       DO UPDATE SET tvl = EXCLUDED.tvl;`,
      [tvl || "0"]
    );

    logger.info("DB", `TVL history updated: ${tvl}`);
  } catch (err) {
    logger.error("DB", "Error writing TVL history", err);
  }
}

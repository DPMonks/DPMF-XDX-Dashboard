import pool from "./db.js";
import { logger } from "./utils/logger.js";

// Helper to extract numeric value safely
function num(x) {
  if (!x) return 0;
  if (typeof x === "string") return Number(x);
  if (typeof x === "number") return x;
  if (typeof x === "object" && x.value) return Number(x.value);
  return 0;
}

// ------------------------------------------------------
// AMM SNAPSHOT WRITER
// ------------------------------------------------------
export async function writeAmmSnapshot(poolName, amm) {
  if (!amm) return;

  try {
    const rA = num(amm.reserve_asset);
    const rC = num(amm.reserve_currency);
    const lp = num(amm.lp_supply);
    const fee = num(amm.trading_fee);

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
    // UPSERT latest (one row at a time)
    for (const h of holders) {
      await pool.query(
        `INSERT INTO token_holders_latest (account, balance, frozen, timestamp)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (account)
         DO UPDATE SET 
           balance = EXCLUDED.balance,
           frozen = EXCLUDED.frozen,
           timestamp = NOW();`,
        [h.account, num(h.balance), h.frozen || false]
      );
    }

    // HISTORY — batch insert
    const values = holders
      .map((h, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`)
      .join(",");

    const params = holders.flatMap(h => [
      h.account,
      num(h.balance),
      h.frozen || false
    ]);

    await pool.query(
      `INSERT INTO token_holders_history (account, balance, frozen)
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
    // UPSERT latest
    for (const h of lpHolders) {
      await pool.query(
        `INSERT INTO lp_holders_latest (account, lp_balance, timestamp)
         VALUES ($1,$2,NOW())
         ON CONFLICT (account)
         DO UPDATE SET 
           lp_balance = EXCLUDED.lp_balance,
           timestamp = NOW();`,
        [h.account, num(h.lp_balance)]
      );
    }

    // HISTORY — batch insert
    const values = lpHolders
      .map((h, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
      .join(",");

    const params = lpHolders.flatMap(h => [
      h.account,
      num(h.lp_balance)
    ]);

    await pool.query(
      `INSERT INTO lp_holders_history (account, lp_balance)
       VALUES ${values};`,
      params
    );

    logger.info("DB", `LP holders written: ${lpHolders.length}`);
  } catch (err) {
    logger.error("DB", "Error writing LP holders", err);
  }
}

console.log("[DB] dbWriter loaded");

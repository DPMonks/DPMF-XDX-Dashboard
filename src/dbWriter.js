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

import { fetchAmm } from "./tasks/amm.js";
import { fetchLpHolders } from "./tasks/lp.js";
import { fetchHolders } from "./tasks/holders.js";
import pools from "./pools.js";
import { logger } from "./utils/logger.js";

// Delay helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processPool(pool) {
  logger.info("POOL", `Processing AMM pool: ${pool.name}`);

  // -------------------------
  // 1. AMM INFO
  // -------------------------
  const amm = await fetchAmm(pool);
  if (!amm) {
    logger.warn("AMM", "No AMM data returned");
  } else {
    logger.info("AMM", "Retrieved AMM info");
  }

  // -------------------------
  // 2. LP HOLDERS
  // -------------------------
  const lp = await fetchLpHolders(pool);
  if (!lp) {
    logger.warn("LP", "No LP token data returned");
  } else {
    logger.info("LP", "Retrieved LP token info");
  }

  // -------------------------
  // 3. HOLDERS (trustlines)
  // -------------------------
  const holders = await fetchHolders(pool.issuer);
  if (!holders || holders.length === 0) {
    logger.warn("HOLDERS", "No trustlines returned");
  } else {
    logger.info("HOLDERS", `Retrieved ${holders.length} trustlines`);
  }

  // -------------------------
  // 4. Save to DB (optional)
  // -------------------------
  // TODO: Add your PostgreSQL insert/update logic here
  // pool, amm, lp, holders

  logger.info("POOL", `Finished processing ${pool.name}`);
}

async function startIndexer() {
  logger.info("SYSTEM", "XDX Indexer Started");

  while (true) {
    logger.cycle("Starting new indexer cycle");
    const cycleStart = Date.now();

    for (const pool of pools) {
      try {
        await processPool(pool);
      } catch (err) {
        logger.error("POOL", `Error processing ${pool.name}`, err);
      }

      // Small delay between pools
      await sleep(1500);
    }

    const cycleEnd = Date.now();
    const duration = ((cycleEnd - cycleStart) / 1000).toFixed(2);

    logger.info("SYSTEM", `Cycle completed in ${duration}s`);
    logger.info("SYSTEM", "Waiting 30 seconds before next cycle");

    await sleep(30000);
  }
}

startIndexer();

// /src/indexer.js

import { fetchAmm } from "./tasks/amm.js";
import { fetchLpHolders } from "./tasks/lp.js";
import { fetchHolders } from "./tasks/holders.js";
import pools from "./pools.js";
import { logger } from "./utils/logger.js";
import { updateHealthTimestamp } from "./health.js";
import {
  writeAmmSnapshot,
  writeTokenHolders,
  writeLpHolders
} from "./dbWriter.js";

import "./server.js"; // start API + health server

// Delay helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Global crash protection
process.on("uncaughtException", (err) => {
  logger.error("SYSTEM", "Uncaught exception", err);
});

process.on("unhandledRejection", (err) => {
  logger.error("SYSTEM", "Unhandled promise rejection", err);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.warn("SYSTEM", "Received SIGTERM, shutting down...");
  process.exit(0);
});

async function processPool(pool) {
  const start = Date.now();
  logger.info("POOL", `Processing AMM pool: ${pool.name}`);

  // -------------------------
  // 1. AMM INFO
  // -------------------------
  const amm = await fetchAmm(pool);
  if (!amm) {
    logger.warn("AMM", "No AMM data returned");
  } else {
    logger.info("AMM", "Retrieved AMM info");
    await writeAmmSnapshot(pool.name, amm);
  }

  // -------------------------
  // 2. LP HOLDERS
  // -------------------------
  const lp = await fetchLpHolders(pool);
  if (!lp || lp.length === 0) {
    logger.warn("LP", "No LP token data returned");
  } else {
    logger.info("LP", `Retrieved ${lp.length} LP holders`);
    await writeLpHolders(lp);
  }

  // -------------------------
  // 3. HOLDERS (trustlines)
  // -------------------------
  const holders = await fetchHolders(pool.issuer);
  if (!holders || holders.length === 0) {
    logger.warn("HOLDERS", "No trustlines returned");
  } else {
    logger.info("HOLDERS", `Retrieved ${holders.length} trustlines`);
    await writeTokenHolders(holders);
  }

  const end = Date.now();
  logger.info("POOL", `${pool.name} processed in ${end - start}ms`);
}

async function startIndexer() {
  logger.info("SYSTEM", "XDX Indexer Started");

  while (true) {
    logger.cycle("Starting new indexer cycle");
    updateHealthTimestamp(); // heartbeat at cycle start

    const cycleStart = Date.now();

    try {
      for (const pool of pools) {
        try {
          await processPool(pool);
        } catch (err) {
          logger.error("POOL", `Error processing ${pool.name}`, err);
        }

        await sleep(1500); // delay between pools
      }
    } catch (err) {
      logger.error("SYSTEM", "Fatal error in cycle", err);
    }

    const cycleEnd = Date.now();
    const duration = ((cycleEnd - cycleStart) / 1000).toFixed(2);

    logger.info("SYSTEM", `Cycle completed in ${duration}s`);
    updateHealthTimestamp(); // heartbeat at cycle end

    logger.info("SYSTEM", "Waiting 30 seconds before next cycle");
    await sleep(30000);
  }
}

startIndexer();

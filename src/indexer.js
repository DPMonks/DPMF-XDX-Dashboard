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
  writeLpHolders,
  writeHoldersHistory,
  writeLpHoldersHistory,
  writeTvlHistory
} from "./dbWriter.js";

// Delay helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// LP throttling (Option A)
const LP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let lastLpRun = 0;

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

  // 1. AMM INFO (always every cycle)
  const amm = await fetchAmm(pool);
  if (amm) {
    logger.info("AMM", "Retrieved AMM info");
    await writeAmmSnapshot(pool.name, amm);

    // NEW: Write TVL history
    if (amm?.tvl) {
      await writeTvlHistory(amm.tvl);
    }
  } else {
    logger.warn("AMM", "No AMM data returned");
  }

  // 2. LP HOLDERS (OPTION A: only every 5 minutes)
  const now = Date.now();
  if (now - lastLpRun >= LP_INTERVAL_MS) {
    logger.info("LP", "Running LP analytics (5‑minute interval)");
    const lp = await fetchLpHolders(pool);
    if (lp?.length) {
      logger.info("LP", `Retrieved ${lp.length} LP holders`);
      await writeLpHolders(lp);

      // NEW: Write LP holders history
      await writeLpHoldersHistory(lp.length);
    } else {
      logger.warn("LP", "No LP token data returned");
    }
    lastLpRun = now;
  } else {
    logger.info("LP", "Skipping LP sync (waiting for 5‑minute interval)");
  }

  // 3. HOLDERS (always every cycle)
  const holders = await fetchHolders(pool.issuer);
  if (holders?.length) {
    logger.info("HOLDERS", `Retrieved ${holders.length} trustlines`);
    await writeTokenHolders(holders);

    // NEW: Write holders history
    await writeHoldersHistory(holders.length);
  } else {
    logger.warn("HOLDERS", "No trustlines returned");
  }

  const end = Date.now();
  logger.info("POOL", `${pool.name} processed in ${end - start}ms`);
}

async function startIndexer() {
  logger.info("SYSTEM", "XDX Indexer Started");

  while (true) {
    logger.cycle("Starting new indexer cycle");
    updateHealthTimestamp();

    const cycleStart = Date.now();

    try {
      for (const pool of pools) {
        try {
          await processPool(pool);
        } catch (err) {
          logger.error("POOL", `Error processing ${pool.name}`, err);
        }
        await sleep(1500);
      }
    } catch (err) {
      logger.error("SYSTEM", "Fatal error in cycle", err);
    }

    const cycleEnd = Date.now();
    const duration = ((cycleEnd - cycleStart) / 1000).toFixed(2);

    logger.info("SYSTEM", `Cycle completed in ${duration}s`);
    updateHealthTimestamp();

    logger.info("SYSTEM", "Waiting 30 seconds before next cycle");
    await sleep(30000);
  }
}

startIndexer();

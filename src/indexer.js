import { fetchAmm } from "./tasks/amm.js";
import { fetchLpHolders } from "./tasks/lp.js";
import { fetchHolders } from "./tasks/holders.js";
import pools from "./pools.js"; // You will create this next

// Delay helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function processPool(pool) {
  console.log(`\n[POOL] Processing AMM pool: ${pool.name}`);

  // -------------------------
  // 1. AMM INFO
  // -------------------------
  const amm = await fetchAmm(pool);
  if (!amm) {
    console.warn("[AMM] No AMM data returned");
  } else {
    console.log("[AMM] Retrieved AMM info");
  }

  // -------------------------
  // 2. LP HOLDERS
  // -------------------------
  const lp = await fetchLpHolders(pool);
  if (!lp) {
    console.warn("[LP] No LP token data returned");
  } else {
    console.log("[LP] Retrieved LP token info");
  }

  // -------------------------
  // 3. HOLDERS (trustlines)
  // -------------------------
  const holders = await fetchHolders(pool.issuer);
  if (!holders || holders.length === 0) {
    console.warn("[HOLDERS] No trustlines returned");
  } else {
    console.log(`[HOLDERS] Retrieved ${holders.length} trustlines`);
  }

  // -------------------------
  // 4. Save to DB (optional)
  // -------------------------
  // TODO: Add your PostgreSQL insert/update logic here
  // pool, amm, lp, holders

  console.log(`[POOL] Finished processing ${pool.name}`);
}

async function startIndexer() {
  console.log("🚀 XDX Indexer Started");

  while (true) {
    console.log("\n==============================");
    console.log("🔄 Starting new indexer cycle");
    console.log("==============================");

    for (const pool of pools) {
      try {
        await processPool(pool);
      } catch (err) {
        console.error(`[POOL ERROR] ${pool.name}`, err);
      }

      // Small delay between pools
      await sleep(1500);
    }

    console.log("⏳ Cycle complete. Waiting 30 seconds...");
    await sleep(30000);
  }
}

startIndexer();

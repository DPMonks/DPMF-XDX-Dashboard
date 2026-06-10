// /src/tokenHolderScanner.js

import { fetchLedgerAccounts, fetchAccountLines } from "./xrplLedgerClient.js";
import { getState, setState } from "./indexerState.js";
import { writeTokenHolders } from "./dbWriter.js";
import { logger } from "./utils/logger.js";
import pools from "./pools.js";

const TOKEN_CURRENCY = "XDX";
const ISSUER = pools[0].issuer;
const CONCURRENCY = 10;

export async function runHolderScanCycle() {
  const marker = await getState("holders_marker");

  const { accounts, marker: nextMarker } = await fetchLedgerAccounts(marker);

  logger.info(
    "HOLDERS",
    `Scanning ${accounts.length} accounts (marker=${marker || "start"})`
  );

  const chunks = [];
  for (let i = 0; i < accounts.length; i += CONCURRENCY) {
    chunks.push(accounts.slice(i, i + CONCURRENCY));
  }

  const allHolders = [];

  for (const chunk of chunks) {
    const promises = chunk.map(async (account) => {
      try {
        const lines = await fetchAccountLines(account);

        if (!lines || !Array.isArray(lines)) return [];

        // Filter for XDX trustlines
        const xdxLines = lines.filter(
          l => l.currency === TOKEN_CURRENCY && l.issuer === ISSUER
        );

        // Convert balances and remove zero-balance entries
        return xdxLines
          .map(l => {
            const raw = Number(l.balance);

            // Convert issuer-side negatives to positive holder balances
            const holderBalance = Math.abs(raw);

            return {
              account,
              balance: holderBalance,
              frozen: Boolean(l.freeze) || false
            };
          })
          .filter(h => h.balance > 0); // Remove zero balances

      } catch (err) {
        logger.error("HOLDERS", `Error scanning account ${account}`, err);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(r => allHolders.push(...r));
  }

  if (allHolders.length > 0) {
    await writeTokenHolders(allHolders);
    logger.info("HOLDERS", `Indexed ${allHolders.length} XDX holders`);
  }

  if (nextMarker) {
    await setState("holders_marker", nextMarker);
  } else {
    logger.info("HOLDERS", "Full ledger scan complete — resetting marker");
    await setState("holders_marker", "");
  }
}

// /src/lpHolderScanner.js

import { fetchLedgerAccounts, fetchAccountLines } from "./xrplLedgerClient.js";
import { getState, setState } from "./indexerState.js";
import { writeLpHolders, writeLpHoldersHistory } from "./dbWriter.js";
import { logger } from "./utils/logger.js";
import pools from "./pools.js";

const LP_CURRENCY = pools[0].lpToken;
const LP_ISSUER = pools[0].issuer;
const CONCURRENCY = 20;

export async function runLpHolderScanCycle() {
  const marker = await getState("lp_holders_marker");

  const { accounts, marker: nextMarker } = await fetchLedgerAccounts(marker);

  logger.info(
    "LP",
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

        const lpLines = lines.filter(
          l => l.currency === LP_CURRENCY && l.issuer === LP_ISSUER
        );

        return lpLines
          .map(l => {
            const raw = Number(l.balance);
            const lpBalance = Math.abs(raw);

            return {
              account,
              lp_balance: lpBalance
            };
          })
          .filter(h => h.lp_balance > 0);

      } catch (err) {
        logger.error("LP", `Error scanning account ${account}`, err);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(r => allHolders.push(...r));
  }

  if (allHolders.length > 0) {
    await writeLpHolders(allHolders);          // writes lp_holders_latest
    await writeLpHoldersHistory(allHolders);   // writes lp_holders_history_daily
    logger.info("LP", `Indexed ${allHolders.length} LP holders`);
  }

  if (nextMarker) {
    await setState("lp_holders_marker", nextMarker);
  } else {
    logger.info("LP", "Full LP ledger scan complete — resetting marker");
    await setState("lp_holders_marker", "");
  }
}

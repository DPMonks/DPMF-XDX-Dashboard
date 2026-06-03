import { client, rpc } from "./xrplClient.js";
import { pool } from "./db.js";
import { config } from "./config.js";

// ------------------------------------------------------
// INDEXER LOOP
// ------------------------------------------------------
export async function startIndexerLoop() {
  console.log("[INDEXER] Loop started");

  // Wait until both XRPL clients are connected
  if (!client.isConnected() || !rpc.isConnected()) {
    console.log("[INDEXER] Waiting for XRPL connection...");
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (client.isConnected() && rpc.isConnected()) {
          clearInterval(check);
          resolve();
        }
      }, 1000);
    });
  }

  console.log("[INDEXER] XRPL connected, starting sync...");

  // Start periodic syncs
  setInterval(syncAmmPool, config.ammSyncInterval);
  setInterval(syncTokenHolders, config.holdersSyncInterval);
  setInterval(syncLpHolders, config.lpSyncInterval);

  // Run initial sync immediately
  await syncAmmPool();
  await syncTokenHolders();
  await syncLpHolders();
}

// ------------------------------------------------------
// AMM POOL SYNC
// ------------------------------------------------------
async function syncAmmPool() {
  try {
    const ammInfo = await client.request({
      command: "amm_info",
      asset: {
        currency: config.xdxCurrency,
        issuer: config.xdxIssuer
      },
      asset2: {
        currency: "XRP"
      }
    });

    const poolData = ammInfo.result;

    await pool.query("DELETE FROM amm_pool");
    await pool.query(
      "INSERT INTO amm_pool (asset, asset2, lp_token, trading_fee) VALUES ($1,$2,$3,$4)",
      [
        poolData.asset.currency,
        poolData.asset2.currency,
        poolData.lp_token.currency,
        poolData.trading_fee
      ]
    );

    console.log("[AMM] Pool synced");
  } catch (err) {
    console.error("AMM sync error:", err);
  }
}

// ------------------------------------------------------
// TOKEN HOLDERS SYNC
// ------------------------------------------------------
async function syncTokenHolders() {
  try {
    const lines = await rpc.request({
      method: "account_lines",
      params: [
        {
          account: config.xdxIssuer,
          ledger_index: "validated"
        }
      ]
    });

    const holders = lines.result.lines.filter(
      (l) => l.currency === config.xdxCurrency && parseFloat(l.balance) > 0
    );

    await pool.query("DELETE FROM token_holders");
    for (const h of holders) {
      await pool.query(
        "INSERT INTO token_holders (account, balance) VALUES ($1,$2)",
        [h.account, h.balance]
      );
    }

    console.log(`[HOLDERS] XDX holders synced: ${holders.length}`);
  } catch (err) {
    console.error("Holder sync error:", err);
  }
}

// ------------------------------------------------------
// LP HOLDERS SYNC
// ------------------------------------------------------
async function syncLpHolders() {
  try {
    const lines = await rpc.request({
      method: "account_lines",
      params: [
        {
          account: config.xdxIssuer,
          ledger_index: "validated"
        }
      ]
    });

    const lpHolders = lines.result.lines.filter(
      (l) => l.currency === config.lpCurrency && parseFloat(l.balance) > 0
    );

    await pool.query("DELETE FROM lp_holders");
    for (const h of lpHolders) {
      await pool.query(
        "INSERT INTO lp_holders (account, lp_balance) VALUES ($1,$2)",
        [h.account, h.balance]
      );
    }

    console.log(`[LP] LP holders synced: ${lpHolders.length}`);
  } catch (err) {
    console.error("LP sync error:", err);
  }
}

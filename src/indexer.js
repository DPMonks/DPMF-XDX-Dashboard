import { wsClient, rpcRequest } from "./xrplClient.js";
import pool from "./db.js";
import { config } from "./config.js";

// ------------------------------------------------------
// INDEXER LOOP
// ------------------------------------------------------
export async function startIndexerLoop() {
  console.log("[INDEXER] Loop started");

  // Wait for WebSocket connection
  if (!wsClient.isConnected()) {
    console.log("[INDEXER] Waiting for XRPL WebSocket...");
    await new Promise((resolve) => {
      const check = setInterval(() => {
        if (wsClient.isConnected()) {
          clearInterval(check);
          resolve();
        }
      }, 1000);
    });
  }

  console.log("[INDEXER] XRPL WebSocket connected, starting sync...");

  // Start periodic syncs
  setInterval(syncAmmPool, config.ammSyncInterval);
  setInterval(syncTokenHolders, config.holdersSyncInterval);
  setInterval(syncLpHolders, config.lpSyncInterval);

  // Initial sync
  await syncAmmPool();
  await syncTokenHolders();
  await syncLpHolders();
}

// ------------------------------------------------------
// AMM POOL SYNC (RPC instead of WebSocket)
// ------------------------------------------------------
async function syncAmmPool() {
  try {
    const response = await rpcRequest({
      method: "amm_info",
      params: [
        {
          asset: {
            currency: config.xdxCurrency,
            issuer: config.xdxIssuer
          },
          asset2: {
            currency: "XRP"
          },
          ledger_index: "current"   // 🔥 REQUIRED FOR PUBLIC RIPPLE SERVERS
        }
      ]
    });

    if (!response || !response.result || !response.result.amm) {
      console.error("[AMM] No AMM data returned");
      return;
    }

    const poolData = response.result.amm;

    await pool.query("DELETE FROM amm_pool");
    await pool.query(
      "INSERT INTO amm_pool (asset, asset2, lp_token, trading_fee) VALUES ($1,$2,$3,$4)",
      [
        poolData.amount.currency,
        "XRP",
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
// TOKEN HOLDERS SYNC (RPC)
// ------------------------------------------------------
async function syncTokenHolders() {
  try {
    const response = await rpcRequest({
      method: "account_lines",
      params: [
        {
          account: config.xdxIssuer,
          ledger_index: "validated"
        }
      ]
    });

    if (!response || !response.result) {
      console.error("[HOLDERS] RPC returned no result");
      return;
    }

    const holders = response.result.lines.filter(
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
// LP HOLDERS SYNC (RPC)
// ------------------------------------------------------
async function syncLpHolders() {
  try {
    const response = await rpcRequest({
      method: "account_lines",
      params: [
        {
          account: config.xdxIssuer,
          ledger_index: "validated"
        }
      ]
    });

    if (!response || !response.result) {
      console.error("[LP] RPC returned no result");
      return;
    }

    const lpHolders = response.result.lines.filter(
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


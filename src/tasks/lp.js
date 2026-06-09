import { rpcRequest } from "../xrplClient.js";

/**
 * Fetch LP token holders for the AMM pool.
 *
 * LP tokens on XRPL ALWAYS use a 40‑byte HEX currency code.
 * Example: "4C50580000000000000000000000000000000000"
 *
 * @param {string} issuer - The AMM LP token issuer (the AMM account)
 * @param {string} lpCurrencyHex - The 160‑bit HEX currency code for the LP token
 */
export async function fetchLpHolders(issuer, lpCurrencyHex) {
  try {
    const body = {
      method: "account_lines",
      params: [
        {
          account: issuer,
          ledger_index: "current"
        }
      ]
    };

    const res = await rpcRequest(body);

    if (!res?.result?.lines) {
      console.warn("[LP] No trustlines returned");
      return [];
    }

    // 🔥 Filter ONLY LP trustlines (LP tokens ALWAYS use HEX)
    const filtered = res.result.lines.filter(
      line => line.currency === lpCurrencyHex
    );

    // 🔥 Preserve full precision (string, not Number)
    const lpHolders = filtered.map(line => ({
      account: line.account,
      lp_balance: line.balance || "0",   // 15‑decimal safe
      frozen: Boolean(line.freeze) || false
    }));

    return lpHolders;

  } catch (err) {
    console.error("[LP ERROR]", err);
    return [];
  }
}

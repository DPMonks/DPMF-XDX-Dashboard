import { rpcRequest } from "../xrplClient.js";

/**
 * Fetch all trustlines for the issuer and return ONLY the trustlines
 * for the XDX token (3‑letter ASCII currency).
 *
 * @param {string} issuer - The issuer account of the token
 * @param {boolean} excludeZeroBalances - Optional flag to remove 0‑balance trustlines
 */
export async function fetchHolders(issuer, excludeZeroBalances = false) {
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
      console.warn("[HOLDERS] No trustlines returned");
      return [];
    }

    // 🔥 Filter ONLY XDX trustlines (ASCII, not HEX)
    let filtered = res.result.lines.filter(line => line.currency === "XDX");

    // 🔥 Optionally remove zero balances
    if (excludeZeroBalances) {
      filtered = filtered.filter(line => Number(line.balance) !== 0);
    }

    // 🔥 Preserve full precision (string, not Number)
    const holders = filtered.map(line => ({
      account: line.account,
      balance: line.balance || "0",
      frozen: Boolean(line.freeze) || false
    }));

    return holders;

  } catch (err) {
    console.error("[HOLDERS ERROR]", err);
    return [];
  }
}

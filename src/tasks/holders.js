import { rpcRequest } from "../xrplClient.js";

/**
 * Fetch all trustlines for the issuer and return ONLY the trustlines
 * for the XDX token (3‑letter ASCII currency).
 *
 * @param {string} issuer - The issuer account of the token
 */
export async function fetchHolders(issuer) {
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
    const filtered = res.result.lines.filter(
      line => line.currency === "XDX"
    );

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

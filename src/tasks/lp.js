import { rpcRequest } from "../xrplClient.js";

export async function fetchLpHolders(pool) {
  try {
    const issuer = pool.amm_issuer;
    const lpCurrencyHex = pool.lp_currency_hex;

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

    const filtered = res.result.lines.filter(
      line => line.currency === lpCurrencyHex
    );

    return filtered.map(line => ({
      account: line.account,
      lp_balance: line.balance || "0",
      frozen: Boolean(line.freeze) || false
    }));

  } catch (err) {
    console.error("[LP ERROR]", err);
    return [];
  }
}

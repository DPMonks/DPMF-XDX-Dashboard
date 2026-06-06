import { rpcRequest } from "../xrplClient.js";

export async function fetchAmm(pool) {
  try {
    const body = {
      method: "amm_info",
      params: [
        {
          asset: pool.asset,
          asset2: pool.asset2,
          ledger_index: "current"   // 🔥 REQUIRED for Clio
        }
      ]
    };

    const res = await rpcRequest(body);

    if (!res || !res.result || !res.result.amm) {
      console.warn("[AMM] No AMM data returned");
      return null;
    }

    return res.result.amm;

  } catch (err) {
    console.error("[AMM ERROR]", err);
    return null;
  }
}

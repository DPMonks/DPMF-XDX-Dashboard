import { rpcRequest } from "../xrplClient.js";

export async function fetchLpHolders(pool) {
  try {
    const body = {
      method: "amm_lp_info",
      params: [
        {
          asset: pool.asset,
          asset2: pool.asset2
        }
      ]
    };

    const res = await rpcRequest(body);

    if (!res || !res.result || !res.result.lp_token) {
      console.warn("[LP] RPC returned no result");
      return null;
    }

    return res.result.lp_token;

  } catch (err) {
    console.error("[LP ERROR]", err);
    return null;
  }
}

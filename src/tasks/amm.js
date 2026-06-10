import { rpcRequest } from "../xrplClient.js";

export async function fetchAmm(pool) {
  try {
    const body = {
      method: "amm_info",
      params: [
        {
          asset: {
            currency: pool.tokenA,
            issuer: pool.issuer
          },
          asset2: {
            currency: pool.tokenB,
            issuer: pool.tokenB_issuer || undefined
          }
        }
      ]
    };

    const res = await rpcRequest(body);

    if (!res?.result?.amm) {
      console.warn("[AMM] No AMM info returned for", pool.name);
      return null;
    }

    const amm = res.result.amm;

    // Extract numeric values ONLY
    const reserve_asset = amm.amount?.value || "0";
    const reserve_currency = amm.amount2?.value || "0";
    const lp_supply = amm.lp_token?.value || "0";
    const trading_fee = amm.trading_fee || "0";

    // TVL must be numeric
    const tvl = amm.tvl?.value || reserve_asset;

    return {
      asset: pool.tokenA,
      currency: pool.tokenB,
      reserve_asset,
      reserve_currency,
      lp_supply,
      trading_fee,
      tvl
    };

  } catch (err) {
    console.error("[AMM ERROR]", err);
    return null;
  }
}

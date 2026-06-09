import { rpcRequest } from "../xrplClient.js";

/**
 * Fetch AMM info for a given pool.
 *
 * Expects:
 *  - pool.amm_issuer  (AMM account)
 *  - pool.tokenA      (e.g. "XDX")
 *  - pool.tokenB      (e.g. "XRP")
 */
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

    const reserve_asset = amm.amount || "0";
    const reserve_currency = amm.amount2 || "0";
    const lp_supply = amm.lp_token?.value || "0";
    const trading_fee = amm.trading_fee || "0";

    // Simple TVL approximation (you can refine later)
    const tvl = amm.tvl || reserve_asset;

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

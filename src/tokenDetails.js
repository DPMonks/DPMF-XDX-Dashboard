import { XDX_ISSUED_AT, XDX_ISSUER, XDX_TOTAL_SUPPLY } from "./constants/ledger.js";
import { XDX_BLACKHOLED_AT } from "./utils/blackhole.js";
import { fillMissingXdxFiat } from "./utils/fiatFx.js";
import { recordedXdxUsdFromPrices, xrpPerXdx } from "./utils/recordedPrice.js";

function numberOrNull(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    return numberOrNull(value.value ?? value.amount ?? value.balance);
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function countOf(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const count = numberOrNull(value.count);
    if (count != null) return count;
  }
  return fallback ?? null;
}

export function composeTokenDetails({
  overview = {},
  prices = {},
  change = {},
  holders,
  trustlines,
  lpHolders,
  lpTrustlines,
} = {}) {
  const totalSupply =
    numberOrNull(overview.total_supply || overview.totalSupply) || XDX_TOTAL_SUPPLY;
  const issuerLocked =
    numberOrNull(overview.issuer_locked || overview.burned_supply || overview.issuerLocked) || 0;
  const rawCirc = numberOrNull(
    overview.circulating || overview.circulating_supply || overview.xdx_supply
  );
  const circulating = rawCirc && rawCirc > 0 ? rawCirc : Math.max(totalSupply - issuerLocked, 0);
  const filledPrices = fillMissingXdxFiat({ ...overview, ...prices });
  const price =
    recordedXdxUsdFromPrices(filledPrices, filledPrices.xrpUsd || overview.xrpUsd) ||
    recordedXdxUsdFromPrices(
      {
        recorded_price: overview.recorded_price,
        xdxUsd: overview.xdxUsd,
        xrpUsd: overview.xrpUsd,
      },
      overview.xrpUsd
    );
  const tvlUsd = numberOrNull(overview.tvl_usd || overview.tvl);
  const ammMarketCap = numberOrNull(overview.ammMarketCap) || tvlUsd;
  const fdv = totalSupply * price;
  const xrpUsd = numberOrNull(prices.xrpUsd || prices.xrp_usd || overview.xrpUsd);
  const xdxPerXrp = xrpPerXdx(price, xrpUsd);

  return {
    ...overview,
    tokenType: "XDX",
    price,
    xdxUsd: price,
    recorded_price: price,
    xdxPerXrp,
    xdx_per_xrp: xdxPerXrp,
    xrplMarketCap: fdv ?? overview.xrplMarketCap ?? overview.market_cap,
    ammMarketCap,
    circulatingMarketCap: price != null ? circulating * price : overview.circulatingMarketCap,
    circulating,
    totalSupply,
    burnedSupply: issuerLocked,
    issuerLocked,
    holders: countOf(holders, overview.holder_count),
    trustlines: countOf(trustlines, overview.trustline_count ?? overview.trustlines),
    lp_holder_count: countOf(lpHolders, overview.lp_holder_count),
    lp_trustline_count: countOf(lpTrustlines, overview.lp_trustline_count),
    lp_supply: numberOrNull(overview.lp_supply),
    issuer: overview.issuer || XDX_ISSUER,
    issuerFee: overview.issuer_fee,
    blackholed: overview.blackholed ?? true,
    blackholed_fixed: overview.blackholed_fixed ?? true,
    blackholed_at: overview.blackholed_at || XDX_BLACKHOLED_AT,
    created: overview.created || XDX_ISSUED_AT,
    change24h: change.xdx ?? change.XDX,
    source: overview.source,
  };
}

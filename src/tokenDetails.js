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
  // One pair that adds up to the fixed supply, or nothing. Before the issuer
  // read lands, total minus "0 burned" would flash the 10,000,000,000 placeholder.
  const supply = pickLedgerSupply({
    circulating: overview.circulating || overview.circulating_supply || overview.xdx_supply,
    issuer_locked: overview.issuer_locked ?? overview.burned_supply ?? overview.issuerLocked,
  });
  const issuerLocked = supply.issuer_locked;
  const circulating = supply.circulating;
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
    circulatingMarketCap:
      price != null && circulating != null ? circulating * price : numberOrNull(overview.circulatingMarketCap),
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

const SUPPLY_TOLERANCE = 1;

/**
 * Circulating and issuer locked XDX as one consistent pair. The issuer's
 * gateway_balances read (source "xrpl") wins. Anything else must add up to the
 * fixed 10B supply, or neither number is shown.
 */
export function pickLedgerSupply(overview = {}, issuerBody = {}) {
  const issued = numberOrNull(issuerBody?.issued);
  if (issuerBody?.source === "xrpl" && issued != null && issued > 0) {
    const locked = numberOrNull(issuerBody.issuer_locked ?? issuerBody.burned_supply);
    return {
      circulating: issued,
      issuer_locked: locked ?? Math.max(XDX_TOTAL_SUPPLY - issued, 0),
      issued,
    };
  }
  const circ = numberOrNull(overview?.circulating ?? overview?.circulating_supply);
  const locked = numberOrNull(overview?.issuer_locked ?? overview?.burned_supply);
  const circKnown = circ != null && circ > 0;
  const lockedKnown = locked != null && locked > 0;
  if (circKnown && lockedKnown) {
    if (Math.abs(circ + locked - XDX_TOTAL_SUPPLY) > SUPPLY_TOLERANCE) {
      return { circulating: null, issuer_locked: null, issued: null };
    }
    return { circulating: circ, issuer_locked: locked, issued: circ };
  }
  if (circKnown) return { circulating: circ, issuer_locked: Math.max(XDX_TOTAL_SUPPLY - circ, 0), issued: circ };
  if (lockedKnown) {
    const derived = Math.max(XDX_TOTAL_SUPPLY - locked, 0);
    return { circulating: derived, issuer_locked: locked, issued: derived };
  }
  return { circulating: null, issuer_locked: null, issued: null };
}

/**
 * Holder or trust line count. A complete ledger line walk wins outright. The
 * old rule took the larger of two figures, which let a doubled count through.
 */
export function pickLedgerCount(endpointBody, overviewCount, overviewSource) {
  const fromEndpoint = numberOrNull(endpointBody?.count);
  const fromOverview = numberOrNull(overviewCount);
  if (endpointBody?.source === "xrpl-lines" && fromEndpoint != null && fromEndpoint > 0) {
    return { count: fromEndpoint, source: "xrpl-lines", stale: Boolean(endpointBody.stale) };
  }
  if (overviewSource === "xrpl-lines" && fromOverview != null && fromOverview > 0) {
    return { count: fromOverview, source: "xrpl-lines" };
  }
  if (fromEndpoint != null && fromEndpoint > 0) return { count: fromEndpoint };
  if (fromOverview != null && fromOverview > 0) return { count: fromOverview };
  return { count: null };
}

const KEPT_COUNT_KEYS = ["holders", "trustlines", "lp_holder_count", "lp_trustline_count"];

/**
 * A refresh that misses a figure keeps the last one already on screen instead
 * of blanking the tile. Circulating and issuer locked move together.
 */
export function keepKnownTokenDetails(prev, next) {
  if (!prev || !next) return next;
  const out = { ...next };
  if (out.circulating == null && out.issuerLocked == null && prev.circulating != null) {
    out.circulating = prev.circulating;
    out.issuerLocked = prev.issuerLocked;
    out.burnedSupply = prev.burnedSupply ?? prev.issuerLocked;
    out.circulatingMarketCap =
      out.price != null ? prev.circulating * out.price : prev.circulatingMarketCap ?? out.circulatingMarketCap;
  }
  for (const key of KEPT_COUNT_KEYS) {
    if (out[key] == null && prev[key] != null) out[key] = prev[key];
  }
  return out;
}

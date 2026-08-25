import { XDX_ISSUED_AT, XDX_ISSUER, XDX_TOTAL_SUPPLY, XDX_XRPL_TO_MD5 } from "../constants/ledger.js";
import { XDX_BLACKHOLED_AT } from "./blackhole.js";
import { fillMissingXdxFiat, pricesNeedFiat } from "./fiatFx.js";
import { looksLikeXdxVolume, xdxFromXrpVolume } from "./lpVolume.js";
import { looksLikeXrpUsd, recordedXdxUsdFromPrices, xrpPerXdx } from "./recordedPrice.js";

export const XRPL_TO_TOKEN_URL = `https://api.xrpl.to/v1/token/${XDX_XRPL_TO_MD5}`;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parseXrplToToken(payload = {}) {
  const token = payload?.token && typeof payload.token === "object" ? payload.token : payload;
  const exchXrp = Number(token?.exch);
  const usd = Number(token?.usd);
  return {
    holders: Number(token?.holders) || 0,
    trustlines: Number(token?.trustlines || token?.lines) || 0,
    lpHolders: Number(token?.lpHolderCount) || 0,
    exchXrp: Number.isFinite(exchXrp) && exchXrp > 0 && exchXrp < 1 ? exchXrp : 0,
    vol24hXrp: Number(token?.vol24hxrp || token?.vol24h) || 0,
    change24h: Number(token?.pro24h),
    usd: Number.isFinite(usd) && usd > 0 && !looksLikeXrpUsd(usd) ? usd : 0,
    marketcap: num(token?.marketcap),
    tvl: num(token?.tvl),
    source: "xrpl.to",
  };
}

export function xdxUsdFromXrplTo(token = {}, xrpUsd) {
  if (num(token.usd)) return Number(token.usd);
  const xrp = num(xrpUsd);
  if (num(token.exchXrp) && xrp) return Number(token.exchXrp) * xrp;
  return 0;
}

export function tvlUsdFromXrplTo(token = {}, xrpUsd) {
  const raw = num(token.tvl);
  const fx = num(xrpUsd);
  if (!raw) return 0;
  // The XDX card stores pool TVL as 2 × XRP reserve, not USD.
  if (fx && raw < 50_000) return raw * fx;
  return raw;
}

function fxFromXrp(xdxUsd, xrpUsd, xrpFx) {
  return xdxUsd > 0 && xrpUsd > 0 && num(xrpFx) ? xdxUsd * (Number(xrpFx) / Number(xrpUsd)) : 0;
}

export function marketNeedsXrplTo(row = {}) {
  const price = recordedXdxUsdFromPrices(row, row.xrpUsd);
  return !(
    price ||
    num(row.holder_count ?? row.holders ?? row.count) ||
    num(row.trustlines ?? row.trustline_count)
  );
}

export function applyXrplToPrices(prices = {}, token = {}) {
  const xrpUsd = num(prices.xrpUsd ?? prices.XRP);
  const fromToken = xdxUsdFromXrplTo(token, xrpUsd);
  const existing = recordedXdxUsdFromPrices(prices, xrpUsd);
  const xdxUsd = existing || fromToken;
  if (!xdxUsd && !pricesNeedFiat(prices)) return prices;
  const usedToken = !existing && fromToken > 0;
  const next = {
    ...prices,
    xdxUsd: xdxUsd || 0,
    recorded_price: xdxUsd || prices.recorded_price || 0,
    price: xdxUsd || prices.price || 0,
    xdxGbp: num(prices.xdxGbp) || fxFromXrp(xdxUsd, xrpUsd, prices.xrpGbp),
    xdxEur: num(prices.xdxEur) || fxFromXrp(xdxUsd, xrpUsd, prices.xrpEur),
    xdxJpy: num(prices.xdxJpy) || fxFromXrp(xdxUsd, xrpUsd, prices.xrpJpy),
    xdx_per_xrp: num(prices.xdx_per_xrp) || xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
    xdxPerXrp: num(prices.xdxPerXrp) || xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
    source: usedToken
      ? prices.source && prices.source !== "xrpl.to"
        ? "hybrid"
        : "xrpl.to"
      : prices.source || "hybrid",
  };
  return fillMissingXdxFiat(next);
}

export function applyXrplToOverview(overview = {}, token = {}, prices = {}) {
  const priced = applyXrplToPrices({ ...overview, ...prices }, token);
  const xdxUsd = num(priced.xdxUsd);
  const xrpUsd = num(priced.xrpUsd ?? overview.xrpUsd);
  const next = {
    ...overview,
    ...priced,
    holder_count: num(overview.holder_count ?? overview.holders) || num(token.holders) || null,
    holders: num(overview.holders ?? overview.holder_count) || num(token.holders) || null,
    trustlines: num(overview.trustlines ?? overview.trustline_count) || num(token.trustlines) || null,
    trustline_count: num(overview.trustline_count ?? overview.trustlines) || num(token.trustlines) || null,
    lp_holder_count: num(overview.lp_holder_count) || num(token.lpHolders) || null,
    volume24hXrp: num(overview.volume24hXrp) || num(token.vol24hXrp) || null,
    volume24hXdx:
      num(overview.volume24hXdx) ||
      xdxFromXrpVolume(token.vol24hXrp, token.exchXrp || overview.xdxPerXrp || overview.xdx_per_xrp) ||
      (looksLikeXdxVolume(overview.volume24h) ? num(overview.volume24h) : 0) ||
      null,
    volume24hUsd:
      num(overview.volume24hUsd) ||
      (num(token.vol24hXrp) && xrpUsd ? token.vol24hXrp * xrpUsd : null),
    volume24h:
      num(overview.volume24hXdx) ||
      xdxFromXrpVolume(token.vol24hXrp, token.exchXrp || overview.xdxPerXrp || overview.xdx_per_xrp) ||
      (looksLikeXdxVolume(overview.volume24h) ? num(overview.volume24h) : 0) ||
      null,
    tvl: num(overview.tvl_usd ?? overview.tvl) || tvlUsdFromXrplTo(token, xrpUsd) || null,
    tvl_usd: num(overview.tvl_usd ?? overview.tvl) || tvlUsdFromXrplTo(token, xrpUsd) || null,
    ammMarketCap: num(overview.ammMarketCap ?? overview.tvl_usd) || tvlUsdFromXrplTo(token, xrpUsd) || null,
    xrplMarketCap: num(overview.xrplMarketCap) || num(token.marketcap) || XDX_TOTAL_SUPPLY * xdxUsd,
    circulatingMarketCap:
      num(overview.circulatingMarketCap) ||
      num(token.marketcap) ||
      Number(overview.circulating || overview.circulating_supply || XDX_TOTAL_SUPPLY) * xdxUsd,
    issuer: overview.issuer || XDX_ISSUER,
    tokenType: overview.tokenType || "XDX",
    created: overview.created || XDX_ISSUED_AT,
    blackholed: overview.blackholed ?? true,
    blackholed_fixed: overview.blackholed_fixed ?? true,
    blackholed_at: overview.blackholed_at || XDX_BLACKHOLED_AT,
    source: overview.source && overview.source !== "xrpl.to" && xdxUsd ? "hybrid" : priced.source,
  };
  return next;
}

export function applyXrplToChange(change = {}, token = {}) {
  const next = { ...change };
  if (!(Number(next.xdx) || Number(next.XDX)) && Number.isFinite(Number(token.change24h))) {
    next.xdx = Number(token.change24h);
    next.source = next.source && next.source !== "xrpl.to" ? "hybrid" : "xrpl.to";
  }
  return next;
}

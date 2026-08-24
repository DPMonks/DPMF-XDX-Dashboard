import { XDX_TOTAL_SUPPLY, XDX_XRPL_TO_MD5 } from "../constants/ledger.js";
import { looksLikeXrpUsd, xrpPerXdx } from "./recordedPrice.js";

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
  return !(
    num(row.xdxUsd ?? row.recorded_price ?? row.price) ||
    num(row.holder_count ?? row.holders ?? row.count) ||
    num(row.trustlines ?? row.trustline_count)
  );
}

export function applyXrplToPrices(prices = {}, token = {}) {
  const xrpUsd = num(prices.xrpUsd ?? prices.XRP);
  const xdxUsd = xdxUsdFromXrplTo(token, xrpUsd);
  if (!xdxUsd) return prices;
  if (num(prices.xdxUsd ?? prices.recorded_price)) {
    return {
      ...prices,
      source: prices.source || "hybrid",
    };
  }
  return {
    ...prices,
    xdxUsd,
    recorded_price: xdxUsd,
    price: xdxUsd,
    xdxGbp: fxFromXrp(xdxUsd, xrpUsd, prices.xrpGbp),
    xdxEur: fxFromXrp(xdxUsd, xrpUsd, prices.xrpEur),
    xdxJpy: fxFromXrp(xdxUsd, xrpUsd, prices.xrpJpy),
    xdx_per_xrp: xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
    xdxPerXrp: xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
    source: prices.source && prices.source !== "xrpl.to" ? "hybrid" : "xrpl.to",
  };
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
    volume24h:
      num(overview.volume24h) ||
      (num(token.vol24hXrp) && xrpUsd ? token.vol24hXrp * xrpUsd : num(token.vol24hXrp)),
    tvl: num(overview.tvl_usd ?? overview.tvl) || tvlUsdFromXrplTo(token, xrpUsd) || null,
    tvl_usd: num(overview.tvl_usd ?? overview.tvl) || tvlUsdFromXrplTo(token, xrpUsd) || null,
    ammMarketCap: num(overview.ammMarketCap ?? overview.tvl_usd) || tvlUsdFromXrplTo(token, xrpUsd) || null,
    xrplMarketCap: num(overview.xrplMarketCap) || num(token.marketcap) || XDX_TOTAL_SUPPLY * xdxUsd,
    circulatingMarketCap:
      num(overview.circulatingMarketCap) ||
      num(token.marketcap) ||
      Number(overview.circulating || overview.circulating_supply || XDX_TOTAL_SUPPLY) * xdxUsd,
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

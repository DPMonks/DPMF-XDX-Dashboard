import { recordUsdPrice } from "./format.js";

// Live Railway /api/prices still does: xdxUsd = xrpUsd * 0.000001
// when price_latest.xdx_usd is missing. That is not USD per 1 XDX.
const XRP_MICRO = 0.000001;

export function isXrpMicroFallback(xdxUsd, xrpUsd) {
  const xdx = Number(xdxUsd);
  const xrp = Number(xrpUsd);
  if (!(xdx > 0) || !(xrp > 0)) return false;
  return Math.abs(xdx - xrp * XRP_MICRO) < 1e-12;
}

export function looksLikeXrpUsd(value) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0.05;
}

export function recordedXdxUsdFromPrices(prices = {}, fallbackXrpUsd) {
  const xrpUsd = Number(prices.xrpUsd ?? prices.xrp_usd ?? fallbackXrpUsd ?? 0);
  for (const value of [prices.recorded_price, prices.xdxUsd, prices.xdx_usd]) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) continue;
    if (isXrpMicroFallback(num, xrpUsd)) continue;
    return recordUsdPrice(num);
  }
  return 0;
}

export function xrpPerXdx(xdxUsd, xrpUsd) {
  const usd = Number(xdxUsd);
  const xrp = Number(xrpUsd);
  if (!(usd > 0) || !looksLikeXrpUsd(xrp)) return 0;
  return recordUsdPrice(usd / xrp);
}

export function pickTrustlineCount(latestCount, historyCount) {
  const history = Number(historyCount) || 0;
  if (history > 0) return history;
  return Number(latestCount) || 0;
}

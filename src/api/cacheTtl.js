export const LIVE_CACHE_MS = 15_000;
export const CATALOG_CACHE_MS = 45_000;
export const HISTORY_CACHE_MS = 60_000;

export function cacheTtlMs(url) {
  const path = String(url || "").split("?")[0];
  if (/\/(charts|top-holders|top-lp|holders\/count|trustlines\/count|lp-holders\/count|lp-trustlines\/count)\b/i.test(path)) {
    return HISTORY_CACHE_MS;
  }
  if (/\/(overview|token-details|sparkline|xdx-flows|trades|change24h|issuer-locked|health)\b/i.test(path)) {
    return CATALOG_CACHE_MS;
  }
  if (/\/api\/?$/.test(path) || /\/health(\/xrpl)?$/.test(path)) {
    return CATALOG_CACHE_MS;
  }
  return LIVE_CACHE_MS;
}

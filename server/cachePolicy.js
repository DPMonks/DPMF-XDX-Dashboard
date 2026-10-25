/**
 * CDN cache policy for the /api proxy. Public market data is served from the
 * Vercel edge straight away and refreshed in the background
 * (stale-while-revalidate), so a cold function never blocks a page load.
 * Every response carries x-dpmf-generated-at, cached with the body, so the page
 * can tell how old a stale copy is and label it.
 *
 * Wallet reads stay short lived, `?fresh=1` reads and errors are never cached.
 */

export const GENERATED_AT_HEADER = "x-dpmf-generated-at";

// Slow to build, slow to change: history, rich lists, counts, candles.
const LONG_STALE = [
  /^charts\//,
  /^chart\/candles$/,
  /^sparkline\//,
  /^top-holders(-v2)?$/,
  /^top-lp$/,
  /^holders\/count$/,
  /^trustlines\/count$/,
  /^lp-holders\/count$/,
  /^lp-trustlines\/count$/,
  /^issuer-locked$/,
  /^xdx-flows$/,
  /^trades$/,
];

function isFreshRead(search = "") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  return params.get("fresh") === "1";
}

export function isWalletSuffix(suffix = "") {
  return /^(wallet|balances|networth)\//.test(String(suffix || ""));
}

export function cacheControlFor(suffix = "", { search = "", status = 200, method = "GET" } = {}) {
  const path = String(suffix || "").split("?")[0].replace(/^\/+/, "");
  if (method !== "GET" && method !== "HEAD") return "no-store";
  if (!(status >= 200 && status < 300)) return "no-store";
  if (isFreshRead(search)) return "private, no-store";
  if (path === "swap-market" || path === "lp-pools/live" || path === "amm/governance") {
    // Quote and pool reads right before signing: keep them close to live.
    return "public, max-age=0, s-maxage=5, stale-while-revalidate=30";
  }
  if (isWalletSuffix(path)) {
    return "public, max-age=0, s-maxage=10, stale-while-revalidate=60";
  }
  if (!path || path === "health" || path === "health/xrpl" || /handshake$/i.test(path)) {
    return "public, max-age=0, s-maxage=15, stale-while-revalidate=300";
  }
  if (LONG_STALE.some((re) => re.test(path))) {
    return "public, max-age=0, s-maxage=120, stale-while-revalidate=86400";
  }
  // overview, token-details, prices, lp-pools, orderbooks and the rest.
  return "public, max-age=0, s-maxage=30, stale-while-revalidate=86400";
}

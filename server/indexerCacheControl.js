export function indexerCacheControl(suffix = "") {
  const path = String(suffix || "").split("?")[0].replace(/^\//, "");
  if (/^(lp-pools\/live|wallet\/|amm\/governance)/i.test(path)) {
    return "private, max-age=0, s-maxage=10, stale-while-revalidate=20";
  }
  if (/^(orderbooks?|lp-pools|prices)$/i.test(path)) {
    return "s-maxage=15, stale-while-revalidate=60";
  }
  if (
    /^(charts\/|top-holders|top-lp|holders\/count|trustlines\/count|lp-holders\/count|lp-trustlines\/count|sparkline\/)/i.test(
      path
    )
  ) {
    return "s-maxage=60, stale-while-revalidate=180";
  }
  if (/^(overview|xdx-flows|trades|change24h|issuer-locked|health)/i.test(path) || path === "") {
    return "s-maxage=45, stale-while-revalidate=120";
  }
  return "s-maxage=30, stale-while-revalidate=120";
}

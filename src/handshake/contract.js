export const PROTOCOL = "indexer-catalog";
export const VERSION = 1;
export const CLIENT = "dpmf-xdx-dashboard";
export const SERVICE = "dpmf-xdx-indexer";

export const DEFAULT_INDEXER_ORIGIN =
  "https://dpmf-xdx-indexer-production.up.railway.app";

export const CLUSTER_HEADERS = {
  accept: "application/json",
};

export const DEFAULT_ENDPOINTS = {
  overview: "/overview",
  amm: "/amm",
  pools: "/pools",
  topHolders: "/top-holders",
  topHoldersToday: "/top-holders?snapshot=today",
  topLp: "/top-lp",
  holdersCount: "/holders/count",
  holdersCountToday: "/holders/count?snapshot=today",
  trustlinesCount: "/trustlines/count",
  lpHoldersCount: "/lp-holders/count",
  tvlHistory: "/charts/tvl",
  holdersHistory: "/charts/holders",
  lpHoldersHistory: "/charts/lp-holders",
  trustlinesHistory: "/charts/trustlines",
  activityHistory: "/charts/activity",
  tradersHistory: "/charts/traders",
  trades: "/trades",
  xdxFlows: "/xdx-flows",
  balances: "/wallet/balances/:address",
  networth: "/wallet/networth/:address",
  prices: "/prices",
  change24h: "/prices/change24h",
  sparkline: "/sparkline/:asset",
};

export const ENDPOINT_ALIASES = {
  overview: ["overview", "publicOverview", "public_overview"],
  amm: ["amm", "publicAmm", "public_amm"],
  pools: ["pools", "publicPools"],
  topHolders: ["topHolders", "top_holders", "holders", "topHoldersV2"],
  topHoldersToday: ["topHoldersToday", "top_holders_today"],
  topLp: ["topLp", "top_lp", "lpHolders", "lp_holders"],
  holdersCount: ["holdersCount", "holders_count"],
  holdersCountToday: ["holdersCountToday", "holders_count_today"],
  trustlinesCount: ["trustlinesCount", "trustlines_count"],
  lpHoldersCount: ["lpHoldersCount", "lp_holders_count"],
  tvlHistory: ["tvlHistory", "chartsTvl"],
  holdersHistory: ["holdersHistory", "chartsHolders"],
  lpHoldersHistory: ["lpHoldersHistory", "chartsLpHolders"],
  trustlinesHistory: ["trustlinesHistory", "chartsTrustlines"],
  activityHistory: ["activityHistory", "chartsActivity"],
  tradersHistory: ["tradersHistory", "chartsTraders"],
  trades: ["trades", "ammTrades"],
  xdxFlows: ["xdxFlows", "flows"],
  balances: ["balances", "walletBalances"],
  networth: ["networth", "walletNetworth"],
  prices: ["prices"],
  change24h: ["change24h", "priceChange"],
  sparkline: ["sparkline"],
};

export const CATALOG_PATHS = ["/api/", "/"];
export const HEALTH_PATHS = ["/health", "/health/xrpl"];

export const INDEXER_HANDSHAKE_PATHS = ["/", "/api", "/api/"];

export const PROTOCOL = "clusterv1";
export const VERSION = 1;
export const CLIENT = "dpmf-xdx-dashboard";
export const SERVICE = "dpmf-xdx-indexer";

export const DEFAULT_INDEXER_ORIGIN =
  "https://dpmf-xdx-indexer-production.up.railway.app";

export const CLUSTER_HEADERS = {
  accept: "application/json",
  "x-dpmf-client": CLIENT,
  "x-cluster-protocol": PROTOCOL,
  "x-cluster-version": String(VERSION),
};

export const HANDSHAKE_BODY = {
  client: CLIENT,
  protocol: PROTOCOL,
  version: VERSION,
};

export const DEFAULT_ENDPOINTS = {
  overview: "/overview",
  amm: "/amm",
  pools: "/pools",
  topHolders: "/top-holders",
  topLp: "/top-lp",
  holdersCount: "/holders/count",
  lpHoldersCount: "/lp-holders/count",
  tvlHistory: "/charts/tvl",
  holdersHistory: "/charts/holders",
  lpHoldersHistory: "/charts/lp-holders",
  balances: "/wallet/balances/:address",
  networth: "/wallet/networth/:address",
  prices: "/prices",
  change24h: "/prices/change24h",
  sparkline: "/sparkline/:asset",
};

export const ENDPOINT_ALIASES = {
  overview: ["overview", "publicOverview", "public_overview"],
  amm: ["amm", "publicAmm", "public_amm"],
  pools: ["pools"],
  topHolders: ["topHolders", "top_holders", "holders", "topHoldersV2"],
  topLp: ["topLp", "top_lp", "lpHolders", "lp_holders"],
  holdersCount: ["holdersCount", "holders_count"],
  lpHoldersCount: ["lpHoldersCount", "lp_holders_count"],
  tvlHistory: ["tvlHistory", "chartsTvl", "tvl"],
  holdersHistory: ["holdersHistory", "chartsHolders"],
  lpHoldersHistory: ["lpHoldersHistory", "chartsLpHolders"],
  balances: ["balances", "walletBalances"],
  networth: ["networth", "walletNetworth"],
  prices: ["prices"],
  change24h: ["change24h", "priceChange"],
  sparkline: ["sparkline"],
};

export const SAME_ORIGIN_HANDSHAKE_PATHS = [
  "/api/cluster/v1/handshake",
  "/api/cluster/handshake",
  "/api/v1/handshake",
  "/api/handshake",
  "/api/public/handshake",
];

export const INDEXER_HANDSHAKE_PATHS = [
  "/api/cluster/v1/handshake",
  "/cluster/v1/handshake",
  "/api/cluster/handshake",
  "/api/v1/handshake",
  "/api/handshake",
  "/api/public/handshake",
  "/handshake",
];

export const CATALOG_PATHS = ["/", "/api", "/api/"];

function resolveIndexerOrigin() {
  const candidates = [
    import.meta.env.VITE_API_BASE,
    import.meta.env.NEXT_PUBLIC_INDEXER_URL,
    import.meta.env.VITE_INDEXER_URL,
    import.meta.env.VITE_API_URL,
  ].filter(Boolean);
  const remote = candidates.find(
    (url) => !/localhost|127\.0\.0\.1/i.test(String(url))
  );
  return (
    remote || "https://dpmf-xdx-indexer-production.up.railway.app"
  ).replace(/\/$/, "");
}

const INDEXER_ORIGIN = resolveIndexerOrigin();
const API = INDEXER_ORIGIN.endsWith("/api")
  ? INDEXER_ORIGIN
  : `${INDEXER_ORIGIN}/api`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJsonOnce(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      data.error || data.detail || `${res.status} ${res.statusText}`
    );
    error.status = res.status;
    throw error;
  }
  return data;
}

async function getJson(path) {
  try {
    return await getJsonOnce(path);
  } catch (error) {
    if (error.status === 429) {
      await sleep(1500);
      return getJsonOnce(path);
    }
    throw error;
  }
}

export { API, INDEXER_ORIGIN };

export const api = {
  overview: () => getJson("/overview"),
  amm: () => getJson("/amm"),
  pools: async () => (await getJson("/pools")).pools || [],
  topHolders: (limit = 200, offset = 0) =>
    getJson(`/top-holders?limit=${limit}&offset=${offset}`),
  topLp: (limit = 50, offset = 0) =>
    getJson(`/top-lp?limit=${limit}&offset=${offset}`),
  holdersCount: () => getJson("/holders/count"),
  lpHoldersCount: () => getJson("/lp-holders/count"),
  tvlHistory: () => getJson("/charts/tvl"),
  holdersHistory: () => getJson("/charts/holders"),
  lpHoldersHistory: () => getJson("/charts/lp-holders"),
  balances: (address) => getJson(`/wallet/balances/${address}`),
  networth: (address) => getJson(`/wallet/networth/${address}`),
  prices: () => getJson("/prices"),
  change24h: () => getJson("/prices/change24h"),
  sparkline: (asset) => getJson(`/sparkline/${asset}`),
};

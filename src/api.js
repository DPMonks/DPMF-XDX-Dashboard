const DEFAULT_REMOTE = "https://dpmf-xdx-indexer-production.up.railway.app";

const DEFAULT_ENDPOINTS = {
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

const HANDSHAKE_PATHS = [
  "/api/cluster/v1/handshake",
  "/api/v1/handshake",
  "/api/handshake",
  "/cluster/v1/handshake",
  "/handshake",
];

function resolveRemoteOrigin() {
  const candidates = [
    import.meta.env.VITE_API_BASE,
    import.meta.env.NEXT_PUBLIC_INDEXER_URL,
    import.meta.env.VITE_INDEXER_URL,
    import.meta.env.VITE_API_URL,
  ].filter(Boolean);
  const remote = candidates.find(
    (url) => !/localhost|127\.0\.0\.1/i.test(String(url))
  );
  return (remote || DEFAULT_REMOTE).replace(/\/$/, "");
}

function resolveRequestOrigin() {
  if (import.meta.env.VITE_USE_DIRECT_INDEXER === "true") {
    return resolveRemoteOrigin();
  }
  return "";
}

const INDEXER_ORIGIN = resolveRemoteOrigin();
const REQUEST_ORIGIN = resolveRequestOrigin();
const API = REQUEST_ORIGIN
  ? REQUEST_ORIGIN.endsWith("/api")
    ? REQUEST_ORIGIN
    : `${REQUEST_ORIGIN}/api`
  : "/api";

let handshakePromise = null;
let handshakeState = {
  ok: false,
  protocol: null,
  version: null,
  path: null,
  error: null,
  endpoints: { ...DEFAULT_ENDPOINTS },
  snapshot: {},
  raw: null,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeEndpoint(value) {
  if (!value) return null;
  let path = String(value);
  if (path.startsWith("http")) {
    try {
      path = new URL(path).pathname;
    } catch {
      return null;
    }
  }
  if (path.startsWith("/api/")) path = path.slice(4);
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

function mergeEndpoints(raw) {
  const source = asObject(raw);
  const next = { ...DEFAULT_ENDPOINTS };
  const alias = {
    overview: ["overview", "publicOverview"],
    amm: ["amm", "publicAmm"],
    pools: ["pools"],
    topHolders: ["topHolders", "top_holders", "holders"],
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

  for (const [key, names] of Object.entries(alias)) {
    for (const name of names) {
      const normalized = normalizeEndpoint(source[name]);
      if (normalized) {
        next[key] = normalized;
        break;
      }
    }
  }
  return next;
}

function extractSnapshot(payload) {
  const root = asObject(payload);
  const snap = asObject(
    root.snapshot || root.data || root.payload || root.tables || root
  );
  return {
    overview: snap.overview || root.overview || null,
    pools: snap.pools || snap.amm || root.pools || root.amm || null,
    holders:
      snap.holders ||
      snap.topHolders ||
      snap.top_holders ||
      root.holders ||
      root.topHolders ||
      null,
    lpHolders:
      snap.lpHolders ||
      snap.lp_holders ||
      snap.topLp ||
      snap.top_lp ||
      root.lpHolders ||
      root.topLp ||
      null,
    charts: snap.charts || root.charts || null,
    prices: snap.prices || root.prices || null,
    change24h: snap.change24h || snap.prices24h || root.change24h || null,
    holdersCount: snap.holdersCount || snap.holder_count || root.holdersCount || null,
  };
}

function looksLikeHandshake(payload) {
  const body = asObject(payload);
  return Boolean(
    body.protocol ||
      body.cluster ||
      body.version ||
      body.endpoints ||
      body.snapshot ||
      body.ok === true ||
      body.service ||
      body.tables
  );
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
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

async function getJsonOnce(path) {
  const url = path.startsWith("/api/") || path.startsWith("http")
    ? `${REQUEST_ORIGIN}${path}`
    : `${API}${path}`;
  return fetchJson(url);
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

function withParams(template, params = {}) {
  let path = template;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }
  return path;
}

async function probeHandshake() {
  let lastError = null;
  for (const path of HANDSHAKE_PATHS) {
    try {
      const raw = await getJson(path);
      if (!looksLikeHandshake(raw) && !raw.overview && !raw.pools) {
        continue;
      }
      handshakeState = {
        ok: true,
        protocol: raw.protocol || raw.cluster || "clusterv1",
        version: raw.version || raw.v || 1,
        path,
        error: null,
        endpoints: mergeEndpoints(raw.endpoints || raw.routes),
        snapshot: extractSnapshot(raw),
        raw,
      };
      return handshakeState;
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const catalog = await getJson("/");
    if (catalog?.endpoints || catalog?.status === "online") {
      handshakeState = {
        ok: true,
        protocol: "catalog",
        version: catalog.version || 1,
        path: "/api/",
        error: null,
        endpoints: mergeEndpoints(catalog.endpoints),
        snapshot: extractSnapshot(catalog),
        raw: catalog,
      };
      return handshakeState;
    }
  } catch (error) {
    lastError = error;
  }

  handshakeState = {
    ...handshakeState,
    ok: false,
    error: lastError?.message || "Handshake failed",
  };
  return handshakeState;
}

export function handshake() {
  if (!handshakePromise) {
    handshakePromise = probeHandshake().finally(() => {
      setTimeout(() => {
        handshakePromise = null;
      }, 30_000);
    });
  }
  return handshakePromise;
}

export function getHandshakeState() {
  return handshakeState;
}

function endpoint(name, params) {
  return withParams(handshakeState.endpoints[name] || DEFAULT_ENDPOINTS[name], params);
}

export { API, INDEXER_ORIGIN, REQUEST_ORIGIN };

export const api = {
  overview: () => getJson(endpoint("overview")),
  amm: () => getJson(endpoint("amm")),
  pools: async () => {
    const body = await getJson(endpoint("pools"));
    return body.pools || body.data || body.rows || body;
  },
  topHolders: (limit = 200, offset = 0) => {
    const path = endpoint("topHolders");
    const join = path.includes("?") ? "&" : "?";
    return getJson(`${path}${join}limit=${limit}&offset=${offset}`);
  },
  topLp: (limit = 50, offset = 0) => {
    const path = endpoint("topLp");
    const join = path.includes("?") ? "&" : "?";
    return getJson(`${path}${join}limit=${limit}&offset=${offset}`);
  },
  holdersCount: () => getJson(endpoint("holdersCount")),
  lpHoldersCount: () => getJson(endpoint("lpHoldersCount")),
  tvlHistory: () => getJson(endpoint("tvlHistory")),
  holdersHistory: () => getJson(endpoint("holdersHistory")),
  lpHoldersHistory: () => getJson(endpoint("lpHoldersHistory")),
  balances: (address) => getJson(endpoint("balances", { address })),
  networth: (address) => getJson(endpoint("networth", { address })),
  prices: () => getJson(endpoint("prices")),
  change24h: () => getJson(endpoint("change24h")),
  sparkline: (asset) => getJson(endpoint("sparkline", { asset })),
};

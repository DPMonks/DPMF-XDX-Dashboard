import {
  CATALOG_PATHS,
  DEFAULT_ENDPOINTS,
  DEFAULT_INDEXER_ORIGIN,
  ENDPOINT_ALIASES,
  HEALTH_PATHS,
  PROTOCOL,
  SERVICE,
  VERSION,
} from "./handshake/contract";
import { createRequestScheduler } from "./utils/requestScheduler";

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
  return (remote || DEFAULT_INDEXER_ORIGIN).replace(/\/$/, "");
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

const inflight = new Map();
const responseCache = new Map();
const CACHE_MS = 15_000;
const scheduleRequest = createRequestScheduler({ concurrency: 2 });

let handshakePromise = null;
let handshakeState = {
  ok: false,
  protocol: PROTOCOL,
  version: VERSION,
  path: "contract",
  error: null,
  endpoints: { ...DEFAULT_ENDPOINTS },
  snapshot: {},
  source: null,
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

  for (const [key, names] of Object.entries(ENDPOINT_ALIASES)) {
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
    trustlinesCount:
      snap.trustlinesCount || snap.trustline_count || root.trustlinesCount || null,
  };
}

function looksLikeHandshake(payload) {
  const body = asObject(payload);
  return Boolean(
    body.status === "online" ||
      body.status === "ok" ||
      body.endpoints ||
      body.service ||
      body.workers ||
      body.xrpl
  );
}

function requestUrl(path) {
  if (path.startsWith("http")) return path;
  if (path === "/" || path === "/api" || path === "/api/") {
    return `${REQUEST_ORIGIN}/api/`;
  }
  if (path.startsWith("/health")) {
    return `${REQUEST_ORIGIN}${path}`;
  }
  if (path.startsWith("/api/")) {
    return `${REQUEST_ORIGIN}${path}`;
  }
  return `${API}${path}`;
}

function cacheGet(url) {
  const hit = responseCache.get(url);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    responseCache.delete(url);
    return null;
  }
  return hit.data;
}

function cacheSet(url, data) {
  responseCache.set(url, { at: Date.now(), data });
}

async function fetchJson(url, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    const next = new Error(
      timedOut
        ? "Indexer proxy timed out"
        : "Failed to fetch /api (not Postgres). Production dpmf-xdx-dashboard.vercel.app still has no /api function — open the PR #4 preview, or promote this branch. Preview SSO 302s also look like Failed to fetch. Do not put the Railway HTTP host in DATABASE_URL."
    );
    next.status = 0;
    throw next;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback =
      res.status === 429
        ? "Indexer rate-limited (Railway Hikari). The proxy will retry."
        : res.status === 404
          ? "This host has no /api function. Open the PR #4 preview or promote that branch to Production — env vars do nothing on the old production deploy."
        : `${res.status} ${res.statusText}`;
    const error = new Error(
      [data.error || data.detail || fallback, data.hint].filter(Boolean).join(" — ")
    );
    error.status = res.status;
    throw error;
  }
  return data;
}

async function queued(task, priority = 0) {
  return scheduleRequest(task, { priority });
}

async function getJsonOnce(path, options) {
  return fetchJson(requestUrl(path), options);
}

async function getJson(path, options = {}) {
  const {
    method = "GET",
    body,
    cache = method === "GET",
    queue: useQueue = true,
    immediate = false,
    priority = 0,
    retries = 2,
  } = options;
  const url = requestUrl(path);
  const cacheKey = `${method} ${url}`;

  if (cache) {
    const cached = cacheGet(cacheKey);
    if (cached) return cached;
    const pending = inflight.get(cacheKey);
    if (pending) return pending;
  }

  const run = async () => {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const data = await getJsonOnce(path, { method, body });
        if (cache) cacheSet(cacheKey, data);
        return data;
      } catch (error) {
        lastError = error;
        if (error.status !== 429 || attempt === retries - 1) break;
        await sleep(800 * (attempt + 1));
      }
    }
    throw lastError;
  };

  const task = immediate || !useQueue ? run() : queued(run, priority);

  if (cache) {
    inflight.set(cacheKey, task);
    task.finally(() => inflight.delete(cacheKey));
  }
  return task;
}

function withParams(template, params = {}) {
  let path = template;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }
  return path;
}

function acceptHandshake(raw, path, extra = {}) {
  if (!looksLikeHandshake(raw) && !extra.health) return false;
  handshakeState = {
    ok: true,
    protocol: raw.service || extra.health?.status || PROTOCOL,
    version: raw.version || VERSION,
    path,
    error: null,
    endpoints: mergeEndpoints(raw.endpoints || raw.routes),
    snapshot: extractSnapshot(raw),
    health: extra.health || null,
    xrpl: extra.xrpl || extra.health?.xrpl || raw.xrpl || null,
    source: raw.source || extra.health?.source || extra.source || null,
    database: raw.database || extra.health?.database || extra.database || null,
    hint: raw.hint || extra.health?.hint || extra.hint || null,
    raw,
  };
  return true;
}

const handshakeGet = (path) =>
  getJson(path, { cache: false, queue: false, retries: 1 });

async function probeHandshake() {
  let lastError = null;
  let catalog = null;
  let catalogPath = CATALOG_PATHS[0];
  let health = null;
  let xrpl = null;

  const [catalogAttempt, healthAttempt, xrplAttempt] = await Promise.allSettled([
    handshakeGet(CATALOG_PATHS[0]),
    handshakeGet(HEALTH_PATHS[0]),
    handshakeGet(HEALTH_PATHS[1]),
  ]);

  if (catalogAttempt.status === "fulfilled") {
    const raw = catalogAttempt.value;
    if (raw?.endpoints || raw?.status === "online" || looksLikeHandshake(raw)) {
      catalog = raw;
      acceptHandshake(raw, catalogPath);
    }
  } else {
    lastError = catalogAttempt.reason;
  }

  if (!catalog) {
    for (const path of CATALOG_PATHS.slice(1)) {
      try {
        const raw = await handshakeGet(path);
        if (raw?.endpoints || raw?.status === "online" || looksLikeHandshake(raw)) {
          catalog = raw;
          catalogPath = path;
          acceptHandshake(raw, path);
          break;
        }
      } catch (error) {
        lastError = lastError || error;
      }
    }
  }

  if (healthAttempt.status === "fulfilled") {
    health = healthAttempt.value;
  } else {
    lastError = lastError || healthAttempt.reason;
  }

  if (xrplAttempt.status === "fulfilled") {
    xrpl = xrplAttempt.value;
  }

  if (catalog || health) {
    acceptHandshake(catalog || { status: health?.status, service: SERVICE }, catalog ? catalogPath : "/health", {
      health,
      xrpl,
    });
    return handshakeState;
  }

  handshakeState = {
    ...handshakeState,
    ok: false,
    protocol: PROTOCOL,
    version: VERSION,
    path: "contract",
    error: lastError?.message || null,
    endpoints: { ...DEFAULT_ENDPOINTS },
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
  health: () => getJson("/health"),
  healthXrpl: () => getJson("/health/xrpl"),
  overview: () => getJson(endpoint("overview"), { queue: false }),
  amm: () => getJson(endpoint("amm")),
  pools: async () => {
    const body = await getJson(endpoint("pools"));
    if (Array.isArray(body?.pools)) return body.pools;
    if (Array.isArray(body)) return body;
    if (body && typeof body === "object" && !body.error) return [body];
    return [];
  },
  topHolders: (limit = 100, offset = 0, extra = {}) => {
    const path = endpoint("topHolders");
    const join = path.includes("?") ? "&" : "?";
    const snapshot = extra.snapshot || "today";
    return getJson(
      `${path}${join}limit=${limit}&offset=${offset}&snapshot=${encodeURIComponent(snapshot)}`
    );
  },
  topLp: (limit = 100, offset = 0, extra = {}) => {
    const path = endpoint("topLp");
    const join = path.includes("?") ? "&" : "?";
    const snapshot = extra.snapshot || "today";
    const pool = extra.pool || extra.pair || "all";
    return getJson(
      `${path}${join}limit=${limit}&offset=${offset}&snapshot=${encodeURIComponent(snapshot)}&pool=${encodeURIComponent(pool)}`
    );
  },
  holdersCount: (extra = {}) => {
    const path = endpoint("holdersCount");
    const snapshot = extra.snapshot || "today";
    const join = path.includes("?") ? "&" : "?";
    return getJson(`${path}${join}snapshot=${encodeURIComponent(snapshot)}`, {
      queue: false,
    });
  },
  trustlinesCount: () => getJson(endpoint("trustlinesCount"), { queue: false }),
  lpHoldersCount: (extra = {}) => {
    const path = endpoint("lpHoldersCount");
    const pool = extra.pool || extra.pair || "all";
    const join = path.includes("?") ? "&" : "?";
    const snapshot = extra.snapshot
      ? `snapshot=${encodeURIComponent(extra.snapshot)}&`
      : "";
    return getJson(`${path}${join}${snapshot}pool=${encodeURIComponent(pool)}`);
  },
  lpTrustlinesCount: (extra = {}) => {
    const path = endpoint("lpTrustlinesCount") || "/lp-trustlines/count";
    const pool = extra.pool || extra.pair || "all";
    const join = path.includes("?") ? "&" : "?";
    return getJson(`${path}${join}pool=${encodeURIComponent(pool)}`);
  },
  lpPools: () => getJson(endpoint("lpPools") || "/lp-pools"),
  tvlHistory: () => getJson(endpoint("tvlHistory")),
  holdersHistory: (extra = {}) => getJson(endpoint("holdersHistory"), extra),
  lpHoldersHistory: () => getJson(endpoint("lpHoldersHistory")),
  lpTrustlinesHistory: (extra = {}) => {
    const path = endpoint("lpTrustlinesHistory") || "/charts/lp-trustlines";
    const pool = extra.pool || extra.pair || "all";
    const join = path.includes("?") ? "&" : "?";
    return getJson(`${path}${join}pool=${encodeURIComponent(pool)}`);
  },
  trustlinesHistory: () => getJson(endpoint("trustlinesHistory")),
  activityHistory: () => getJson(endpoint("activityHistory")),
  tradersHistory: () => getJson(endpoint("tradersHistory")),
  trades: () => getJson(endpoint("trades")),
  xdxFlows: () => getJson(endpoint("xdxFlows")),
  balances: (address) => getJson(endpoint("balances", { address })),
  networth: (address) => getJson(endpoint("networth", { address })),
  walletAccount: (address) =>
    getJson(endpoint("walletAccount", { address }) || `/wallet/account/${encodeURIComponent(address)}`, {
      retries: 1,
    }),
  walletLp: (address) =>
    getJson(endpoint("walletLp", { address }) || `/wallet/lp/${encodeURIComponent(address)}`, {
      retries: 1,
    }),
  walletRank: (address) =>
    getJson(endpoint("walletRank", { address }) || `/wallet/rank/${encodeURIComponent(address)}`, {
      retries: 1,
    }),
  walletOffers: (address) =>
    getJson(`/wallet/offers/${encodeURIComponent(address)}`, {
      retries: 1,
      queue: false,
      cache: false,
    }),
  walletActivity: (address) =>
    getJson(`/wallet/activity/${encodeURIComponent(address)}`, {
      retries: 1,
      queue: false,
      cache: false,
    }),
  walletVotes: (address) =>
    getJson(`/wallet/votes/${encodeURIComponent(address)}`, {
      retries: 1,
      queue: false,
      cache: false,
    }),
  ammGovernance: (pair, account) => {
    const search = new URLSearchParams({ pair: pair || "XDX/XRP" });
    if (account) search.set("account", account);
    return getJson(`/amm/governance?${search}`, { retries: 1, queue: false, cache: false });
  },
  prices: () => getJson(endpoint("prices"), { queue: false }),
  change24h: () => getJson(endpoint("change24h"), { queue: false }),
  sparkline: (asset) => getJson(endpoint("sparkline", { asset })),
  issuerLocked: () => getJson(endpoint("issuerLocked")),
  orderbook: (pair = "XDX/XRP") => {
    const path = endpoint("orderbook") || "/orderbook";
    const join = path.includes("?") ? "&" : "?";
    return getJson(`${path}${join}pair=${encodeURIComponent(pair)}`, {
      queue: false,
      retries: 1,
    });
  },
  orderbooks: () =>
    getJson(endpoint("orderbooks") || "/orderbooks", { queue: false, retries: 1 }),
};

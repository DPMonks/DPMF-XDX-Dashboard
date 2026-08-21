import {
  CLUSTER_HEADERS,
  DEFAULT_INDEXER_ORIGIN,
  INDEXER_HANDSHAKE_PATHS,
} from "../src/handshake/contract.js";
import { hasIndexerDatabase, readIndexerDb } from "./readIndexerDb.js";

export { DEFAULT_INDEXER_ORIGIN };

export function indexerOrigin(env = process.env) {
  const candidates = [
    env.INDEXER_ORIGIN,
    env.VITE_API_BASE,
    env.NEXT_PUBLIC_INDEXER_URL,
    env.VITE_INDEXER_URL,
  ].filter(Boolean);
  const remote = candidates.find(
    (url) => !/localhost|127\.0\.0\.1/i.test(String(url))
  );
  return (remote || DEFAULT_INDEXER_ORIGIN).replace(/\/$/, "");
}

export function joinIndexerUrl(origin, path, search = "") {
  const prefix = origin.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${suffix}${search || ""}`;
}

function isHandshakeSuffix(suffix) {
  return (
    suffix === "handshake" ||
    suffix === "cluster/v1/handshake" ||
    suffix === "cluster/handshake" ||
    suffix === "v1/handshake" ||
    suffix === "public/handshake"
  );
}

export function indexerPathsFor(suffix) {
  if (suffix === "health") return ["/health"];
  if (suffix === "health/xrpl") return ["/health/xrpl"];
  if (isHandshakeSuffix(suffix) || !suffix) return INDEXER_HANDSHAKE_PATHS;
  return [`/api/${suffix}`];
}

export async function fetchIndexer(url, { method = "GET", body } = {}) {
  const payload =
    body == null || typeof body === "string" ? body : JSON.stringify(body);

  const response = await fetch(url, {
    method,
    headers: {
      ...CLUSTER_HEADERS,
      "user-agent": "DPMF-XDX-Dashboard/1.1",
      ...(payload ? { "content-type": "application/json" } : {}),
    },
    body: payload,
    signal: AbortSignal.timeout(3500),
  });
  const text = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "application/json",
    body: text,
  };
}

function withSource(result, source) {
  if (!result) return result;
  return { ...result, source: result.source || source };
}

function indexerErrorHint(last) {
  let detail = last?.body || "Indexer unavailable";
  try {
    const parsed = JSON.parse(last.body);
    detail = parsed.error || parsed.detail || parsed.message || detail;
  } catch {
    if (typeof last?.body === "string" && last.body.length && last.body.length < 200) {
      detail = last.body;
    }
  }
  return {
    status: last?.status || 502,
    contentType: "application/json",
    source: "none",
    body: JSON.stringify({
      error: detail,
      hint: "Cards are SELECT-only from the XDX Postgres tables (token_holders_latest, lp_holders_latest, amm_pool_latest, history). Railway HTTP did not return data. Set server-only DATABASE_URL on Vercel to the same database the indexer uses. This process does not start or reset workers.",
      source: "none",
    }),
  };
}

export async function fetchIndexerFirst(paths, { method = "GET", body, search = "", suffix = "" } = {}) {
  let dbResult = null;

  // Prefer the XDX tables when a connection string is present so Hikari 429
  // cannot hide history. Never starts or resets indexer workers.
  if (method === "GET" && hasIndexerDatabase()) {
    dbResult = await readIndexerDb(suffix, search);
    if (dbResult && dbResult.status < 400) {
      return withSource(dbResult, "postgres");
    }
  }

  const origin = indexerOrigin();
  let last;
  for (const path of paths) {
    try {
      last = await fetchIndexer(joinIndexerUrl(origin, path, search), { method, body });
      if (last.status < 400) {
        return withSource(last, "indexer");
      }
    } catch (error) {
      last = {
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: error.message || "Indexer proxy failed" }),
      };
    }
  }

  if (dbResult) return dbResult;
  return indexerErrorHint(last);
}

export function proxyResponseHeaders(last) {
  return {
    "content-type": last?.contentType || "application/json",
    ...proxyCorsHeaders(),
    ...(last?.source ? { "x-dpmf-source": last.source } : {}),
  };
}

export function handshakePostBody(incoming) {
  if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
    return incoming;
  }
  return undefined;
}

export function proxyCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "accept,content-type",
  };
}

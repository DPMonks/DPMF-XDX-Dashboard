import {
  CLUSTER_HEADERS,
  DEFAULT_INDEXER_ORIGIN,
  HANDSHAKE_BODY,
  INDEXER_HANDSHAKE_PATHS,
} from "../src/handshake/contract.js";

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  if (suffix === "health") return ["/health", "/api/health"];
  if (isHandshakeSuffix(suffix)) return INDEXER_HANDSHAKE_PATHS;
  return [`/api/${suffix}`];
}

export async function fetchIndexer(url, { method = "GET", body } = {}) {
  let lastError;
  const payload =
    body == null || typeof body === "string" ? body : JSON.stringify(body);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...CLUSTER_HEADERS,
          "user-agent": "DPMF-XDX-Dashboard/1.1",
          ...(payload ? { "content-type": "application/json" } : {}),
        },
        body: payload,
      });
      if (response.status === 429 && attempt < 4) {
        await sleep(900 * 2 ** attempt);
        continue;
      }
      const text = await response.text();
      return {
        status: response.status,
        contentType: response.headers.get("content-type") || "application/json",
        body: text,
      };
    } catch (error) {
      lastError = error;
      await sleep(400 * (attempt + 1));
    }
  }
  throw lastError || new Error("Indexer proxy failed");
}

export async function fetchIndexerFirst(paths, { method = "GET", body, search = "" } = {}) {
  const origin = indexerOrigin();
  let last;
  for (const path of paths) {
    last = await fetchIndexer(joinIndexerUrl(origin, path, search), { method, body });
    if (last.status < 500 && last.status !== 404 && last.status !== 429) {
      return last;
    }
  }
  return last;
}

export function handshakePostBody(incoming) {
  if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
    return { ...HANDSHAKE_BODY, ...incoming };
  }
  return HANDSHAKE_BODY;
}

export const DEFAULT_INDEXER_ORIGIN =
  "https://dpmf-xdx-indexer-production.up.railway.app";

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

export async function fetchIndexer(url, { method = "GET" } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          accept: "application/json",
          "user-agent": "DPMF-XDX-Dashboard/1.0",
        },
      });
      if (response.status === 429 && attempt < 3) {
        await sleep(700 * (attempt + 1));
        continue;
      }
      const body = await response.text();
      return {
        status: response.status,
        contentType: response.headers.get("content-type") || "application/json",
        body,
      };
    } catch (error) {
      lastError = error;
      await sleep(400 * (attempt + 1));
    }
  }
  throw lastError || new Error("Indexer proxy failed");
}

export async function fetchIndexerFirst(paths, search = "") {
  const origin = indexerOrigin();
  let last;
  for (const path of paths) {
    last = await fetchIndexer(joinIndexerUrl(origin, path, search));
    if (last.status < 500 && last.status !== 404 && last.status !== 429) {
      return last;
    }
  }
  return last;
}

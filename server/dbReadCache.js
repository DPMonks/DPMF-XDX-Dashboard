/**
 * Short in-process cache for Postgres-backed indexer reads.
 *
 * A warm Vercel instance answers repeat reads of the same public payload
 * (overview, prices, charts, rich lists) from memory for DB_READ_CACHE_MS
 * instead of pulling the same 0.1 to 1.9 MB from the indexer database again.
 * Concurrent misses for one key share a single query (single flight).
 *
 * Never cached: wallet reads, quote reads right before signing, ?fresh=1,
 * and any non 2xx result.
 */

export const DB_READ_CACHE_MS = Math.max(0, Number(process.env.DB_READ_CACHE_MS ?? 30_000));
const MAX_ENTRIES = 200;

const NO_CACHE = [
  /^(wallet|balances|networth)\//,
  /^swap-market$/,
  /^lp-pools\/live$/,
  /^amm\/governance$/,
  /^health(\/|$)/,
  /^aim\//,
];

const store = new Map();
const inflight = new Map();

export function isCacheableRead(suffix = "", search = "") {
  const path = String(suffix || "").split("?")[0].replace(/^\/+/, "");
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  if (params.get("fresh") === "1") return false;
  return !NO_CACHE.some((re) => re.test(path));
}

export function clearDbReadCache() {
  store.clear();
  inflight.clear();
}

export async function cachedDbRead(suffix, search, load, now = Date.now) {
  if (!DB_READ_CACHE_MS || !isCacheableRead(suffix, search)) return load();
  const key = `${suffix}?${String(search || "").replace(/^\?/, "")}`;
  const hit = store.get(key);
  if (hit && now() - hit.at < DB_READ_CACHE_MS) return hit.value;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const value = await load();
      if (value && value.status >= 200 && value.status < 300) {
        if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
        store.set(key, { at: now(), value });
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

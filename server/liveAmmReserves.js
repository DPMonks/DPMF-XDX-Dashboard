import { overlayLiveAmmReserves, poolReservesFromAmmInfo } from "../src/utils/ammInfo.js";
import { quoteIdFromName, quoteIssue, xdxIssue } from "../src/wallet/ammVote.js";
import { xrplRpc } from "./xrplBookOffers.js";

const CACHE_MS = 15_000;
const DELETED_MS = 10 * 60_000;
const cache = new Map();
const accountCache = new Map();
const DEFAULT_CONCURRENCY = 3;

export function isTransientXrplError(err) {
  return /429|502|503|504|timeout|TIMEOUT|ECONNRESET|aborted|fetch failed/i.test(String(err?.message || err));
}

export async function withXrplRetry(fn, { retries = 3, waitMs = 280 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      last = err;
      if (!isTransientXrplError(err) || attempt === retries) throw err;
      await new Promise((resolve) => setTimeout(resolve, waitMs * 2 ** attempt));
    }
  }
  throw last;
}

export async function mapLimit(items, limit, fn) {
  const list = Array.isArray(items) ? items : [];
  const out = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const index = next;
      next += 1;
      out[index] = await fn(list[index], index);
    }
  }
  const n = Math.max(1, Math.min(Number(limit) || 1, list.length || 1));
  await Promise.all(Array.from({ length: list.length ? n : 0 }, () => worker()));
  return out;
}

function normalizePair(value, quote) {
  const text = String(value || `XDX/${quote || "XRP"}`)
    .replace(/\s+/g, "")
    .toUpperCase();
  return text || "XDX/XRP";
}

function cacheKey(query, pair) {
  return [
    String(query.ammAccount || query.amm_account || "").trim(),
    pair,
    String(query.issuer || query.quote_issuer || "").trim(),
    String(query.hex || query.quote_hex || query.quote || "").trim().toUpperCase(),
  ].join("|");
}

function emptyLive(pair) {
  return {
    pair,
    reserve_xdx: null,
    reserve_asset: null,
    reserve_currency: null,
    reserve_quote: null,
    lp_supply: null,
    amm_account: null,
    lp_currency: null,
    trading_fee: null,
    reserve_source: "empty",
    source: "empty",
  };
}

function deletedLive(pair, ammAccount) {
  return {
    ...emptyLive(pair),
    amm_account: ammAccount || null,
    reserve_source: "deleted",
    deleted: true,
    empty: true,
    source: "xrpl",
  };
}

function cacheTtl(body) {
  return body?.reserve_source === "deleted" ? DELETED_MS : CACHE_MS;
}

export async function loadLiveAmmReserves(query = {}, options = {}) {
  const pair = normalizePair(query.pair || query.pool, query.quote);
  const quoteId = String(query.quote || quoteIdFromName(pair) || "XRP").toUpperCase();
  const quote = {
    id: quoteId,
    currency: quoteId,
    issuer: query.issuer || query.quote_issuer || null,
    hex: query.hex || query.quote_hex || null,
  };
  const asset2 = quoteIssue(quote);
  const ammAccount = String(query.ammAccount || query.amm_account || "").trim();
  if (!ammAccount && quoteId !== "XRP" && asset2.currency === "XRP") {
    return emptyLive(pair);
  }

  const now = Number(options.now) || Date.now();
  const key = cacheKey(query, pair);
  if (!query.fresh) {
    const hit = cache.get(key);
    if (hit && now - hit.at < cacheTtl(hit.body)) return hit.body;
  }

  const rpc = {
    fetchImpl: options.fetchImpl,
    rpcUrl: options.rpcUrl,
  };
  const retry = {
    retries: Number.isFinite(Number(options.retries)) ? Number(options.retries) : 3,
    waitMs: Number(options.waitMs) || 280,
  };
  let result = null;
  let transient = false;
  if (ammAccount) {
    try {
      result = await withXrplRetry(
        () => xrplRpc("amm_info", { amm_account: ammAccount, ledger_index: "validated" }, rpc),
        retry
      );
    } catch (err) {
      transient = isTransientXrplError(err);
      result = null;
    }
    if (result?.error === "actNotFound" || result?.error === "actMalformed") {
      const exists = await accountStillExists(ammAccount, { ...rpc, now, fresh: query.fresh, retries: 0, waitMs: retry.waitMs });
      if (exists === false) {
        const body = deletedLive(pair, ammAccount);
        cache.set(key, { at: now, body });
        return body;
      }
    }
  }
  if (!result?.amm && !transient) {
    try {
      result = await withXrplRetry(
        () => xrplRpc("amm_info", { asset: xdxIssue(), asset2, ledger_index: "validated" }, rpc),
        retry
      );
    } catch (err) {
      transient = isTransientXrplError(err);
      result = null;
    }
  }

  const parsed = poolReservesFromAmmInfo(result);
  // Prefer the pair encoded in the AMM assets. A missing query pair used to
  // default to XDX/XRP and then stamp every other LP position as that pool.
  const resolvedPair = parsed?.pair || pair;
  const body = parsed
    ? { ...parsed, pair: resolvedPair, reserve_source: "amm_info", source: "xrpl" }
    : emptyLive(pair);
  if (parsed || !transient) {
    cache.set(key, { at: now, body });
  }
  return body;
}

export async function loadLiveAmmReservesMany(queries = [], options = {}) {
  const concurrency = Number(options.concurrency) || DEFAULT_CONCURRENCY;
  const deadlineMs = Number(options.deadlineMs) || 0;
  const started = Date.now();
  return mapLimit(queries, concurrency, async (query) => {
    if (deadlineMs > 0 && Date.now() - started >= deadlineMs) {
      return emptyLive(normalizePair(query?.pair || query?.pool, query?.quote));
    }
    try {
      return await loadLiveAmmReserves(query, options);
    } catch {
      return emptyLive(normalizePair(query?.pair || query?.pool, query?.quote));
    }
  });
}

export async function accountStillExists(account, options = {}) {
  const name = String(account || "").trim();
  if (!name) return null;
  const now = Number(options.now) || Date.now();
  const hit = accountCache.get(name);
  const ttl = hit?.exists === false ? DELETED_MS : CACHE_MS;
  if (hit && !options.fresh && now - hit.at < ttl) return hit.exists;
  try {
    const result = await withXrplRetry(
      () => xrplRpc("account_info", { account: name, ledger_index: "validated" }, options),
      {
        retries: Number.isFinite(Number(options.retries)) ? Number(options.retries) : 0,
        waitMs: Number(options.waitMs) || 200,
      }
    );
    if (result?.error === "actNotFound") {
      accountCache.set(name, { at: now, exists: false });
      return false;
    }
    if (result?.account_data) {
      accountCache.set(name, { at: now, exists: true });
      return true;
    }
    return null;
  } catch {
    return hit ? hit.exists : null;
  }
}

function alreadyLive(pool) {
  if (pool?.reserve_source !== "amm_info") return false;
  return (
    Number(pool.reserve_xdx ?? pool.reserve_asset) > 0 ||
    Number(pool.reserve_currency ?? pool.reserve_quote) > 0 ||
    Number(pool.lp_supply) > 0
  );
}

export async function dropDeletedAmmPools(pools = [], options = {}) {
  const list = Array.isArray(pools) ? pools : [];
  const need = list.filter((pool) => {
    const account = String(pool?.amm_account || "").trim();
    if (!account) return false;
    if (pool.reserve_source === "deleted" || pool.deleted) return false;
    return !alreadyLive(pool);
  });
  const reads = await loadLiveAmmReservesMany(
    need.map((pool) => ({
      ammAccount: pool.amm_account,
      pair: pool.pool || pool.pool_name,
      quote: pool.quote,
      issuer: pool.quote_issuer,
      hex: pool.quote_hex,
      fresh: options.fresh,
    })),
    {
      ...options,
      concurrency: Number(options.concurrency) || DEFAULT_CONCURRENCY,
      retries: Number.isFinite(Number(options.retries)) ? Number(options.retries) : 1,
      waitMs: Number(options.waitMs) || 200,
    }
  );
  const readByAccount = new Map();
  need.forEach((pool, index) => {
    readByAccount.set(String(pool.amm_account).trim(), reads[index]);
  });
  const deleted = new Set();
  for (const pool of list) {
    if ((pool?.reserve_source === "deleted" || pool?.deleted) && pool.amm_account) {
      deleted.add(String(pool.amm_account).trim());
    }
  }
  for (const read of reads) {
    if (read?.reserve_source === "deleted" && read.amm_account) {
      deleted.add(String(read.amm_account).trim());
    }
  }
  const kept = [];
  for (const pool of list) {
    const account = String(pool?.amm_account || "").trim();
    if (account && deleted.has(account)) continue;
    const read = account ? readByAccount.get(account) : null;
    if (read?.reserve_source === "amm_info") {
      const over = overlayLiveAmmReserves(pool, read);
      const xdx = Number(over.reserve_xdx ?? over.reserve_asset);
      const quote = Number(over.reserve_currency ?? over.reserve_quote);
      kept.push({
        ...over,
        price: xdx > 0 && quote > 0 ? quote / xdx : over.price,
        reserve_source: "amm_info",
      });
      continue;
    }
    kept.push(pool);
  }
  return { pools: kept, deleted_amms: [...deleted] };
}

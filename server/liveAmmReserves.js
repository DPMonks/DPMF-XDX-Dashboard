import { poolReservesFromAmmInfo } from "../src/utils/ammInfo.js";
import { quoteIdFromName, quoteIssue, xdxIssue } from "../src/wallet/ammVote.js";
import { xrplRpc } from "./xrplBookOffers.js";

const CACHE_MS = 15_000;
const cache = new Map();
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
  if (quoteId !== "XRP" && asset2.currency === "XRP") {
    return emptyLive(pair);
  }

  const now = Number(options.now) || Date.now();
  const key = cacheKey(query, pair);
  if (!query.fresh) {
    const hit = cache.get(key);
    if (hit && now - hit.at < CACHE_MS) return hit.body;
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
  const ammAccount = String(query.ammAccount || query.amm_account || "").trim();
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
  const body = parsed
    ? { ...parsed, pair, reserve_source: "amm_info", source: "xrpl" }
    : emptyLive(pair);
  if (parsed || !transient) {
    cache.set(key, { at: now, body });
  }
  return body;
}

export async function loadLiveAmmReservesMany(queries = [], options = {}) {
  const concurrency = Number(options.concurrency) || DEFAULT_CONCURRENCY;
  return mapLimit(queries, concurrency, async (query) => {
    try {
      return await loadLiveAmmReserves(query, options);
    } catch {
      return emptyLive(normalizePair(query?.pair || query?.pool, query?.quote));
    }
  });
}

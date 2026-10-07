import {
  RLUSD_HEX,
  RLUSD_ISSUER,
  XDX_ISSUER,
  XIO_ISSUER,
  XSQUAD_HEX,
  XSQUAD_ISSUER,
  asciiCurrencyHex,
} from "../src/constants/ledger.js";
import { extractDexSides, normalizeOrderbookPair, topDexLevels } from "../src/orderbook.js";

const DEFAULT_RPC = process.env.XRPL_RPC_URL || "https://xrplcluster.com";
const CACHE_MS = 20_000;
// After a failed read, a recent live book is still better than nothing, but
// never serve one older than this as if it were current.
const STALE_BOOK_MS = 5 * 60_000;
const cache = new Map();

export const XDX_SPEC = { currency: "XDX", issuer: XDX_ISSUER };

export function quoteSpecForPair(pair, pool = {}) {
  const name = normalizeOrderbookPair(pair);
  const quote = String(pool.quote || name.split("/")[1] || "XRP").trim();
  const issuer = pool.quote_issuer || pool.quoteIssuer || null;
  const hex = pool.quote_hex || pool.quoteHex || null;
  if (!quote || quote.toUpperCase() === "XRP") return { currency: "XRP" };
  if (quote.toUpperCase() === "RLUSD") {
    return { currency: hex || RLUSD_HEX, issuer: issuer || RLUSD_ISSUER };
  }
  if (quote.toUpperCase() === "XIO") {
    return { currency: quote, issuer: issuer || XIO_ISSUER };
  }
  if (quote.toUpperCase() === "XSQUAD") {
    return { currency: hex || XSQUAD_HEX, issuer: issuer || XSQUAD_ISSUER };
  }
  if (hex && issuer) return { currency: hex, issuer };
  if (issuer && quote.length <= 3) return { currency: quote, issuer };
  if (issuer && quote.length > 3) return { currency: hex || asciiCurrencyHex(quote), issuer };
  return null;
}

// Public JSON-RPC nodes on port 443. Vercel shares egress IPs, so one node can
// rate limit us (429/503 or rippled "slowDown"). When the caller did not pin a
// node, a transient failure moves on to the next one instead of returning
// nothing, which used to drop the page back onto old Postgres snapshots.
export const XRPL_FAILOVER_RPCS = ["https://xrplcluster.com", "https://s1.ripple.com", "https://s2.ripple.com"];
const BUSY_RPC_ERRORS = new Set(["slowDown", "tooBusy", "noNetwork", "noCurrent", "noClosed", "notReady", "notSynced", "amendmentBlocked"]);

export function isBusyRpcResult(body) {
  return Boolean(body && typeof body === "object" && BUSY_RPC_ERRORS.has(String(body.error || "")));
}

export function xrplRpcCandidates(rpcUrl = DEFAULT_RPC) {
  const first = String(rpcUrl || "").trim();
  return [...new Set([first, ...XRPL_FAILOVER_RPCS].filter(Boolean))];
}

async function xrplRpcOnce(method, params, { fetchImpl = fetch, rpcUrl = DEFAULT_RPC, timeoutMs = 8_000 } = {}) {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ method, params: [params] }),
    signal: AbortSignal.timeout(Number(timeoutMs) || 8_000),
  });
  if (!response.ok) {
    throw new Error(`XRPL RPC ${response.status}`);
  }
  const body = await response.json();
  if (body?.result) return body.result;
  if (body?.error) return body;
  return {};
}

export async function xrplRpc(method, params, options = {}) {
  const pinned = Boolean(options.rpcUrl);
  const failover = options.failover ?? (!pinned && !options.fetchImpl);
  if (!failover) return xrplRpcOnce(method, params, options);
  const urls = xrplRpcCandidates(options.rpcUrl || DEFAULT_RPC);
  const firstTimeout = Number(options.timeoutMs) || 8_000;
  let lastError = null;
  let lastBusy = null;
  for (let index = 0; index < urls.length; index += 1) {
    try {
      const body = await xrplRpcOnce(method, params, {
        ...options,
        rpcUrl: urls[index],
        // Later nodes get a shorter leash so a bad first node cannot eat the function budget.
        timeoutMs: index === 0 ? firstTimeout : Math.min(firstTimeout, 5_000),
      });
      const resultBody = body?.result && typeof body.result === "object" ? body.result : body;
      if (isBusyRpcResult(body) || isBusyRpcResult(resultBody)) {
        lastBusy = body;
        continue;
      }
      return body;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastBusy) return lastBusy;
  throw lastError || new Error("XRPL RPC failed");
}

export async function fillNativeBookFromXrpl(pair, pool = {}, options = {}) {
  const name = normalizeOrderbookPair(pair);
  const quote = quoteSpecForPair(name, pool);
  if (!quote) return null;

  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.book;

  try {
    const [asksRes, bidsRes] = await Promise.all([
      xrplRpc("book_offers", { taker_gets: XDX_SPEC, taker_pays: quote, limit: 80 }, options),
      xrplRpc("book_offers", { taker_gets: quote, taker_pays: XDX_SPEC, limit: 80 }, options),
    ]);
    const asks = topDexLevels(extractDexSides({ offers: asksRes.offers || [] }).asks, "ask");
    const bids = topDexLevels(extractDexSides({ offers: bidsRes.offers || [] }).bids, "bid");
    if (!bids.length && !asks.length) {
      return recentBook(hit);
    }
    const book = {
      pair: name,
      bids,
      asks,
      present: true,
      dex_present: true,
      catching_up: false,
      as_of: new Date().toISOString(),
      source: "xrpl",
    };
    cache.set(name, { at: Date.now(), book });
    return book;
  } catch {
    return recentBook(hit);
  }
}

function recentBook(hit) {
  if (!hit?.book || Date.now() - hit.at > STALE_BOOK_MS) return null;
  return { ...hit.book, stale: true };
}

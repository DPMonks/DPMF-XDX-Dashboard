import { poolReservesFromAmmInfo } from "../src/utils/ammInfo.js";
import { quoteIdFromName, quoteIssue, xdxIssue } from "../src/wallet/ammVote.js";
import { xrplRpc } from "./xrplBookOffers.js";

const CACHE_MS = 8_000;
const cache = new Map();

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
  let result = null;
  const ammAccount = String(query.ammAccount || query.amm_account || "").trim();
  if (ammAccount) {
    try {
      result = await xrplRpc("amm_info", { amm_account: ammAccount, ledger_index: "validated" }, rpc);
    } catch {
      result = null;
    }
  }
  if (!result?.amm) {
    try {
      result = await xrplRpc(
        "amm_info",
        { asset: xdxIssue(), asset2, ledger_index: "validated" },
        rpc
      );
    } catch {
      result = null;
    }
  }

  const parsed = poolReservesFromAmmInfo(result);
  const body = parsed
    ? { ...parsed, pair, reserve_source: "amm_info", source: "xrpl" }
    : emptyLive(pair);
  cache.set(key, { at: now, body });
  return body;
}

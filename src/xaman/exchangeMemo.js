import { asciiToHex, hexToAscii } from "./signMarker.js";

export const EXCHANGE_PLATFORM = "xdx-exchange.dpmf.technology";
export const EXCHANGE_MEMO_TYPE = "dpmf.memo";
export const EXCHANGE_MEMO_FORMAT = "application/json";
export const EXCHANGE_MEMO_VERSION = "1.0.3";
const MAX_MEMO_CHARS = 220;

function currencyLabel(value) {
  const raw = String(value?.currency || value || "").trim();
  if (!raw || raw.toUpperCase() === "XRP") return "XRP";
  const upper = raw.toUpperCase();
  if (/^[A-Z0-9]{3}$/.test(upper)) return upper;
  if (/^03[A-F0-9]{38}$/.test(upper)) return "LP";
  if (/^[A-F0-9]{40}$/.test(upper)) {
    const chars = [];
    for (let i = 0; i < 40; i += 2) {
      const code = Number.parseInt(upper.slice(i, i + 2), 16);
      if (!code) break;
      chars.push(String.fromCharCode(code));
    }
    return chars.join("") || "IOU";
  }
  return upper.slice(0, 12);
}

function isXdx(value) {
  return currencyLabel(value) === "XDX";
}

function pairName(left, right) {
  const a = currencyLabel(left);
  const b = currencyLabel(right);
  if (a === "XDX") return `XDX/${b || "XRP"}`;
  if (b === "XDX") return `XDX/${a || "XRP"}`;
  return [a, b].filter(Boolean).join("/") || "XDX/XRP";
}

export function poolFromTradeContext(txjson = {}, trade = {}) {
  const fromTrade = String(trade.pair || trade.pool || "").replace(/\s+/g, "").toUpperCase();
  if (fromTrade.includes("/")) return fromTrade;
  if (trade.quote) return `XDX/${String(trade.quote).replace(/\s+/g, "").toUpperCase()}`;
  if (txjson.Asset || txjson.Asset2) return pairName(txjson.Asset, txjson.Asset2);
  if (txjson.Amount && txjson.Amount2) return pairName(txjson.Amount, txjson.Amount2);
  if (txjson.TakerPays && txjson.TakerGets) return pairName(txjson.TakerPays, txjson.TakerGets);
  if (txjson.Amount && txjson.SendMax) return pairName(txjson.Amount, txjson.SendMax);
  return "XDX/XRP";
}

function compactMemo(row) {
  const out = { platform: EXCHANGE_PLATFORM };
  for (const [key, value] of Object.entries(row || {})) {
    if (key === "platform") continue;
    if (value == null || value === "") continue;
    out[key] = String(value);
  }
  const json = JSON.stringify(out);
  if (json.length <= MAX_MEMO_CHARS) return out;
  return { platform: EXCHANGE_PLATFORM, module: out.module || "swap" };
}

export function exchangeMemoJson({ txjson = {}, trade = {} } = {}) {
  const type = String(txjson.TransactionType || "");
  const action = String(trade.action || "").trim();
  const pool = poolFromTradeContext(txjson, trade);

  if (type === "AMMCreate" || action === "createPool") {
    return compactMemo({ module: "pool_create", pair: pool });
  }
  if (type === "AMMVote" || action === "vote") {
    return compactMemo({ module: "amm_vote", vote_type: trade.voteType || "trading_fee" });
  }
  if (type === "AMMDeposit" || action === "addLp") {
    return compactMemo({ module: "add_liquidity", pool });
  }
  if (type === "AMMWithdraw" || action === "removeLp") {
    return compactMemo({ module: "remove_liquidity", pool });
  }
  if (type === "TrustSet") {
    const token = currencyLabel(txjson.LimitAmount);
    if (token === "LP") return compactMemo({ module: "lp_action", action: "trustline" });
    return compactMemo({ module: "lp_action", action: token === "XDX" ? "xdx_trustline" : "trustline" });
  }
  if (type === "Payment" || type === "OfferCreate" || action === "buy" || action === "sell") {
    const side =
      action === "sell" ||
      (type === "Payment" && isXdx(txjson.SendMax)) ||
      (type === "OfferCreate" && isXdx(txjson.TakerGets))
        ? "sell"
        : "buy";
    const order = type === "OfferCreate" ? "limit" : "market";
    return compactMemo({
      module: "swap",
      pool,
      version: EXCHANGE_MEMO_VERSION,
      action: side,
      order,
    });
  }
  return compactMemo({ module: action || type.toLowerCase() || "swap", pool });
}

function memoRows(txjson) {
  return Array.isArray(txjson?.Memos) ? txjson.Memos : [];
}

export function extractExchangeMemo(txjson) {
  for (const row of memoRows(txjson)) {
    const memo = row?.Memo || row || {};
    const type = hexToAscii(memo.MemoType);
    if (type !== EXCHANGE_MEMO_TYPE && type !== "application/json") continue;
    try {
      const parsed = JSON.parse(hexToAscii(memo.MemoData));
      if (parsed?.platform === EXCHANGE_PLATFORM) return parsed;
    } catch {
      // ignore malformed memo data
    }
  }
  return null;
}

export function stampExchangeMemo(txjson, context = {}) {
  if (!txjson || typeof txjson !== "object") return txjson;
  if (extractExchangeMemo(txjson)) return txjson;
  const memo = exchangeMemoJson({ txjson, trade: context.trade || {} });
  return {
    ...txjson,
    Memos: [
      ...memoRows(txjson),
      {
        Memo: {
          MemoType: asciiToHex(EXCHANGE_MEMO_TYPE),
          MemoFormat: asciiToHex(EXCHANGE_MEMO_FORMAT),
          MemoData: asciiToHex(JSON.stringify(memo)),
        },
      },
    ],
  };
}

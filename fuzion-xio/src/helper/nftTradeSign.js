import { extractTradeMarker } from "./signMarker.js";

export const NFT_TRADE_TX = new Set([
  "NFTokenMint",
  "NFTokenCreateOffer",
  "NFTokenAcceptOffer",
  "NFTokenCancelOffer",
  "NFTokenBurn",
  "Payment",
  "OfferCreate"
]);

export const ACTION_TX_TYPES = {
  buy: ["NFTokenCreateOffer", "NFTokenAcceptOffer"],
  sale: ["NFTokenCreateOffer"],
  sell: ["NFTokenCreateOffer"],
  makeOffer: ["NFTokenCreateOffer"],
  acceptOffer: ["NFTokenAcceptOffer"],
  cancelSale: ["NFTokenCancelOffer"],
  cancelOffer: ["NFTokenCancelOffer"],
  cancelSend: ["NFTokenCancelOffer"],
  mint: ["NFTokenMint"],
  burn: ["NFTokenBurn"],
  send: ["NFTokenCreateOffer"]
};

export function isNftTradeTx(txType) {
  return NFT_TRADE_TX.has(String(txType || "").trim());
}

export function executionTxType(detail = {}) {
  return String(
    detail.txType ||
      detail.txjson?.TransactionType ||
      detail.payload?.tx_type ||
      detail.payload?.request_json?.TransactionType ||
      detail.result?.payload?.tx_type ||
      ""
  ).trim();
}

export function executionClosesTradeAction(action, detail = {}) {
  const txType = executionTxType(detail);
  if (txType === "TrustSet" || txType === "SignIn") return false;
  const allowed = ACTION_TX_TYPES[action];
  if (!allowed) return Boolean(action);
  if (!txType) return true;
  return allowed.includes(txType);
}

export function executionResolvedAtMs(detail = {}) {
  const raw =
    detail.resolved_at ||
    detail.payload?.meta?.resolved_at ||
    detail.result?.meta?.resolved_at ||
    detail.signed_at ||
    "";
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return parsed;
  const numeric = Number(detail.at);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

export function executionBelongsToOpenTrade(current, detail = {}) {
  if (!current?.action || !executionClosesTradeAction(current.action, detail)) return false;
  const openedAt = Number(current.openId) || 0;
  const resolvedMs = executionResolvedAtMs(detail);
  if (openedAt && resolvedMs && resolvedMs + 2000 < openedAt) return false;

  const eventUuid = String(detail.uuid || "").trim().toLowerCase();
  const currentUuid = String(current.activeUuid || current.resumeUuid || "").trim().toLowerCase();
  if (!currentUuid) return false;
  if (eventUuid && currentUuid !== eventUuid) return false;

  const eventMarker = String(detail.signMarker || extractTradeMarker(detail.txjson) || "").trim();
  const currentMarker = String(current.signMarker || "").trim();
  if (currentMarker && eventMarker && currentMarker !== eventMarker) return false;
  return true;
}

export function openNftTradePanel(action, extra = {}) {
  return {
    action,
    openId: Date.now(),
    activeUuid: "",
    resumeUuid: "",
    signMarker: "",
    ...extra
  };
}

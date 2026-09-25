/** Pre-flight checks so Xaman only sees txs it can actually submit. */

export function isLedgerNftId(value) {
  return /^[A-Fa-f0-9]{64}$/.test(String(value || "").trim());
}

export function isClassicAddress(value, { allowDemo = false } = {}) {
  const text = String(value || "").trim();
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(text)) return true;
  if (allowDemo && /^r[A-Za-z0-9]{24,34}$/.test(text)) return true;
  return false;
}

export function isPositiveAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

const LEDGER_NFT_KINDS = new Set(["sale", "buy", "burn", "send", "makeOffer"]);
const AMOUNT_KINDS = new Set(["sale", "buy", "makeOffer"]);

export function validateSignedIntent(kind, intent = {}, txjson = {}) {
  const nftId = intent.NFTokenID || txjson.NFTokenID || "";
  if (LEDGER_NFT_KINDS.has(kind) && !isLedgerNftId(nftId)) {
    return {
      ok: false,
      status: 400,
      message:
        "This NFT is not on the live XRPL yet (needs a 64-character hex NFTokenID). Paper demo listings stay on the local desk — Xaman rejects demo ids."
    };
  }
  if (AMOUNT_KINDS.has(kind) && !isPositiveAmount(intent.amount ?? txjson.Amount)) {
    return { ok: false, status: 400, message: "Enter a valid amount before signing in Xaman." };
  }
  if (kind === "send" && !isClassicAddress(intent.destAdd || txjson.Destination)) {
    return {
      ok: false,
      status: 400,
      message: "Destination is not a valid XRPL classic address."
    };
  }
  if (kind === "buy" && intent.Owner && !isClassicAddress(intent.Owner, { allowDemo: true })) {
    return { ok: false, status: 400, message: "Seller address is invalid." };
  }
  if (
    (kind === "acceptOffer" || kind === "cancelOffer" || kind === "cancelSale" || kind === "cancelSend") &&
    !intent.offerId &&
    !intent.nftOfferIndex &&
    !(Array.isArray(txjson.NFTokenOffers) && txjson.NFTokenOffers.length)
  ) {
    return { ok: false, status: 400, message: "Offer index required to sign this cancel/accept." };
  }
  if (kind === "trustset" && (!intent.currency || !intent.issuer)) {
    return { ok: false, status: 400, message: "Trust line needs a currency and issuer." };
  }
  if (kind !== "connect" && kind !== "register" && kind !== "signin" && kind !== "mint") {
    if (txjson.Account && !isClassicAddress(txjson.Account, { allowDemo: true })) {
      return { ok: false, status: 400, message: "Connect Xaman with a valid XRPL address first." };
    }
  }
  return { ok: true };
}

const AUTH_CODES = new Set([810, 811, 812, 813]);

export function xamanUserError(raw, fallback = "Xaman could not open this transaction.") {
  if (typeof raw === "string" && raw && raw !== "[object Object]") return raw;
  if (typeof raw?.error === "string" && raw.error) return raw.error;
  if (typeof raw?.message === "string" && raw.message) return raw.message;
  if (typeof raw?.error?.message === "string" && raw.error.message) {
    return raw.error.message;
  }
  const code = Number(raw?.error?.code ?? raw?.code ?? raw?.error_code);
  if (code === 603) {
    return "Xaman could not build this transaction (603). The NFT id, amount, or address is not a valid XRPL value.";
  }
  if (AUTH_CODES.has(code)) {
    return "Xaman rejected the app keys. Check XUMM_API_KEY and XUMM_API_SECRET, and add this site as a return URL.";
  }
  if (Number.isFinite(code)) return `Xaman could not open this transaction (${code}).`;
  return fallback;
}

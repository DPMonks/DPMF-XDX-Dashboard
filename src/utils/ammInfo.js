import { XDX_HEX, XDX_ISSUER } from "../constants/ledger.js";

const XDX_PREFIX = "584458";

export function isXdxAmount(amount) {
  if (amount == null || typeof amount !== "object") return false;
  const currency = String(amount.currency || "").toUpperCase();
  const issuer = String(amount.issuer || "");
  return (
    currency === "XDX" ||
    currency === XDX_HEX ||
    currency.startsWith(XDX_PREFIX) ||
    issuer === XDX_ISSUER
  );
}

export function issuedAmountValue(amount) {
  if (amount == null) return null;
  if (typeof amount === "object") {
    const n = Number(amount.value);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return n / 1_000_000;
}

export function poolReservesFromAmmInfo(result) {
  const amm = result?.amm || result;
  if (!amm || (amm.amount == null && amm.amount2 == null && !amm.lp_token)) return null;
  const first = amm.amount;
  const second = amm.amount2;
  const firstIsXdx = isXdxAmount(first);
  const secondIsXdx = isXdxAmount(second);
  const reserveXdx = firstIsXdx
    ? issuedAmountValue(first)
    : secondIsXdx
      ? issuedAmountValue(second)
      : null;
  const reserveQuote = firstIsXdx
    ? issuedAmountValue(second)
    : secondIsXdx
      ? issuedAmountValue(first)
      : issuedAmountValue(second);
  const lpSupply = issuedAmountValue(amm.lp_token);
  return {
    amm_account: amm.account || null,
    lp_supply: lpSupply,
    reserve_xdx: reserveXdx,
    reserve_asset: reserveXdx,
    reserve_currency: reserveQuote,
    reserve_quote: reserveQuote,
    lp_currency: amm.lp_token?.currency || null,
    trading_fee: amm.trading_fee ?? null,
  };
}

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

function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function overlayLiveAmmReserves(row = {}, live = null) {
  if (!live) return row;
  const reserveXdx =
    positive(live.reserve_xdx ?? live.reserve_asset) ||
    positive(row.reserve_xdx ?? row.reserve_asset);
  const reserveQuote =
    positive(live.reserve_currency ?? live.reserve_quote) ||
    positive(row.reserve_currency ?? row.reserve_quote);
  const lpSupply = positive(live.lp_supply) || positive(row.lp_supply);
  const liveHit = Boolean(
    positive(live.reserve_xdx ?? live.reserve_asset) ||
      positive(live.reserve_currency ?? live.reserve_quote) ||
      positive(live.lp_supply)
  );
  return {
    ...row,
    reserve_xdx: reserveXdx || row.reserve_xdx || null,
    reserve_asset: reserveXdx || row.reserve_asset || null,
    reserve_currency: reserveQuote || row.reserve_currency || null,
    reserve_quote: reserveQuote || row.reserve_quote || null,
    lp_supply: lpSupply || row.lp_supply || null,
    trading_fee: live.trading_fee ?? row.trading_fee,
    reserve_source: liveHit ? "amm_info" : row.reserve_source,
  };
}

export function lpShareAmounts(lpAmount, reserveBase, reserveQuote, lpSupply) {
  const lp = Number(lpAmount);
  const supply = Number(lpSupply);
  if (!(lp > 0) || !(supply > 0)) return { base: 0, quote: 0 };
  return {
    base: (lp / supply) * Number(reserveBase || 0),
    quote: (lp / supply) * Number(reserveQuote || 0),
  };
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

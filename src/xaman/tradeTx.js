import {
  RLUSD_ISSUER,
  TF_SET_NO_RIPPLE,
  XDX_ISSUER,
  XDX_CURRENCY,
  XDX_RLUSD_AMM,
  XDX_RLUSD_LP_HEX,
  XDX_XRP_AMM,
  XDX_XRP_LP_HEX,
  XIO_ISSUER,
  XSQUAD_ISSUER,
} from "../constants/ledger.js";

export const DROPS_PER_XRP = 1_000_000;
export const TF_IMMEDIATE_OR_CANCEL = 131072;
export const TF_TWO_ASSET = 1_048_576;
export const TF_LP_TOKEN = 65_536;
export const LEDGER_FEE_XRP = 0.000012;

export const QUOTE_ASSETS = [
  { id: "XRP", currency: "XRP", label: "XRP" },
  { id: "RLUSD", currency: "RLUSD", issuer: RLUSD_ISSUER, label: "RLUSD" },
  { id: "XIO", currency: "XIO", issuer: XIO_ISSUER, label: "XIO" },
  { id: "XSQUAD", currency: "XSQUAD", issuer: XSQUAD_ISSUER, label: "XSQUAD" },
];

export function quoteAsset(id) {
  return QUOTE_ASSETS.find((row) => row.id === id) || QUOTE_ASSETS[0];
}

export function xrpDrops(xrp) {
  const n = Number(xrp);
  if (!Number.isFinite(n) || n < 0) return "0";
  return String(Math.round(n * DROPS_PER_XRP));
}

export function issuedAmount(currency, issuer, value) {
  return {
    currency,
    issuer,
    value: String(value),
  };
}

export function quoteAmount(quote, value) {
  if (!quote || quote.currency === "XRP") return xrpDrops(value);
  return issuedAmount(quote.currency, quote.issuer, value);
}

export function xdxAmount(value) {
  return issuedAmount(XDX_CURRENCY, XDX_ISSUER, value);
}

export function offerCreateBuyXdx({ account, quote, xdx, cost, market = false } = {}) {
  const txjson = {
    TransactionType: "OfferCreate",
    TakerPays: xdxAmount(xdx),
    TakerGets: quoteAmount(quote, cost),
  };
  if (account) txjson.Account = account;
  if (market) txjson.Flags = TF_IMMEDIATE_OR_CANCEL;
  return txjson;
}

export function offerCreateSellXdx({ account, quote, xdx, proceeds, market = false } = {}) {
  const txjson = {
    TransactionType: "OfferCreate",
    TakerGets: xdxAmount(xdx),
    TakerPays: quoteAmount(quote, proceeds),
  };
  if (account) txjson.Account = account;
  if (market) txjson.Flags = TF_IMMEDIATE_OR_CANCEL;
  return txjson;
}

export function ammDepositTx({ account, quote, xdx, quoteQty } = {}) {
  const txjson = {
    TransactionType: "AMMDeposit",
    Asset: { currency: XDX_CURRENCY, issuer: XDX_ISSUER },
    Asset2: quote?.currency === "XRP" || !quote?.issuer ? { currency: "XRP" } : { currency: quote.currency, issuer: quote.issuer },
    Amount: xdxAmount(xdx),
    Amount2: quoteAmount(quote, quoteQty),
    Flags: TF_TWO_ASSET,
  };
  if (account) txjson.Account = account;
  return txjson;
}

export function poolForQuote(quote) {
  if (quote?.currency === "RLUSD") {
    return { amm: XDX_RLUSD_AMM, lpCurrency: XDX_RLUSD_LP_HEX, pair: "XDX/RLUSD" };
  }
  return { amm: XDX_XRP_AMM, lpCurrency: XDX_XRP_LP_HEX, pair: "XDX/XRP" };
}

export function ammWithdrawTx({ account, quote, lpAmount } = {}) {
  const pool = poolForQuote(quote);
  const txjson = {
    TransactionType: "AMMWithdraw",
    Asset: { currency: XDX_CURRENCY, issuer: XDX_ISSUER },
    Asset2: quote?.currency === "XRP" || !quote?.issuer ? { currency: "XRP" } : { currency: quote.currency, issuer: quote.issuer },
    LPTokenIn: {
      currency: pool.lpCurrency,
      issuer: pool.amm,
      value: String(lpAmount),
    },
    Flags: TF_LP_TOKEN,
  };
  if (account) txjson.Account = account;
  return txjson;
}

export function quoteTrustSetTxjson(account, quote) {
  if (!quote?.issuer) return null;
  const txjson = {
    TransactionType: "TrustSet",
    Flags: TF_SET_NO_RIPPLE,
    LimitAmount: {
      currency: quote.currency,
      issuer: quote.issuer,
      value: "100000000000",
    },
  };
  if (account) txjson.Account = account;
  return txjson;
}

export function tradeTotal(amount, price) {
  const qty = Number(amount);
  const px = Number(price);
  if (!Number.isFinite(qty) || !Number.isFinite(px) || qty <= 0 || px <= 0) return 0;
  return qty * px;
}

export function recommendedQuote(xdxAmount, reserveBase, reserveQuote) {
  const base = Number(reserveBase);
  const quote = Number(reserveQuote);
  const qty = Number(xdxAmount);
  if (!(base > 0) || !(quote > 0) || !(qty > 0)) return 0;
  return (qty / base) * quote;
}

export function expectedLpTokens(xdxAmount, reserveBase, lpSupply) {
  const base = Number(reserveBase);
  const supply = Number(lpSupply);
  const qty = Number(xdxAmount);
  if (!(base > 0) || !(supply > 0) || !(qty > 0)) return 0;
  return (qty / base) * supply;
}

export function notifyWalletRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dpmf-wallet-refresh"));
}

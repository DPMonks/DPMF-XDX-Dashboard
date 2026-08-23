import {
  RLUSD_HEX,
  RLUSD_ISSUER,
  TF_SET_NO_RIPPLE,
  XDX_ISSUER,
  XDX_CURRENCY,
  XDX_RLUSD_AMM,
  XDX_RLUSD_LP_HEX,
  XDX_XRP_AMM,
  XDX_XRP_LP_HEX,
  XIO_ISSUER,
  XSQUAD_HEX,
  XSQUAD_ISSUER,
  asciiCurrencyHex,
} from "../constants/ledger.js";
import { detectQuoteUsd } from "../utils/poolSplit.js";
import { pendingFromExecution, rememberPending } from "../wallet/ledgerOrders.js";
import { pendingVoteFromExecution } from "../wallet/ammVote.js";

export const DROPS_PER_XRP = 1_000_000;
export const TF_IMMEDIATE_OR_CANCEL = 131072;
export const TF_TWO_ASSET = 1_048_576;
export const TF_LP_TOKEN = 65_536;
export const LEDGER_FEE_XRP = 0.000012;

export const QUOTE_ASSETS = [
  { id: "XRP", currency: "XRP", label: "XRP" },
  { id: "RLUSD", currency: "RLUSD", issuer: RLUSD_ISSUER, hex: RLUSD_HEX, label: "RLUSD" },
  { id: "XIO", currency: "XIO", issuer: XIO_ISSUER, label: "XIO" },
  { id: "XSQUAD", currency: "XSQUAD", issuer: XSQUAD_ISSUER, hex: XSQUAD_HEX, label: "XSQUAD" },
];

export function quoteAsset(id) {
  return QUOTE_ASSETS.find((row) => row.id === id) || QUOTE_ASSETS[0];
}

export function lpHeldForPair(rows, pair, quoteId) {
  const want = String(pair || (quoteId ? `XDX/${quoteId}` : "")).toUpperCase();
  const quote = String(quoteId || want.split("/")[1] || "").toUpperCase();
  const row = (Array.isArray(rows) ? rows : []).find((item) => {
    const name = String(item?.pool_name || item?.pool || item?.pair || "").replace(/\s+/g, "").toUpperCase();
    return name === want || name === `XDX/${quote}` || (quote && name.endsWith(`/${quote}`));
  });
  const n = Number(row?.lp_balance ?? row?.lp ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function quoteIdFromPair(pair) {
  const text = String(pair || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!text) return "XRP";
  if (text.includes("/")) return text.split("/").pop() || "XRP";
  return text;
}

export const WALLET_EVENTS = {
  needSignIn: "dpmf-need-sign-in",
  signedIn: "dpmf-wallet-signed-in",
  signInCancelled: "dpmf-sign-in-cancelled",
};

export function normalizeTradeRequest(detail) {
  if (!detail) return null;
  if (typeof detail === "string") return { action: detail, quote: "XRP" };
  const action = detail.action || detail.id || null;
  if (!action) return null;
  return {
    action,
    quote: quoteIdFromPair(detail.quote || detail.pair || detail.pool || "XRP"),
    quoteIssuer: detail.quoteIssuer || detail.quote_issuer || null,
    quoteHex: detail.quoteHex || detail.quote_hex || null,
  };
}

export function gateUnsignedTrade(detail, walletAddress) {
  const trade = normalizeTradeRequest(detail);
  if (!trade) return { action: "ignore" };
  if (walletAddress) return { action: "open", trade };
  return { action: "sign-in", trade };
}

export function resolveQuote(id, extra = {}) {
  const key = quoteIdFromPair(id || extra.quote);
  const known = QUOTE_ASSETS.find((row) => row.id === key);
  if (known) return { ...known, pair: `XDX/${known.id}` };
  return {
    id: key,
    currency: key === "XRP" ? "XRP" : key,
    issuer: extra.quoteIssuer || extra.quote_issuer || extra.issuer || null,
    hex: extra.quoteHex || extra.quote_hex || extra.hex || null,
    label: key,
    pair: `XDX/${key}`,
  };
}

export function quoteChoices(pools = []) {
  const ids = QUOTE_ASSETS.map((row) => row.id);
  for (const row of Array.isArray(pools) ? pools : []) {
    const id = quoteIdFromPair(row.pool || row.pool_name || row.pair || row.quote);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function quoteLedgerCurrency(quote) {
  if (!quote || quote.currency === "XRP" || !quote.issuer) return "XRP";
  const code = String(quote.currency || quote.hex || "");
  if (/^[A-Z0-9]{3}$/i.test(code)) return code.toUpperCase();
  if (/^[A-Fa-f0-9]{40}$/.test(code)) return code.toUpperCase();
  const hex = String(quote.hex || "");
  if (/^[A-Fa-f0-9]{40}$/.test(hex)) return hex.toUpperCase();
  return asciiCurrencyHex(quote.currency || quote.id || code);
}

export function xrplIssuedValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  const abs = Math.abs(n);
  const decimals = abs >= 1 ? Math.min(8, Math.max(0, 15 - String(Math.trunc(abs)).length)) : 10;
  return n.toFixed(decimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") || "0";
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
    value: xrplIssuedValue(value),
  };
}

export function quoteAmount(quote, value) {
  if (!quote || quote.currency === "XRP" || !quote.issuer) return xrpDrops(value);
  return issuedAmount(quoteLedgerCurrency(quote), quote.issuer, value);
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
    Asset2:
      quote?.currency === "XRP" || !quote?.issuer
        ? { currency: "XRP" }
        : { currency: quoteLedgerCurrency(quote), issuer: quote.issuer },
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
    Asset2:
      quote?.currency === "XRP" || !quote?.issuer
        ? { currency: "XRP" }
        : { currency: quoteLedgerCurrency(quote), issuer: quote.issuer },
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

export function poolPrice(reserveBase, reserveQuote) {
  const base = Number(reserveBase);
  const quote = Number(reserveQuote);
  if (!(base > 0) || !(quote > 0)) return 0;
  return quote / base;
}

export function visibleQuoteQty(quoteQty, hint) {
  if (quoteQty !== "" && quoteQty != null) return String(quoteQty);
  return Number(hint) > 0 ? String(hint) : "";
}

export const MAX_TRADE_QTY = 1_000_000_000_000;

export function formatLinkedQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  const capped = Math.min(n, MAX_TRADE_QTY);
  if (capped >= 1_000_000) return String(Math.round(capped));
  const text = capped.toPrecision(8);
  if (/[eE]/.test(text)) return capped.toFixed(8).replace(/\.?0+$/, "");
  return String(Number(text));
}

export function sanitizeQtyInput(raw) {
  const text = String(raw ?? "").replace(/,/g, "").trim();
  if (text === "" || text === "." || text === "0.") return text;
  if (!/^\d*\.?\d*$/.test(text)) return null;
  const clipped = text.length > 18 ? text.slice(0, 18) : text;
  const n = Number(clipped);
  if (Number.isFinite(n) && n > MAX_TRADE_QTY) return String(MAX_TRADE_QTY);
  return clipped;
}

export function linkedDepositAmounts({
  editedSide = "xdx",
  amount,
  quoteQty,
  price,
  reserveBase,
  reserveQuote,
} = {}) {
  const side = editedSide === "quote" ? "quote" : "xdx";
  if (side === "quote") {
    const quote = Number(quoteQty);
    const xdx = predictedXdxFromQuote(quoteQty, price, reserveBase, reserveQuote);
    return {
      xdx: xdx > 0 ? xdx : 0,
      quote: quote > 0 ? quote : 0,
      xdxInput: xdx > 0 ? formatLinkedQty(xdx) : "",
      quoteInput: quoteQty == null ? "" : String(quoteQty),
    };
  }
  const xdx = Number(amount);
  const quote = predictedQuoteOut(amount, price, reserveBase, reserveQuote);
  return {
    xdx: xdx > 0 ? xdx : 0,
    quote: quote > 0 ? quote : 0,
    xdxInput: amount == null ? "" : String(amount),
    quoteInput: quote > 0 ? formatLinkedQty(quote) : "",
  };
}

export function predictedQuoteOut(xdxAmount, price, reserveBase, reserveQuote) {
  const fromPool = recommendedQuote(xdxAmount, reserveBase, reserveQuote);
  if (fromPool > 0) return fromPool;
  return tradeTotal(xdxAmount, price);
}

export function predictedXdxFromQuote(quoteAmount, price, reserveBase, reserveQuote) {
  const base = Number(reserveBase);
  const quote = Number(reserveQuote);
  const qty = Number(quoteAmount);
  if (base > 0 && quote > 0 && qty > 0) return (qty / quote) * base;
  const px = Number(price);
  if (px > 0 && qty > 0) return qty / px;
  return 0;
}

export function xdxUnitUsd({ pool, prices } = {}) {
  const fromPool = Number(pool?.xdxUsd);
  if (fromPool > 0) return fromPool;
  const fromPrices = Number(prices?.xdxUsd ?? prices?.recorded_price);
  return fromPrices > 0 ? fromPrices : 0;
}

export function quoteUnitUsd({ quoteId, pool, prices, allowImplied = true } = {}) {
  return detectQuoteUsd({
    quoteId,
    pool: {
      ...pool,
      xdxUsd: xdxUnitUsd({ pool, prices }) || pool?.xdxUsd,
    },
    prices,
    allowImplied,
  });
}

export function depositValueSplit({ xdxAmount, quoteAmount, xdxUsd, quoteUsd } = {}) {
  const xdxValue = Math.max(0, Number(xdxAmount) * Number(xdxUsd) || 0);
  const quoteValue = Math.max(0, Number(quoteAmount) * Number(quoteUsd) || 0);
  const total = xdxValue + quoteValue;
  if (!(total > 0)) {
    return { xdxValue: 0, quoteValue: 0, total: 0, xdxPct: 50, quotePct: 50, measured: false };
  }
  const xdxPct = (xdxValue / total) * 100;
  return {
    xdxValue,
    quoteValue,
    total,
    xdxPct,
    quotePct: 100 - xdxPct,
    measured: Number(xdxUsd) > 0 && Number(quoteUsd) > 0,
  };
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

export function expectedWithdraw(lpAmount, reserveBase, reserveQuote, lpSupply) {
  const lp = Number(lpAmount);
  const supply = Number(lpSupply);
  if (!(lp > 0) || !(supply > 0)) return { base: 0, quote: 0 };
  return {
    base: (lp / supply) * Number(reserveBase || 0),
    quote: (lp / supply) * Number(reserveQuote || 0),
  };
}

export function tradeSides({ action, amount, quoteQty, quoteLabel, total, lpAmount, lpOut, withdraw } = {}) {
  const label = quoteLabel || "XRP";
  if (action === "buy") {
    return {
      pay: [{ value: Number(quoteQty || total) || 0, asset: label }],
      receive: [{ value: Number(amount) || 0, asset: "XDX" }],
    };
  }
  if (action === "sell") {
    return {
      pay: [{ value: Number(amount) || 0, asset: "XDX" }],
      receive: [{ value: Number(quoteQty || total) || 0, asset: label }],
    };
  }
  if (action === "addLp") {
    return {
      pay: [
        { value: Number(amount) || 0, asset: "XDX" },
        { value: Number(quoteQty) || 0, asset: label },
      ],
      receive: [{ value: Number(lpOut) || 0, asset: "LP" }],
    };
  }
  return {
    pay: [{ value: Number(lpAmount) || 0, asset: "LP" }],
    receive: [
      { value: Number(withdraw?.base) || 0, asset: "XDX" },
      { value: Number(withdraw?.quote) || 0, asset: label },
    ],
  };
}

export function notifyWalletRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dpmf-wallet-refresh"));
}

export function notifyTradeExecuted(detail = {}) {
  if (typeof window === "undefined") return;
  const account = detail.account || detail.txjson?.Account || null;
  const pending = pendingFromExecution(detail, account) || pendingVoteFromExecution(detail, account);
  if (pending) rememberPending(pending.activity.account, pending);
  window.dispatchEvent(new CustomEvent("dpmf-trade-executed", { detail }));
  notifyWalletRefresh();
}

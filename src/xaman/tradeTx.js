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
import { rememberTradeNotice } from "../wallet/tradeNotice.js";
import { pendingVoteFromExecution } from "../wallet/ammVote.js";
import { preferMarkWhenPoolInsane } from "../wallet/quoteMarker.js";
import { liveWalletAddress } from "../wallet/walletStorage.js";
import { extractTradeMarker } from "./signMarker.js";
import { isConsumedUuid, isPayloadUuid, peekPendingPayload, rememberConsumedUuid, rememberPendingPayload } from "./payloadResume.js";

export const ACTION_TX_TYPES = {
  buy: ["Payment", "OfferCreate"],
  sell: ["Payment", "OfferCreate"],
  addLp: ["AMMDeposit"],
  removeLp: ["AMMWithdraw"],
  createPool: ["AMMCreate"],
  vote: ["AMMVote"],
};

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

export const DROPS_PER_XRP = 1_000_000;
export const TF_IMMEDIATE_OR_CANCEL = 131072;
export const TF_PARTIAL_PAYMENT = 131072;
export const TF_TWO_ASSET = 1_048_576;
export const TF_SINGLE_ASSET = 524_288;
export const TF_LP_TOKEN = 65_536;
// AMMWithdraw only. 262144 is tfOneAssetWithdrawAll (Amount, no LPTokenIn)
// and is temMALFORMED if LPTokenIn is also present.
export const TF_ONE_ASSET_LP_TOKEN = 2_097_152;
export const TF_ONE_ASSET_WITHDRAW_ALL = 262_144;
export const LEDGER_FEE_XRP = 0.000012;
export const MARKET_SLIPPAGE = 0.15;

export function withMarketSlippage(value, side = "buy") {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return side === "sell" ? n * (1 - MARKET_SLIPPAGE) : n * (1 + MARKET_SLIPPAGE);
}

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
  tradePending: "dpmf-trade-pending",
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
  if (liveWalletAddress(walletAddress)) return { action: "open", trade };
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

export function xrplIssuedFloor(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "0";
  const canon = xrplIssuedValue(n);
  if (Number(canon) <= n) return canon;
  const abs = Math.abs(n);
  const decimals = abs >= 1 ? Math.min(8, Math.max(0, 15 - String(Math.trunc(abs)).length)) : 10;
  const stepped = n - 10 ** -decimals;
  return stepped > 0 ? xrplIssuedValue(stepped) : "0";
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

/**
 * Market buy/sell is a self Payment so rippled takes the pair's DEX book and
 * AMM. OfferCreate + Immediate-or-Cancel only hits resting CLOB offers and
 * returns tecKILLED when those are empty (ImmediateOfferKilled).
 */
export function marketBuyXdx({ account, quote, xdx, cost } = {}) {
  const sendMax = withMarketSlippage(cost, "buy");
  const txjson = {
    TransactionType: "Payment",
    Amount: xdxAmount(xdx),
    SendMax: quoteAmount(quote, sendMax),
    Flags: TF_PARTIAL_PAYMENT,
  };
  if (account) {
    txjson.Account = account;
    txjson.Destination = account;
  }
  return txjson;
}

export function marketSellXdx({ account, quote, xdx, proceeds } = {}) {
  const deliver = withMarketSlippage(proceeds, "sell");
  const txjson = {
    TransactionType: "Payment",
    Amount: quoteAmount(quote, deliver),
    SendMax: xdxAmount(xdx),
    Flags: TF_PARTIAL_PAYMENT,
  };
  if (account) {
    txjson.Account = account;
    txjson.Destination = account;
  }
  return txjson;
}

export function offerCreateBuyXdx({ account, quote, xdx, cost, market = false } = {}) {
  if (market) return marketBuyXdx({ account, quote, xdx, cost });
  const txjson = {
    TransactionType: "OfferCreate",
    TakerPays: xdxAmount(xdx),
    TakerGets: quoteAmount(quote, cost),
  };
  if (account) txjson.Account = account;
  return txjson;
}

export function offerCreateSellXdx({ account, quote, xdx, proceeds, market = false } = {}) {
  if (market) return marketSellXdx({ account, quote, xdx, proceeds });
  const txjson = {
    TransactionType: "OfferCreate",
    TakerGets: xdxAmount(xdx),
    TakerPays: quoteAmount(quote, proceeds),
  };
  if (account) txjson.Account = account;
  return txjson;
}

export function ammDepositTx({ account, quote, xdx, quoteQty, mode = "double", singleAsset = "xdx" } = {}) {
  const txjson = {
    TransactionType: "AMMDeposit",
    Asset: { currency: XDX_CURRENCY, issuer: XDX_ISSUER },
    Asset2:
      quote?.currency === "XRP" || !quote?.issuer
        ? { currency: "XRP" }
        : { currency: quoteLedgerCurrency(quote), issuer: quote.issuer },
  };
  if (mode === "single") {
    txjson.Flags = TF_SINGLE_ASSET;
    txjson.Amount = singleAsset === "quote" ? quoteAmount(quote, quoteQty) : xdxAmount(xdx);
  } else {
    txjson.Flags = TF_TWO_ASSET;
    txjson.Amount = xdxAmount(xdx);
    txjson.Amount2 = quoteAmount(quote, quoteQty);
  }
  if (account) txjson.Account = account;
  return txjson;
}

export function isLpCurrency(value) {
  return /^03[A-Fa-f0-9]{38}$/.test(String(value || "").trim());
}

export function poolForQuote(quote, pools = [], live = null) {
  const pair = String(quote?.pair || `XDX/${quote?.id || quote?.currency || "XRP"}`)
    .replace(/\s+/g, "")
    .toUpperCase();
  const liveAmm = live?.amm_account || live?.amm || null;
  const liveLp = isLpCurrency(live?.lp_currency || live?.lp_currency_hex)
    ? String(live.lp_currency || live.lp_currency_hex).trim().toUpperCase()
    : null;
  if (liveAmm && liveLp) return { amm: liveAmm, lpCurrency: liveLp, pair };
  const row = (Array.isArray(pools) ? pools : []).find((item) => {
    const name = String(item?.pool || item?.pool_name || item?.pair || "")
      .replace(/\s+/g, "")
      .toUpperCase();
    return name === pair || name.endsWith(`/${pair.split("/")[1] || ""}`);
  });
  const amm = row?.amm_account || row?.amm || liveAmm || null;
  const rawLp = row?.lp_currency || row?.lp_currency_hex || liveLp || null;
  const lpCurrency = isLpCurrency(rawLp) ? String(rawLp).trim().toUpperCase() : null;
  if (amm && lpCurrency) return { amm, lpCurrency, pair };
  if (quote?.currency === "RLUSD" || pair === "XDX/RLUSD") {
    return { amm: XDX_RLUSD_AMM, lpCurrency: XDX_RLUSD_LP_HEX, pair: "XDX/RLUSD" };
  }
  if (quote?.currency === "XRP" || pair === "XDX/XRP" || !quote?.issuer) {
    return { amm: XDX_XRP_AMM, lpCurrency: XDX_XRP_LP_HEX, pair: pair || "XDX/XRP" };
  }
  return { amm: null, lpCurrency: null, pair };
}

export function lpTrustSetTxjson(account, spec = {}) {
  const currency = isLpCurrency(spec.lpCurrency || spec.currency)
    ? String(spec.lpCurrency || spec.currency).trim().toUpperCase()
    : "";
  const issuer = String(spec.amm || spec.issuer || "").trim();
  if (!currency || !issuer) return null;
  const txjson = {
    TransactionType: "TrustSet",
    Flags: TF_SET_NO_RIPPLE,
    LimitAmount: {
      currency,
      issuer,
      value: "100000000000",
    },
  };
  if (account) txjson.Account = account;
  return txjson;
}

export function hasLpTrustline(lines, spec = {}) {
  const currency = String(spec.lpCurrency || spec.currency || "").toUpperCase();
  const issuer = String(spec.amm || spec.issuer || "").toUpperCase();
  if (!currency && !issuer) return false;
  return (Array.isArray(lines) ? lines : []).some((row) => {
    const who = String(row?.issuer || row?.account || "").toUpperCase();
    if (issuer && who && who !== issuer) return false;
    const code = String(row?.currency || row?.hex || "").toUpperCase();
    if (currency && code === currency) return true;
    return Boolean(row?.lp) && Boolean(issuer) && who === issuer;
  });
}

export function ammWithdrawTx({
  account,
  quote,
  lpAmount,
  pools,
  live,
  mode = "double",
  singleAsset = "xdx",
} = {}) {
  const pool = poolForQuote(quote, pools, live);
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
      value: xrplIssuedFloor(lpAmount),
    },
    Flags: TF_LP_TOKEN,
  };
  if (mode === "single") {
    // tfOneAssetLPToken: Amount is a *minimum*. 0 means accept any
    // positive output so the AMM trading fee cannot trigger tecAMM_FAILED.
    txjson.Flags = TF_ONE_ASSET_LP_TOKEN;
    txjson.Amount = singleAsset === "quote" ? quoteAmount(quote, 0) : xdxAmount(0);
  }
  if (account) txjson.Account = account;
  return txjson;
}

export function quoteTrustSetTxjson(account, quote) {
  if (!quote?.issuer) return null;
  const currency = quoteLedgerCurrency(quote);
  if (!currency || currency === "XRP") return null;
  const txjson = {
    TransactionType: "TrustSet",
    Flags: TF_SET_NO_RIPPLE,
    LimitAmount: {
      currency,
      issuer: quote.issuer,
      value: "100000000000",
    },
  };
  if (account) txjson.Account = account;
  return txjson;
}

export function hasQuoteTrustline(lines, quote = {}) {
  if (!quote?.issuer) return true;
  const issuer = String(quote.issuer || "").toUpperCase();
  const codes = new Set(
    [quote.currency, quote.hex, quote.id, quote.label, quoteLedgerCurrency(quote)]
      .map((value) => String(value || "").toUpperCase())
      .filter(Boolean)
  );
  return (Array.isArray(lines) ? lines : []).some((row) => {
    if (String(row?.issuer || row?.account || "").toUpperCase() !== issuer) return false;
    const code = String(row?.currency || row?.hex || row?.ticker || "").toUpperCase();
    return codes.has(code);
  });
}

export function shouldAskLpTrustline({ loaded = false, haveLine = false, spec = {} } = {}) {
  if (!loaded || haveLine) return false;
  return Boolean(spec?.amm && isLpCurrency(spec.lpCurrency));
}

export function shouldAskQuoteTrustline({
  loaded = false,
  haveLine = false,
  haveLp = false,
  quote = {},
} = {}) {
  if (!quote?.issuer || haveLine || haveLp || !loaded) return false;
  return true;
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
  preferMark = false,
} = {}) {
  const side = editedSide === "quote" ? "quote" : "xdx";
  if (side === "quote") {
    const quote = Number(quoteQty);
    const xdx = predictedXdxFromQuote(quoteQty, price, reserveBase, reserveQuote, { preferMark });
    return {
      xdx: xdx > 0 ? xdx : 0,
      quote: quote > 0 ? quote : 0,
      xdxInput: xdx > 0 ? formatLinkedQty(xdx) : "",
      quoteInput: quoteQty == null ? "" : String(quoteQty),
    };
  }
  const xdx = Number(amount);
  const quote = predictedQuoteOut(amount, price, reserveBase, reserveQuote, { preferMark });
  return {
    xdx: xdx > 0 ? xdx : 0,
    quote: quote > 0 ? quote : 0,
    xdxInput: amount == null ? "" : String(amount),
    quoteInput: quote > 0 ? formatLinkedQty(quote) : "",
  };
}

export function predictedQuoteOut(xdxAmount, price, reserveBase, reserveQuote, options = {}) {
  const fromPool = recommendedQuote(xdxAmount, reserveBase, reserveQuote);
  const marked = tradeTotal(xdxAmount, price);
  if (options.preferMark) return preferMarkWhenPoolInsane(fromPool, marked);
  if (fromPool > 0) return fromPool;
  return marked;
}

export function predictedXdxFromQuote(quoteAmount, price, reserveBase, reserveQuote, options = {}) {
  const base = Number(reserveBase);
  const quote = Number(reserveQuote);
  const qty = Number(quoteAmount);
  const fromPool = base > 0 && quote > 0 && qty > 0 ? (qty / quote) * base : 0;
  const px = Number(price);
  const marked = px > 0 && qty > 0 ? qty / px : 0;
  if (options.preferMark) return preferMarkWhenPoolInsane(fromPool, marked);
  if (fromPool > 0) return fromPool;
  return marked;
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

export function saneOpposingReserve(reserveBase, reserveQuote, price) {
  const base = Number(reserveBase);
  const quote = Number(reserveQuote);
  const px = Number(price);
  const marked = base > 0 && px > 0 ? base * px : 0;
  return preferMarkWhenPoolInsane(quote, marked) || (quote > 0 ? quote : marked);
}

export function expectedLpTokens(xdxAmount, reserveBase, lpSupply) {
  const base = Number(reserveBase);
  const supply = Number(lpSupply);
  const qty = Number(xdxAmount);
  if (!(base > 0) || !(supply > 0) || !(qty > 0)) return 0;
  return (qty / base) * supply;
}

export function expectedSingleLpTokens(deposit, reserve, lpSupply) {
  const qty = Number(deposit);
  const pool = Number(reserve);
  const supply = Number(lpSupply);
  if (!(qty > 0) || !(pool > 0) || !(supply > 0)) return 0;
  return supply * (Math.sqrt(1 + qty / pool) - 1);
}

export function expectedWithdraw(lpAmount, reserveBase, reserveQuote, lpSupply, options = {}) {
  const lp = Number(lpAmount);
  const supply = Number(lpSupply);
  if (!(lp > 0) || !(supply > 0)) return { base: 0, quote: 0 };
  // LP share is always the pool ratio. preferMark is only a last-resort
  // stand-in when the opposing reserve is missing, not a cross-market rewrite.
  const measured = Number(reserveQuote || 0);
  const quoteReserve =
    measured > 0
      ? measured
      : options.preferMark
        ? saneOpposingReserve(reserveBase, reserveQuote, options.price)
        : 0;
  return {
    base: (lp / supply) * Number(reserveBase || 0),
    quote: (lp / supply) * Number(quoteReserve || 0),
  };
}

export function expectedSingleWithdraw(lpAmount, reserve, lpSupply, tradingFee = 0) {
  const lp = Number(lpAmount);
  const pool = Number(reserve);
  const supply = Number(lpSupply);
  if (!(lp > 0) || !(pool > 0) || !(supply > 0) || lp > supply) return 0;
  const t1 = lp / supply;
  const fee = Math.min(Math.max(Number(tradingFee) || 0, 0), 1000) / 100_000;
  const denom = t1 * fee - 1;
  if (denom === 0) return 0;
  // rippled ammAssetOut (equation 8), including the trading fee.
  const frac = (t1 * t1 - t1 * (2 - fee)) / denom;
  if (!(frac > 0)) return 0;
  return pool * frac;
}

export function tradeSides({
  action,
  amount,
  quoteQty,
  quoteLabel,
  total,
  lpAmount,
  lpOut,
  withdraw,
  singleAsset,
} = {}) {
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
    const pay = [
      { value: Number(amount) || 0, asset: "XDX" },
      { value: Number(quoteQty) || 0, asset: label },
    ].filter((row) => row.value > 0);
    return {
      pay: pay.length ? pay : [{ value: 0, asset: "XDX" }],
      receive: [{ value: Number(lpOut) || 0, asset: "LP" }],
    };
  }
  const receive = [
    { value: Number(withdraw?.base) || 0, asset: "XDX" },
    { value: Number(withdraw?.quote) || 0, asset: label },
  ];
  if (singleAsset === "xdx") receive.splice(1, 1);
  if (singleAsset === "quote") receive.splice(0, 1);
  return {
    pay: [{ value: Number(lpAmount) || 0, asset: "LP" }],
    receive,
  };
}

export function notifyWalletRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dpmf-wallet-refresh"));
}

const announcedTrades = new Set();

function rememberConfirmed(detail = {}) {
  const account = detail.account || detail.txjson?.Account || null;
  const pending = pendingFromExecution(detail, account) || pendingVoteFromExecution(detail, account);
  if (pending) rememberPending(pending.activity.account, pending);
  return pending;
}

export function notifyTradePending(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_EVENTS.tradePending, { detail }));
}

export function notifyTradeExecuted(detail = {}) {
  if (typeof window === "undefined") return;
  if (detail.executed === false || detail.failed || detail.rejected) return;
  const pending = peekPendingPayload();
  const notice = {
    ...detail,
    kind: "executed",
    txjson: detail.txjson || pending?.txjson || null,
    trade: detail.trade || pending?.trade || null,
  };
  rememberTradeNotice(notice);
  const key = String(detail.uuid || detail.txid || "").trim().toLowerCase();
  const marker = detail.signMarker || extractTradeMarker(detail.txjson);
  if (key && (announcedTrades.has(key) || isConsumedUuid(key))) return;
  if (key) {
    announcedTrades.add(key);
    if (isPayloadUuid(key)) rememberConsumedUuid(key, marker);
  } else if (marker) {
    rememberConsumedUuid("", marker);
  }
  if (isPayloadUuid(key)) rememberPendingPayload(key, { signState: "executed", signMarker: marker });
  rememberConfirmed(notice);
  window.dispatchEvent(new CustomEvent("dpmf-trade-executed", { detail: { ...notice, executed: true } }));
  notifyWalletRefresh();
}

export function notifyFunctionConfirmed(detail = {}) {
  if (typeof window === "undefined") return;
  if (detail.executed === false || detail.failed || detail.rejected) return;
  const key = `fn:${String(detail.uuid || detail.txid || "").trim().toLowerCase()}`;
  if (key !== "fn:" && announcedTrades.has(key)) return;
  if (key !== "fn:") announcedTrades.add(key);
  rememberConfirmed(detail);
  window.dispatchEvent(new CustomEvent("dpmf-function-confirmed", { detail: { ...detail, executed: true } }));
  notifyWalletRefresh();
}

export function notifyTradeFailed(detail = {}) {
  if (typeof window === "undefined") return;
  rememberTradeNotice({ ...detail, kind: "failed" });
  window.dispatchEvent(new CustomEvent("dpmf-trade-failed", { detail }));
}

export function notifyTradeUnconfirmed(detail = {}) {
  if (typeof window === "undefined") return;
  rememberTradeNotice({ ...detail, kind: "unconfirmed" });
  window.dispatchEvent(new CustomEvent("dpmf-trade-unconfirmed", { detail }));
}

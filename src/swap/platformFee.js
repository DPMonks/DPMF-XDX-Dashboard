import { XDX_FEE_TREASURY, XDX_PLATFORM_FEE_PCT } from "../constants/ledger.js";
import { normalizePriceBook } from "../utils/poolSplit.js";
import { quoteUnitUsd, xdxAmount, xdxUnitUsd } from "../xaman/tradeTx.js";

function tickerOf(id) {
  return String(id || "")
    .split(":")[0]
    .toUpperCase();
}

export function isXdxAsset(id) {
  return tickerOf(id) === "XDX";
}

export function sameXrplAccount(left, right) {
  return String(left || "").trim() === String(right || "").trim();
}

export function needsXdxPlatformFee(fromId, toId) {
  const from = tickerOf(fromId);
  const to = tickerOf(toId);
  if (!from || !to || from === to) return false;
  return !isXdxAsset(from) && !isXdxAsset(to);
}

export function poolForSwapTicker(pools = [], ticker) {
  const quote = tickerOf(ticker);
  if (!quote) return null;
  const want = `XDX/${quote}`;
  return (
    (Array.isArray(pools) ? pools : []).find((row) => {
      const name = String(row?.pool || row?.pool_name || row?.pair || "")
        .replace(/\s+/g, "")
        .toUpperCase();
      return name === want || name.endsWith(`/${quote}`);
    }) || null
  );
}

export function swapAssetUsd({ id, ticker, pools = [], prices = {}, pool } = {}) {
  const code = tickerOf(ticker || id);
  const book = normalizePriceBook(prices);
  if (!code) return 0;
  if (code === "XDX") return xdxUnitUsd({ prices: book }) || Number(book.xdxUsd) || 0;
  if (code === "XRP") return Number(book.xrpUsd) || 0;
  return quoteUnitUsd({
    quoteId: code,
    pool: pool || poolForSwapTicker(pools, code),
    prices: book,
    allowImplied: true,
  });
}

export function tradeNotionalUsd({ payAmount, payUsd, receiveAmount, receiveUsd, xdxNotional, xdxUsd } = {}) {
  const pay = Number(payAmount) * Number(payUsd);
  if (Number.isFinite(pay) && pay > 0) return pay;
  const got = Number(receiveAmount) * Number(receiveUsd);
  if (Number.isFinite(got) && got > 0) return got;
  const viaXdx = Number(xdxNotional) * Number(xdxUsd);
  return Number.isFinite(viaXdx) && viaXdx > 0 ? viaXdx : 0;
}

export function xdxPlatformFeeFromUsd({
  tradeUsd,
  xdxUsd,
  pct = XDX_PLATFORM_FEE_PCT,
} = {}) {
  const usd = Number(tradeUsd);
  const px = Number(xdxUsd);
  const rate = Number(pct);
  if (!(usd > 0) || !(px > 0) || !(rate > 0)) return 0;
  return (usd * rate) / 100 / px;
}

export function shouldSkipXdxPlatformFee({
  account,
  treasury = XDX_FEE_TREASURY,
  xdx,
} = {}) {
  if (!(Number(xdx) > 0)) return true;
  return sameXrplAccount(account, treasury);
}

export function xdxPlatformFeeTxjson({
  account,
  xdx,
  treasury = XDX_FEE_TREASURY,
} = {}) {
  if (shouldSkipXdxPlatformFee({ account, treasury, xdx })) return null;
  const txjson = {
    TransactionType: "Payment",
    Destination: treasury,
    Amount: xdxAmount(xdx),
  };
  if (account) txjson.Account = account;
  return txjson;
}

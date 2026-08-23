import { detectQuoteUsd, normalizePriceBook } from "../utils/poolSplit.js";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function poolSpot(reserveBase, reserveQuote) {
  const base = num(reserveBase);
  const quote = num(reserveQuote);
  if (!base || !quote) return 0;
  return quote / base;
}

export function xdxXrpSpot(prices = {}, pool = {}) {
  const book = normalizePriceBook(prices);
  const listed = num(book.xdxXrp || book.xdxPerXrp || prices.xdxXrp || prices.xdxPerXrp);
  if (listed) return listed;
  const xdxUsd = num(book.xdxUsd || pool.xdxUsd);
  const xrpUsd = num(book.xrpUsd);
  if (xdxUsd && xrpUsd) return xdxUsd / xrpUsd;
  return poolSpot(pool.base ?? pool.reserve_xdx ?? pool.reserve_asset, pool.quote ?? pool.reserve_currency);
}

export function xdxQuoteSpot({ quoteId, prices = {}, pool = {}, bookMid = 0 } = {}) {
  const id = String(quoteId || pool.quoteName || pool.quote || "XRP").toUpperCase();
  const book = normalizePriceBook(prices);
  const xdxUsd = num(book.xdxUsd || pool.xdxUsd);
  const xrpMark = xdxXrpSpot(book, pool);
  const mid = num(bookMid);

  if (id === "XRP") return mid || xrpMark;

  const quoteUsd = detectQuoteUsd({
    quoteId: id,
    pool,
    prices: book,
    allowImplied: false,
  });
  const marked = xdxUsd && quoteUsd ? xdxUsd / quoteUsd : 0;
  const fromXrp =
    xrpMark && quoteUsd && num(book.xrpUsd) ? xrpMark / (quoteUsd / num(book.xrpUsd)) : 0;
  const reserveSpot = poolSpot(
    pool.base ?? pool.reserve_xdx ?? pool.reserve_asset,
    pool.quote ?? pool.reserve_currency
  );
  const mark = marked || fromXrp || mid;
  if (mark && reserveSpot) {
    const ratio = reserveSpot / mark;
    if (ratio > 4 || ratio < 0.25) return mark;
    return reserveSpot;
  }
  return mark || reserveSpot;
}

export function preferMarkWhenPoolInsane(fromPool, fromMark) {
  const pool = num(fromPool);
  const mark = num(fromMark);
  if (mark && pool) {
    const ratio = pool / mark;
    if (ratio > 4 || ratio < 0.25) return mark;
    return pool;
  }
  if (mark) return mark;
  return pool;
}

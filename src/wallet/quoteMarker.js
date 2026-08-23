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

function usdCrossSpot(quoteId, prices = {}, pool = {}) {
  const id = String(quoteId || "XRP").toUpperCase();
  const book = normalizePriceBook(prices);
  const xdxUsd = num(book.xdxUsd || pool.xdxUsd);
  const xrpMark = xdxXrpSpot(book, pool);
  if (id === "XRP") return xrpMark;
  const quoteUsd = detectQuoteUsd({
    quoteId: id,
    pool,
    prices: book,
    allowImplied: false,
  });
  const marked = xdxUsd && quoteUsd ? xdxUsd / quoteUsd : 0;
  const fromXrp =
    xrpMark && quoteUsd && num(book.xrpUsd) ? xrpMark / (quoteUsd / num(book.xrpUsd)) : 0;
  return marked || fromXrp;
}

function looksLikeXrpLeftover(spot, xrpMark) {
  const a = num(spot);
  const b = num(xrpMark);
  if (!a || !b) return false;
  const ratio = a / b;
  return ratio > 0.25 && ratio < 4;
}

/**
 * Live opposing-asset mark for Buy/Sell XDX.
 * Prefer the pair's ledger book mid (DEX tape, then AMM implied), then this
 * pair's AMM reserves, then a USD/XRP cross. Never hardcode XIO/RLUSD/XSQUAD.
 */
export function composeLedgerQuoteMark({
  quoteId,
  prices = {},
  pool = {},
  bookMid = 0,
  dexPresent = false,
} = {}) {
  const id = String(quoteId || pool.quoteName || pool.quote || "XRP").toUpperCase();
  const mid = num(bookMid);
  const reserveSpot = poolSpot(
    pool.base ?? pool.reserve_xdx ?? pool.reserve_asset,
    pool.quote ?? pool.reserve_currency
  );
  const xrpMark = xdxXrpSpot(prices, pool);
  const cross = usdCrossSpot(id, prices, pool);
  const leftover =
    id !== "XRP" && (looksLikeXrpLeftover(reserveSpot, xrpMark) || looksLikeXrpLeftover(mid, xrpMark));
  const liveBook = Boolean(mid && (dexPresent || !leftover));
  const usableReserve = leftover ? 0 : reserveSpot;

  const xdxPerQuote = liveBook
    ? mid
    : preferMarkWhenPoolInsane(usableReserve, cross) || usableReserve || cross;
  const source = liveBook
    ? "ledger-book"
    : xdxPerQuote && xdxPerQuote === usableReserve
      ? "amm"
      : xdxPerQuote
        ? "usd-cross"
        : null;

  return {
    quoteId: id,
    pair: `XDX/${id}`,
    xdxPerQuote: xdxPerQuote || 0,
    bookMid: mid || null,
    reserveSpot: reserveSpot || null,
    cross: cross || null,
    source,
  };
}

export function xdxQuoteSpot({ quoteId, prices = {}, pool = {}, bookMid = 0, dexPresent = false } = {}) {
  return composeLedgerQuoteMark({ quoteId, prices, pool, bookMid, dexPresent }).xdxPerQuote;
}

export function tradableQuoteIds(pools = [], extraIds = []) {
  const ids = [];
  const add = (value) => {
    const raw = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!raw) return;
    const id = raw.includes("/") ? raw.split("/").pop() : raw;
    if (!id || id === "XDX" || ids.includes(id)) return;
    ids.push(id);
  };
  for (const known of ["XRP", "RLUSD", "XIO", "XSQUAD"]) add(known);
  for (const row of Array.isArray(pools) ? pools : []) {
    add(row?.pool || row?.pool_name || row?.pair || row?.quote);
  }
  for (const id of Array.isArray(extraIds) ? extraIds : []) add(id);
  return ids;
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

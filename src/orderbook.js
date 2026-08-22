import { ammSpot, measureAmmAgainstDex } from "./ammCurve.js";

export const ORDERBOOK_PAIRS = ["XDX/XRP", "XDX/RLUSD"];
export const FEATURED_ORDERBOOK_PAIRS = [
  "XDX/XRP",
  "XDX/RLUSD",
  "XDX/XIO",
  "XDX/XSQUAD",
];
export const ORDERBOOK_VISIBLE_LEVELS = 20;

export function combineOrderbookSide(dexRows, ammRows, side = "bid") {
  const dex = Array.isArray(dexRows) ? dexRows : [];
  const amm = Array.isArray(ammRows) ? ammRows : [];
  const rows = [
    ...dex.map((row) => ({ ...row, source: row.source || "dex" })),
    ...amm.map((row) => ({ ...row, source: row.source || "amm" })),
  ].filter((row) => Number.isFinite(Number(row?.price)));
  const ask = String(side).toLowerCase() === "ask";
  rows.sort((a, b) => {
    const delta = Number(a.price) - Number(b.price);
    return ask ? delta : -delta;
  });
  return rows;
}

export function padOrderbookLevels(rows, count = ORDERBOOK_VISIBLE_LEVELS) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length >= count) return list;
  const blanks = Array.from({ length: count - list.length }, () => ({
    price: null,
    base_size: null,
    quote_size: null,
    placeholder: true,
  }));
  return list.concat(blanks);
}

export function normalizeOrderbookPair(value) {
  const trimmed = String(value || "XDX/XRP").trim();
  const spaced = trimmed.replace(/\s*\/\s*/g, "/").replace(/-/g, "/");
  const upper = spaced.toUpperCase();
  if (upper === "RLUSD" || upper === "XDX/RLUSD") return "XDX/RLUSD";
  if (upper === "XRP" || upper === "XDX/XRP" || upper === "XRP/XDX") return "XDX/XRP";
  if (upper === "XIO" || upper === "XDX/XIO") return "XDX/XIO";
  if (upper === "XSQUAD" || upper === "XDX/XSQUAD") return "XDX/XSQUAD";
  if (upper.startsWith("XDX/")) {
    const quote = spaced.slice(spaced.indexOf("/") + 1).trim();
    return quote ? `XDX/${quote}` : "XDX/XRP";
  }
  if (spaced && !spaced.includes("/")) return `XDX/${spaced}`;
  return "XDX/XRP";
}

export function sortOrderbookPairs(pairs) {
  const seen = new Set();
  const out = [];
  for (const name of [...FEATURED_ORDERBOOK_PAIRS, ...(pairs || [])]) {
    const pair = normalizeOrderbookPair(name);
    if (seen.has(pair.toUpperCase())) continue;
    seen.add(pair.toUpperCase());
    out.push(pair);
  }
  return out;
}

export function filterOrderbookPairs(pairs, query) {
  const q = String(query || "")
    .trim()
    .replace(/^XDX\s*\/\s*/i, "")
    .toUpperCase();
  if (!q) return pairs || [];
  return (pairs || []).filter((pair) => {
    const name = normalizeOrderbookPair(pair);
    const quote = name.split("/")[1] || "";
    return name.toUpperCase().includes(q) || quote.toUpperCase().includes(q);
  });
}

export function emptyOrderbook(pair = "XDX/XRP") {
  const name = normalizeOrderbookPair(pair);
  const quote = name.split("/")[1] || "XRP";
  return {
    pair: name,
    base: "XDX",
    quote,
    price_unit: "quote_per_base",
    as_of: null,
    present: false,
    catching_up: true,
    best_bid: null,
    best_ask: null,
    mid: null,
    spread: null,
    spread_bps: null,
    mid_usd: null,
    bids: [],
    asks: [],
    amm: null,
    depth: { bid_base: 0, ask_base: 0, bid_quote: 0, ask_quote: 0 },
    source: "db",
  };
}

function nativeBest(rows, side) {
  const prices = (Array.isArray(rows) ? rows : [])
    .filter((row) => Number(row?.price) > 0 && String(row.source || "dex") !== "amm")
    .map((row) => Number(row.price));
  if (!prices.length) return null;
  return side === "ask" ? Math.min(...prices) : Math.max(...prices);
}

export function bookHeader(book = {}) {
  const best_bid = Number(book.best_bid) > 0 ? Number(book.best_bid) : nativeBest(book.bids, "bid");
  const best_ask = Number(book.best_ask) > 0 ? Number(book.best_ask) : nativeBest(book.asks, "ask");
  const mid =
    Number(book.mid) > 0
      ? Number(book.mid)
      : best_bid > 0 && best_ask > 0
        ? (best_bid + best_ask) / 2
        : best_bid || best_ask || (Number(book.amm?.price) > 0 ? Number(book.amm.price) : null);
  const mid_usd = Number(book.mid_usd) > 0 ? Number(book.mid_usd) : null;
  const spread =
    best_bid > 0 && best_ask > 0 ? best_ask - best_bid : Number(book.spread) > 0 ? Number(book.spread) : null;
  const spread_bps =
    mid > 0 && spread > 0
      ? Math.round((spread / mid) * 1_000_000) / 100
      : Number(book.spread_bps) > 0
        ? Number(book.spread_bps)
        : null;
  return { best_bid, best_ask, mid, mid_usd, spread, spread_bps };
}

export function orderBookRowStamp(row = {}) {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  return row.as_of || payload.as_of || row.timestamp || row.updated_at || null;
}

export function nativeDexRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      if (!row || row.placeholder) return false;
      if (String(row.source || "dex").toLowerCase() === "amm") return false;
      const price = Number(row.price);
      const size = Number(row.base_size ?? row.amount ?? row.size);
      return price > 0 && size > 0;
    })
    .map((row, index) => ({
      ...row,
      level: row.level ?? index + 1,
      price: Number(row.price),
      base_size: Number(row.base_size ?? row.amount ?? row.size),
      source: "dex",
    }));
}

function withCumulative(rows, side) {
  const ask = String(side).toLowerCase() === "ask";
  const sorted = [...rows].sort((a, b) => {
    const delta = Number(a.price) - Number(b.price);
    return ask ? delta : -delta;
  });
  let cumulative = 0;
  return sorted.map((row, index) => {
    cumulative += Number(row.base_size) || 0;
    return { ...row, level: row.level ?? index + 1, cumulative_base: cumulative };
  });
}

export function composeAmmBook(stored, reserves = {}, pair = "XDX/XRP") {
  const name = normalizeOrderbookPair(stored?.pair || pair);
  const base = asOrderbookPayload(stored, name);
  const reserveBase = Number(
    reserves.reserve_asset ?? reserves.reserve_xdx ?? base.amm?.reserve_asset ?? 0
  );
  const reserveQuote = Number(
    reserves.reserve_currency ?? reserves.reserve_quote ?? base.amm?.reserve_currency ?? 0
  );
  const tradingFee = Number(reserves.trading_fee ?? base.amm?.trading_fee ?? 1000);
  const spot =
    Number(reserves.price) > 0
      ? Number(reserves.price)
      : ammSpot(reserveBase, reserveQuote) || Number(base.amm?.price) || null;

  const reserveMeta = { reserveBase, reserveQuote, tradingFee };
  const bids = withCumulative(
    measureAmmAgainstDex(nativeDexRows(base.bids), reserveMeta, "bid"),
    "bid"
  );
  const asks = withCumulative(
    measureAmmAgainstDex(nativeDexRows(base.asks), reserveMeta, "ask"),
    "ask"
  );
  const present = bids.length > 0 || asks.length > 0;
  const best_bid = nativeBest(bids, "bid");
  const best_ask = nativeBest(asks, "ask");
  const mid =
    best_bid > 0 && best_ask > 0
      ? (best_bid + best_ask) / 2
      : spot || best_bid || best_ask || null;

  return {
    ...base,
    pair: name,
    quote: base.quote || name.split("/")[1] || "XRP",
    bids,
    asks,
    present,
    catching_up: !present,
    best_bid,
    best_ask,
    mid,
    amm: {
      ...(base.amm || {}),
      reserve_asset: reserveBase || null,
      reserve_currency: reserveQuote || null,
      trading_fee: tradingFee,
      price: spot,
      levels: [],
      source: "opposing",
    },
    mid_usd:
      Number(base.mid_usd) > 0
        ? Number(base.mid_usd)
        : Number(reserves.mid_usd) > 0
          ? Number(reserves.mid_usd)
          : null,
  };
}

export function asOrderbookPayload(raw, pair = "XDX/XRP") {
  let body = raw;
  if (typeof raw === "string") {
    try {
      body = JSON.parse(raw);
    } catch {
      return emptyOrderbook(pair);
    }
  }
  if (!body || typeof body !== "object") return emptyOrderbook(pair);
  const name = normalizeOrderbookPair(body.pair || pair);
  const bids = Array.isArray(body.bids) ? body.bids : [];
  const asks = Array.isArray(body.asks) ? body.asks : [];
  const present = body.present !== false && (bids.length > 0 || asks.length > 0);
  return {
    ...emptyOrderbook(name),
    ...body,
    pair: name,
    base: body.base || "XDX",
    quote: body.quote || name.split("/")[1] || "XRP",
    price_unit: body.price_unit || "quote_per_base",
    present,
    catching_up: Boolean(body.catching_up || !present),
    bids,
    asks,
    amm: body.amm && typeof body.amm === "object" ? body.amm : null,
    depth: body.depth || emptyOrderbook(name).depth,
    source: body.source || "db",
  };
}

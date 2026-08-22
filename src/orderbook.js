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
  const list = (Array.isArray(rows) ? rows.filter(Boolean) : []).slice(0, count);
  if (list.length >= count) return list;
  const blanks = Array.from({ length: count - list.length }, () => ({
    price: null,
    base_size: null,
    quote_size: null,
    placeholder: true,
  }));
  return list.concat(blanks);
}

export function topDexLevels(rows, side = "bid", limit = ORDERBOOK_VISIBLE_LEVELS) {
  const ask = String(side).toLowerCase() === "ask";
  return [...(Array.isArray(rows) ? rows : [])]
    .filter(
      (row) =>
        Number(row?.price) > 0 &&
        Number(row?.base_size) > 0 &&
        String(row.source || "dex").toLowerCase() !== "amm"
    )
    .sort((a, b) => {
      const delta = Number(a.price) - Number(b.price);
      return ask ? delta : -delta;
    })
    .slice(0, limit);
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

function issuedAmount(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" || typeof value === "string") {
    const raw = String(value);
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    const drops = /^\d+$/.test(raw);
    return {
      currency: "XRP",
      value: drops ? num / 1_000_000 : num,
    };
  }
  if (typeof value === "object") {
    const num = Number(value.value ?? value.amount);
    if (!Number.isFinite(num) || num <= 0) return null;
    return {
      currency: String(value.currency || value.currencyCode || "").toUpperCase(),
      issuer: value.issuer || null,
      value: num,
    };
  }
  return null;
}

function isXdxAmount(amount) {
  const currency = String(amount?.currency || "").toUpperCase();
  return currency === "XDX" || currency.startsWith("584458");
}

export function offerToDexRow(row) {
  if (!row || typeof row !== "object" || row.placeholder) return null;
  if (String(row.source || "").toLowerCase() === "amm") return null;

  const directPrice = Number(row.price ?? row.quality_price);
  const directSize = Number(row.base_size ?? row.amount ?? row.size);
  if (directPrice > 0 && directSize > 0 && row.TakerGets == null && row.taker_gets == null) {
    return {
      price: directPrice,
      base_size: directSize,
      source: "dex",
      side: String(row.side || "").toLowerCase() === "ask" ? "ask" : "bid",
    };
  }

  const gets = issuedAmount(row.TakerGets ?? row.taker_gets);
  const pays = issuedAmount(row.TakerPays ?? row.taker_pays);
  if (!gets || !pays) return null;
  if (isXdxAmount(gets)) {
    return {
      price: pays.value / gets.value,
      base_size: gets.value,
      source: "dex",
      side: "ask",
    };
  }
  if (isXdxAmount(pays)) {
    return {
      price: gets.value / pays.value,
      base_size: pays.value,
      source: "dex",
      side: "bid",
    };
  }
  return null;
}

function firstOfferList(...lists) {
  for (const list of lists) {
    if (Array.isArray(list) && list.length) return list;
  }
  return [];
}

export function extractDexSides(body = {}) {
  const nested =
    (body.book && typeof body.book === "object" && body.book) ||
    (body.dex && typeof body.dex === "object" && body.dex) ||
    (body.offers && typeof body.offers === "object" && !Array.isArray(body.offers) && body.offers) ||
    (body.orderbook && typeof body.orderbook === "object" && body.orderbook) ||
    (body.result && typeof body.result === "object" && body.result) ||
    (body.data && typeof body.data === "object" && body.data) ||
    {};
  const bids = [];
  const asks = [];

  for (const row of firstOfferList(body.bids, body.buy, body.buys, nested.bids, nested.buy, nested.buys)) {
    const next = offerToDexRow({ ...row, side: row.side || "bid" });
    if (next && next.side !== "ask") bids.push({ ...next, side: "bid" });
  }
  for (const row of firstOfferList(body.asks, body.sell, body.sells, nested.asks, nested.sell, nested.sells)) {
    const next = offerToDexRow({ ...row, side: row.side || "ask" });
    if (next && next.side !== "bid") asks.push({ ...next, side: "ask" });
  }
  const mixed = firstOfferList(
    Array.isArray(body.offers) ? body.offers : null,
    Array.isArray(nested.offers) ? nested.offers : null
  );
  for (const row of mixed) {
    const next = offerToDexRow(row);
    if (!next) continue;
    if (next.side === "ask") asks.push(next);
    else bids.push({ ...next, side: "bid" });
  }
  return { bids, asks };
}

export function payloadHasNativeDex(raw, pair = "XDX/XRP") {
  const body = asOrderbookPayload(raw, pair);
  const extracted = extractDexSides(body);
  const bids = nativeDexRows(extracted.bids.length ? extracted.bids : body.bids);
  const asks = nativeDexRows(extracted.asks.length ? extracted.asks : body.asks);
  return bids.length > 0 || asks.length > 0;
}

export function pickNativeBookRow(latest, historyRows = [], pair = "XDX/XRP") {
  const name = normalizeOrderbookPair(pair);
  const candidates = [latest, ...(Array.isArray(historyRows) ? historyRows : [])].filter(Boolean);
  for (const row of candidates) {
    const payload = row.payload != null ? row.payload : row;
    if (payloadHasNativeDex(payload, name)) {
      return {
        payload,
        pair: name,
        as_of: orderBookRowStamp(row),
      };
    }
  }
  if (!latest) return null;
  return {
    payload: latest.payload != null ? latest.payload : latest,
    pair: name,
    as_of: orderBookRowStamp(latest),
  };
}

export function nativeDexRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => offerToDexRow(row) || (
      row && Number(row.price) > 0 && Number(row.base_size) > 0 && String(row.source || "") !== "amm"
        ? { ...row, source: "dex" }
        : null
    ))
    .filter(Boolean)
    .map((row, index) => ({
      ...row,
      level: row.level ?? index + 1,
      price: Number(row.price),
      base_size: Number(row.base_size),
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
  const extracted = extractDexSides(base);
  const dexBids = topDexLevels(
    nativeDexRows(extracted.bids.length ? extracted.bids : base.bids),
    "bid"
  );
  const dexAsks = topDexLevels(
    nativeDexRows(extracted.asks.length ? extracted.asks : base.asks),
    "ask"
  );
  const dexPresent = dexBids.length > 0 || dexAsks.length > 0;
  const bids = withCumulative(
    dexBids.length ? measureAmmAgainstDex(dexBids, reserveMeta, "bid") : [],
    "bid"
  );
  const asks = withCumulative(
    dexAsks.length ? measureAmmAgainstDex(dexAsks, reserveMeta, "ask") : [],
    "ask"
  );
  const present = bids.length > 0 || asks.length > 0;
  const best_bid = nativeBest(bids, "bid") || (bids[0] && Number(bids[0].price)) || null;
  const best_ask = nativeBest(asks, "ask") || (asks[0] && Number(asks[0].price)) || null;
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
    dex_present: dexPresent,
    amm_implied: false,
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
  const extracted = extractDexSides(body);
  const bids = extracted.bids.length ? extracted.bids : Array.isArray(body.bids) ? body.bids : [];
  const asks = extracted.asks.length ? extracted.asks : Array.isArray(body.asks) ? body.asks : [];
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

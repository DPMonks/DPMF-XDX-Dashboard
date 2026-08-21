export const ORDERBOOK_PAIRS = ["XDX/XRP", "XDX/RLUSD"];
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
  const raw = String(value || "XDX/XRP")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "/");
  if (raw === "RLUSD" || raw === "XDX/RLUSD") return "XDX/RLUSD";
  if (raw === "XRP" || raw === "XDX/XRP" || raw === "XRP/XDX") return "XDX/XRP";
  if (raw.startsWith("XDX/") && ORDERBOOK_PAIRS.includes(raw)) return raw;
  return "XDX/XRP";
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
  const present = body.present !== false && (bids.length > 0 || asks.length > 0 || Boolean(body.amm));
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

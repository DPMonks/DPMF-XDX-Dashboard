import test from "node:test";
import assert from "node:assert/strict";
import {
  asOrderbookPayload,
  bookHeader,
  combineOrderbookSide,
  composeAmmBook,
  emptyOrderbook,
  filterOrderbookPairs,
  normalizeOrderbookPair,
  ORDERBOOK_VISIBLE_LEVELS,
  orderBookRowStamp,
  padOrderbookLevels,
  sortOrderbookPairs,
} from "../src/orderbook.js";
import { ammCurveLevels } from "../src/ammCurve.js";

test("normalizeOrderbookPair maps quote aliases onto featured and detected AMM pairs", () => {
  assert.equal(normalizeOrderbookPair("XRP"), "XDX/XRP");
  assert.equal(normalizeOrderbookPair("rlusd"), "XDX/RLUSD");
  assert.equal(normalizeOrderbookPair("XDX-RLUSD"), "XDX/RLUSD");
  assert.equal(normalizeOrderbookPair("XIO"), "XDX/XIO");
  assert.equal(normalizeOrderbookPair("xsquad"), "XDX/XSQUAD");
  assert.equal(normalizeOrderbookPair("SOLO"), "XDX/SOLO");
  assert.equal(normalizeOrderbookPair("XDX/POWDER KEG"), "XDX/POWDER KEG");
});

test("sortOrderbookPairs keeps XRP, RLUSD, XIO, XSQUAD first", () => {
  assert.deepEqual(sortOrderbookPairs(["XDX/SOLO", "XDX/XSQUAD", "XDX/XIO"]), [
    "XDX/XRP",
    "XDX/RLUSD",
    "XDX/XIO",
    "XDX/XSQUAD",
    "XDX/SOLO",
  ]);
});

test("filterOrderbookPairs matches quote search without requiring the XDX/ prefix", () => {
  const rows = filterOrderbookPairs(
    ["XDX/XRP", "XDX/XIO", "XDX/XSQUAD", "XDX/SOLO"],
    "xio"
  );
  assert.deepEqual(rows, ["XDX/XIO"]);
});

test("ammCurveLevels fills 20 bids and 20 asks from pool reserves", () => {
  const curve = ammCurveLevels({
    reserveBase: 63_000_000,
    reserveQuote: 1875,
    tradingFee: 1000,
  });
  assert.equal(curve.asks.length, 20);
  assert.equal(curve.bids.length, 20);
  assert.ok(curve.asks[0].price > curve.price);
  assert.ok(curve.bids[0].price < curve.price);
  assert.equal(curve.asks[0].source, "amm");
});

test("composeAmmBook blends an empty DEX book with a 20-level AMM curve", () => {
  const book = composeAmmBook(emptyOrderbook("XDX/XIO"), {
    reserve_asset: 51_000_000,
    reserve_currency: 120_000,
    trading_fee: 1000,
  }, "XDX/XIO");
  const asks = (book.amm.levels || []).filter((row) => row.side === "ask");
  const bids = (book.amm.levels || []).filter((row) => row.side === "bid");
  assert.equal(book.pair, "XDX/XIO");
  assert.equal(book.present, true);
  assert.equal(asks.length, 20);
  assert.equal(bids.length, 20);
});

test("empty order book matches the catching_up envelope", () => {
  const empty = emptyOrderbook("RLUSD");
  assert.equal(empty.pair, "XDX/RLUSD");
  assert.equal(empty.present, false);
  assert.equal(empty.catching_up, true);
  assert.deepEqual(empty.bids, []);
  assert.deepEqual(empty.asks, []);
  assert.equal(empty.price_unit, "quote_per_base");
});

test("padOrderbookLevels keeps 20 slots and does not invent prices", () => {
  const padded = padOrderbookLevels([], 20);
  assert.equal(ORDERBOOK_VISIBLE_LEVELS, 20);
  assert.equal(padded.length, 20);
  assert.equal(padded[0].placeholder, true);
  assert.equal(padded[0].price, null);
  assert.equal(padded[0].base_size, null);

  const long = padOrderbookLevels(
    Array.from({ length: 25 }, (_, i) => ({ price: 0.00003 + i, base_size: 10 })),
    20
  );
  assert.equal(long.length, 25);
  assert.ok(long.every((row) => row.placeholder !== true));
});

test("combineOrderbookSide mirrors GateHub: best bid high, best ask low", () => {
  const bids = combineOrderbookSide(
    [{ price: 0.000029, base_size: 100 }],
    [{ price: 0.00003, base_size: 50, side: "bid" }],
    "bid"
  );
  assert.equal(bids[0].price, 0.00003);
  assert.equal(bids[0].source, "amm");

  const asks = combineOrderbookSide(
    [{ price: 0.00004, base_size: 10 }, { price: 0.000031, base_size: 8 }],
    [],
    "ask"
  );
  assert.equal(asks[0].price, 0.000031);
});

test("bookHeader uses AMM quote-per-XDX when DEX bid/ask are zero", () => {
  const header = bookHeader({
    best_bid: 0,
    best_ask: 0,
    mid: 0.000029697395,
    mid_usd: 0.00004336,
    amm: {
      price: 0.000029697395,
      levels: [
        { side: "bid", price: 0.000029623152 },
        { side: "ask", price: 0.000029771638 },
      ],
    },
  });
  assert.equal(header.best_bid, 0.000029623152);
  assert.equal(header.best_ask, 0.000029771638);
  assert.equal(header.mid, 0.000029697395);
  assert.equal(header.mid_usd, 0.00004336);
  assert.ok(header.spread_bps > 0);
});

test("order book stamp prefers Worker 2 timestamp, not updated_at", () => {
  assert.equal(
    orderBookRowStamp({ timestamp: "2026-08-21T23:40:00.000Z", updated_at: "stale" }),
    "2026-08-21T23:40:00.000Z"
  );
  assert.equal(
    orderBookRowStamp({ payload: { as_of: "2026-08-21T23:41:00.000Z" } }),
    "2026-08-21T23:41:00.000Z"
  );
});

test("asOrderbookPayload does not treat quote-per-XDX as xdxUsd", () => {
  const book = asOrderbookPayload({
    pair: "XDX/XRP",
    present: true,
    best_bid: 0.0000298,
    best_ask: 0.0000301,
    mid: 0.00002995,
    mid_usd: 0.0000416,
    bids: [{ level: 1, price: 0.0000298, source: "dex" }],
    asks: [],
  });
  assert.equal(book.present, true);
  assert.equal(book.price_unit, "quote_per_base");
  assert.equal(book.mid, 0.00002995);
  assert.equal(book.mid_usd, 0.0000416);
  assert.notEqual(book.mid, book.mid_usd);
});

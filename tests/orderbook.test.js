import test from "node:test";
import assert from "node:assert/strict";
import {
  asOrderbookPayload,
  bookHeader,
  combineOrderbookSide,
  composeAmmBook,
  emptyOrderbook,
  extractDexSides,
  filterOrderbookPairs,
  normalizeOrderbookPair,
  offerToDexRow,
  ORDERBOOK_VISIBLE_LEVELS,
  orderBookRowStamp,
  padOrderbookLevels,
  sortOrderbookPairs,
} from "../src/orderbook.js";
import { ammSizeToPrice, ammSpot } from "../src/ammCurve.js";

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

test("ammSizeToPrice grows as price walks further from spot", () => {
  const reserveBase = 63_000_000;
  const reserveQuote = 1875;
  const spot = ammSpot(reserveBase, reserveQuote);
  const near = ammSizeToPrice({
    reserveBase,
    reserveQuote,
    targetPrice: spot * 0.995,
  });
  const far = ammSizeToPrice({
    reserveBase,
    reserveQuote,
    targetPrice: spot * 0.95,
  });
  const up = ammSizeToPrice({
    reserveBase,
    reserveQuote,
    targetPrice: spot * 1.01,
  });
  assert.equal(near.side, "bid");
  assert.equal(far.side, "bid");
  assert.equal(up.side, "ask");
  assert.ok(far.base_size > near.base_size);
  assert.notEqual(near.base_size, far.base_size);
});

test("composeAmmBook uses AMM opposing depth when native DEX is empty", () => {
  const book = composeAmmBook(emptyOrderbook("XDX/XIO"), {
    reserve_asset: 51_000_000,
    reserve_currency: 120_000,
    trading_fee: 1000,
  }, "XDX/XIO");
  assert.equal(book.pair, "XDX/XIO");
  assert.equal(book.present, true);
  assert.equal(book.dex_present, false);
  assert.equal(book.amm_implied, true);
  assert.equal(book.bids.length, 20);
  assert.equal(book.asks.length, 20);
  assert.equal(book.bids[0].source, "amm");
  assert.notEqual(book.bids[0].base_size, book.bids[4].base_size);
  assert.ok(book.bids[4].base_size > book.bids[0].base_size);
  assert.deepEqual(book.amm.levels, []);
});

test("composeAmmBook keeps native sizes and measures AMM opposing at those prices", () => {
  const book = composeAmmBook(
    {
      pair: "XDX/XRP",
      bids: [
        { price: 0.0000295, base_size: 5_000 },
        { price: 0.000028, base_size: 12_400 },
      ],
      asks: [{ price: 0.000031, base_size: 8_000 }],
    },
    {
      reserve_asset: 63_000_000,
      reserve_currency: 1875,
      trading_fee: 1000,
    },
    "XDX/XRP"
  );
  assert.equal(book.present, true);
  assert.equal(book.dex_present, true);
  assert.equal(book.amm_implied, false);
  assert.equal(book.bids[0].source, "dex");
  assert.equal(book.bids[0].base_size, 5_000);
  assert.equal(book.bids[1].base_size, 12_400);
  assert.notEqual(book.bids[0].base_size, book.bids[1].base_size);
  assert.ok(book.bids[1].amm_through > book.bids[0].amm_through);
  assert.equal(book.asks[0].amm_opposing, 0);
  assert.ok(book.asks[0].amm_through > 0);
  assert.deepEqual(book.amm.levels, []);
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

test("bookHeader uses native DEX bid/ask and only falls mid back to AMM spot", () => {
  const header = bookHeader({
    best_bid: 0,
    best_ask: 0,
    mid: 0,
    mid_usd: 0.00004336,
    bids: [],
    asks: [],
    amm: {
      price: 0.000029697395,
      levels: [
        { side: "bid", price: 0.000029623152 },
        { side: "ask", price: 0.000029771638 },
      ],
    },
  });
  assert.equal(header.best_bid, null);
  assert.equal(header.best_ask, null);
  assert.equal(header.mid, 0.000029697395);
  assert.equal(header.mid_usd, 0.00004336);
  assert.equal(header.spread_bps, null);
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

test("offerToDexRow reads XRPL TakerGets / TakerPays as native bids and asks", () => {
  const bid = offerToDexRow({
    TakerGets: "1500000",
    TakerPays: { currency: "XDX", issuer: "rIssuer", value: "50000" },
  });
  const ask = offerToDexRow({
    TakerGets: { currency: "XDX", issuer: "rIssuer", value: "8000" },
    TakerPays: "400",
  });
  assert.equal(bid.side, "bid");
  assert.equal(bid.source, "dex");
  assert.equal(bid.base_size, 50000);
  assert.ok(Math.abs(bid.price - 1.5 / 50000) < 1e-12);
  assert.equal(ask.side, "ask");
  assert.equal(ask.base_size, 8000);
  assert.ok(Math.abs(ask.price - 0.0004 / 8000) < 1e-12);
});

test("extractDexSides finds nested Worker 2 book.bids without treating AMM rungs as DEX", () => {
  const sides = extractDexSides({
    book: {
      bids: [{ price: 0.00003, base_size: 1200 }],
      asks: [{ price: 0.000032, amount: 900 }],
    },
    amm: {
      levels: [{ side: "bid", price: 0.000029, base_size: 158976, source: "amm" }],
    },
  });
  assert.equal(sides.bids.length, 1);
  assert.equal(sides.bids[0].base_size, 1200);
  assert.equal(sides.asks[0].base_size, 900);
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

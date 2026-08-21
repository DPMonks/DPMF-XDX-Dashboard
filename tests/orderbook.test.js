import test from "node:test";
import assert from "node:assert/strict";
import {
  asOrderbookPayload,
  emptyOrderbook,
  normalizeOrderbookPair,
} from "../src/orderbook.js";

test("normalizeOrderbookPair maps quote aliases onto the two Worker 2 books", () => {
  assert.equal(normalizeOrderbookPair("XRP"), "XDX/XRP");
  assert.equal(normalizeOrderbookPair("rlusd"), "XDX/RLUSD");
  assert.equal(normalizeOrderbookPair("XDX-RLUSD"), "XDX/RLUSD");
  assert.equal(normalizeOrderbookPair("SOLO"), "XDX/XRP");
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

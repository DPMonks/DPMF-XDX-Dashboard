import test from "node:test";
import assert from "node:assert/strict";
import {
  composeLedgerQuoteMark,
  preferMarkWhenPoolInsane,
  xdxQuoteSpot,
  xdxXrpSpot,
} from "../src/wallet/quoteMarker.js";
import { predictedQuoteOut, tradeTotal } from "../src/xaman/tradeTx.js";

test("XDX/XRP mark is the recorded XRP spot", () => {
  assert.equal(xdxXrpSpot({ xdxXrp: 0.000000869, xrpUsd: 2, xdxUsd: 0.0000018 }), 0.000000869);
  assert.ok(Math.abs(xdxQuoteSpot({ quoteId: "XRP", prices: { xdxXrp: 0.000869 } }) - 0.000869) < 1e-12);
});

test("opposing-asset mark is XDX USD over the quote USD, not leftover XRP", () => {
  const prices = {
    xdxUsd: 0.001738,
    xrpUsd: 2,
    xdxXrp: 0.000869,
    quotes: { XIO: 869 },
  };
  const spot = xdxQuoteSpot({ quoteId: "XIO", prices });
  assert.ok(Math.abs(spot - 0.000002) < 1e-12);
  assert.ok(Math.abs(tradeTotal(100000, spot) - 0.2) < 1e-9);
});

test("a stale XRP-sized AMM reserve is ignored when the mark is sane", () => {
  const prices = {
    xdxUsd: 0.001738,
    xrpUsd: 2,
    xdxXrp: 0.000869,
    quotes: { XIO: 869, XSQUAD: 0.05 },
  };
  const xio = xdxQuoteSpot({
    quoteId: "XIO",
    prices,
    pool: { base: 100000, reserve_xdx: 100000, quote: 86.9, reserve_currency: 86.9 },
  });
  assert.ok(Math.abs(xio - 0.000002) < 1e-12);
  const squad = xdxQuoteSpot({ quoteId: "XSQUAD", prices });
  assert.ok(squad > 0);
  assert.ok(Math.abs(tradeTotal(100000, squad) - 86.9) > 1);
});

test("market estimates prefer the mark when the pool quote is wildly off", () => {
  assert.equal(preferMarkWhenPoolInsane(86.9, 0.2), 0.2);
  assert.ok(Math.abs(predictedQuoteOut(100000, 0.000002, 100000, 86.9, { preferMark: true }) - 0.2) < 1e-9);
  assert.equal(predictedQuoteOut(100, 0, 1000, 50), 5);
});

test("a live ledger book mid wins over a stale XIO USD print", () => {
  const mark = composeLedgerQuoteMark({
    quoteId: "XIO",
    prices: { xdxUsd: 0.001738, xrpUsd: 2, xdxXrp: 0.000869, quotes: { XIO: 869 } },
    pool: { base: 100000, reserve_xdx: 100000, quote: 86.9, reserve_currency: 86.9 },
    bookMid: 0.0000035,
    dexPresent: true,
  });
  assert.equal(mark.source, "ledger-book");
  assert.ok(Math.abs(mark.xdxPerQuote - 0.0000035) < 1e-12);
  assert.ok(Math.abs(tradeTotal(100000, mark.xdxPerQuote) - 0.35) < 1e-9);
});

test("when XIO moves on the ledger, the opposing-asset mark moves with it", () => {
  const earlier = composeLedgerQuoteMark({
    quoteId: "XIO",
    bookMid: 0.000002,
    dexPresent: true,
  });
  const later = composeLedgerQuoteMark({
    quoteId: "XIO",
    bookMid: 0.000004345,
    dexPresent: true,
  });
  assert.ok(Math.abs(tradeTotal(100000, earlier.xdxPerQuote) - 0.2) < 1e-9);
  assert.ok(Math.abs(tradeTotal(100000, later.xdxPerQuote) - 0.4345) < 1e-9);
});

test("an AMM-implied leftover XRP mid is not treated as XIO", () => {
  const leftover = composeLedgerQuoteMark({
    quoteId: "XIO",
    prices: { xdxUsd: 0.001738, xrpUsd: 2, xdxXrp: 0.000869, quotes: { XIO: 869 } },
    pool: { reserve_xdx: 100000, reserve_currency: 86.9 },
    bookMid: 0.000869,
    dexPresent: false,
  });
  assert.ok(Math.abs(leftover.xdxPerQuote - 0.000002) < 1e-12);
  assert.equal(leftover.source, "usd-cross");
});

test("every featured quote uses its own ledger mid, not XDX/XRP", () => {
  for (const [id, mid] of [
    ["RLUSD", 0.0017],
    ["XIO", 0.000003],
    ["XSQUAD", 0.03],
  ]) {
    const mark = composeLedgerQuoteMark({ quoteId: id, bookMid: mid, dexPresent: true });
    assert.equal(mark.quoteId, id);
    assert.equal(mark.xdxPerQuote, mid);
    assert.ok(Math.abs(tradeTotal(100000, mark.xdxPerQuote) - 100000 * mid) < 1e-9);
  }
});

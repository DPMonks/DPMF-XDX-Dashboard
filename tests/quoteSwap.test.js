import test from "node:test";
import assert from "node:assert/strict";
import {
  ammSwapOut,
  expectedFromMid,
  quoteSwap,
  saferSwapAlternatives,
  walkBook,
  walkHybrid,
} from "../src/swap/quoteSwap.js";
import { pickOtherAsset, swapCounterAsset, swapSellingXdx } from "../src/swap/swapAssets.js";
import { filterBookTape } from "../src/orderbook.js";

test("ammSwapOut follows the constant-product fee walk", () => {
  const out = ammSwapOut({ reserveIn: 1000, reserveOut: 10, amountIn: 100, tradingFee: 1000 });
  assert.ok(out > 0);
  assert.ok(out < 10 * (100 / 1100));
  assert.ok(Math.abs(out - (10 - 1000 * 10 / (1000 + 100 * 0.99))) < 1e-12);
});

test("walkBook consumes bids when selling XDX", () => {
  const fill = walkBook({
    inIsBase: true,
    amountIn: 150,
    levels: [
      { price: 0.02, base_size: 100 },
      { price: 0.019, base_size: 100 },
    ],
  });
  assert.equal(fill.leftover, 0);
  assert.ok(Math.abs(fill.out - (100 * 0.02 + 50 * 0.019)) < 1e-12);
});

test("walkHybrid prefers a better book level then finishes on the AMM", () => {
  const fill = walkHybrid({
    inIsBase: true,
    amountIn: 200,
    reserveBase: 10_000,
    reserveQuote: 200,
    tradingFee: 1000,
    levels: [{ price: 0.03, base_size: 50 }],
  });
  assert.equal(fill.route, "hybrid");
  assert.ok(fill.usedAmm);
  assert.ok(fill.usedDex);
  assert.ok(fill.out > 50 * 0.03);
});

test("quoteSwap marks negative slippage when actual is below mid", () => {
  const quote = quoteSwap({
    amountIn: 1000,
    sellingXdx: true,
    mid: 0.03,
    reserveBase: 10_000,
    reserveQuote: 200,
    tradingFee: 1000,
    routingMode: "amm",
    bids: [],
    asks: [],
  });
  assert.ok(quote.expectedOutput > quote.actualOutput);
  assert.equal(quote.isNegativeSlippage, true);
  assert.ok(quote.lossAmount > 0);
  assert.ok(quote.slippagePercent < 0);
  assert.equal(quote.routeUsed, "amm");
});

test("saferSwapAlternatives offers a smaller size when impact is high", () => {
  const extras = {
    sellingXdx: true,
    mid: 0.03,
    reserveBase: 8_000,
    reserveQuote: 80,
    tradingFee: 1000,
    bids: [],
    asks: [],
  };
  const quote = quoteSwap({ ...extras, amountIn: 2_000, routingMode: "smart" });
  const rows = saferSwapAlternatives(2_000, quote, extras);
  assert.ok(rows.some((row) => row.id === "half"));
});

test("expectedFromMid and swap helpers keep one side on XDX", () => {
  assert.equal(expectedFromMid(100, 0.02, true), 2);
  assert.equal(expectedFromMid(2, 0.02, false), 100);
  assert.equal(swapSellingXdx("XDX"), true);
  assert.equal(swapCounterAsset("XDX", "RLUSD"), "RLUSD");
  assert.equal(swapCounterAsset("XRP", "XDX"), "XRP");
  assert.equal(pickOtherAsset("XDX", "XDX", "XRP"), "XRP");
  assert.equal(pickOtherAsset("RLUSD", "XRP"), "XRP");
});

test("filterBookTape splits hybrid, DEX, and AMM rows", () => {
  const book = {
    bids: [
      { price: 1, base_size: 10, source: "dex" },
      { price: 0.9, base_size: 8, source: "amm" },
      { price: 0.95, base_size: 4, source: "bridge" },
    ],
    asks: [
      { price: 1.1, base_size: 6, source: "dex" },
      { price: 1.2, base_size: 5, source: "amm" },
    ],
  };
  const dex = filterBookTape(book, "dex");
  const amm = filterBookTape(book, "amm");
  assert.equal(dex.bids.length, 2);
  assert.equal(amm.asks.length, 1);
  assert.equal(filterBookTape(book, "hybrid").bids.length, 3);
});

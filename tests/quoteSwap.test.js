import test from "node:test";
import assert from "node:assert/strict";
import {
  ammSwapOut,
  expectedFromMid,
  quoteBridgeSwap,
  quoteSwap,
  resolveVenueMid,
  saferSwapAlternatives,
  walkBook,
  walkHybrid,
} from "../src/swap/quoteSwap.js";
import { RLUSD_ISSUER } from "../src/constants/ledger.js";
import {
  isActiveXdxPool,
  pickOtherAsset,
  swapAssetOptions,
  swapCounterAsset,
  swapCounterOptions,
  swapSellingXdx,
} from "../src/swap/swapAssets.js";
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
  assert.ok(fill.bookOut > 0);
  assert.ok(fill.ammOut > 0);
  assert.ok(Math.abs(fill.bookOut + fill.ammOut - fill.out) < 1e-9);
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
  assert.equal(quote.bookOutput, 0);
  assert.ok(quote.ammOutput > 0);
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
  assert.equal(swapCounterAsset("XDX", "XDX"), "XRP");
  assert.equal(pickOtherAsset("XDX", "XDX", "XRP"), "XRP");
  assert.equal(pickOtherAsset("RLUSD", "XRP"), "XRP");
  assert.ok(swapAssetOptions({ balances: { xdx: 1 } }).some((row) => row.id === "XDX"));
});

test("swap counters are individual assets from active XDX pools, then wallet lines", () => {
  const activeXrp = { pool: "XDX/XRP", reserve_asset: 1_000_000, reserve_currency: 2_000 };
  const activeRlusd = {
    pool: "XDX/RLUSD",
    reserve_asset: 500_000,
    reserve_currency: 1_200,
    quote_issuer: RLUSD_ISSUER,
  };
  const deadXio = { pool: "XDX/XIO", reserve_asset: 0, reserve_currency: 0 };
  const listedUnknown = { pool: "XDX/XIO", amm_account: "rExampleAmm" };
  const rlusdLine = { currency: "RLUSD", issuer: RLUSD_ISSUER, ticker: "RLUSD", balance: "12" };
  const soloLine = { currency: "SOLO", issuer: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh", ticker: "SOLO", balance: "9" };

  assert.equal(isActiveXdxPool(activeRlusd), true);
  assert.equal(isActiveXdxPool(deadXio), false);
  assert.equal(isActiveXdxPool({ pool: "XDX/XDX", reserve_asset: 10, reserve_currency: 10 }), false);

  const browse = swapCounterOptions({ pools: [activeXrp, activeRlusd, deadXio, listedUnknown] });
  assert.deepEqual(
    browse.map((row) => row.id),
    ["XRP", "RLUSD", "XIO"]
  );
  assert.equal(
    browse.some((row) => String(row.id).includes("/") || row.id === "XDX" || row.id === "SOLO"),
    false
  );

  const held = swapCounterOptions({
    pools: [activeXrp, activeRlusd, deadXio],
    lines: [rlusdLine, soloLine],
    balances: { xdx: 100, xrp: 5 },
    signedIn: true,
  });
  assert.deepEqual(
    held.map((row) => row.id).sort(),
    ["RLUSD", "SOLO", "XRP"]
  );

  const noRlusdLine = swapCounterOptions({
    pools: [activeXrp, activeRlusd],
    lines: [soloLine],
    signedIn: true,
  });
  assert.deepEqual(
    noRlusdLine.map((row) => row.id).sort(),
    ["SOLO", "XRP"]
  );

  const lineWithoutPool = swapCounterOptions({
    pools: [activeXrp],
    lines: [rlusdLine, soloLine],
    signedIn: true,
  });
  assert.deepEqual(
    lineWithoutPool.map((row) => row.id).sort(),
    ["RLUSD", "SOLO", "XRP"]
  );

  assert.deepEqual(
    swapCounterOptions({ lines: [rlusdLine], signedIn: true }).map((row) => row.id).sort(),
    ["RLUSD", "XRP"]
  );
  assert.ok(swapAssetOptions({ lines: [rlusdLine, soloLine], signedIn: true }).some((row) => row.id === "XDX"));
});

test("quoteBridgeSwap walks from-quote into XDX then out to the other quote", () => {
  const quote = quoteBridgeSwap({
    amountIn: 10,
    routingMode: "amm",
    fromVenue: { reserveBase: 10_000, reserveQuote: 200, tradingFee: 1000, mid: 0.02, bids: [], asks: [] },
    toVenue: { reserveBase: 8_000, reserveQuote: 80, tradingFee: 1000, mid: 0.01, bids: [], asks: [] },
  });
  assert.equal(quote.routeUsed, "bridge");
  assert.ok(quote.actualOutput > 0);
  assert.ok(quote.xdxNotional > 0);
});

test("empty book-only does not report -100% slippage from an AMM mid", () => {
  const quote = quoteSwap({
    amountIn: 1_000_000,
    sellingXdx: true,
    mid: 0.0001157745,
    reserveBase: 10_000_000,
    reserveQuote: 1_157.745,
    tradingFee: 1000,
    routingMode: "book",
    bids: [{ price: 0.0001157745, base_size: 50, source: "amm" }],
    asks: [],
  });
  assert.equal(quote.routeUsed, "none");
  assert.equal(quote.actualOutput, 0);
  assert.equal(quote.expectedOutput, 0);
  assert.equal(quote.slippagePercent, null);
  assert.equal(quote.priceImpactPercent, null);
  assert.equal(quote.isNegativeSlippage, false);
  assert.equal(resolveVenueMid({ routingMode: "book", mid: 0.0001157745, bids: [], asks: [] }), 0);
});

test("book slippage uses only the filled slice against the DEX mid", () => {
  const quote = quoteSwap({
    amountIn: 1_000,
    sellingXdx: true,
    mid: 0.03,
    routingMode: "book",
    bids: [
      { price: 0.02, base_size: 100, source: "dex" },
      { price: 0.03, base_size: 50, source: "amm" },
    ],
    asks: [{ price: 0.021, base_size: 100, source: "dex" }],
  });
  assert.equal(quote.routeUsed, "book");
  assert.ok(quote.partialFill);
  assert.ok(Math.abs(quote.actualOutput - 2) < 1e-12);
  assert.ok(quote.slippagePercent != null);
  assert.ok(Math.abs(quote.slippagePercent) < 10);
  assert.ok(quote.slippagePercent > -90);
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

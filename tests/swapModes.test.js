import test from "node:test";
import assert from "node:assert/strict";
import { feeBadgeForMode, feeRowsForMode } from "../src/swap/swapFeeCalculator.js";
import {
  SWAP_MODE_IDS,
  SWAP_MODES,
  normalizeSwapMode,
  quoteEngineMode,
} from "../src/swap/swapModes.js";
import {
  applySwapRouteFlags,
  TF_LIMIT_QUALITY,
  TF_NO_DIRECT_RIPPLE,
  TF_PARTIAL_PAYMENT,
} from "../src/xaman/tradeTx.js";
import {
  buildSwapHops,
  paymentFlagsForMode,
  recommendSwapMode,
  sameIssuerRipple,
  smartChatMessages,
} from "../src/swap/swapRouting.js";

test("Smart Swap exposes twelve XRPL modes and keeps Smart recommended", () => {
  assert.equal(SWAP_MODES.length, 12);
  assert.deepEqual(SWAP_MODES.map((row) => row.id), SWAP_MODE_IDS);
  assert.equal(SWAP_MODES[0].id, "smart");
  assert.equal(SWAP_MODES[0].recommended, true);
  assert.equal(normalizeSwapMode("book"), "orderbook-only");
  assert.equal(quoteEngineMode("passive-amm"), "amm");
  assert.equal(quoteEngineMode("orderbook-only"), "book");
});

test("fee badges and payment flags follow the selected mode", () => {
  assert.equal(feeBadgeForMode("orderbook-only"), "Fee: 0%");
  assert.ok(feeRowsForMode("smart").some((row) => row.label === "AMM hop"));
  assert.equal(paymentFlagsForMode("limit-quality") & TF_LIMIT_QUALITY, TF_LIMIT_QUALITY);
  const tx = applySwapRouteFlags(
    { TransactionType: "Payment", Flags: TF_PARTIAL_PAYMENT },
    "no-direct-ripple"
  );
  assert.equal(tx.Flags & TF_NO_DIRECT_RIPPLE, TF_NO_DIRECT_RIPPLE);
});

test("rippling stays locked unless both assets share an issuer", () => {
  assert.equal(sameIssuerRipple({ issuer: "rSame" }, { issuer: "rSame" }), true);
  const rec = recommendSwapMode({
    qty: 10,
    routingMode: "rippling",
    alternatives: [],
    noRoute: false,
    fromAsset: { issuer: "rA" },
    toAsset: { issuer: "rB" },
  });
  assert.equal(rec.id, "smart");
  assert.equal(rec.reason, "noripple");
});

test("supply and demand chat recommends the deeper venue", () => {
  const rec = recommendSwapMode({
    qty: 10,
    routingMode: "smart",
    alternatives: [],
    noRoute: false,
    quote: { actualOutput: 8, routeUsed: "hybrid" },
    bookQuote: { actualOutput: 12 },
    ammQuote: { actualOutput: 7 },
    fromTicker: "XRP",
    toTicker: "RLUSD",
  });
  assert.equal(rec.id, "orderbook-only");
  assert.equal(rec.reason, "demand");
});

test("smart chat reports a split fill and hop path", () => {
  const quote = {
    actualOutput: 27,
    routeUsed: "hybrid",
    via: "direct",
    bookOutput: 8,
    ammOutput: 19,
  };
  const rows = smartChatMessages({ quote, routingMode: "smart", toTicker: "RLUSD" });
  assert.ok(rows.some((row) => row.includes("split the trade")));
  assert.deepEqual(buildSwapHops({ quote, fromTicker: "XRP", toTicker: "RLUSD" }), [
    { from: "XRP", to: "RLUSD", venue: "hybrid" },
  ]);
});

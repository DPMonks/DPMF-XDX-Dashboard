import test from "node:test";
import assert from "node:assert/strict";
import { XDX_FEE_TREASURY, XDX_ISSUER, XDX_PLATFORM_FEE_PCT } from "../src/constants/ledger.js";
import {
  needsXdxPlatformFee,
  shouldSkipXdxPlatformFee,
  swapAssetUsd,
  tradeNotionalUsd,
  xdxPlatformFeeFromUsd,
  xdxPlatformFeeTxjson,
} from "../src/swap/platformFee.js";

test("platform fee only applies when neither side is XDX", () => {
  assert.equal(needsXdxPlatformFee("BITX", "USD"), true);
  assert.equal(needsXdxPlatformFee("XRP", "RLUSD"), true);
  assert.equal(needsXdxPlatformFee("XDX", "XRP"), false);
  assert.equal(needsXdxPlatformFee("XRP", "XDX"), false);
  assert.equal(needsXdxPlatformFee("BITX", "BITX"), false);
  assert.equal(XDX_PLATFORM_FEE_PCT, 1);
});

test("1% fee is the USD size converted into XDX", () => {
  assert.equal(tradeNotionalUsd({ payAmount: 50, payUsd: 2 }), 100);
  assert.equal(tradeNotionalUsd({ receiveAmount: 10, receiveUsd: 1 }), 10);
  assert.equal(xdxPlatformFeeFromUsd({ tradeUsd: 100, xdxUsd: 0.0001 }), 10_000);
  assert.equal(xdxPlatformFeeFromUsd({ tradeUsd: 0, xdxUsd: 0.0001 }), 0);
  assert.equal(xdxPlatformFeeFromUsd({ tradeUsd: 100, xdxUsd: 0 }), 0);
});

test("fee payment goes to the DPMF bank and skips the treasury wallet", () => {
  const tx = xdxPlatformFeeTxjson({ account: "rTrader", xdx: 12.5 });
  assert.equal(tx.TransactionType, "Payment");
  assert.equal(tx.Destination, XDX_FEE_TREASURY);
  assert.equal(tx.Account, "rTrader");
  assert.equal(tx.Amount.currency, "XDX");
  assert.equal(tx.Amount.issuer, XDX_ISSUER);
  assert.equal(tx.Amount.value, "12.5");
  assert.equal(xdxPlatformFeeTxjson({ account: XDX_FEE_TREASURY, xdx: 12.5 }), null);
  assert.equal(shouldSkipXdxPlatformFee({ account: XDX_FEE_TREASURY, xdx: 12.5 }), true);
});

test("swap asset USD uses the price book and XRP/XDX marks", () => {
  const prices = { xdxUsd: 0.00008, xrpUsd: 2.5, quotes: { RLUSD: 1 } };
  assert.equal(swapAssetUsd({ id: "XRP", prices }), 2.5);
  assert.equal(swapAssetUsd({ id: "XDX", prices }), 0.00008);
  assert.equal(swapAssetUsd({ id: "RLUSD", prices }), 1);
});

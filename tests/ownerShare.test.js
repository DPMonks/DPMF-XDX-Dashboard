import test from "node:test";
import assert from "node:assert/strict";
import { XDX_TOTAL_SUPPLY } from "../src/constants/ledger.js";
import { shareOf } from "../src/utils/format.js";

test("XDX owner share is wallet balance / 10B total supply", () => {
  const top = 3_016_093_753.766;
  const share = shareOf(top, XDX_TOTAL_SUPPLY);

  assert.equal(XDX_TOTAL_SUPPLY, 10_000_000_000);
  assert.ok(Math.abs(share - 30.16093753766) < 1e-9);

  const detectedWallets = 9_334_000_000;
  const againstDetected = shareOf(top, detectedWallets);
  assert.ok(againstDetected > 32);
  assert.ok(share < againstDetected);
});

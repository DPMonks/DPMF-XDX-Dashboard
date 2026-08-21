import test from "node:test";
import assert from "node:assert/strict";
import {
  isXrpMicroFallback,
  pickTrustlineCount,
  recordedXdxUsdFromPrices,
} from "../src/utils/recordedPrice.js";

test("rejects live Railway xrpUsd * 0.000001 fallback", () => {
  const xrpUsd = 1.36;
  const hack = xrpUsd * 0.000001;
  assert.equal(isXrpMicroFallback(hack, xrpUsd), true);
  assert.equal(
    recordedXdxUsdFromPrices({ xdxUsd: hack, xrpUsd, recorded_price: hack }),
    0
  );
});

test("trustline count uses every latest row and does not copy holders", () => {
  assert.equal(pickTrustlineCount(19983, 15947), 19983);
  assert.equal(pickTrustlineCount(0, 19983), 19983);
  assert.equal(pickTrustlineCount(0, 0), 0);
  assert.notEqual(pickTrustlineCount(19983, 15947), 15947);
});

test("keeps a real USD-per-XDX recorded price at 8 decimals", () => {
  const price = recordedXdxUsdFromPrices({
    recorded_price: 0.00002946123,
    xdxUsd: 0.00002946123,
    xrpUsd: 1.36,
  });
  assert.equal(price, 0.00002946);
  assert.equal(isXrpMicroFallback(0.00002946, 1.36), false);
});

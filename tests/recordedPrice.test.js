import test from "node:test";
import assert from "node:assert/strict";
import {
  isXrpMicroFallback,
  looksLikeXrpUsd,
  pickTrustlineCount,
  recordedXdxUsdFromPrices,
  xrpPerXdx,
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

test("trustline count prefers the history scan when latest was truncated", () => {
  assert.equal(pickTrustlineCount(0, 19983), 19983);
  assert.equal(pickTrustlineCount(15947, 19983), 19983);
  assert.equal(pickTrustlineCount(19983, 0), 19983);
  assert.equal(pickTrustlineCount(0, 0), 0);
  assert.notEqual(pickTrustlineCount(15947, 19983), 15947);
});

test("XDX/XRP tile is XRP per XDX, not USD", () => {
  assert.equal(xrpPerXdx(0.0000419, 1.4), 0.00002993);
  assert.equal(xrpPerXdx(0.0000419, 0.0000419), 0);
  assert.equal(xrpPerXdx(0, 1.4), 0);
});

test("keeps Worker 2 XDX USD and does not treat it as XRP", () => {
  const price = recordedXdxUsdFromPrices({
    recorded_price: 0.0000416,
    xdxUsd: 0.0000416,
    xrpUsd: 1.4,
  });
  assert.equal(price, 0.0000416);
  assert.equal(looksLikeXrpUsd(0.0000416), false);
  assert.equal(looksLikeXrpUsd(1.4), true);
  assert.equal(isXrpMicroFallback(0.0000416, 1.4), false);
});

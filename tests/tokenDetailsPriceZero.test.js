import test from "node:test";
import assert from "node:assert/strict";
import { composeTokenDetailHistory, windowedTokenSeries, tokenDetailMetricNumber } from "../src/tokenDetailsHistory.js";

const now = Date.parse("2026-10-21T19:30:00Z");
const candles = Array.from({ length: 40 }, (_, i) => ({
  timestamp: new Date(now - (40 - i) * 3600000).toISOString(),
  price_xrp: 3.7e-5,
  price_usd: 5.13e-5,
  asset: "XDX",
}));

test("zero prices are not samples, zero counts still are", () => {
  assert.equal(tokenDetailMetricNumber({ price: 0 }, "price"), null);
  assert.equal(tokenDetailMetricNumber({ holders: 0 }, "holders"), 0);
});

for (const bad of [0, 1.385e-6]) {
  test(`live tip of ${bad} does not drop the 1W price line`, () => {
    const rows = composeTokenDetailHistory({
      candles,
      live: { timestamp: new Date(now).toISOString(), price: bad, recorded_price: bad, xdxUsd: bad, holders: 15868 },
    });
    const vals = windowedTokenSeries(rows, "1W", now, "price").map((r) => r.plot).filter((v) => v != null);
    assert.ok(Math.min(...vals) > 4e-5);
  });
}

test("sane live tip is kept", () => {
  const rows = composeTokenDetailHistory({ candles, live: { timestamp: new Date(now).toISOString(), price: 5.187e-5 } });
  const w = windowedTokenSeries(rows, "1W", now, "price");
  assert.ok(Math.abs(w[w.length - 1].plot - 5.187e-5) < 1e-12);
});

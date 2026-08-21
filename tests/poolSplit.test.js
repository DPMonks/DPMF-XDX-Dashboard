import test from "node:test";
import assert from "node:assert/strict";
import { poolAssetSplit, quoteUsdFromMap } from "../src/utils/poolSplit.js";

test("poolAssetSplit is a USD value share, not a raw unit share", () => {
  const split = poolAssetSplit({
    reserveXdx: 63_105_563.3193,
    reserveQuote: 1872.95,
    xdxUsd: 0.0000419,
    quoteUsd: 1.41,
  });
  assert.ok(split);
  assert.equal(split.xdxPct + split.quotePct, 100);
  assert.ok(split.xdxPct > 40 && split.xdxPct < 70);
  assert.ok(split.quotePct > 30 && split.quotePct < 60);
});

test("poolAssetSplit stays hidden when a side or price is missing", () => {
  assert.equal(
    poolAssetSplit({ reserveXdx: 1000, reserveQuote: 0, xdxUsd: 0.00004, quoteUsd: 1.4 }),
    null
  );
  assert.equal(
    poolAssetSplit({ reserveXdx: 1000, reserveQuote: 10, xdxUsd: 0.00004, quoteUsd: 0 }),
    null
  );
});

test("quoteUsdFromMap uses recorded prices and treats RLUSD as one dollar", () => {
  assert.equal(quoteUsdFromMap("XRP", { XRP: 1.41 }), 1.41);
  assert.equal(quoteUsdFromMap("RLUSD", {}), 1);
  assert.equal(quoteUsdFromMap("SOLO", {}), 0);
  assert.equal(quoteUsdFromMap("SOLO", { SOLO: 0.22 }), 0.22);
});

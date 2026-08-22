import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPoolPct,
  inferQuoteReserve,
  poolAssetSplit,
  quoteUsdFromMap,
  resolvePoolSplit,
} from "../src/utils/poolSplit.js";

test("poolAssetSplit is a USD value share, not a raw unit share", () => {
  const split = poolAssetSplit({
    reserveXdx: 63_105_563.3193,
    reserveQuote: 1872.95,
    xdxUsd: 0.0000419,
    quoteUsd: 1.41,
  });
  assert.ok(split);
  assert.equal(Number((split.xdxPct + split.quotePct).toFixed(1)), 100);
  assert.ok(split.xdxPct > 40 && split.xdxPct < 70);
  assert.ok(split.quotePct > 30 && split.quotePct < 60);
  assert.equal(formatPoolPct(split.xdxPct).includes("."), true);
});

test("poolAssetSplit reports one decimal like 40.0 / 60.0", () => {
  const split = poolAssetSplit({
    reserveXdx: 40,
    reserveQuote: 60,
    xdxUsd: 1,
    quoteUsd: 1,
  });
  assert.deepEqual(split, { xdxPct: 40.0, quotePct: 60.0, lead: "quote" });
  assert.equal(formatPoolPct(40), "40.0");
  assert.equal(formatPoolPct(50), "50.0");
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

test("inferQuoteReserve fills the missing AMM quote side from equal USD value", () => {
  const quote = inferQuoteReserve(674_386, 0.000045, 1);
  assert.ok(quote > 30 && quote < 31);
});

test("resolvePoolSplit only needs XDX in the LP and works out the opposing side", () => {
  const inferred = resolvePoolSplit({
    reserveXdx: 1_000_000,
    xdxUsd: 0.00004,
    quoteUsd: 2,
  });
  assert.ok(inferred);
  assert.equal(inferred.xdxPct, 50);
  assert.equal(inferred.quotePct, 50);
  assert.equal(inferred.inferred, true);
  assert.equal(inferred.reserveQuote, 20);

  const measured = resolvePoolSplit({
    reserveXdx: 40,
    reserveQuote: 60,
    xdxUsd: 1,
    quoteUsd: 1,
  });
  assert.deepEqual(
    { xdxPct: measured.xdxPct, quotePct: measured.quotePct, lead: measured.lead },
    { xdxPct: 40, quotePct: 60, lead: "quote" }
  );
  assert.equal(measured.inferred, false);

  const xdxOnly = resolvePoolSplit({ reserveXdx: 63_105_563.3193 });
  assert.deepEqual(
    { xdxPct: xdxOnly.xdxPct, quotePct: xdxOnly.quotePct, lead: xdxOnly.lead },
    { xdxPct: 50, quotePct: 50, lead: "xdx" }
  );
});

test("quoteUsdFromMap uses recorded prices and treats RLUSD as one dollar", () => {
  assert.equal(quoteUsdFromMap("XRP", { XRP: 1.41 }), 1.41);
  assert.equal(quoteUsdFromMap("RLUSD", {}), 1);
  assert.equal(quoteUsdFromMap("SOLO", {}), 0);
  assert.equal(quoteUsdFromMap("SOLO", { SOLO: 0.22 }), 0.22);
});

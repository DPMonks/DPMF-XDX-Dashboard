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

test("resolvePoolSplit is XDX versus LP tokens, not an inferred 50/50", () => {
  const xrp = resolvePoolSplit({
    reserveXdx: 63_105_563.3193,
    reserveQuote: 1846.778,
    lpSupply: 218_594_863.12,
  });
  assert.ok(xrp);
  assert.equal(xrp.xdxPct, 22.4);
  assert.equal(xrp.quotePct, 77.6);
  assert.equal(xrp.lead, "quote");

  const moreXdx = resolvePoolSplit({
    reserveXdx: 800,
    lpSupply: 200,
  });
  assert.deepEqual(
    { xdxPct: moreXdx.xdxPct, quotePct: moreXdx.quotePct, lead: moreXdx.lead },
    { xdxPct: 80, quotePct: 20, lead: "xdx" }
  );

  const noLp = resolvePoolSplit({
    reserveXdx: 40,
    reserveQuote: 60,
  });
  assert.deepEqual(
    { xdxPct: noLp.xdxPct, quotePct: noLp.quotePct, lead: noLp.lead },
    { xdxPct: 40, quotePct: 60, lead: "quote" }
  );

  assert.equal(resolvePoolSplit({ reserveXdx: 63_105_563.3193 }), null);
});

test("quoteUsdFromMap uses recorded prices and treats RLUSD as one dollar", () => {
  assert.equal(quoteUsdFromMap("XRP", { XRP: 1.41 }), 1.41);
  assert.equal(quoteUsdFromMap("RLUSD", {}), 1);
  assert.equal(quoteUsdFromMap("SOLO", {}), 0);
  assert.equal(quoteUsdFromMap("SOLO", { SOLO: 0.22 }), 0.22);
});

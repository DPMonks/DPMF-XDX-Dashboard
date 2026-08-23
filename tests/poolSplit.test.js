import test from "node:test";
import assert from "node:assert/strict";
import {
  displayPoolSplit,
  formatPoolPct,
  inferQuoteReserve,
  poolAssetSplit,
  detectQuoteUsd,
  impliedQuoteUsd,
  quoteUsdFromMap,
  quoteUsdFromXrpRate,
  resolvePoolSplit,
  usableMarketQuoteUsd,
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

test("displayPoolSplit labels a 50/50 bar when the pool split is not measured", () => {
  assert.deepEqual(displayPoolSplit(50, 50), { xdxPct: 50, quotePct: 50, measured: true });
  assert.deepEqual(displayPoolSplit(null, null), { xdxPct: 50, quotePct: 50, measured: false });
  assert.equal(formatPoolPct(50), "50.0");
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

  const fromPrice = resolvePoolSplit({
    reserveXdx: 51_000_000,
    price: 0.002,
  });
  assert.ok(fromPrice);
  assert.equal(fromPrice.xdxPct, 99.8);
  assert.equal(fromPrice.quotePct, 0.2);
  assert.equal(fromPrice.inferred, true);
});

test("quoteUsdFromMap uses recorded prices and treats RLUSD as one dollar", () => {
  assert.equal(quoteUsdFromMap("XRP", { XRP: 1.41 }), 1.41);
  assert.equal(quoteUsdFromMap("XRP", { xrpUsd: 2.8 }), 2.8);
  assert.equal(quoteUsdFromMap("RLUSD", {}), 1);
  assert.equal(quoteUsdFromMap("USDC", {}), 1);
  assert.equal(quoteUsdFromMap("SOLO", {}), 0);
  assert.equal(quoteUsdFromMap("SOLO", { SOLO: 0.22 }), 0.22);
});

test("detectQuoteUsd prefers live USD then XDX pool implied for any quote", () => {
  assert.equal(
    detectQuoteUsd({
      quoteId: "XRP",
      pool: { quote_usd: 1.5, reserve_xdx: 100000, reserve_currency: 3.12, xdxUsd: 0.000047 },
      prices: { xrpUsd: 2.8 },
    }),
    2.8
  );
  assert.equal(
    impliedQuoteUsd({ reserveXdx: 1000, reserveQuote: 50, xdxUsd: 0.0001 }),
    0.002
  );
  assert.equal(
    detectQuoteUsd({
      quoteId: "MAG",
      pool: { reserve_xdx: 1000, reserve_currency: 50, xdxUsd: 0.0001, quote_usd: 0.0001 },
      prices: {},
    }),
    0.002
  );
  assert.equal(detectQuoteUsd({ quoteId: "USDT", pool: {}, prices: {} }), 1);
  assert.equal(usableMarketQuoteUsd(0.000045, { xdxUsd: 0.000045, xrpUsd: 2.8 }), 0);
  assert.equal(usableMarketQuoteUsd(2.8 * 0.000001, { xrpUsd: 2.8 }), 0);
  assert.equal(quoteUsdFromXrpRate("XIO", { xioXrp: 26.4, xrpUsd: 1 }, 1), 26.4);
  assert.equal(
    detectQuoteUsd({
      quoteId: "XIO",
      pool: { reserve_xdx: 1150, reserve_currency: 1, xdxUsd: 0.000087 },
      prices: { XIO: 0.0001, xrpUsd: 2.8 },
    }),
    impliedQuoteUsd({ reserveXdx: 1150, reserveQuote: 1, xdxUsd: 0.000087 })
  );
  assert.equal(
    detectQuoteUsd({
      quoteId: "XIO",
      pool: { reserve_xdx: 1150, reserve_currency: 1, xdxUsd: 0.000087 },
      prices: { xioXrp: 26.4, xrpUsd: 1 },
    }),
    26.4
  );
});

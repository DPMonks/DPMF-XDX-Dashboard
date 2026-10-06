import test from "node:test";
import assert from "node:assert/strict";
import {
  applyXrplToChange,
  applyXrplToOverview,
  applyXrplToPrices,
  countsNeedXrplTo,
  marketNeedsXrplTo,
  parseXrplToToken,
  tvlUsdFromXrplTo,
  xdxUsdFromXrplTo,
} from "../src/utils/xrplToToken.js";

const sample = parseXrplToToken({
  token: {
    usd: "0.000046124014641489683889",
    exch: 3.120905264789023e-5,
    holders: 15942,
    trustlines: 19973,
    lpHolderCount: 80,
    pro24h: -4.89,
    vol24hxrp: 115.77,
    marketcap: 311525.65,
    tvl: 6030,
  },
});

test("parseXrplToToken reads the live XDX token card", () => {
  assert.ok(sample.usd > 0.00004);
  assert.equal(sample.holders, 15942);
  assert.equal(sample.trustlines, 19973);
  assert.ok(sample.exchXrp > 0);
});

test("xrpl.to fills empty Postgres prices and holder counts", () => {
  assert.equal(marketNeedsXrplTo({ xdxUsd: 0, holder_count: 0, xrpUsd: 1.5 }), true);
  assert.equal(countsNeedXrplTo({ xdxUsd: 0.00005, holder_count: 0, trustlines: 0 }), true);
  assert.equal(countsNeedXrplTo({ holder_count: 15940, trustlines: 19973 }), false);
  const prices = applyXrplToPrices({ xdxUsd: 0, xrpUsd: 1.5, xrpGbp: 1.1, source: "db" }, sample);
  assert.ok(prices.xdxUsd > 0.00004);
  assert.equal(prices.source, "hybrid");
  const overview = applyXrplToOverview(
    { xdxUsd: 0, holder_count: 0, trustlines: 0, xrpUsd: 1.5, circulating: 10_000_000_000, source: "db" },
    sample,
    { xrpUsd: 1.5 }
  );
  assert.equal(overview.holder_count, 15942);
  assert.equal(overview.trustline_count, 19973);
  assert.ok(overview.xrplMarketCap > 0);
  assert.ok(overview.volume24hXdx > 1_000_000);
  assert.ok(overview.volume24hUsd > 100);
  assert.ok(overview.volume24h > 1_000_000);
  assert.equal(applyXrplToChange({ xdx: 0 }, sample).xdx, -4.89);
});

test("issuer line counts and a ledger volume of 0 stay on the token card", () => {
  const overview = applyXrplToOverview(
    {
      xdxUsd: 0.00005,
      holder_count: 15879,
      holders: 15879,
      trustlines: 20048,
      trustline_count: 20048,
      holders_source: "xrpl-lines",
      volume24h: 0,
      volume24hXdx: 0,
      volumeLedger: true,
      volumeSource: "xrpl-amm",
      xrpUsd: 1.5,
      source: "xrpl",
    },
    sample,
    { xdxUsd: 0.00005, xrpUsd: 1.5 }
  );
  assert.equal(overview.holder_count, 15879);
  assert.equal(overview.trustline_count, 20048);
  assert.equal(overview.volume24h, 0);
  assert.equal(overview.volume24hXdx, 0);
  assert.equal(overview.volumeSource, "xrpl-amm");
  assert.equal(applyXrplToChange({ xdx: null, source: "xrpl-ledger" }, sample).source, "xrpl-ledger");
  assert.equal(applyXrplToChange({ xdx: null, source: "xrpl-ledger" }, sample).xdx, null);
});

test("xrpl.to still fills holder boxes when the live AMM already has a price", () => {
  const overview = applyXrplToOverview(
    { xdxUsd: 0.00005, holder_count: 0, trustlines: 0, xrpUsd: 1.5, source: "xrpl" },
    sample,
    { xdxUsd: 0.00005, xrpUsd: 1.5 }
  );
  assert.equal(overview.holder_count, 15942);
  assert.equal(overview.trustline_count, 19973);
  assert.equal(overview.lp_holder_count, 80);
});

test("xdxUsdFromXrplTo can price from exch * XRP when usd is missing", () => {
  assert.ok(Math.abs(xdxUsdFromXrplTo({ exchXrp: 0.00003 }, 2) - 0.00006) < 1e-12);
  assert.equal(xdxUsdFromXrplTo({ usd: 0.00005 }, 2), 0.00005);
});

test("xrpl.to pool TVL is 2 x XRP reserve and converts to USD", () => {
  const xrpReserve = 2043.896261;
  const tvlXrp = xrpReserve * 2;
  const xrpUsd = 1.48;
  assert.ok(Math.abs(tvlUsdFromXrplTo({ tvl: tvlXrp }, xrpUsd) - tvlXrp * xrpUsd) < 1e-6);
});

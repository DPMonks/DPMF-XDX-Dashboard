import test from "node:test";
import assert from "node:assert/strict";
import {
  TOKEN_DETAIL_METRICS,
  TOKEN_DETAIL_RANGES,
  composeTokenDetailHistory,
  liveTokenDetailTip,
  mergeTokenDetailRows,
  namedHistoryRows,
  tokenDetailDecimals,
  tokenDetailLabel,
  tokenDetailMetricNumber,
  windowedTokenSeries,
} from "../src/tokenDetailsHistory.js";

test("token detail tabs cover the live numeric token-detail boxes", () => {
  assert.deepEqual(TOKEN_DETAIL_METRICS, [
    "price",
    "xdxPerXrp",
    "xrplMarketCap",
    "circulatingMarketCap",
    "ammMarketCap",
    "circulating",
    "burnedSupply",
    "holders",
    "trustlines",
    "lpHolders",
    "lpTrustlines",
    "lpSupply",
  ]);
  assert.deepEqual(TOKEN_DETAIL_RANGES, [
    "1H",
    "4H",
    "12H",
    "24H",
    "1W",
    "1M",
    "3M",
    "1Y",
    "Max",
  ]);
});

test("tokenDetailLabel uses Token Details copy for LP counts", () => {
  const t = {
    lpHolders: "XDX Lp Owners",
    lpHoldersCount: "LP holders",
    lpTrustlinesCount: "LP trustlines",
    price: "Price",
  };
  assert.equal(tokenDetailLabel(t, "lpHolders"), "LP holders");
  assert.equal(tokenDetailLabel(t, "lpTrustlines"), "LP trustlines");
  assert.equal(tokenDetailLabel(t, "price"), "Price");
});

test("namedHistoryRows maps a dedicated count series onto one metric", () => {
  const rows = namedHistoryRows(
    [{ timestamp: "2026-08-25T12:00:00.000Z", count: 15939 }],
    "holders"
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].holders, 15939);
});

test("mergeTokenDetailRows keeps later values at the same timestamp", () => {
  const merged = mergeTokenDetailRows(
    [{ timestamp: "2026-08-25T12:00:00.000Z", holders: 15940, price: 0.00004 }],
    [{ timestamp: "2026-08-25T12:00:00.000Z", holders: 15939, trustlines: 19980 }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].holders, 15939);
  assert.equal(merged[0].price, 0.00004);
  assert.equal(merged[0].trustlines, 19980);
});

test("liveTokenDetailTip keeps Token Details numbers on the latest point", () => {
  const tip = liveTokenDetailTip({
    timestamp: "2026-08-25T12:09:00.000Z",
    price: 0.00004658,
    holders: 15939,
    lpHolders: 88,
    lpSupply: 12.5,
  });
  assert.equal(tokenDetailMetricNumber(tip, "price"), 0.00004658);
  assert.equal(tokenDetailMetricNumber(tip, "holders"), 15939);
  assert.equal(tokenDetailMetricNumber(tip, "lpHolders"), 88);
  assert.equal(tokenDetailMetricNumber(tip, "lpSupply"), 12.5);
});

test("composeTokenDetailHistory derives market caps from sparkline and live supply", () => {
  const rows = composeTokenDetailHistory({
    holders: [{ timestamp: "2026-08-25T11:00:00.000Z", count: 15940 }],
    sparkline: [{ timestamp: "2026-08-25T11:30:00.000Z", price_usd: 0.00004 }],
    live: {
      timestamp: "2026-08-25T12:00:00.000Z",
      price: 0.00005,
      circulating: 10_000_000_000,
      totalSupply: 10_000_000_000,
      xrpUsd: 2,
      holders: 15939,
    },
  });
  assert.ok(rows.length >= 2);
  const spark = rows.find((row) => row.price === 0.00004);
  assert.ok(spark);
  assert.equal(Math.round(spark.xrplMarketCap), 400_000);
  assert.equal(Math.round(spark.circulatingMarketCap), 400_000);
  assert.equal(spark.xdxPerXrp, 0.00002);
  const tip = rows[rows.length - 1];
  assert.equal(tip.holders, 15939);
  assert.equal(tip.price, 0.00005);
});

test("windowedTokenSeries seeds the selected timeframe and keeps the live tip", () => {
  const now = Date.parse("2026-08-25T12:00:00.000Z");
  const rows = [
    { timestamp: "2026-08-24T12:00:00.000Z", ts: now - 86400000, holders: 15944 },
    { timestamp: "2026-08-25T12:00:00.000Z", ts: now, holders: 15939 },
  ];
  const windowed = windowedTokenSeries(rows, "24H", now, "holders");
  assert.ok(windowed.length >= 2);
  assert.equal(windowed[0].ts, now - 86400000);
  assert.equal(windowed[windowed.length - 1].plot, 15939);
});

test("tokenDetailDecimals match Token Details precision", () => {
  assert.equal(tokenDetailDecimals("price"), 8);
  assert.equal(tokenDetailDecimals("xdxPerXrp"), 8);
  assert.equal(tokenDetailDecimals("xrplMarketCap"), 2);
  assert.equal(tokenDetailDecimals("holders"), 0);
});

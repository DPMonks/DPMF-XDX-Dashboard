import test from "node:test";
import assert from "node:assert/strict";
import { offerToDexRow } from "../src/orderbook.js";
import { formatFeePercent, governanceFromAmmInfo } from "../src/wallet/ammVote.js";
import { composeTokenDetails } from "../src/tokenDetails.js";
import {
  composeTokenDetailHistory,
  rowsFromLockedCandles,
  windowedTokenSeries,
  xdxPriceHistoryRows,
} from "../src/tokenDetailsHistory.js";
import { dbRowIsFresh, dropStaleAmmRow } from "../server/readIndexerDb.js";
import { mergeOrderbookCatalogs } from "../server/catalogSwitch.js";
import { isBusyRpcResult, xrplRpc, xrplRpcCandidates } from "../server/xrplBookOffers.js";

const XDX = (value) => ({ currency: "XDX", issuer: "rIssuer", value: String(value) });

test("unfunded book_offers rows are dropped instead of drawn at full size", () => {
  assert.equal(
    offerToDexRow({ TakerGets: XDX(8000), TakerPays: "400", taker_gets_funded: XDX(0) }),
    null
  );
  assert.equal(offerToDexRow({ TakerGets: "1500000", TakerPays: XDX(50000), taker_gets_funded: "0" }), null);
  const partial = offerToDexRow({
    TakerGets: XDX(8000),
    TakerPays: "400",
    taker_gets_funded: XDX(2000),
  });
  assert.equal(partial.base_size, 2000);
});

test("a missed amm_info read shows an unknown fee, not 0%", () => {
  const gov = governanceFromAmmInfo(null);
  assert.equal(gov.loaded, false);
  assert.equal(gov.tradingFeePct, null);
  assert.equal(formatFeePercent(null), "-");
  const live = governanceFromAmmInfo({ amm: { trading_fee: 963, vote_slots: [] } });
  assert.equal(live.loaded, true);
  assert.ok(Math.abs(live.tradingFeePct - 0.963) < 1e-9);
});

test("circulating is not the full supply while issuer-locked is unknown", () => {
  const unknown = composeTokenDetails({ overview: { total_supply: 10_000_000_000 }, prices: {} });
  assert.equal(unknown.circulating, null);
  const known = composeTokenDetails({
    overview: { total_supply: 10_000_000_000, issuer_locked: 17_996_071.62 },
    prices: {},
  });
  assert.ok(Math.abs(known.circulating - 9_982_003_928.38) < 0.01);
});

test("stale AMM rows lose their reserve fields; fresh ones keep them", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  assert.equal(dbRowIsFresh("2026-10-07T11:30:00Z", now), true);
  assert.equal(dbRowIsFresh("2026-08-23T00:00:00Z", now), false);
  assert.equal(dbRowIsFresh(null, now), false);
  const stale = dropStaleAmmRow(
    { timestamp: "2026-08-23T00:00:00Z", lp_supply: 220_406_408.73, reserve_asset: 1, price: 2 },
    now
  );
  assert.equal(stale.lp_supply, null);
  assert.equal(stale.price, null);
  assert.equal(stale.reserve_source, "stale");
  const live = dropStaleAmmRow({ reserve_source: "amm_info", lp_supply: 321_930_822.86 }, now);
  assert.equal(live.lp_supply, 321_930_822.86);
});

test("a single-pair request takes the live book over a stored snapshot", () => {
  const db = { pair: "XDX/XRP", bids: [{ price: 0.00003029, base_size: 1 }], asks: [], source: "db" };
  const live = {
    pair: "XDX/XRP",
    bids: [{ price: 0.0000353, base_size: 1 }],
    asks: [{ price: 0.0000355, base_size: 1 }],
    source: "xrpl",
  };
  const merged = mergeOrderbookCatalogs(db, live);
  assert.equal(merged.bids[0].price, 0.0000353);
  assert.equal(merged.source, "xrpl");
});

test("XRPL RPC fails over when a node is busy or down", async () => {
  assert.equal(isBusyRpcResult({ error: "slowDown" }), true);
  assert.equal(isBusyRpcResult({ amm: {} }), false);
  const urls = xrplRpcCandidates("https://a.example");
  assert.equal(urls[0], "https://a.example");
  assert.ok(urls.length >= 3);
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (seen.length === 1) throw new Error("down");
    if (seen.length === 2) return { ok: true, json: async () => ({ result: { error: "tooBusy" } }) };
    return { ok: true, json: async () => ({ result: { amm: { trading_fee: 963 } } }) };
  };
  const body = await xrplRpc("amm_info", {}, { fetchImpl, failover: true, rpcUrl: "https://a.example" });
  assert.equal(body.amm.trading_fee, 963);
  assert.equal(seen.length, 3);
});

test("price history reads the ledger candles nested under db, once", () => {
  const candle = { timestamp: "2026-10-07T11:00:00.000Z", price_xrp: 0.0000357, price_usd: 0.0000511, asset: "XDX" };
  const rows = xdxPriceHistoryRows({ locked: {}, db: { price_history: [candle], rows: [candle] } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price_usd, 0.0000511);
});

test("locked XDX/XRP closes are converted to USD with that day's XRP close", () => {
  const day = Date.parse("2024-01-02T00:00:00Z");
  const locked = {
    pairs: { "XDX/XRP": { quote: "XRP", candles: [{ t: day, c: 0.00005 }, { t: day + 86400000, c: 0.00006 }] } },
    xrpUsd: [{ t: day, c: 0.6 }],
  };
  const rows = rowsFromLockedCandles(locked);
  assert.equal(rows.length, 1);
  assert.ok(Math.abs(rows[0].price_usd - 0.00003) < 1e-12);
  assert.equal(rows[0].price_xrp, 0.00005);
});

test("ledger candles replace the locked tape where they overlap", () => {
  const day = Date.parse("2026-08-20T00:00:00Z");
  const rows = composeTokenDetailHistory({
    candles: [{ timestamp: new Date(day).toISOString(), price_xrp: 0.00003, price_usd: 0.00009, asset: "XDX" }],
    lockedCandles: {
      pairs: {
        "XDX/XRP": {
          quote: "XRP",
          candles: [
            { t: day - 86400000, c: 0.00002 },
            { t: day, c: 0.00002 },
          ],
        },
      },
      xrpUsd: [
        { t: day - 86400000, c: 1.5 },
        { t: day, c: 1.5 },
      ],
    },
  });
  const priced = rows.filter((row) => row.price != null && !row.__carried?.price);
  assert.equal(priced.length, 2);
  assert.ok(Math.abs(priced[0].price - 0.00003) < 1e-12);
  // The ledger row is repriced in the USD of its own day (0.00003 XRP x $1.5).
  assert.ok(Math.abs(priced[1].price - 0.000045) < 1e-12);
});

test("price lines break across multi day holes instead of a flat fake line", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  const d = 86400000;
  const rows = [
    { ts: now - 30 * d, price: 0.00003 },
    { ts: now - 29 * d, price: 0.000031 },
    { ts: now - 2 * d, price: 0.00005, holders: 10 },
    { ts: now - 1 * d, price: 0.000052 },
    { ts: now - 20 * d, holders: 9, price: 0.000031, __carried: { price: true } },
  ].map((row) => ({ ...row, timestamp: new Date(row.ts).toISOString() }));
  const series = windowedTokenSeries(rows, "1M", now, "price");
  const breaks = series.filter((row) => row.plot == null);
  assert.equal(breaks.length, 1);
  assert.ok(!series.some((row) => row.ts === now - 20 * d));
  assert.equal(series[series.length - 1].plot, 0.000052);
  // Level metrics still step across the hole.
  const holders = windowedTokenSeries(rows, "1M", now, "holders");
  assert.ok(holders.every((row) => row.plot != null));
});

test("dust-trade candles far from their neighbours are dropped from price history", async () => {
  const { dropPriceOutliers } = await import("../src/tokenDetailsHistory.js");
  const start = Date.parse("2024-10-01T00:00:00Z");
  const rows = Array.from({ length: 30 }, (_, i) => ({
    timestamp: new Date(start + i * 3600000).toISOString(),
    price_xrp: 0.0001 * (1 + (i % 5) * 0.02),
  }));
  rows[10] = { ...rows[10], price_xrp: 89.47 };
  rows[20] = { ...rows[20], price_xrp: 0.0000001 };
  const kept = dropPriceOutliers(rows);
  assert.equal(kept.length, 28);
  assert.ok(kept.every((row) => row.price_xrp < 0.001 && row.price_xrp > 0.00001));
});

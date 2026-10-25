import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { composePairCandles } from "../src/chart/composeChart.js";
import { ledgerPairCandles, parseLedgerPayload } from "../src/chart/ledgerPairCandles.js";
import { buildLedgerChartPayload, resetPairLedgerCache } from "../server/pairLedgerCandles.js";
import {
  XIO_LEDGER_FROM_MS,
  XIO_LEDGER_POOLS,
  loadXioPoolCandles,
  resetXioLedgerCache,
  xioCandleRows,
  xioTradePrintFromTx,
} from "../server/xioLedgerCandles.js";

const fixture = JSON.parse(readFileSync(new URL("./xioAmmTx.fixture.json", import.meta.url), "utf8"));
const DAY = 86_400_000;
const HOUR = 3_600_000;
const RIPPLE_EPOCH = 946_684_800;
const NOW = Date.parse("2026-10-08T17:00:00.000Z");

function rippleDate(ms) {
  return Math.floor(ms / 1000) - RIPPLE_EPOCH;
}

/** A copy of the real XIO/XRP swap moved to `ms`, with its own hash. */
function swapAt(ms, hash) {
  const row = structuredClone(fixture.xrp_swap);
  row.tx.date = rippleDate(ms);
  row.tx.hash = hash;
  row.hash = hash;
  return row;
}

function fakeRpc(pages) {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    const body = JSON.parse(init.body);
    const params = body.params[0];
    calls.push(params);
    const index = params.marker ? Number(params.marker.page) : 0;
    const page = pages[index] || { transactions: [] };
    return {
      ok: true,
      json: async () => ({
        result: {
          transactions: page.transactions,
          ...(page.next != null ? { marker: { page: page.next } } : {}),
        },
      }),
    };
  };
  return { fetchImpl, calls };
}

test("an XIO/XRP AMM swap prints XRP per XIO from the AMM's own balance changes", () => {
  const print = xioTradePrintFromTx(fixture.xrp_swap, XIO_LEDGER_POOLS["XIO/XRP"]);
  assert.equal(print.timestamp, "2026-10-08T16:49:20.000Z");
  assert.equal(print.quoteCurrency, "XRP");
  assert.ok(Math.abs(print.price - 25.07324) < 1e-4, `price ${print.price}`);
  assert.equal(print.side, "buy");
});

test("an XIO/RLUSD AMM swap prints RLUSD per XIO", () => {
  const print = xioTradePrintFromTx(fixture.rlusd_swap, XIO_LEDGER_POOLS["XIO/RLUSD"]);
  assert.equal(print.quoteCurrency, "RLUSD");
  assert.ok(Math.abs(print.price - 33.8079) < 1e-3, `price ${print.price}`);
  assert.equal(print.side, "sell");
});

test("deposits and swaps on another pool are not XIO prints", () => {
  assert.equal(xioTradePrintFromTx(fixture.xrp_deposit, XIO_LEDGER_POOLS["XIO/XRP"]), null);
  assert.equal(xioTradePrintFromTx(fixture.rlusd_swap, XIO_LEDGER_POOLS["XIO/XRP"]), null);
  const failed = structuredClone(fixture.xrp_swap);
  failed.meta.TransactionResult = "tecPATH_DRY";
  assert.equal(xioTradePrintFromTx(failed, XIO_LEDGER_POOLS["XIO/XRP"]), null);
});

test("pool candles page back to the lock date, then a warm refresh stops at known swaps", async () => {
  resetXioLedgerCache();
  const day = Date.parse("2026-10-07T00:00:00.000Z");
  const newest = [swapAt(day + 10 * HOUR, "A3"), swapAt(day + 9 * HOUR, "A2")];
  const older = [swapAt(day - DAY + HOUR, "A1"), swapAt(XIO_LEDGER_FROM_MS - HOUR, "OLD")];
  const { fetchImpl, calls } = fakeRpc([
    { transactions: newest, next: 1 },
    { transactions: older, next: 2 },
    { transactions: [swapAt(XIO_LEDGER_FROM_MS - 2 * DAY, "OLDER")] },
  ]);
  const cold = await loadXioPoolCandles("XIO/XRP", { fetchImpl, now: NOW });
  assert.equal(calls.length, 2, "stops on the page that reaches the lock date");
  assert.equal(cold.partial, false);
  assert.equal(cold.ohlc["1d"].length, 2);
  assert.equal(cold.ohlc["1h"].length, 3);
  assert.ok(cold.ohlc["1d"].every((row) => row[0] >= XIO_LEDGER_FROM_MS));

  const fresh = swapAt(day + 11 * HOUR, "A4");
  const warmRpc = fakeRpc([{ transactions: [fresh, ...newest], next: 1 }, { transactions: older }]);
  const warm = await loadXioPoolCandles("XIO/XRP", { fetchImpl: warmRpc.fetchImpl, now: NOW + 2 * 60_000 });
  assert.equal(warmRpc.calls.length, 1, "warm refresh reads only the newest page");
  assert.equal(warm.ohlc["1h"].length, 4);
});

test("a failed RPC leaves an honest empty payload instead of throwing", async () => {
  resetXioLedgerCache();
  resetPairLedgerCache();
  const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) });
  const body = await buildLedgerChartPayload("XIO/RLUSD", { fetchImpl, now: NOW, loadXrpUsd: async () => ({ candles: [] }) });
  assert.equal(body.view, "ledger");
  assert.equal(body.pair, "XIO/RLUSD");
  assert.equal(body.native.reason, "unavailable");
  const parsed = parseLedgerPayload(body);
  assert.deepEqual(parsed.native["1d"], []);
});

test("XIO/XRP ledger payload uses its own pool as the XRP leg", async () => {
  resetXioLedgerCache();
  const day = Date.parse("2026-10-07T00:00:00.000Z");
  const { fetchImpl } = fakeRpc([{ transactions: [swapAt(day + HOUR, "B1")] }]);
  const body = await buildLedgerChartPayload("xio-xrp", { fetchImpl, now: NOW });
  assert.equal(body.pair, "XIO/XRP");
  const parsed = parseLedgerPayload(body);
  assert.equal(parsed.xrp, parsed.native);
  const daily = ledgerPairCandles({ pair: "XIO/XRP", intervalId: "1D", ledger: parsed, now: NOW });
  assert.equal(daily.length, 1);
  assert.ok(Math.abs(daily[0].c - 25.07324) < 1e-4);
});

test("XIO/XRP daily chart keeps the XIO lock and continues after 13 Sep from ledger swaps", () => {
  const lockEnd = XIO_LEDGER_FROM_MS;
  const lockRows = [lockEnd - 2 * DAY, lockEnd - DAY, lockEnd].map((t, i) => ({
    t,
    o: 24 + i * 0.1,
    h: 24.5 + i * 0.1,
    l: 23.5 + i * 0.1,
    c: 24.1 + i * 0.1,
    v: 0,
    source: "inftf-xrpl-dex",
  }));
  const locked = { pairs: { "XIO/XRP": { quote: "XRP", source: "xio-exchange", candles: lockRows } }, xrpUsd: [] };
  const ledgerRows = [
    [lockEnd, 23.9, 24.7, 19.1, 19.7, 5, 134],
    [lockEnd + DAY, 20.1, 27, 19.2, 22.5, 3, 62],
    [Date.parse("2026-10-08T00:00:00.000Z"), 23.2, 25.5, 23.2, 25.07, 3.4, 19],
  ];
  const ledger = parseLedgerPayload({ view: "ledger", pair: "XIO/XRP", native: { ohlc: { "1d": ledgerRows } }, fx: {} });
  const candles = composePairCandles({
    pair: "XIO/XRP",
    interval: "1D",
    range: "Max",
    locked,
    ledger,
    livePrice: 25.07,
    now: NOW,
    windowed: false,
  });
  const times = candles.map((c) => c.t);
  assert.deepEqual(times.slice(0, 3), lockRows.map((r) => r.t), "locked days stay as locked");
  assert.equal(candles[2].c, lockRows[2].c, "13 Sep stays the locked candle");
  assert.ok(times.includes(lockEnd + DAY), "14 Sep comes from the ledger");
  assert.equal(times[times.length - 1], Date.parse("2026-10-08T00:00:00.000Z"));
  assert.ok(!times.some((t) => t > lockEnd + DAY && t < Date.parse("2026-10-08T00:00:00.000Z")), "no carried days in the gap");

  const without = composePairCandles({
    pair: "XIO/XRP",
    interval: "1D",
    range: "Max",
    locked,
    ledger: null,
    livePrice: 25.07,
    now: NOW,
    windowed: false,
  });
  assert.ok(without.length < candles.length, "without ledger data only the lock and live mark remain");
});

test("XIO hourly chart uses ledger hours once ledger data is there", () => {
  const start = Date.parse("2026-10-08T00:00:00.000Z");
  const ledger = parseLedgerPayload({
    view: "ledger",
    pair: "XIO/RLUSD",
    native: { ohlc: { "1h": [[start, 33, 34, 32.5, 33.5, 0.1, 3], [start + 5 * HOUR, 33.5, 35, 33, 34.7, 0.2, 4]] } },
    fx: {},
  });
  const candles = composePairCandles({
    pair: "XIO/RLUSD",
    interval: "1h",
    range: "Max",
    locked: { pairs: {}, xrpUsd: [] },
    ledger,
    livePrice: 33.8,
    now: NOW,
    windowed: false,
  });
  const hours = candles.map((c) => (c.t - start) / HOUR);
  assert.deepEqual(hours.slice(0, 2), [0, 5]);
  assert.equal(candles[1].o, 33.5, "opens at the previous close");
});

test("xioCandleRows buckets prints and keeps one minute rows for seven days only", () => {
  const prints = [
    { timestamp: new Date(NOW - 8 * DAY).toISOString(), price: 24, xio: 1 },
    { timestamp: new Date(NOW - HOUR).toISOString(), price: 25, xio: 2 },
  ];
  assert.equal(xioCandleRows(prints, "1m", NOW).length, 1);
  assert.equal(xioCandleRows(prints, "1d", NOW).length, 2);
});

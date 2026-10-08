import test from "node:test";
import assert from "node:assert/strict";
import { appendLiveClose } from "../src/chart/candles.js";
import { composePairCandles } from "../src/chart/composeChart.js";
import {
  crossLedgerCandles,
  dropCloseOutliers,
  fxAt,
  ledgerPairCandles,
  parseLedgerPayload,
  quoteLeg,
} from "../src/chart/ledgerPairCandles.js";
import { buildLedgerChartPayload, compactCandleRows, resetPairLedgerCache } from "../server/pairLedgerCandles.js";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const NOW = Date.parse("2026-10-08T15:30:00.000Z");

function row(t, c, { o = c, h = c * 1.01, l = c * 0.99, v = 100, n = 2 } = {}) {
  return [t, o, h, l, c, v, n];
}

function payload(pair, { native = {}, xrp = null, fx = null } = {}) {
  return {
    view: "ledger",
    pair,
    native: { ohlc: native },
    ...(xrp ? { xrp: { ohlc: xrp } } : {}),
    fx: fx ? { "XRP/USD": fx } : {},
  };
}

const isFlat = (c) => c.o === c.h && c.h === c.l && c.l === c.c;

test("XDX/XRP hourly chart uses ledger candles and leaves no-trade hours empty", () => {
  const start = Date.parse("2026-10-08T00:00:00.000Z");
  const hours = [0, 1, 2, 8, 9, 14];
  const ledger = parseLedgerPayload(
    payload("XDX/XRP", { native: { "1h": hours.map((h, i) => row(start + h * HOUR, 3.7e-5 + i * 1e-7)) } })
  );
  const candles = composePairCandles({
    pair: "XDX/XRP",
    interval: "1h",
    range: "Max",
    locked: { pairs: {}, xrpUsd: [] },
    ledger,
    livePrice: 3.76e-5,
    now: NOW,
    windowed: false,
  });
  const times = candles.map((c) => (c.t - start) / HOUR);
  assert.deepEqual(times, [0, 1, 2, 8, 9, 14, 15]);
  assert.ok(candles.every((c) => c.source !== "carry" && c.source !== "session"));
  assert.ok(candles.slice(0, -1).every((c) => !isFlat(c)));
});

test("4H buckets merge real hourly candles and skip buckets with no trade", () => {
  const start = Date.parse("2026-10-08T00:00:00.000Z");
  const ledger = parseLedgerPayload(
    payload("XDX/XRP", {
      native: {
        "1h": [row(start, 1, { h: 1.2, l: 0.9 }), row(start + HOUR, 1.1, { h: 1.3, l: 1.0 }), row(start + 9 * HOUR, 1.2)],
      },
    })
  );
  const four = ledgerPairCandles({ pair: "XDX/XRP", intervalId: "4h", ledger, now: NOW });
  assert.equal(four.length, 2);
  assert.equal(four[0].t, start);
  assert.equal(four[0].o, 1);
  assert.equal(four[0].h, 1.3);
  assert.equal(four[0].l, 0.9);
  assert.equal(four[0].c, 1.1);
  assert.equal(four[1].t, start + 8 * HOUR);
});

test("daily XDX/RLUSD continues past the locked tape from ledger XDX/XRP times that day's XRP/USD", () => {
  const lockedEnd = Date.parse("2026-08-22T00:00:00.000Z");
  const locked = {
    pairs: { "XDX/RLUSD": { candles: [{ t: lockedEnd, o: 5e-5, h: 5.1e-5, l: 4.9e-5, c: 5e-5, v: 1 }] } },
    xrpUsd: [{ t: lockedEnd, c: 1.4 }],
  };
  const d1 = lockedEnd + DAY;
  const d3 = lockedEnd + 3 * DAY;
  const ledger = parseLedgerPayload(
    payload("XDX/RLUSD", {
      native: {},
      xrp: { "1d": [row(d1, 3.6e-5), row(d3, 3.8e-5)] },
      fx: [
        [d1, 1.5],
        [d3, 1.25],
      ],
    })
  );
  const candles = composePairCandles({
    pair: "XDX/RLUSD",
    interval: "1D",
    range: "Max",
    locked,
    ledger,
    now: d3 + 12 * HOUR,
    windowed: false,
  });
  assert.deepEqual(
    candles.map((c) => c.t),
    [lockedEnd, d1, d3],
    "no carried candle on the day with no trade"
  );
  assert.ok(Math.abs(candles[1].c - 3.6e-5 * 1.5) < 1e-12);
  assert.ok(Math.abs(candles[2].c - 3.8e-5 * 1.25) < 1e-12);
  assert.equal(candles[2].source, "ledger-cross");
});

test("the pool's own candles win from its first bucket; earlier buckets are crossed", () => {
  const t0 = Date.parse("2026-10-01T00:00:00.000Z");
  const ledger = parseLedgerPayload(
    payload("XDX/RLUSD", {
      native: { "1h": [row(t0 + 5 * HOUR, 5.2e-5), row(t0 + 7 * HOUR, 5.3e-5)] },
      xrp: { "1h": [row(t0 + HOUR, 3.7e-5), row(t0 + 5 * HOUR, 3.8e-5), row(t0 + 6 * HOUR, 3.9e-5)] },
      fx: [[t0, 1.4]],
    })
  );
  const candles = ledgerPairCandles({ pair: "XDX/RLUSD", intervalId: "1h", ledger, now: t0 + 8 * HOUR });
  assert.deepEqual(
    candles.map((c) => [(c.t - t0) / HOUR, c.source]),
    [
      [1, "ledger-cross"],
      [5, "ledger"],
      [7, "ledger"],
    ]
  );
});

test("a crossed candle needs a quote price no older than its limit", () => {
  const t0 = Date.parse("2026-09-01T00:00:00.000Z");
  const series = [{ t: t0, c: 25 }];
  assert.equal(fxAt(series, t0 + 2 * DAY, 3 * DAY), 25);
  assert.equal(fxAt(series, t0 + 4 * DAY, 3 * DAY), null);
  assert.equal(fxAt(series, t0 - 1, 3 * DAY), null);
  const xrp = [
    { t: t0 + DAY, o: 4e-5, h: 4e-5, l: 4e-5, c: 4e-5, v: 1 },
    { t: t0 + 20 * DAY, o: 4e-5, h: 4e-5, l: 4e-5, c: 4e-5, v: 1 },
  ];
  const crossed = crossLedgerCandles(xrp, { mode: "token", series, live: null }, t0 + 30 * DAY);
  assert.equal(crossed.length, 1);
  assert.ok(Math.abs(crossed[0].c - 4e-5 / 25) < 1e-15);
});

test("XDX/XIO uses the live XIO/XRP mark only for the last day and a half", () => {
  const leg = quoteLeg("XDX/XIO", { locked: { pairs: {} }, prices: { XIOXrp: 25 } });
  assert.equal(leg.mode, "token");
  assert.equal(leg.live, 25);
  const recent = { t: NOW - 2 * HOUR, o: 4e-5, h: 4e-5, l: 4e-5, c: 4e-5 };
  const old = { t: NOW - 40 * DAY, o: 4e-5, h: 4e-5, l: 4e-5, c: 4e-5 };
  const out = crossLedgerCandles([old, recent], { ...leg, series: [] }, NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].t, recent.t);
});

test("dropCloseOutliers removes a dust fill spike and keeps the market", () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ t: i, o: 1, h: 1, l: 1, c: 1 + i * 0.001 }));
  rows[10] = { t: 10, o: 1, h: 89, l: 1, c: 89 };
  const kept = dropCloseOutliers(rows);
  assert.equal(kept.length, 19);
  assert.ok(kept.every((r) => r.c < 2));
});

test("no carried flat candles after the locked tape ends when ledger data is missing", () => {
  const end = Date.parse("2026-08-22T00:00:00.000Z");
  const candles = composePairCandles({
    pair: "XDX/XRP",
    interval: "1D",
    range: "Max",
    locked: { pairs: { "XDX/XRP": { candles: [{ t: end, o: 3e-5, h: 3.1e-5, l: 2.9e-5, c: 3e-5, v: 1 }] } }, xrpUsd: [] },
    livePrice: 3.7e-5,
    now: NOW,
    windowed: false,
  });
  assert.equal(candles.length, 2);
  assert.equal(candles[1].source, "live");
  assert.ok(candles.every((c) => c.source !== "carry"));
});

test("XIO pairs on intraday timeframes keep real daily candles, not interpolated sessions", () => {
  const first = Date.parse("2026-09-10T00:00:00.000Z");
  const lock = [0, 1, 3].map((d) => ({ t: first + d * DAY, o: 24, h: 25, l: 23.5, c: 24.5, v: 1, source: "inftf-xrpl-dex" }));
  const candles = composePairCandles({
    pair: "XIO/XRP",
    interval: "1h",
    range: "Max",
    locked: { pairs: { "XIO/XRP": { candles: lock } } },
    now: first + 28 * DAY,
    windowed: false,
  });
  assert.equal(candles.length, 3);
  assert.ok(candles.every((c) => c.source === "inftf-xrpl-dex"));
});

test("appendLiveClose with skipFlat does not add a flat bar when nothing moved", () => {
  const rows = [{ t: 0, o: 1, h: 1.1, l: 0.9, c: 1, v: 1 }];
  assert.equal(appendLiveClose(rows, 1, 5 * HOUR, "1h", { skipFlat: true }).length, 1);
  assert.equal(appendLiveClose(rows, 1.05, 5 * HOUR, "1h", { skipFlat: true }).length, 2);
  assert.equal(appendLiveClose(rows, 1, 5 * HOUR, "1h").length, 2);
});

test("compactCandleRows keeps OHLC, rounds, and trims 1m to seven days", () => {
  const now = NOW;
  const rows = compactCandleRows(
    [
      { bucket: now - 8 * DAY, open: 1, high: 2, low: 0.5, close: 1.5, volume_xdx: 10, trades: 3 },
      { bucket: now - HOUR, open: 1.123456789, high: 2, low: 0.5, close: 1.5, volume_xdx: 10, trades: 3 },
    ],
    "1m",
    now
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], [now - HOUR, 1.123457, 2, 0.5, 1.5, 10, 3]);
});

test("ledger chart payload reads the pool's own rows and adds XDX/XRP and XRP/USD for RLUSD", async () => {
  resetPairLedgerCache();
  const seen = [];
  const body = await buildLedgerChartPayload("xdx/rlusd", {
    now: NOW,
    queryImpl: async (sql, params) => {
      seen.push(params[0]);
      return {
        ok: true,
        rows: [
          { interval: "1h", bucket: NOW - 2 * HOUR, open: 5e-5, high: 5.1e-5, low: 4.9e-5, close: 5e-5, volume_xdx: 9, trades: 1 },
        ],
      };
    },
    loadXrpCandles: async () => ({
      candles: { "1m": [], "1h": [{ bucket: NOW - HOUR, open: 3.7e-5, high: 3.7e-5, low: 3.6e-5, close: 3.65e-5, volume_xdx: 5, trades: 2 }], "1d": [] },
    }),
    loadXrpUsd: async () => ({ candles: [{ t: NOW - DAY, c: 1.35 }] }),
  });
  assert.deepEqual(seen, ["XDX/RLUSD"]);
  assert.equal(body.view, "ledger");
  assert.equal(body.pair, "XDX/RLUSD");
  assert.equal(body.native.ohlc["1h"].length, 1);
  assert.equal(body.xrp.ohlc["1h"].length, 1);
  assert.deepEqual(body.fx["XRP/USD"], [[NOW - DAY, 1.35]]);
  const parsed = parseLedgerPayload(body);
  assert.equal(parsed.native["1h"][0].c, 5e-5);
  assert.equal(parsed.xrp["1h"][0].c, 3.65e-5);
});

test("noTradeGaps flags breaks over three bars and a full day only", async () => {
  const { noTradeGaps } = await import("../src/chart/candles.js");
  const start = Date.parse("2026-10-01T00:00:00.000Z");
  const hourly = [0, 1, 9, 10, 40].map((h) => ({ t: start + h * HOUR }));
  assert.deepEqual(noTradeGaps(hourly, "1h"), [{ from: start + 10 * HOUR, to: start + 40 * HOUR }]);
  const daily = [0, 1, 3, 8].map((d) => ({ t: start + d * DAY }));
  assert.deepEqual(noTradeGaps(daily, "1D"), [{ from: start + 3 * DAY, to: start + 8 * DAY }]);
});

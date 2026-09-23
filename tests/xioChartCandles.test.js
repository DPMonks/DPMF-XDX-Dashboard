import test from "node:test";
import assert from "node:assert/strict";
import { composePairCandles } from "../src/chart/composeChart.js";
import {
  isXioBasePair,
  liveQuotesFromXioPrices,
  mergeXioPairs,
  normalizeChartPair,
} from "../src/chart/xioHistory.js";
import {
  attachXioChartHistory,
  buildChartCandlesPayload,
  resetXioCandleCache,
} from "../server/xioChartCandles.js";

const DAY = 86_400_000;
const FIRST = Date.parse("2024-02-10T00:00:00.000Z");

function xioCandles(count = 90) {
  return Array.from({ length: count }, (_, index) => {
    const close = 20 + (index % 9);
    return {
      t: FIRST + index * DAY,
      o: close - 0.4,
      h: close + 1.2,
      l: close - 0.8,
      c: close,
      v: 10 + index,
      source: "inftf-xrpl-dex",
    };
  });
}

function xioBody() {
  return {
    locked: true,
    snapshot: {
      pairs: {
        "XIO/XRP": { quote: "XRP", source: "inftf-xrpl-dex", candles: xioCandles(120) },
        "XIO/RLUSD": {
          quote: "RLUSD",
          source: "backdated(xio_xrp*xrp_usd)",
          candles: xioCandles(120).map((row) => ({ ...row, c: row.c * 1.5, o: row.o * 1.5, h: row.h * 1.5, l: row.l * 1.5, source: "backdated" })),
        },
        "XDX/XRP": { candles: [{ t: 1, o: 9, h: 9, l: 9, c: 9, v: 1 }] },
      },
    },
    db: null,
  };
}

function jsonResponse(body, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

test("isXioBasePair matches XIO quote pairs only", () => {
  assert.equal(isXioBasePair("XIO/XRP"), true);
  assert.equal(isXioBasePair("xio-rlusd"), true);
  assert.equal(isXioBasePair("XIO/XDX"), true);
  assert.equal(isXioBasePair("XDX/XIO"), false);
  assert.equal(isXioBasePair("XDX/XRP"), false);
  assert.equal(normalizeChartPair(" xio / xrp "), "XIO/XRP");
});

test("mergeXioPairs adds XIO history and leaves XDX/XRP candles untouched", () => {
  const xdx = [{ t: FIRST, o: 0.00002, h: 0.00003, l: 0.00001, c: 0.00002, v: 4, source: "locked" }];
  const snap = { pairs: { "XDX/XRP": { candles: xdx } }, xrpUsd: [{ c: 2 }] };
  const merged = mergeXioPairs(snap, xioBody().snapshot);
  assert.equal(merged.pairs["XDX/XRP"].candles, xdx);
  assert.equal(merged.xrpUsd, snap.xrpUsd);
  assert.equal(merged.pairs["XIO/XRP"].candles.length, 120);
  assert.equal(merged.pairs["XIO/XRP"].candles[0].t, FIRST);
  assert.equal(merged.pairs["XDX/XRP"].candles[0].c, 0.00002);
  assert.equal(merged.pairs["XIO/XRP"].candles.some((row) => row.c === 9), false);
});

test("live XIO marks stay on the locked scale", () => {
  assert.deepEqual(
    liveQuotesFromXioPrices({ xio_per_xrp: 25.18, xioUsd: 37.77, xrpUsd: 1.5 }),
    { "XIO/XRP": 25.18, "XIO/RLUSD": 37.77 }
  );
});

test("XIO/XRP 1D and 3D use the locked series, not one live print", () => {
  const locked = mergeXioPairs({ pairs: { "XDX/XRP": { candles: [] } } }, xioBody().snapshot);
  const now = FIRST + 119 * DAY;
  const daily = composePairCandles({
    pair: "XIO/XRP",
    interval: "1D",
    range: "Max",
    locked,
    sparkline: [{ timestamp: new Date(now).toISOString(), price_usd: 0.00004 }],
    trades: [{ timestamp: new Date(now).toISOString(), price: 0.00004, pool: "XIO/XRP", xdx: 3 }],
    livePrice: 0.00004,
    now,
    windowed: false,
  });
  assert.ok(daily.length > 100, `expected multi-day XIO history, got ${daily.length}`);
  assert.equal(daily[0].t, FIRST);
  assert.ok(daily.some((row) => row.source === "inftf-xrpl-dex" || row.c > 10));
  assert.ok(daily.every((row) => row.c > 1), "XDX sparkline must not replace the XIO scale");

  const threeDay = composePairCandles({
    pair: "XIO/XRP",
    interval: "3D",
    range: "Max",
    locked,
    now,
    windowed: false,
  });
  assert.ok(threeDay.length > 20, `expected 3D history, got ${threeDay.length}`);
  assert.ok(threeDay.length < daily.length);
  assert.ok(threeDay[0].t >= FIRST - 3 * DAY);
});

test("missing XIO candles are not backfilled", () => {
  const now = FIRST + 400 * DAY;
  const empty = composePairCandles({
    pair: "XIO/XDX",
    interval: "1D",
    range: "Max",
    locked: { pairs: {} },
    livePrice: null,
    now,
    windowed: false,
  });
  assert.equal(empty.length, 0);
  const liveOnly = composePairCandles({
    pair: "XIO/XDX",
    interval: "1D",
    range: "Max",
    locked: { pairs: {} },
    livePrice: 12,
    now,
    windowed: false,
  });
  assert.equal(liveOnly.length, 1);
  assert.equal(liveOnly[0].source, "live");
  assert.equal(liveOnly[0].t, now);
});

test("chart payload proxies XIO pairs and skips XIO for XDX/XRP", async () => {
  resetXioCandleCache();
  const calls = [];
  const xdx = [{ t: FIRST, o: 1, h: 1, l: 1, c: 1, v: 1, source: "locked" }];
  const locked = { pairs: { "XDX/XRP": { candles: xdx } }, xrpUsd: [] };
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/api/prices")) {
      return jsonResponse({ xio_per_xrp: 25.2, xioUsd: 37.8 });
    }
    return jsonResponse(xioBody());
  };

  const xdxBody = await buildChartCandlesPayload({
    pair: "XDX/XRP",
    locked,
    db: { rows: [1] },
    fetchImpl,
  });
  assert.equal(calls.length, 0);
  assert.equal(xdxBody.snapshot.pairs["XDX/XRP"].candles, xdx);
  assert.equal(xdxBody.db.rows[0], 1);
  assert.equal(xdxBody.xio, undefined);

  const first = await buildChartCandlesPayload({ pair: "XIO/XRP", locked, db: null, fetchImpl });
  assert.ok(first.snapshot.pairs["XIO/XRP"].candles.length > 100);
  assert.equal(first.snapshot.pairs["XDX/XRP"].candles, xdx);
  assert.equal(first.xio.ok, true);
  assert.equal(first.xio.live["XIO/XRP"], 25.2);
  assert.equal(first.xio.live["XIO/RLUSD"], 37.8);
  assert.ok(first.snapshot.pairs["XIO/RLUSD"].candles.length > 100);
  const candleCalls = calls.filter((url) => url.includes("/api/chart/candles")).length;

  const second = await buildChartCandlesPayload({
    pair: "XIO/RLUSD",
    locked,
    db: null,
    fetchImpl,
    now: Date.now(),
  });
  assert.equal(calls.filter((url) => url.includes("/api/chart/candles")).length, candleCalls);
  assert.ok(second.snapshot.pairs["XIO/RLUSD"].candles.length > 100);
  resetXioCandleCache();
});

test("Commander thin XIO context is replaced with the locked series", async () => {
  const summary = {
    pair: "XIO/XRP",
    source: "xio-exchange",
    proxy: "/api/chart/candles?pair=XIO%2FXRP",
    interval: "1D",
    count: 947,
    first_t: FIRST,
    last_t: FIRST + 946 * DAY,
    first_close: 150,
    last_close: 24.2,
    live: 25.1,
    recent: xioCandles(40),
  };
  const thin = await attachXioChartHistory(
    { pair: "XIO/XRP", candles: [{ t: FIRST + 900 * DAY, o: 1, h: 1, l: 1, c: 1 }] },
    "show XIO/XRP",
    { load: async () => summary }
  );
  assert.equal(thin.xioChart.count, 947);
  assert.equal(thin.xioChart.recent.length, 8);
  assert.ok(thin.chartContext.candles.length > 8);
  assert.equal(thin.chartContext.candles[0].t, FIRST);

  const thick = await attachXioChartHistory(
    { pair: "XIO/XRP", candles: xioCandles(12) },
    "",
    { load: async () => summary }
  );
  assert.equal(thick.chartContext.candles.length, 12);

  const xdx = await attachXioChartHistory({ pair: "XDX/XRP", candles: [{ t: 1, c: 1 }] }, "how is XDX/XRP", {
    load: async () => {
      throw new Error("should not load");
    },
  });
  assert.equal(xdx.xioChart, null);
  assert.equal(xdx.chartContext.pair, "XDX/XRP");
});

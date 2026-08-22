import test from "node:test";
import assert from "node:assert/strict";
import {
  ticksToCandles,
  sma,
  ema,
  wma,
  smma,
  vwma,
  movingAverage,
  averagesForWindow,
  candleBodyWidth,
  appendLiveClose,
  resampleCandles,
  fillDailyGaps,
  candlesFromMarketData,
  expandDailyToInterval,
  windowLastBars,
} from "../src/chart/candles.js";
import { bucketTime, DEFAULT_INTERVAL } from "../src/chart/intervals.js";
import { backdateRlusdCandle, quotePerXdx, stitchRlusdCandles } from "../src/chart/pairQuote.js";
import { ammImpact, arbitrageWindow, liquidityPressure, liquidityWalls } from "../src/chart/overlays.js";
import { walletChartMarks } from "../src/chart/walletMarks.js";
import { composePairCandles, lockedSnapshot } from "../src/chart/composeChart.js";
import { formatAxisPrice, formatAxisTime, formatCursorWhen, formatPriceLabel, priceTicks, timeTicks } from "../src/chart/axis.js";
import { rsi, rsiForWindow, volumeWaveValues, wavePath } from "../src/chart/indicators.js";
import {
  drawingHandles,
  fibBands,
  fibExtent,
  fibPrice,
  hitDrawingHandle,
  moveDrawingHandle,
  nextDrawingState,
  previewDrawing,
  raySegment,
  RANGE_DOWN,
  RANGE_UP,
  rangeColor,
  rangeStats,
  snapPoint,
  toolMeta,
} from "../src/chart/drawings.js";

test("bucketTime uses UTC midnight and Monday weeks", () => {
  assert.equal(bucketTime(Date.parse("2021-10-24T13:31:20.000Z"), "1D"), Date.parse("2021-10-24T00:00:00.000Z"));
  assert.equal(bucketTime(Date.parse("2021-10-24T13:31:20.000Z"), "1W"), Date.parse("2021-10-18T00:00:00.000Z"));
  assert.equal(bucketTime(Date.parse("2026-08-22T13:00:00.000Z"), "1M"), Date.parse("2026-08-01T00:00:00.000Z"));
  assert.equal(bucketTime(Date.parse("2026-08-22T13:31:00.000Z"), "1h"), Date.parse("2026-08-22T13:00:00.000Z"));
  assert.equal(DEFAULT_INTERVAL, "12h");
});

test("ticksToCandles builds exact OHLC and continuous opens", () => {
  const day = Date.parse("2021-10-24T00:00:00.000Z");
  const candles = ticksToCandles(
    [
      { t: day + 3600_000, p: 0.00004, v: 10 },
      { t: day + 7200_000, p: 0.00006, v: 5 },
      { t: day + 86_400_000 + 1000, p: 0.00005, v: 2 },
    ],
    "1D",
    { continuous: true }
  );
  assert.equal(candles.length, 2);
  assert.equal(candles[0].o, 0.00004);
  assert.equal(candles[0].h, 0.00006);
  assert.equal(candles[0].l, 0.00004);
  assert.equal(candles[0].c, 0.00006);
  assert.equal(candles[0].v, 15);
  assert.equal(candles[1].o, 0.00006);
  assert.equal(candles[1].c, 0.00005);
});

test("fillDailyGaps carries the previous close so every UTC day has a candle", () => {
  const start = Date.parse("2021-11-10T00:00:00.000Z");
  const filled = fillDailyGaps(
    [
      { t: start, o: 1, h: 1, l: 1, c: 1, v: 3 },
      { t: start + 2 * 86_400_000, o: 2, h: 2, l: 2, c: 2, v: 1 },
    ],
    start,
    start + 2 * 86_400_000
  );
  assert.equal(filled.length, 3);
  assert.equal(filled[1].c, 1);
  assert.equal(filled[1].v, 0);
  assert.equal(filled[1].source, "carry");
  assert.equal(filled[2].c, 2);
});

test("candlesFromMarketData reads InFTF open/high/low/close/volume", () => {
  const rows = candlesFromMarketData([
    {
      timestamp: "2021-11-10T00:00:00.000Z",
      open: 0.001,
      high: 0.002,
      low: 0.0009,
      close: 0.0015,
      base_volume: 3000,
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].o, 0.001);
  assert.equal(rows[0].h, 0.002);
  assert.equal(rows[0].l, 0.0009);
  assert.equal(rows[0].c, 0.0015);
  assert.equal(rows[0].v, 3000);
});

test("sma is the arithmetic mean of the last N closes", () => {
  assert.deepEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
});

test("ema wma smma and vwma cover the moving-average set", () => {
  const ema3 = ema([1, 2, 3, 4], 3);
  assert.equal(ema3[0], null);
  assert.equal(ema3[2], 2);
  assert.ok(Math.abs(ema3[3] - 3) < 1e-12);
  assert.deepEqual(wma([1, 2, 3], 3), [null, null, (1 * 1 + 2 * 2 + 3 * 3) / 6]);
  const smooth = smma([1, 2, 3, 4], 3);
  assert.equal(smooth[2], 2);
  assert.equal(smooth[3], (2 * 2 + 4) / 3);
  assert.deepEqual(vwma([1, 2, 3], [1, 1, 4], 3), [null, null, (1 + 2 + 12) / 6]);
  assert.deepEqual(movingAverage("sma", [1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
});

test("averagesForWindow uses full history so a 200 SMA covers the visible month", () => {
  const series = Array.from({ length: 250 }, (_, index) => ({
    t: index * 86_400_000,
    c: 1 + index / 100,
    v: 10,
  }));
  const visible = series.slice(-30);
  const [sma200] = averagesForWindow({
    series,
    visible,
    type: "sma",
    periods: [200],
  });
  assert.equal(sma200.values.length, 30);
  assert.ok(sma200.values.every((value) => Number.isFinite(value)));
});

test("rsi uses Wilder averages and maps onto the visible window", () => {
  const values = rsi([10, 12, 11, 13], 2);
  assert.equal(values[0], null);
  assert.equal(values[1], null);
  assert.ok(Math.abs(values[2] - 200 / 3) < 1e-12);
  const series = Array.from({ length: 40 }, (_, index) => ({
    t: index * 86_400_000,
    c: 1 + index / 10,
  }));
  const visible = series.slice(-8);
  const windowed = rsiForWindow({ series, visible, period: 14 });
  assert.equal(windowed.length, 8);
  assert.ok(windowed.every((value) => Number.isFinite(value)));
  assert.ok(windowed.every((value) => value > 70));
});

test("volume wave spreads a daily print and stays a curve, not a spike", () => {
  const day = Date.parse("2026-08-21T00:00:00.000Z");
  const hour = 3_600_000;
  const candles = [
    { t: day, o: 1, h: 1.1, l: 0.9, c: 1.05, v: 24 },
    { t: day + hour, o: 1.05, h: 1.05, l: 1.05, c: 1.05, v: 0 },
    { t: day + 2 * hour, o: 1.05, h: 1.05, l: 1.05, c: 1.04, v: 0 },
  ];
  const wave = volumeWaveValues(candles, { smooth: 3 });
  assert.equal(wave.length, 3);
  assert.ok(wave.every((value) => value > 0));
  assert.ok(Math.max(...wave) / Math.min(...wave) < 3);
  const path = wavePath([
    { x: 0, y: 10 },
    { x: 10, y: 4 },
    { x: 20, y: 8 },
  ]);
  assert.match(path, /^M0 10/);
  assert.match(path, /C/);
});

test("candle bodies are a quarter of the previous slot so more bars fit", () => {
  const hour = 3_600_000;
  const bars = Array.from({ length: 40 }, (_, index) => ({ t: index * hour }));
  const innerW = 858;
  const width = candleBodyWidth({
    innerW,
    candles: bars,
    start: bars[0].t,
    end: bars[39].t,
    stepMs: hour,
  });
  const slot = innerW / 39;
  const previous = Math.max(2, Math.min(slot * 0.92, innerW * 0.22));
  assert.ok(Math.abs(width / previous - 0.25) < 0.05, `expected ~25% of ${previous}, got ${width}`);
});

test("expandDailyToInterval builds 1H buckets and windowLastBars keeps the tail", () => {
  const day = Date.parse("2026-08-21T00:00:00.000Z");
  const expanded = expandDailyToInterval(
    [{ t: day, o: 1, h: 2, l: 0.5, c: 1.5, v: 4 }],
    "1h",
    day,
    day + 5 * 3_600_000
  );
  assert.equal(expanded.length, 6);
  assert.equal(expanded[0].h, 2);
  assert.equal(expanded[1].c, 1.5);
  assert.equal(expanded[1].source, "carry");
  assert.equal(windowLastBars(expanded, 2).length, 2);
  assert.equal(windowLastBars(expanded, 2)[0].t, expanded[4].t);
});

test("XDX/RLUSD backdate is XDX/XRP times that day's XRP/USD", () => {
  const candle = { t: Date.parse("2021-10-24T00:00:00.000Z"), o: 0.00002, h: 0.00003, l: 0.00001, c: 0.00002, v: 1 };
  const rlusd = backdateRlusdCandle(candle, 1.1);
  assert.ok(Math.abs(rlusd.c - 0.000022) < 1e-12);
  assert.equal(rlusd.source, "backdated");
  assert.ok(Math.abs(quotePerXdx({ pair: "XDX/RLUSD", xdxXrp: 0.00002, xrpUsd: 1.1 }) - 0.000022) < 1e-12);
  assert.ok(Math.abs(quotePerXdx({ pair: "XDX/XRP", xdxUsd: 0.000044, xrpUsd: 1.1 }) - 0.00004) < 1e-12);
});

test("stitchRlusdCandles prefers native AMM prints after RLUSD exists", () => {
  const t = Date.parse("2025-01-01T00:00:00.000Z");
  const rows = stitchRlusdCandles({
    xrpCandles: [{ t, o: 0.00002, h: 0.00002, l: 0.00002, c: 0.00002, v: 1 }],
    xrpUsd: [{ t, c: 2 }],
    native: [{ t, o: 0.00005, h: 0.00005, l: 0.00005, c: 0.00005, v: 3, source: "native" }],
  });
  assert.equal(rows[0].c, 0.00005);
  assert.equal(rows[0].source, "native");
});

test("arbitrage window is (mid - AMM) / AMM", () => {
  const row = arbitrageWindow(0.00003129, 0.00003459);
  assert.ok(Math.abs(row.pct - 10.5465) < 0.01);
  assert.equal(row.highlight, true);
});

test("AMM buy impact follows constant product", () => {
  const impact = ammImpact({ reserveBase: 1000, reserveQuote: 10, amount: 100, side: "buy" });
  assert.equal(impact.spot, 0.01);
  assert.ok(impact.next > impact.spot);
  assert.equal(ammImpact({ reserveBase: 1000, reserveQuote: 10, amount: 100, side: "addLp" }).impactPct, 0);
});

test("liquidity walls keep levels at least 2x the median size", () => {
  const walls = liquidityWalls({
    bids: [{ price: 1, base_size: 10, side: "bid" }],
    asks: [
      { price: 2, base_size: 10, side: "ask" },
      { price: 3, base_size: 50, side: "ask" },
    ],
  });
  assert.equal(walls.length, 1);
  assert.equal(walls[0].price, 3);
});

test("wallet marks stay empty until an address is signed in", () => {
  const hidden = walletChartMarks({
    address: "",
    orders: [{ price: 1, amount: 2, pair: "XDX/XRP" }],
    fills: [{ account: "rA", timestamp: "2021-10-24T13:31:20.000Z", price: 1, pool: "XDX/XRP" }],
    pair: "XDX/XRP",
  });
  assert.deepEqual(hidden, { orders: [], fills: [] });
  const shown = walletChartMarks({
    address: "rA",
    orders: [{ price: 0.00003, amount: 5, pair: "XDX/XRP", side: "bid" }],
    fills: [{ account: "rA", timestamp: "2021-10-24T13:31:20.000Z", price: 0.00003, pool: "XDX/XRP" }],
    pair: "XDX/XRP",
  });
  assert.equal(shown.orders.length, 1);
  assert.equal(shown.fills.length, 1);
});

test("pressure is down when the AMM holds more XDX than quote", () => {
  assert.equal(liquidityPressure({ xdxPct: 77.6, quotePct: 22.4 }).bias, "down");
  assert.equal(liquidityPressure({ xdxPct: 22.4, quotePct: 77.6 }).bias, "up");
});

test("composePairCandles appends a live close onto locked history", () => {
  const t = Date.parse("2021-10-24T00:00:00.000Z");
  const candles = composePairCandles({
    pair: "XDX/XRP",
    interval: "1D",
    range: "Max",
    locked: {
      pairs: { "XDX/XRP": { candles: [{ t, o: 0.00002, h: 0.00002, l: 0.00002, c: 0.00002, v: 1 }] } },
      xrpUsd: [],
    },
    livePrice: 0.0000313,
    now: Date.parse("2026-08-22T00:00:00.000Z"),
  });
  assert.ok(candles.length >= 2);
  assert.equal(candles[candles.length - 1].c, 0.0000313);
});

test("resampleCandles weekly uses Monday buckets", () => {
  const rows = [
    { t: Date.parse("2021-10-18T00:00:00.000Z"), o: 1, h: 2, l: 1, c: 1.5, v: 1 },
    { t: Date.parse("2021-10-20T00:00:00.000Z"), o: 1.5, h: 3, l: 1.2, c: 2, v: 2 },
  ];
  const week = resampleCandles(rows, "1W");
  assert.equal(week.length, 1);
  assert.equal(week[0].o, 1);
  assert.equal(week[0].h, 3);
  assert.equal(week[0].c, 2);
  assert.equal(week[0].v, 3);
});

test("locked XDX/RLUSD daily history paints one candle per UTC day on 1M", () => {
  const lock = lockedSnapshot();
  const xrp = lock.pairs?.["XDX/XRP"]?.candles || [];
  const rlusd = lock.pairs?.["XDX/RLUSD"]?.candles || [];
  assert.ok(xrp.length > 365, `expected locked XDX/XRP history, got ${xrp.length}`);
  assert.ok(rlusd.length > 365, `expected locked XDX/RLUSD history, got ${rlusd.length}`);
  assert.equal(new Date(xrp[0].t).toISOString().slice(0, 10), "2021-11-10");
  const now = Date.parse("2026-08-22T12:00:00.000Z");
  const month = composePairCandles({
    pair: "XDX/RLUSD",
    interval: "1D",
    range: "1M",
    locked: lock,
    now,
  });
  assert.equal(month.length, 30);
  assert.equal(new Date(month[0].t).toISOString().slice(0, 10), "2026-07-24");
  assert.equal(new Date(month[month.length - 1].t).toISOString().slice(0, 10), "2026-08-22");
  const uniqueDays = new Set(month.map((row) => row.t));
  assert.equal(uniqueDays.size, 30);
});

test("priceTicks and timeTicks fill left and bottom chart scales", () => {
  const prices = priceTicks(0.00001214, 0.00025542, 6);
  assert.ok(prices.length >= 4 && prices.length <= 8);
  assert.ok(prices[0] >= 0.00001214);
  assert.ok(prices[prices.length - 1] <= 0.00025542);
  assert.match(formatAxisPrice(0.00004538), /^0\.000045/);
  assert.equal(formatPriceLabel(0.000034), "0.000034");
  assert.equal(formatPriceLabel(0.00003462), "0.000035");

  const start = Date.parse("2026-07-24T00:00:00.000Z");
  const end = Date.parse("2026-08-22T00:00:00.000Z");
  const stamps = timeTicks(start, end, { count: 6, intervalId: "1D" });
  assert.ok(stamps.length >= 4 && stamps.length <= 10);
  assert.ok(stamps.every((stamp) => stamp >= start && stamp <= end));
  assert.equal(formatAxisTime(start, { spanMs: end - start, intervalId: "1D", locale: "en-GB" }), "24 Jul");
  assert.match(formatCursorWhen(start, "en-GB"), /24 Jul 2026/);
  assert.match(formatCursorWhen(start, "en-GB"), /00:00/);
});

test("drawing tools trail from the first drop to the hover point", () => {
  const start = { t: 100, price: 2 };
  const hover = { t: 400, price: 5 };
  const first = nextDrawingState({ tool: "trend", color: "#ff5d73", pending: null, point: start });
  assert.equal(first.pending.points.length, 1);
  assert.equal(first.drawing, null);
  const ghost = previewDrawing({ tool: "trend", color: "#ff5d73", pending: first.pending, hover });
  assert.equal(ghost.kind, "trend");
  assert.equal(ghost.preview, true);
  assert.equal(ghost.a.t, 100);
  assert.equal(ghost.b.t, 400);
  assert.equal(ghost.color, "#ff5d73");
  const done = nextDrawingState({ tool: "trend", color: "#ff5d73", pending: first.pending, point: hover });
  assert.equal(done.pending, null);
  assert.equal(done.drawing.kind, "trend");
  assert.equal(done.drawing.b.price, 5);
});

test("selected draw color stays on the H-line and ray", () => {
  const hline = nextDrawingState({
    tool: "hline",
    color: "#ff9a3c",
    pending: null,
    point: { t: 10, price: 0.4 },
  });
  assert.equal(hline.drawing.color, "#ff9a3c");
  const start = nextDrawingState({
    tool: "ray",
    color: "#ff9a3c",
    pending: null,
    point: { t: 10, price: 1 },
  });
  const ray = nextDrawingState({
    tool: "ray",
    color: "#ff9a3c",
    pending: start.pending,
    point: { t: 40, price: 2 },
  });
  assert.equal(ray.drawing.kind, "ray");
  assert.equal(ray.drawing.color, "#ff9a3c");
});

test("horizontal line trails under the cursor and drops on one click", () => {
  const ghost = previewDrawing({ tool: "hline", color: "#98f050", pending: null, hover: { t: 10, price: 0.4 } });
  assert.equal(ghost.kind, "hline");
  assert.equal(ghost.price, 0.4);
  const placed = nextDrawingState({ tool: "hline", color: "#98f050", pending: null, point: { t: 10, price: 0.4 } });
  assert.equal(placed.pending, null);
  assert.equal(placed.drawing.kind, "hline");
  assert.equal(placed.drawing.price, 0.4);
  assert.equal(toolMeta("hline").clicks, 1);
});

test("placed drawings keep white handles that can be moved", () => {
  const line = nextDrawingState({
    tool: "trend",
    color: "#3d8bff",
    pending: { tool: "trend", color: "#3d8bff", points: [{ t: 10, price: 1 }] },
    point: { t: 40, price: 2 },
  }).drawing;
  const handles = drawingHandles(line);
  assert.equal(handles.length, 2);
  assert.equal(handles[0].key, "a");
  assert.equal(handles[1].key, "b");
  const moved = moveDrawingHandle(line, "b", { t: 80, price: 3 });
  assert.equal(moved.b.t, 80);
  assert.equal(moved.b.price, 3);
  assert.equal(moved.a.price, 1);
  const vline = nextDrawingState({ tool: "vline", color: "#fff", pending: null, point: { t: 12, price: 0.5 } }).drawing;
  assert.equal(drawingHandles(vline).length, 1);
  const scale = { x: (t) => t, y: (p) => p * 10, min: 0, max: 4 };
  const hit = hitDrawingHandle([line], scale, 40, 20);
  assert.equal(hit.key, "b");
  assert.equal(hitDrawingHandle([line], scale, 400, 200), null);
});

test("fib retracement uses TradingView level colors and click order", () => {
  const a = { t: 1, price: 100 };
  const b = { t: 5, price: 0 };
  assert.equal(fibPrice(a, b, 0), 0);
  assert.equal(fibPrice(a, b, 1), 100);
  assert.equal(fibPrice(a, b, 0.618), 61.8);
  const bands = fibBands(a, b);
  assert.equal(bands[0].color, "#787B86");
  assert.equal(bands.find((row) => row.level === 0.618).color, "#089981");
  assert.equal(bands.find((row) => row.level === 0.236).color, "#F23645");
  assert.equal(bands.find((row) => row.level === 4.236)?.color, "#E040FB");
  assert.ok(bands.some((row) => row.level === 1.618 && row.label === "1.618"));
  assert.equal(bands.find((row) => row.level === 1.618).color, "#F23645");
  assert.ok(Math.abs(fibPrice(a, b, 4.236) - 423.6) < 1e-9);
  const first = nextDrawingState({ tool: "fib", color: "#3d8bff", pending: null, point: a });
  assert.equal(first.drawing, null);
  const ghost = previewDrawing({ tool: "fib", color: "#3d8bff", pending: first.pending, hover: b });
  assert.equal(ghost.kind, "fib");
  assert.equal(ghost.a.price, 100);
  assert.equal(ghost.b.price, 0);
  const span = fibExtent(a, b);
  assert.equal(span.t0, 1);
  assert.equal(span.t1, 5);
  assert.ok(span.t1 - span.t0 < 10);
});

test("snapPoint locks to the nearest candle open high low or close", () => {
  const snapped = snapPoint(
    { t: 150, price: 1.8 },
    [
      { t: 100, o: 1, h: 2, l: 0.5, c: 1.2 },
      { t: 200, o: 3, h: 4, l: 2.5, c: 3.5 },
    ]
  );
  assert.equal(snapped.t, 100);
  assert.equal(snapped.price, 2);
});

test("ray extends past the second point and range stats keep the percent move", () => {
  const [a, b] = raySegment({ t: 10, price: 1 }, { t: 20, price: 2 }, 0, 100);
  assert.equal(a.t, 10);
  assert.equal(b.t, 100);
  assert.equal(b.price, 10);
  const stats = rangeStats({ t: 0, price: 2 }, { t: 5, price: 3 });
  assert.equal(stats.delta, 1);
  assert.equal(stats.pct, 50);
  assert.equal(rangeColor({ t: 0, price: 2 }, { t: 5, price: 3 }), RANGE_UP);
  assert.equal(rangeColor({ t: 0, price: 3 }, { t: 5, price: 2 }), RANGE_DOWN);
  assert.equal(toolMeta("channel").clicks, 3);
});

test("appendLiveClose updates the current UTC day instead of inventing a second candle", () => {
  const t = Date.parse("2026-08-22T00:00:00.000Z");
  const next = appendLiveClose([{ t, o: 1, h: 1, l: 1, c: 1, v: 0 }], 1.5, t + 3600_000, "1D");
  assert.equal(next.length, 1);
  assert.equal(next[0].c, 1.5);
  assert.equal(next[0].h, 1.5);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  driftPlot,
  easeInOutCubic,
  lerp,
  lerpPair,
  resamplePlot,
} from "../src/utils/lineDrift.js";

test("resamplePlot keeps the first and last measurements", () => {
  const rows = [
    { ts: 100, plot: 10 },
    { ts: 200, plot: 20 },
    { ts: 400, plot: 40 },
  ];
  const sampled = resamplePlot(rows, 5);
  assert.equal(sampled.length, 5);
  assert.equal(sampled[0].ts, 100);
  assert.equal(sampled[0].plot, 10);
  assert.equal(sampled[4].ts, 400);
  assert.equal(sampled[4].plot, 40);
});

test("driftPlot morphs from one series into the next", () => {
  const from = [
    { ts: 0, plot: 0 },
    { ts: 10, plot: 0 },
  ];
  const to = [
    { ts: 100, plot: 100 },
    { ts: 200, plot: 200 },
  ];
  const mid = driftPlot(from, to, 0.5);
  const start = driftPlot(from, to, 0);
  const end = driftPlot(from, to, 1);
  assert.equal(start[0].plot, 0);
  assert.equal(end[end.length - 1].plot, 200);
  assert.ok(mid[0].plot > 0);
  assert.ok(mid[0].plot < 100);
  assert.ok(mid[0].ts > 0);
});

test("ease and lerp helpers stay in range", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(easeInOutCubic(0.5) > 0.4 && easeInOutCubic(0.5) < 0.6);
  assert.equal(lerp(10, 20, 0.5), 15);
  assert.deepEqual(lerpPair([0, 10], [10, 20], 0.5), [5, 15]);
});

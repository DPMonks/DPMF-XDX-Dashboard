import test from "node:test";
import assert from "node:assert/strict";
import {
  analysePatternSetups,
  estimateMatchesChartPair,
  scoreMeasuredMovePct,
  timeframeGainExpectation,
} from "../server/commanderChartPredict.js";

test("scoreMeasuredMovePct is percent gain support to resistance", () => {
  assert.ok(Math.abs(scoreMeasuredMovePct("bull", 1, 1.05) - 5) < 1e-9);
  assert.ok(Math.abs(scoreMeasuredMovePct("bear", 0.95, 1) - 5) < 1e-9);
});

test("timeframeGainExpectation scales with horizon", () => {
  assert.ok(timeframeGainExpectation("5m").sweet < timeframeGainExpectation("1H").sweet);
  assert.ok(timeframeGainExpectation("1H").sweet < timeframeGainExpectation("1D").sweet);
});

test("estimateMatchesChartPair keeps XRP estimate off XDX tabs", () => {
  assert.equal(estimateMatchesChartPair({ pair: "XRP/RLUSD" }, { pair: "XDX/RLUSD" }), false);
  assert.equal(estimateMatchesChartPair({ pair: "XRP/RLUSD" }, { pair: "XRP/RLUSD" }), true);
});

test("analysePatternSetups returns trend + next resistance path", () => {
  const candles = [];
  let px = 1;
  for (let i = 0; i < 24; i += 1) {
    const wave = Math.sin(i / 3) * 0.03;
    const c = px + wave;
    candles.push({ t: i * 3600000, o: c, h: c + 0.02, l: c - 0.02, c });
    px += 0.004;
  }
  const setup = analysePatternSetups(
    { pair: "XRP/RLUSD", timeframe: "1H", price: { live: candles.at(-1).c }, candles },
    "bull"
  );
  assert.ok(setup);
  assert.ok(setup.pct > 0);
  assert.equal(setup.horizon, "medium_large");
  assert.ok(setup.support > 0 && setup.resistance > setup.support);
});

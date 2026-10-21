import test from "node:test";
import assert from "node:assert/strict";
import { priceHistorySql, ammHistorySql, lpHoldersSeriesSql, rollupReadsEnabled, oldestFirst } from "../server/rollupReads.js";

test("rollup reads off by default", () => {
  assert.equal(rollupReadsEnabled({}), false);
  assert.equal(rollupReadsEnabled({ ROLLUP_READS: "1" }), true);
});

test("price and amm read newest 20000 across raw + hourly", () => {
  for (const sql of [priceHistorySql("asset"), ammHistorySql()]) {
    assert.match(sql, /ORDER BY timestamp DESC\s+LIMIT 20000/);
    assert.match(sql, /UNION ALL/);
  }
  assert.match(lpHoldersSeriesSql(), /lp_holders_daily/);
  assert.deepEqual(oldestFirst([3, 2, 1]), [1, 2, 3]);
});

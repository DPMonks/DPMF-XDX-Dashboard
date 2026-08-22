import test from "node:test";
import assert from "node:assert/strict";
import {
  dailyLastPoints,
  downsampleSeries,
  mergeActivityRows,
  rowsFromXrplToGraph,
} from "../src/activityHistory.js";
import { XDX_ISSUED_AT } from "../src/constants/ledger.js";

test("rowsFromXrplToGraph keeps issuance-to-now holder and trustline counts", () => {
  const rows = rowsFromXrplToGraph({
    history: [
      { time: Date.parse(XDX_ISSUED_AT), holders: 0, length: 1121 },
      { time: Date.parse("2021-10-29T15:01:30Z"), holders: 1, length: 4181 },
      { time: Date.parse("2026-08-22T08:07:07Z"), holders: 15945, length: 19977 },
    ],
  });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].trustlines, 1121);
  assert.equal(rows[0].holders, null);
  assert.equal(rows[1].holders, 1);
  assert.equal(rows[2].holders, 15945);
  assert.ok(new Date(rows[0].timestamp) >= new Date("2021-10-24"));
});

test("mergeActivityRows lets SQL overwrite the same timestamp", () => {
  const merged = mergeActivityRows(
    [{ timestamp: "2026-08-22T00:00:00.000Z", holders: 15940, trustlines: 19970 }],
    [{ timestamp: "2026-08-22T00:00:00.000Z", holders: 15944, trustlines: 19980 }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].holders, 15944);
  assert.equal(merged[0].trustlines, 19980);
});

test("downsampleSeries keeps first and last points", () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ i }));
  const slim = downsampleSeries(rows, 40);
  assert.ok(slim.length <= 41);
  assert.equal(slim[0], rows[0]);
  assert.equal(slim[slim.length - 1], rows[999]);
});

test("dailyLastPoints keeps one row per UTC day", () => {
  const daily = dailyLastPoints([
    { timestamp: "2026-08-21T01:00:00.000Z", holders: 1 },
    { timestamp: "2026-08-21T23:00:00.000Z", holders: 2 },
    { timestamp: "2026-08-22T08:00:00.000Z", holders: 3 },
  ]);
  assert.equal(daily.length, 2);
  assert.equal(daily[0].holders, 2);
  assert.equal(daily[1].holders, 3);
});

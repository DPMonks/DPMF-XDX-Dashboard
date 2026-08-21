import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTodayLpOwnersPayload,
  normalizeLpPool,
  pickAllPoolCount,
  pickTodayLpSource,
  remapLpSourceKind,
} from "../src/todayLpOwners.js";

test("normalizeLpPool keeps every XDX/{QUOTE} name and treats all as no filter", () => {
  assert.equal(normalizeLpPool("XDX/XRP"), "XDX/XRP");
  assert.equal(normalizeLpPool("xdx-rlusd"), "XDX/RLUSD");
  assert.equal(normalizeLpPool("SOLO"), "XDX/SOLO");
  assert.equal(normalizeLpPool("XDX/USD"), "XDX/USD");
  assert.equal(normalizeLpPool("all"), null);
  assert.equal(normalizeLpPool("*"), null);
});

test("pickTodayLpSource remaps token source kinds onto LP tables", () => {
  const now = new Date("2026-08-21T22:15:00.000Z");
  const today = pickTodayLpSource({
    latestTs: "2026-08-21T22:15:00.000Z",
    latestCount: 80,
    now,
  });
  assert.equal(today.kind, "lp_holders_latest");
  assert.equal(today.present, true);
  assert.equal(today.count, 80);
  assert.equal(remapLpSourceKind("token_holders_history"), "lp_holders_history");

  const missing = pickTodayLpSource({
    latestTs: "2026-08-20T23:59:00.000Z",
    latestCount: 12,
    historyTs: "2026-08-20T23:59:00.000Z",
    historyCount: 12,
    now,
  });
  assert.equal(missing.present, false);
  assert.equal(missing.kind, "none");
});

test("buildTodayLpOwnersPayload matches the today-LP envelope", () => {
  const empty = buildTodayLpOwnersPayload({
    source: { kind: "none", ts: "2026-08-20T12:00:00.000Z", count: 0, present: false },
    pool: "XDX/XRP",
  });
  assert.deepEqual(empty, {
    holders: [],
    as_of: "2026-08-20T12:00:00.000Z",
    snapshot_day: "2026-08-20",
    present: false,
    catching_up: true,
    count: 0,
    source: "none",
    pool: "XDX/XRP",
  });

  const present = buildTodayLpOwnersPayload({
    source: {
      kind: "lp_holders_latest",
      ts: "2026-08-21T22:15:00.000Z",
      count: 2,
      present: true,
    },
    holders: [
      { account: "rOne", lp_balance: 12.5, frozen: false, pool_name: "XDX/XRP" },
      { account: "rTwo", balance: 1, frozen: true, pool_name: "XDX/SOLO" },
    ],
    pool: "all",
  });
  assert.equal(present.present, true);
  assert.equal(present.catching_up, false);
  assert.equal(present.holders[0].lp_balance, 12.5);
  assert.equal(present.holders[0].balance, 12.5);
  assert.equal(present.holders[0].pool_name, "XDX/XRP");
  assert.equal(present.holders[1].lp_balance, 1);
  assert.equal(present.holders[1].pool_name, "XDX/SOLO");
  assert.equal(present.pool, "all");
});

test("pickAllPoolCount uses every pool, not one leftover scan", () => {
  assert.equal(pickAllPoolCount(1, 84), 84);
  assert.equal(pickAllPoolCount(120, 80), 120);
  assert.equal(pickAllPoolCount(0, 0), 0);
});

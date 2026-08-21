import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTodayOwnersPayload,
  isSameUtcDay,
  pickTodayOwnerSource,
  utcDay,
  wantsTodaySnapshot,
} from "../src/todayOwners.js";

test("wantsTodaySnapshot matches indexer PR #5 query strings", () => {
  assert.equal(wantsTodaySnapshot({ snapshot: "today" }), true);
  assert.equal(wantsTodaySnapshot({ snapshot: "1" }), true);
  assert.equal(wantsTodaySnapshot({ as_of: "true" }), true);
  assert.equal(wantsTodaySnapshot({ snapshot: "yesterday" }), false);
  assert.equal(wantsTodaySnapshot(new URLSearchParams("snapshot=today")), true);
});

test("pickTodayOwnerSource requires a same-UTC-day timestamp", () => {
  const now = new Date("2026-08-21T20:15:00.000Z");
  const today = pickTodayOwnerSource({
    latestTs: "2026-08-21T20:15:00.000Z",
    latestCount: 235,
    now,
  });
  assert.equal(today.kind, "token_holders_latest");
  assert.equal(today.present, true);
  assert.equal(today.count, 235);

  const missingTs = pickTodayOwnerSource({
    latestCount: 235,
    latestTs: null,
    now,
  });
  assert.equal(missingTs.kind, "none");
  assert.equal(missingTs.present, false);

  const yesterday = pickTodayOwnerSource({
    latestTs: "2026-08-20T23:59:00.000Z",
    latestCount: 200,
    historyTs: "2026-08-20T23:59:00.000Z",
    historyCount: 200,
    now,
  });
  assert.equal(yesterday.kind, "none");
  assert.equal(yesterday.present, false);
  assert.equal(isSameUtcDay("2026-08-20T23:59:00.000Z", utcDay(now)), false);
});

test("buildTodayOwnersPayload matches indexer catching_up shape", () => {
  const empty = buildTodayOwnersPayload({
    source: { kind: "none", ts: "2026-08-20T12:00:00.000Z", count: 0, present: false },
  });
  assert.deepEqual(empty, {
    holders: [],
    as_of: "2026-08-20T12:00:00.000Z",
    snapshot_day: "2026-08-20",
    present: false,
    catching_up: true,
    count: 0,
    source: "none",
  });

  const present = buildTodayOwnersPayload({
    source: {
      kind: "token_holders_latest",
      ts: "2026-08-21T20:15:00.000Z",
      count: 2,
      present: true,
    },
    holders: [
      { account: "rOne", balance: 10, frozen: true },
      { account: "rTwo", balance: 1, frozen: false },
    ],
  });
  assert.equal(present.present, true);
  assert.equal(present.catching_up, false);
  assert.equal(present.holders[0].frozen, true);
  assert.equal(present.holders[0].rank, 1);
  assert.equal(present.count, 2);
});

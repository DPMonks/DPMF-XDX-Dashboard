import test from "node:test";
import assert from "node:assert/strict";
import { cacheTtlMs } from "../src/api/cacheTtl.js";
import {
  mergeOwnerPage,
  shouldSkipOwnerRestPages,
} from "../src/utils/pagination.js";
import {
  COUNT_REUSE_MS,
  MARKET_REUSE_MS,
  freshMarket,
  freshTokenCounts,
  rememberMarket,
  rememberTokenCounts,
  resetMarketReuse,
  shouldReuseCached,
} from "../src/api/marketReuse.js";
import { indexerCacheControl } from "../server/indexerCacheControl.js";
import { isDocumentHidden, startVisiblePoll } from "../src/utils/visiblePoll.js";

test("heavy catalog paths stay in the client cache longer than live books", () => {
  assert.equal(cacheTtlMs("/api/charts/holders"), 60_000);
  assert.equal(cacheTtlMs("/api/top-holders?snapshot=today"), 60_000);
  assert.equal(cacheTtlMs("/api/holders/count?snapshot=today"), 60_000);
  assert.equal(cacheTtlMs("/api/overview"), 45_000);
  assert.equal(cacheTtlMs("/api/xdx-flows"), 45_000);
  assert.equal(cacheTtlMs("/health"), 45_000);
  assert.equal(cacheTtlMs("/api/lp-pools"), 15_000);
  assert.equal(cacheTtlMs("/api/orderbooks"), 15_000);
  assert.equal(cacheTtlMs("/api/prices"), 15_000);
});

test("Vercel edge cache is longer for charts than live AMM books", () => {
  assert.match(indexerCacheControl("charts/holders"), /s-maxage=60/);
  assert.match(indexerCacheControl("top-holders"), /s-maxage=60/);
  assert.match(indexerCacheControl("overview"), /s-maxage=45/);
  assert.match(indexerCacheControl("lp-pools"), /s-maxage=15/);
  assert.match(indexerCacheControl("orderbooks"), /s-maxage=15/);
  assert.match(indexerCacheControl("wallet/balances/rABC"), /s-maxage=10/);
  assert.match(indexerCacheControl("lp-pools/live"), /s-maxage=10/);
});

test("owner list refresh keeps extra pages after the first page is already loaded", () => {
  assert.equal(shouldSkipOwnerRestPages(0, 100), false);
  assert.equal(shouldSkipOwnerRestPages(100, 100), false);
  assert.equal(shouldSkipOwnerRestPages(250, 100), true);
  const merged = mergeOwnerPage(
    [
      { account: "rOld", balance: 1 },
      { account: "rKeep", balance: 2 },
    ],
    [{ account: "rNew", balance: 9 }]
  );
  assert.deepEqual(
    merged.map((row) => row.account),
    ["rNew", "rOld", "rKeep"]
  );
  const updated = mergeOwnerPage(
    [
      { account: "rTop", balance: 1 },
      { account: "rKeep", balance: 2 },
    ],
    [{ account: "rTop", balance: 8 }]
  );
  assert.equal(updated.length, 2);
  assert.equal(updated[0].balance, 8);
});

test("signed-in wallet reuses fresh market payloads instead of refetching them", () => {
  resetMarketReuse();
  const now = 1_000_000;
  assert.equal(shouldReuseCached(now - 10_000, now, MARKET_REUSE_MS), true);
  assert.equal(shouldReuseCached(now - 50_000, now, MARKET_REUSE_MS), false);
  rememberMarket({ prices: { xdxUsd: 1 }, pools: [{ pool: "XDX/XRP" }] }, now);
  assert.equal(freshMarket("prices", now)?.xdxUsd, 1);
  assert.equal(freshMarket("pools", now)?.[0].pool, "XDX/XRP");
  assert.equal(freshMarket("prices", now + MARKET_REUSE_MS + 1), null);
  rememberTokenCounts({ holders: { count: 12 } }, now);
  assert.equal(freshTokenCounts(now)?.holders.count, 12);
  assert.equal(freshTokenCounts(now + COUNT_REUSE_MS + 1), null);
  resetMarketReuse();
});

test("background tabs do not keep polling", () => {
  const listeners = new Map();
  const doc = {
    visibilityState: "visible",
    addEventListener(name, fn) {
      listeners.set(name, fn);
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
  };
  let ticks = 0;
  const timers = [];
  const stop = startVisiblePoll(() => {
    ticks += 1;
  }, 30_000, {
    documentObject: doc,
    setIntervalFn: (fn) => {
      timers.push(fn);
      return 1;
    },
    clearIntervalFn: () => {},
  });
  assert.equal(isDocumentHidden(doc), false);
  timers[0]();
  assert.equal(ticks, 1);
  doc.visibilityState = "hidden";
  timers[0]();
  assert.equal(ticks, 1);
  doc.visibilityState = "visible";
  listeners.get("visibilitychange")();
  assert.equal(ticks, 2);
  stop();
  assert.equal(listeners.size, 0);
});

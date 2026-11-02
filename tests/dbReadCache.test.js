import test from "node:test";
import assert from "node:assert/strict";
import { cachedDbRead, clearDbReadCache, isCacheableRead } from "../server/dbReadCache.js";

test("repeat public reads within TTL hit memory once", async () => {
  clearDbReadCache();
  let calls = 0; let t = 0;
  const load = async () => { calls++; return { status: 200, body: "x" }; };
  await cachedDbRead("overview", "", load, () => t);
  t = 10_000; await cachedDbRead("overview", "", load, () => t);
  assert.equal(calls, 1);
  t = 40_000; await cachedDbRead("overview", "", load, () => t);
  assert.equal(calls, 2);
});

test("concurrent misses share one query", async () => {
  clearDbReadCache();
  let calls = 0;
  const load = () => new Promise((r) => setTimeout(() => { calls++; r({ status: 200 }); }, 10));
  await Promise.all([cachedDbRead("prices", "", load), cachedDbRead("prices", "", load)]);
  assert.equal(calls, 1);
});

test("errors, wallet, quote and fresh reads are never cached", async () => {
  clearDbReadCache();
  let calls = 0;
  const bad = async () => { calls++; return { status: 502 }; };
  await cachedDbRead("overview", "", bad); await cachedDbRead("overview", "", bad);
  assert.equal(calls, 2);
  assert.equal(isCacheableRead("wallet/rABC/lines"), false);
  assert.equal(isCacheableRead("swap-market"), false);
  assert.equal(isCacheableRead("overview", "?fresh=1"), false);
  assert.equal(isCacheableRead("top-holders"), true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { cacheControlFor, isWalletSuffix } from "../server/cachePolicy.js";
import { dbRowsWinWhenFilled, overlayDbResultWithLive } from "../server/catalogSwitch.js";
import { dataAgeMs, formatDataAge, generatedAtFromHeaders, staleDataLabel } from "../src/dataAge.js";

test("public market data is served stale from the edge while it refreshes", () => {
  for (const path of ["overview", "token-details", "prices", "lp-pools", "orderbooks"]) {
    const value = cacheControlFor(path);
    assert.match(value, /s-maxage=30/);
    assert.match(value, /stale-while-revalidate=86400/);
  }
  assert.match(cacheControlFor("charts/lp-trustlines", { search: "?pool=all" }), /s-maxage=120/);
  assert.match(cacheControlFor("top-holders"), /stale-while-revalidate=86400/);
});

test("wallet reads stay short lived and fresh reads or errors are never cached", () => {
  assert.equal(isWalletSuffix("wallet/balances/rX"), true);
  assert.equal(isWalletSuffix("balances/rX"), true);
  assert.match(cacheControlFor("wallet/balances/rX"), /s-maxage=10, stale-while-revalidate=60/);
  assert.equal(cacheControlFor("wallet/offers/rX", { search: "?fresh=1" }), "private, no-store");
  assert.equal(cacheControlFor("overview", { status: 502 }), "no-store");
  assert.equal(cacheControlFor("overview", { status: 404 }), "no-store");
  assert.equal(cacheControlFor("handshake", { method: "POST" }), "no-store");
  assert.match(cacheControlFor("swap-market"), /s-maxage=5/);
});

test("db-first paths skip the live read when stored rows are filled", async () => {
  assert.equal(dbRowsWinWhenFilled("top-holders"), true);
  assert.equal(dbRowsWinWhenFilled("charts/holders"), true);
  assert.equal(dbRowsWinWhenFilled("charts/candles"), false);
  assert.equal(dbRowsWinWhenFilled("overview"), false);
  let calls = 0;
  const loadLive = async () => {
    calls += 1;
    return [{ account: "rLive", balance: 1 }];
  };
  const rows = [{ account: "rDb", balance: 5 }];
  const out = await overlayDbResultWithLive(
    "top-holders",
    { status: 200, body: JSON.stringify(rows), contentType: "application/json" },
    loadLive
  );
  assert.equal(calls, 0);
  assert.deepEqual(JSON.parse(out.body), rows);
  await overlayDbResultWithLive(
    "top-holders",
    { status: 200, body: "[]", contentType: "application/json" },
    loadLive
  );
  assert.equal(calls, 1);
});

test("the page reads the server build time and labels old copies", () => {
  const headers = new Headers({ "x-dpmf-generated-at": "2026-10-11T08:00:00.000Z" });
  const at = generatedAtFromHeaders(headers);
  assert.equal(at, Date.parse("2026-10-11T08:00:00.000Z"));
  assert.equal(generatedAtFromHeaders(new Headers()), null);
  assert.equal(dataAgeMs(at, at + 5 * 60_000), 5 * 60_000);
  assert.equal(formatDataAge(30_000), "under a minute");
  assert.equal(formatDataAge(5 * 60_000), "5 min");
  assert.equal(formatDataAge(3 * 3_600_000), "3 hours");
  assert.equal(staleDataLabel(60_000, "Saved {age} ago"), null);
  assert.equal(staleDataLabel(10 * 60_000, "Saved {age} ago"), "Saved 10 min ago");
  assert.doesNotMatch(staleDataLabel(10 * 60_000), /[\u2013\u2014]/);
});

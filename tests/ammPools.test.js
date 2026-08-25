import test from "node:test";
import assert from "node:assert/strict";
import { filterAmmPools, mergeAmmPoolLists, searchAmmAccount, searchPairHint } from "../src/ammPools.js";
import { knownLivePoolSpecs } from "../server/liveCatalog.js";

test("AMM pool search matches XDX / quote, pair, or AMM account", () => {
  const pools = [
    { pool: "XDX/XRP", quote: "XRP", amm_account: "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB" },
    { pool: "XDX/RLUSD", quote: "RLUSD", amm_account: "rLbBzF9oxntVf4XxcyakNKJTci4yqSmQUu" },
    { pool: "XDX/PLX", quote: "PLX", amm_account: "rPlxPool" },
  ];
  assert.deepEqual(
    filterAmmPools(pools, "rlusd").map((row) => row.pool),
    ["XDX/RLUSD"]
  );
  assert.deepEqual(
    filterAmmPools(pools, "XDX / plx").map((row) => row.pool),
    ["XDX/PLX"]
  );
  assert.deepEqual(
    filterAmmPools(pools, "rhEwhut").map((row) => row.pool),
    ["XDX/XRP"]
  );
  assert.equal(filterAmmPools(pools, "").length, 3);
});

test("searchPairHint turns a quote ticker into an XDX pair", () => {
  assert.equal(searchPairHint("usdc"), "XDX/USDC");
  assert.equal(searchPairHint("xdx / xio"), "XDX/XIO");
  assert.equal(searchPairHint("rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB"), "");
  assert.equal(searchAmmAccount("rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB"), "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB");
});

test("mergeAmmPoolLists keeps a newly found live pool beside the catalog", () => {
  const merged = mergeAmmPoolLists(
    [{ pool: "XDX/XRP", amm_account: "rXrp" }],
    [{ pool: "XDX/USDC", amm_account: "rUsdc" }],
    [{ pool: "XDX/XRP", amm_account: "rXrp" }]
  );
  assert.deepEqual(
    merged.map((row) => row.pool),
    ["XDX/XRP", "XDX/USDC"]
  );
});

test("known live pool specs include featured XDX quotes, not only XRP and RLUSD", () => {
  const pairs = knownLivePoolSpecs().map((row) => row.pair);
  assert.ok(pairs.includes("XDX/XRP"));
  assert.ok(pairs.includes("XDX/RLUSD"));
  assert.ok(pairs.includes("XDX/XIO"));
  assert.ok(pairs.includes("XDX/XSQUAD"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FARM = "rNf1vw3aTxAHJmFBRX2L7PLN8E38WoMme9";
const CREATE = "rLYKyx5ozLUMTVn3JZJhNv5wimSqfT7Y7S";

test("getAmm renders the ledger-checked catalog and does not merge xrpl.to", () => {
  const src = readFileSync(new URL("../src/api/indexer.js", import.meta.url), "utf8");
  const start = src.indexOf("export async function getAmm()");
  const end = src.indexOf("export async function discoverLiveAmmPool");
  assert.ok(start > 0 && end > start);
  const fn = src.slice(start, end);
  assert.equal(/mergeDiscoveredXdxPools|clientDiscoveredXdxPools|xrplToXdxAmmListUrl|poolsFromXrplToAmm/.test(fn), false);
  assert.match(fn, /deletedAmmAccounts\(body\)/);
  assert.match(fn, /asArray\(body\)/);
  assert.equal(src.includes("function clientDiscoveredXdxPools"), false);
  assert.equal(src.includes("from \"../utils/xrplToAmm\""), false);
});

test("deleted_amms accounts are named so a stale row cannot stay on the card", () => {
  const src = readFileSync(new URL("../src/api/indexer.js", import.meta.url), "utf8");
  assert.match(src, /function deletedAmmAccounts\(body\)/);
  assert.match(src, /body\?\.deleted_amms/);
  assert.equal(src.includes(FARM), false);
  assert.equal(src.includes(CREATE), false);
});

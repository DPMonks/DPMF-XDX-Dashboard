import test from "node:test";
import assert from "node:assert/strict";
import { SITE_JUMP_IDS, pageTravelPercent, readJumpHash, sectionAtLockLine, siteJumpItems } from "../src/siteJump.js";

test("site jump catalog covers the eleven decks", () => {
  assert.equal(SITE_JUMP_IDS.length, 11);
  assert.deepEqual(
    siteJumpItems({}).map((row) => row.id),
    SITE_JUMP_IDS
  );
  assert.equal(readJumpHash("#swap"), "swap");
  assert.equal(readJumpHash("#missing"), "");
  assert.equal(readJumpHash(""), "");
});

test("travel percent and lock line follow the page", () => {
  assert.equal(pageTravelPercent(50, 200), 25);
  assert.equal(pageTravelPercent(0, 0), 0);
  const lookup = (id) => ({
    getBoundingClientRect: () => ({ top: id === "swap" ? -4 : id === "wallet" ? -80 : 120 }),
  });
  assert.equal(sectionAtLockLine(["wallet", "swap", "pools"], 72, lookup), "swap");
});

import test from "node:test";
import assert from "node:assert/strict";
import { SITE_JUMP_IDS, jumpLockOffset, pageTravelPercent, readJumpHash, sectionAtLockLine, siteJumpItems, trailChromeOffset } from "../src/siteJump.js";

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
  assert.equal(jumpLockOffset({ barH: 52, safeTop: 12, gap: 4 }), 68);
  assert.equal(trailChromeOffset({ headerH: 80, barH: 52, padTop: 8 }), 60);
  const lookup = (id) => ({
    getBoundingClientRect: () => ({ top: id === "swap" ? -4 : id === "wallet" ? -80 : 120 }),
  });
  assert.equal(sectionAtLockLine(["wallet", "swap", "pools"], 72, lookup), "swap");
});

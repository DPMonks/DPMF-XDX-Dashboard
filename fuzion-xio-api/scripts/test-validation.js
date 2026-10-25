import assert from "node:assert/strict";
import { DEMO_BIDDER, DEMO_ISSUER, DEMO_OWNER, demoSeed } from "../lib/seed.js";
import { vScoreBadge, xioRank } from "../lib/governance.js";
import {
  addressValidation,
  applyValidation,
  nftValidation,
  V_SCORE_BLUE,
  V_SCORE_GOLD
} from "../lib/validation.js";

assert.equal(V_SCORE_BLUE, 100);
assert.equal(V_SCORE_GOLD, 10000);
assert.equal(vScoreBadge(99.99), "tick");
assert.equal(vScoreBadge(100), "blue");
assert.equal(vScoreBadge(9999.99), "blue");
assert.equal(vScoreBadge(10000), "gold");
assert.equal(xioRank(0.0001), "New Validator");
assert.equal(xioRank(100), "Master Validator");

const store = demoSeed();
const issuer = addressValidation(store, DEMO_ISSUER);
assert.equal(issuer.badge, "gold");
assert.equal(issuer.rank, "Master Validator");
assert.ok(issuer.vScore >= 10000);

const owner = addressValidation(store, DEMO_OWNER);
assert.equal(owner.badge, "blue");
assert.ok(owner.vScore >= 100 && owner.vScore < 10000);

const lilly = store.nfts.find((nft) => nft._id === "seed-lilly-1");
const lillyVal = nftValidation(store, lilly);
assert.equal(lillyVal.issuer, DEMO_ISSUER);
assert.equal(lillyVal.issuerBadge, "gold");
assert.equal(lillyVal.badge, "gold");

const hero = store.nfts.find((nft) => nft._id === "seed-fuzion-3d-hero");
const heroVal = nftValidation(store, hero);
assert.equal(heroVal.linked, DEMO_OWNER);
assert.equal(heroVal.linkedBadge, "blue");
assert.equal(heroVal.badge, "gold");

const self = applyValidation(store, {
  from: DEMO_OWNER,
  to: DEMO_OWNER,
  currency: "XRP",
  amount: "1"
});
assert.equal(self.ok, false);

const paid = applyValidation(store, {
  from: DEMO_BIDDER,
  to: DEMO_OWNER,
  currency: "XRP",
  amount: "5"
});
assert.equal(paid.ok, true);
assert.equal(paid.target.vScore, 125);
assert.equal(paid.target.badge, "blue");
assert.equal(paid.validator.rank, "New Validator");
assert.ok(store.validations.length >= 1);

const goldHit = applyValidation(store, {
  from: DEMO_BIDDER,
  to: DEMO_OWNER,
  currency: "XIO",
  amount: "9880"
});
assert.equal(goldHit.target.badge, "gold");
assert.ok(goldHit.target.vScore >= 10000);
assert.equal(nftValidation(store, hero).linkedBadge, "gold");

console.log(
  `validation ok: issuer=${issuer.badge} owner=${goldHit.target.badge} nft=${nftValidation(store, lilly).badge}`
);

import assert from "node:assert/strict";
import { browseCollection } from "../lib/market.js";
import { DEMO_BIDDER, DEMO_OWNER, demoSeed } from "../lib/seed.js";
import {
  allowlistOk,
  batchList,
  collectionAnalytics,
  collectionVerification,
  discover,
  feeQuote,
  fileIntegrity,
  homeRails,
  rarityForNft,
  reportItem,
  voteProposal
} from "../lib/v2.js";
import { findTemplate, resolveNft } from "../lib/collections.js";

const store = demoSeed();

const hits = discover(store, { q: "Lilly", chain: "xrpl" });
assert.ok(hits.nfts.some((nft) => nft._id === "seed-lilly-1"));
assert.deepEqual(hits.filters.chain, ["xrpl"]);

const rails = homeRails(store);
assert.ok(rails.trending.some((row) => row.slug === "fuzion-3d" && row.verified));
assert.ok(rails.newDrops.some((row) => row.slug === "fuzion-3d-horizon"));
assert.ok(rails.editorPicks.some((row) => row._id === "seed-lilly-1"));

const template = findTemplate(store, "fuzion-3d");
const verification = collectionVerification(store, template);
assert.equal(verification.verified, true);
const fake = collectionVerification(store, {
  ...template,
  slug: "fuzion-3dd",
  collectionName: "FUZION 3DD",
  verified: false
});
assert.equal(fake.status, "suspicious");

const analytics = collectionAnalytics(store, template);
assert.ok(analytics.floorHistory.points.length > 2);
assert.ok(analytics.floorsByCurrency.XIO > 0);
assert.ok(Array.isArray(analytics.topHolders));

const ranked = browseCollection(store, "fuzion-3d", { sort: "rarity", size: 8 });
assert.ok(ranked.docs[0].rarityRank >= 1);
assert.ok(ranked.docs.every((nft) => nft.rarityRank));

const virtual = resolveNft(store, "col:fuzion-3d:2");
assert.ok(virtual);
const rarity = rarityForNft(store, virtual);
assert.ok(rarity.rank >= 1);
assert.ok(rarity.traits.length > 0);

const deny = allowlistOk(store, {
  collectionName: "FUZION 3D",
  address: DEMO_BIDDER
});
assert.equal(deny.ok, false);
const allow = allowlistOk(store, {
  collectionName: "FUZION 3D",
  address: DEMO_OWNER
});
assert.equal(allow.ok, true);

const quote = feeQuote(store.nfts.find((nft) => nft._id === "seed-lilly-1"));
assert.equal(quote.marketplace.amount, 0.012);
assert.equal(quote.royalty.amount, 0.6);
assert.equal(quote.sellerNet, 11.388);
assert.match(quote.network.note, /XRPL/);

const integrity = fileIntegrity(store, store.nfts.find((nft) => nft._id === "seed-lilly-1"));
assert.equal(integrity.match, true);
assert.equal(integrity.badge, "Verified file");

const vote = voteProposal(store, {
  proposalId: "gov-fee-split",
  address: DEMO_OWNER,
  support: true,
  weight: 12.4
});
assert.equal(vote.ok, true);
assert.equal(vote.proposal.yes, 140.9);

const listed = batchList(store, {
  ids: ["seed-signal-4"],
  amount: "4",
  currency: "XRP",
  seller: DEMO_OWNER
});
assert.equal(listed.ok, true);
assert.equal(listed.count, 1);

const report = reportItem(store, {
  targetType: "nft",
  targetId: "seed-lilly-1",
  reason: "spam",
  from: DEMO_BIDDER
});
assert.equal(report.ok, true);
assert.equal(store.reports[0].status, "open");

console.log("v2 marketplace ok: discover, rarity, allowlist, quote, vote, batch, report");

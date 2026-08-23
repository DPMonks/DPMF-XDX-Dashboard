import assert from "node:assert/strict";
import { demoSeed, DEMO_BIDDER, DEMO_OWNER } from "../lib/seed.js";
import { feeAmount, feePolicy, PLATFORM_FEE_BPS, splitTrade } from "../lib/fees.js";
import { xioRank } from "../lib/governance.js";
import { buyNow, placeOffer } from "../lib/market.js";
import { ensureTrustline, ensureTrustlines } from "../lib/wallet.js";

assert.equal(PLATFORM_FEE_BPS, 10);
assert.equal(feePolicy().percent, 0.1);
assert.equal(feePolicy().pendingAddress, true);
assert.equal(feeAmount(100), 0.1);
assert.equal(splitTrade(12).fee, 0.012);
assert.equal(splitTrade(12).net, 11.988);

assert.equal(xioRank(0), "Unranked");
assert.equal(xioRank(0.0001), "New Validator");
assert.equal(xioRank(0.001), "Beginner Validator");
assert.equal(xioRank(100), "Master Validator");

const store = demoSeed();
const skip = ensureTrustline(store, {
  address: DEMO_BIDDER,
  currency: "XRP"
});
assert.equal(skip.skipped, true);

const xio = ensureTrustline(store, {
  address: DEMO_BIDDER,
  currency: "XIO",
  issuer: "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU"
});
assert.equal(xio.created, true);
assert.equal(xio.line.status, "downloaded");
assert.equal(xio.line.trustSet.TransactionType, "TrustSet");

const again = ensureTrustlines(store, {
  address: DEMO_BIDDER,
  assets: [{ currency: "XIO", issuer: "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU" }]
});
assert.equal(again.downloaded.length, 0);
assert.equal(again.existing.length, 1);

const sale = buyNow(store, { nftId: "seed-lilly-1", buyer: DEMO_BIDDER });
assert.equal(sale.ok, true);
assert.equal(sale.fee.bps, 10);
assert.equal(sale.fee.fee, 0.012);
assert.ok(store.fees.some((row) => row.nftId === "seed-lilly-1" && row.fee === 0.012 && row.signed === false));
assert.equal(sale.activity.signed, false);
assert.equal(sale.activity.marker, "FUZION-XIO");

const offer = placeOffer(store, {
  nftId: "seed-orbit-3",
  from: DEMO_OWNER,
  assets: [
    { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo", amount: "4" }
  ]
});
assert.equal(offer.ok, true);
const ownerWallet = store.wallets.find((row) => row.address === DEMO_OWNER);
assert.ok(ownerWallet.trustlines.some((line) => line.currency === "XDX"));

console.log(
  `fees + trustlines ok: fee=${sale.fee.fee} lines=${store.wallets[0].trustlines.length}`
);

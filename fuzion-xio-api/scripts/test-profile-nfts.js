import assert from "node:assert/strict";
import { demoSeed, DEMO_OWNER, DEMO_ISSUER, DEMO_BIDDER } from "../lib/seed.js";
import {
  addPin,
  deskKey,
  pinsForNft,
  profileNftDesk,
  removePin,
  storeNftsForAddress
} from "../lib/profileNfts.js";

const store = demoSeed();
const found = storeNftsForAddress(store, DEMO_OWNER);
const names = found.map((row) => row.name);
assert.equal(
  names.filter((name) => name === "FUZION 3D #1").length,
  1,
  "owner should not see both seed hero and virtual #1"
);

const desk = await profileNftDesk(store, DEMO_OWNER);
const deskNames = desk.docs.map((row) => row.name);
assert.equal(new Set(deskNames).size, deskNames.length, "profile desk names must be unique");
assert.equal(
  desk.docs.filter((row) => row.name === "FUZION 3D #1").length,
  1
);
assert.ok(desk.docs.some((row) => row._id === "seed-lilly-1"));
assert.ok(desk.docs.some((row) => row._id === "seed-fuzion-3d-hero"));
assert.ok(!desk.docs.some((row) => row._id === "col:fuzion-3d:1"));

const keys = desk.docs.map(deskKey);
assert.equal(new Set(keys).size, keys.length);

const ownerPins = pinsForNft(store, "seed-lilly-1");
assert.ok(
  ownerPins.some((row) => row.walletAddr === DEMO_OWNER),
  "owner or issuer should see the NFT as on-profile"
);

removePin(store, DEMO_OWNER, "seed-lilly-1");
const afterHide = await profileNftDesk(store, DEMO_OWNER);
assert.ok(!afterHide.docs.some((row) => row._id === "seed-lilly-1"));
assert.ok(!pinsForNft(store, "seed-lilly-1").some((row) => row.walletAddr === DEMO_OWNER));

addPin(store, DEMO_OWNER, store.nfts.find((nft) => nft._id === "seed-lilly-1"));
const afterAdd = await profileNftDesk(store, DEMO_OWNER);
assert.ok(afterAdd.docs.some((row) => row._id === "seed-lilly-1" && row.pinned));

addPin(store, DEMO_BIDDER, store.nfts.find((nft) => nft._id === "seed-lilly-1"));
const bidderDesk = await profileNftDesk(store, DEMO_BIDDER);
assert.ok(bidderDesk.docs.some((row) => row._id === "seed-lilly-1"));

removePin(store, DEMO_OWNER, "seed-fuzion-3d-hero");
const hidden3d = await profileNftDesk(store, DEMO_OWNER);
assert.ok(!hidden3d.docs.some((row) => /FUZION 3D #1/i.test(row.name)));

const issuerDesk = await profileNftDesk(store, DEMO_ISSUER);
assert.ok(issuerDesk.docs.length > 0);
assert.equal(
  issuerDesk.docs.filter((row) => row.name === "FUZION 3D #1").length,
  1
);

console.log(`profile NFT desk ok: owner=${desk.count} issuer=${issuerDesk.count}`);

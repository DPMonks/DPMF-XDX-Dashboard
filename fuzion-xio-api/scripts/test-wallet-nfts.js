import assert from "node:assert/strict";
import { DEMO_OWNER, demoSeed } from "../lib/seed.js";
import { burnNft } from "../lib/market.js";
import {
  decorateWalletNft,
  fileKindFromUri,
  fromLedgerNft,
  mergeWalletNfts,
  nftActions,
  rememberWalletNfts,
  walletNftDesk
} from "../lib/walletNfts.js";

assert.equal(fileKindFromUri("https://cdn.example/model.glb"), "glb");
assert.equal(fileKindFromUri("ipfs://bafy/file.fbx"), "fbx");
assert.equal(fileKindFromUri("https://x/a.usdz"), "usdz");
assert.equal(fileKindFromUri("https://x/clip.mp4"), "video");

const ledger = fromLedgerNft(
  {
    NFTokenID: "00080000ABCDEF",
    Issuer: "rIssuer11111111111111111111111111111",
    URI: Buffer.from("ipfs://bafy/hero.glb").toString("hex"),
    NFTokenTaxon: 1,
    Flags: 8
  },
  DEMO_OWNER
);
assert.equal(ledger.fileType, "glb");
assert.equal(ledger.threeD, undefined);
assert.ok(ledger.image.includes("dweb.link"));

const store = demoSeed();
const merged = mergeWalletNfts(
  store.nfts.filter((nft) => nft.accountNumber === DEMO_OWNER),
  [ledger]
);
assert.ok(merged.some((nft) => nft._id === "seed-lilly-1"));
assert.ok(merged.some((nft) => nft.NFTokenID === "00080000ABCDEF"));

const card = decorateWalletNft(store, store.nfts.find((nft) => nft._id === "seed-lilly-1"));
assert.equal(card.actions.canDelist, true);
assert.equal(card.actions.canSale, false);
assert.ok(card.vscore >= 0);

const added = rememberWalletNfts(store, [ledger]);
assert.equal(added, 1);
assert.ok(store.nfts.some((nft) => nft.NFTokenID === "00080000ABCDEF"));

const burned = burnNft(store, { nftId: "seed-signal-4", from: DEMO_OWNER });
assert.equal(burned.ok, true);
assert.equal(store.nfts.find((nft) => nft._id === "seed-signal-4").status, "burned");
assert.equal(nftActions({ status: "burned" }).canBurn, false);

const desk = await walletNftDesk(store, DEMO_OWNER, { page: 1, size: 50 });
assert.ok(desk.docs.length >= 6);
assert.ok(desk.docs.every((nft) => nft.actions && nft.status !== "burned"));
assert.ok(desk.docs.some((nft) => nft.fileType === "glb"));

console.log(`wallet nfts ok: ${desk.total} visible, ledger-3d=${ledger.fileType}`);

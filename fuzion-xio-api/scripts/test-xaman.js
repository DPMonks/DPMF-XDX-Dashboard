import assert from "node:assert/strict";
import { demoSeed } from "../lib/seed.js";
import {
  amountForXrpl,
  applySignedIntent,
  decodeSession,
  ensureFreeProfile,
  findPayload,
  jwtSecret,
  linesToCurrency,
  notConfigured,
  payloadState,
  rememberPayload,
  shapeCreated,
  signSession,
  statusHttp,
  toHex,
  transferFeeFromBps,
  txjsonFor,
  verifySession,
  xamanConfigured,
  xrpDrops
} from "../lib/xaman.js";

if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
  assert.equal(xamanConfigured(), false);
}
const missing = notConfigured("xumm/connect");
assert.equal(missing.implemented, false);
assert.match(missing.message, /XUMM_API_KEY/);

assert.equal(xrpDrops(12), "12000000");
assert.equal(xrpDrops(0), "0");
assert.equal(amountForXrpl({ amount: "2.5", currency: "XRP" }), "2500000");
assert.deepEqual(amountForXrpl({ amount: "4", currency: "XDX", issuer: "rIssuer" }), {
  currency: "XDX",
  issuer: "rIssuer",
  value: "4"
});
assert.equal(transferFeeFromBps(500), 5000);
assert.equal(toHex("ipfs://cid"), Buffer.from("ipfs://cid", "utf8").toString("hex").toUpperCase());

const signIn = txjsonFor("connect");
assert.equal(signIn.TransactionType, "SignIn");
const mint = txjsonFor("mint", { image: "https://example.com/a.png" }, "rAccount");
assert.equal(mint.TransactionType, "NFTokenMint");
assert.equal(mint.Account, "rAccount");
assert.equal(mint.Flags, 8);
const sale = txjsonFor(
  "sale",
  { NFTokenID: "NFT1", amount: "1", currency: "XRP" },
  "rSeller"
);
assert.equal(sale.TransactionType, "NFTokenCreateOffer");
assert.equal(sale.Flags, 1);
assert.equal(sale.Amount, "1000000");
const send = txjsonFor("send", { NFTokenID: "NFT1", destAdd: "rDest" }, "rFrom");
assert.equal(send.Destination, "rDest");
assert.equal(send.Amount, "0");
const burn = txjsonFor("burn", { NFTokenID: "NFT1" }, "rFrom");
assert.equal(burn.TransactionType, "NFTokenBurn");

const token = signSession("rFuzionXioDemoOwner11111111111111");
const parts = token.split(".");
assert.equal(parts.length, 3);
const decoded = decodeSession(token);
assert.equal(decoded.ac, "rFuzionXioDemoOwner11111111111111");
assert.equal(verifySession(token).ac, decoded.ac);
assert.ok(jwtSecret());

const created = shapeCreated({
  uuid: "abc-123",
  pushed: false,
  refs: { qr_png: "https://xumm.app/sign/abc-123_q.png" },
  next: { always: "https://xumm.app/sign/abc-123" }
});
assert.equal(created.message, "https://xumm.app/sign/abc-123_q.png");
assert.equal(created.forMobile, "abc-123");
assert.equal(created.uuid, "abc-123");

assert.equal(payloadState({ meta: { signed: true } }), "signed");
assert.equal(payloadState({ meta: { cancelled: true } }), "cancelled");
assert.equal(payloadState({ meta: { expired: true } }), "expired");
assert.equal(payloadState({ meta: {} }), "pending");
assert.equal(statusHttp("pending"), 202);
assert.equal(statusHttp("signed"), 200);
assert.equal(statusHttp("cancelled"), 400);

const store = demoSeed();
rememberPayload(store, {
  uuid: "sale-1",
  kind: "sale",
  nftId: "seed-signal-4",
  amount: "8",
  currency: "XRP",
  account: "rFuzionXioDemoOwner11111111111111"
});
const listed = applySignedIntent(
  store,
  findPayload(store, "sale-1"),
  { account: "rFuzionXioDemoOwner11111111111111", txid: "TX1" }
);
assert.equal(listed.ok, true);
assert.equal(listed.activity.signed, true);
assert.equal(listed.activity.txid, "TX1");
const signal = store.nfts.find((nft) => nft._id === "seed-signal-4");
assert.equal(signal.status, "sale");
assert.equal(signal.amount, "8");

rememberPayload(store, {
  uuid: "buy-1",
  kind: "buy",
  nftId: "seed-lilly-1",
  account: "rFuzionXioDemoBidder1111111111111"
});
const bought = applySignedIntent(
  store,
  findPayload(store, "buy-1"),
  { account: "rFuzionXioDemoBidder1111111111111", txid: "TX2" }
);
assert.equal(bought.ok, true);
const lilly = store.nfts.find((nft) => nft._id === "seed-lilly-1");
assert.equal(lilly.accountNumber, "rFuzionXioDemoBidder1111111111111");

const profile = ensureFreeProfile(store, "rNewXamanWallet11111111111111111");
assert.equal(profile.wAddress, "rNewXamanWallet11111111111111111");
assert.ok(store.profiles.some((row) => row.wAddress === profile.wAddress));

const currency = linesToCurrency(
  { result: { account_data: { Balance: "25000000" } } },
  {
    result: {
      lines: [{ currency: "XIO", balance: "12.4", account: "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU" }]
    }
  }
);
assert.equal(currency[0].currency, "XRP");
assert.equal(currency[0].value, "25");
assert.equal(currency[1].currency, "XIO");
assert.equal(currency[1].value, "12.4");

console.log("xaman connect + signing helpers ok");

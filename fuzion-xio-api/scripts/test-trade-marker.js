import assert from "node:assert/strict";
import { activityFeed, buyNow, listForSale, placeOffer } from "../lib/market.js";
import { DEMO_BIDDER, DEMO_OWNER, demoSeed } from "../lib/seed.js";
import {
  TRADE_MARKER,
  TRADE_VENUE,
  hexToText,
  memoFromLedger,
  paperMark,
  signedMark,
  signedQuery,
  stampTrade,
  textToHex,
  xrplMemos
} from "../lib/tradeMarker.js";
import { applySignedIntent, txjsonFor } from "../lib/xaman.js";

assert.equal(signedQuery("true"), true);
assert.equal(signedQuery("paper"), false);
assert.equal(signedQuery(""), null);

const paper = paperMark();
assert.equal(paper.marker, TRADE_MARKER);
assert.equal(paper.venue, TRADE_VENUE);
assert.equal(paper.signed, false);
assert.equal(paper.sign, "paper");

const signed = signedMark({ txid: "HASH1" });
assert.equal(signed.signed, true);
assert.equal(signed.sign, "xaman");
assert.equal(signed.txid, "HASH1");

const store = demoSeed();
assert.ok(store.activity.every((row) => row.marker === TRADE_MARKER && row.signed === false));
assert.ok(store.tradehistories.every((row) => row.signed === false));

const sale = buyNow(store, { nftId: "seed-lilly-1", buyer: DEMO_BIDDER, ...paperMark() });
assert.equal(sale.ok, true);
assert.equal(sale.activity.signed, false);
assert.equal(sale.activity.marker, TRADE_MARKER);
assert.equal(sale.simulated, true);
assert.ok(store.fees.some((row) => row.nftId === "seed-lilly-1" && row.signed === false));
assert.ok(store.tradehistories.some((row) => row.nftID === "seed-lilly-1" && row.signed === false));

const listed = listForSale(store, {
  nftId: "seed-signal-4",
  amount: "9",
  currency: "XRP",
  seller: DEMO_OWNER,
  ...signedMark({ txid: "SIGNED-LIST" })
});
assert.equal(listed.activity.signed, true);
assert.equal(listed.activity.txid, "SIGNED-LIST");

const offer = placeOffer(store, {
  nftId: "seed-orbit-3",
  from: DEMO_BIDDER,
  amount: "3",
  currency: "XRP",
  ...paperMark()
});
assert.equal(offer.offer.signed, false);

const signedOnly = activityFeed(store, { signed: "true" });
assert.ok(signedOnly.docs.every((row) => row.signed === true));
assert.ok(signedOnly.docs.some((row) => row.txid === "SIGNED-LIST"));
const paperOnly = activityFeed(store, { signed: "false" });
assert.ok(paperOnly.docs.every((row) => row.signed === false));

const next = demoSeed();
applySignedIntent(
  next,
  {
    uuid: "buy-signed",
    kind: "buy",
    nftId: "seed-lilly-1",
    account: DEMO_BIDDER
  },
  { account: DEMO_BIDDER, txid: "LEDGER-BUY" }
);
const buyRow = next.activity.find((row) => row.type === "sale" && row.nftId === "seed-lilly-1");
assert.equal(buyRow.signed, true);
assert.equal(buyRow.sign, "xaman");
assert.equal(buyRow.txid, "LEDGER-BUY");
assert.equal(buyRow.marker, TRADE_MARKER);

const saleTx = txjsonFor("sale", { NFTokenID: "NFT1", amount: "1", currency: "XRP" }, "rSeller");
assert.ok(saleTx.Memos?.[0]?.Memo?.MemoData);
const memoText = hexToText(saleTx.Memos[0].Memo.MemoData);
assert.match(memoText, /FUZION-XIO/);
assert.match(hexToText(saleTx.Memos[0].Memo.MemoType), /fuzion-xio/);
const parsed = memoFromLedger(saleTx);
assert.equal(parsed.signed, true);
assert.equal(parsed.marker, TRADE_MARKER);
assert.equal(memoFromLedger({}), null);

const connect = txjsonFor("connect");
assert.equal(connect.Memos, undefined);

const memos = xrplMemos({ kind: "buy" });
assert.equal(hexToText(memos.Memos[0].Memo.MemoType), TRADE_VENUE);
assert.ok(textToHex("fuzion-xio"));
assert.equal(stampTrade({ type: "sale" }).signed, false);

console.log("trade marker ok: paper vs signed stay separate");

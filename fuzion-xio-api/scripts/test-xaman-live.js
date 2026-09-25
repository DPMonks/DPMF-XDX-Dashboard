import assert from "node:assert/strict";
import "dotenv/config";
import {
  cancelPayload,
  createPayload,
  fuzionReturnUrl,
  pingXaman,
  txjsonFor,
  xamanAppSummary,
  xamanConfigured
} from "../lib/xaman.js";
import { hexToText } from "../lib/tradeMarker.js";

if (!xamanConfigured()) {
  console.log("xaman live skipped: keys not set");
  process.exit(0);
}

const ping = await pingXaman();
assert.equal(ping.ok, true, ping.error);
const app = xamanAppSummary(ping.data || {});
assert.equal(app.pong, true);
assert.equal(app.disabled, false);
assert.ok(app.name);

const ACCOUNT = "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU";
const NFT =
  "000B013A95F14B0044F78A264E41713C64B5F2488CE5A05C9DDA8751BA375D65";
const DEST = "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH";
const kinds = [
  ["connect", {}, ""],
  ["mint", { image: "https://example.com/fuzion.png" }, ACCOUNT],
  ["sale", { NFTokenID: NFT, amount: "1", currency: "XRP" }, ACCOUNT],
  ["buy", { NFTokenID: NFT, amount: "1", currency: "XRP", Owner: ACCOUNT }, ACCOUNT],
  ["burn", { NFTokenID: NFT }, ACCOUNT],
  ["send", { NFTokenID: NFT, destAdd: DEST }, ACCOUNT]
];

assert.match(fuzionReturnUrl(), /xaman=\{id\}/);

for (const [kind, body, account] of kinds) {
  const txjson = txjsonFor(kind, body, account);
  if (kind !== "connect") {
    assert.ok(txjson.Memos?.[0]?.Memo?.MemoData, `${kind} missing Fuzion memo`);
    assert.match(hexToText(txjson.Memos[0].Memo.MemoData), /FUZION-XIO/);
  }
  const created = await createPayload(txjson, {
    custom_meta: { instruction: `FUZION-XIO live ${kind}` }
  });
  assert.equal(created.ok, true, `${kind}: ${created.error}`);
  const uuid = created.data?.uuid;
  assert.ok(uuid, `${kind} missing uuid`);
  assert.ok(created.data?.refs?.qr_png, `${kind} missing QR`);
  await cancelPayload(uuid);
}

console.log(`xaman live ok: app=${app.name} payloads=${kinds.length} cancelled`);

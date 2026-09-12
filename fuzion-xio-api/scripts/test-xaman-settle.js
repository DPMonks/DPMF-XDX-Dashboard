import assert from "node:assert/strict";
import {
  detectExecution,
  isSignInKind,
  settleDecision,
  statusHttp
} from "../lib/xamanSettle.js";
import { fuzionReturnUrl, applySignedIntent, rememberPayload } from "../lib/xaman.js";
import { validateSignedIntent, xamanUserError } from "../lib/xamanPrepare.js";
import { demoSeed } from "../lib/seed.js";
import { isXamanStillOpen, shouldFinishXamanPoll } from "../../fuzion-xio/src/helper/xamanResume.js";

assert.equal(isSignInKind("connect"), true);
assert.equal(fuzionReturnUrl().includes("xaman={id}"), true);

const pending = detectExecution({ payload: { meta: {} } });
assert.equal(pending.status, "pending");

const signedIn = settleDecision("connect", {
  meta: { signed: true },
  response: { account: "rFuzionXioDemoOwner11111111111111" }
});
assert.equal(signedIn.status, "completed");
assert.equal(signedIn.executed, true);

const waitingAccount = settleDecision("connect", { meta: { signed: true } });
assert.equal(waitingAccount.status, "confirming");

const salePending = settleDecision("sale", { meta: { signed: true } });
assert.equal(salePending.status, "confirming");

const saleOk = settleDecision("sale", {
  meta: { signed: true, submitted: true },
  response: {
    account: "rFuzionXioDemoBidder1111111111111",
    txid: "A".repeat(64),
    dispatched_result: "tesSUCCESS"
  }
});
assert.equal(saleOk.status, "completed");
assert.equal(saleOk.tesSuccess, true);

const saleFail = settleDecision("sale", {
  meta: { signed: true, submitted: true },
  response: { dispatched_result: "tecNO_PERMISSION", txid: "B".repeat(64) }
});
assert.equal(saleFail.status, "failed");
assert.equal(statusHttp("failed"), 409);
assert.equal(statusHttp("confirming"), 202);

assert.equal(shouldFinishXamanPoll({ status: 202, data: { status: "pending" } }), "wait");
assert.equal(shouldFinishXamanPoll({ status: 200, data: { status: "completed", executed: true } }), "done");
assert.equal(shouldFinishXamanPoll({ status: 200, data: {} }), "wait");
assert.equal(shouldFinishXamanPoll({ status: 409, data: { status: "failed" } }), "fail");
assert.equal(shouldFinishXamanPoll({ status: 502, data: {} }), "wait");
assert.equal(isXamanStillOpen({ status: 202, data: { status: "pending" } }), true);

const demoId = "00080000FUZIONXIODEMO0000000000000000000000000000000001";
const badDemo = validateSignedIntent("sale", { NFTokenID: demoId, amount: "1" }, { NFTokenID: demoId });
assert.equal(badDemo.ok, false);
const liveNft = "000B013A95F14B0044F78A264E41713C64B5F2488CE5A05C9DDA8751BA375D65";
const goodSale = validateSignedIntent(
  "sale",
  { NFTokenID: liveNft, amount: "1" },
  { NFTokenID: liveNft, Account: "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU" }
);
assert.equal(goodSale.ok, true);
assert.match(xamanUserError({ error: { code: 603 } }), /603/);

const store = demoSeed();
rememberPayload(store, { uuid: "once-1", kind: "connect", account: "rA" });
const first = applySignedIntent(store, { uuid: "once-1", kind: "connect" }, { account: "rA" });
assert.equal(first.already, undefined);
const second = applySignedIntent(store, { uuid: "once-1", kind: "connect" }, { account: "rA" });
assert.equal(second.already, true);

console.log("xaman settle + no-early-refresh helpers ok");

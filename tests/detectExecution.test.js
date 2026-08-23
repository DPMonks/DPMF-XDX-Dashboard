import test from "node:test";
import assert from "node:assert/strict";
import {
  detectTradeExecution,
  extractTxHash,
  isTradeTxjson,
  ledgerExecutionSignals,
  payloadExecutionSignals,
} from "../src/xaman/detectExecution.js";

const HASH = "A".repeat(64);

test("isTradeTxjson only treats signed ledger trades as trades", () => {
  assert.equal(isTradeTxjson({ TransactionType: "OfferCreate" }), true);
  assert.equal(isTradeTxjson({ TransactionType: "AMMDeposit" }), true);
  assert.equal(isTradeTxjson({ TransactionType: "AMMWithdraw" }), true);
  assert.equal(isTradeTxjson({ TransactionType: "AMMVote" }), true);
  assert.equal(isTradeTxjson({ TransactionType: "SignIn" }), false);
  assert.equal(isTradeTxjson({ TransactionType: "TrustSet" }), false);
});

test("extractTxHash accepts a 64-character hash from Xaman or XRPL", () => {
  assert.equal(extractTxHash({ response: { txid: HASH.toLowerCase() } }), HASH);
  assert.equal(extractTxHash({ hash: HASH }), HASH);
  assert.equal(extractTxHash({ txid: "nope" }), null);
});

test("Xaman dispatch tesSUCCESS is an executed trade", () => {
  const detection = detectTradeExecution({
    payload: {
      meta: { signed: true, submitted: true },
      response: { txid: HASH, dispatched_result: "tesSUCCESS", account: "rA" },
    },
  });
  assert.equal(detection.executed, true);
  assert.equal(detection.via, "xaman-dispatch");
  assert.ok(detection.detectors.includes("xaman-dispatch"));
});

test("websocket signed plus a txid is an executed trade", () => {
  const detection = detectTradeExecution({
    socket: { signed: true },
    payload: { meta: { signed: true }, response: { txid: HASH } },
  });
  assert.equal(detection.executed, true);
  assert.ok(detection.detectors.includes("xaman-socket"));
  assert.ok(detection.detectors.includes("xaman-txid"));
});

test("validated XRPL tesSUCCESS is an executed trade", () => {
  const detection = detectTradeExecution({
    ledger: {
      hash: HASH,
      validated: true,
      Account: "rA",
      meta: { TransactionResult: "tesSUCCESS" },
    },
  });
  assert.equal(detection.executed, true);
  assert.equal(detection.via, "xrpl-validated");
  assert.equal(ledgerExecutionSignals({ error: "txnNotFound" }).found, false);
});

test("a cancelled Xaman payload is not an executed trade", () => {
  const detection = detectTradeExecution({
    payload: { meta: { cancelled: true, signed: false } },
  });
  assert.equal(detection.executed, false);
  assert.equal(detection.rejected, true);
  assert.equal(payloadExecutionSignals({ meta: { cancelled: true } }).cancelled, true);
});

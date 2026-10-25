import assert from "node:assert/strict";
import {
  extractSignedAccount,
  isFreshXamanCreate,
  isReusableUnsignedPayload,
  payloadLooksSigned,
  payloadSignedThisSession
} from "../lib/xamanSettle.js";
import { createPayload, txjsonFor } from "../lib/xaman.js";
import {
  SIGN_MEMO_TYPE,
  extractTradeMarker,
  extractTradeMarkerFromPayload,
  hexToAscii,
  invoiceIdFromMarker,
  nextSignMarker,
  stampTradeTxjson,
  xamanSignIdentifier
} from "../../fuzion-xio/src/helper/signMarker.js";
import {
  canClaimExecutedTrade,
  clearConsumedUuids,
  clearPendingPayload,
  discardStalePendingTrade,
  isConsumedMarker,
  isConsumedUuid,
  payloadMatchesPendingTrade,
  peekPendingPayload,
  peekXamanUuid,
  rememberConsumedUuid,
  rememberPendingPayload,
  shouldAutoClaimPendingTrade,
  shouldFinishXamanPoll
} from "../../fuzion-xio/src/helper/xamanResume.js";
import {
  executionBelongsToOpenTrade,
  openNftTradePanel
} from "../../fuzion-xio/src/helper/nftTradeSign.js";

function memoryStore() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}

function withMemoryStorage(fn) {
  const previous = {
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage
  };
  globalThis.sessionStorage = memoryStore();
  globalThis.localStorage = memoryStore();
  try {
    return fn();
  } finally {
    clearPendingPayload();
    clearConsumedUuids();
    if (previous.sessionStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous.sessionStorage;
    if (previous.localStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous.localStorage;
  }
}

const account = "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU";
const uuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

assert.equal(
  extractSignedAccount({
    meta: { signed: false, destination: account },
    payload: { tx_destination: account, request_json: { Account: account } },
    account
  }),
  ""
);
assert.equal(
  payloadLooksSigned({
    meta: { signed: false },
    payload: { request_json: { Account: account, TransactionType: "NFTokenCreateOffer" } }
  }),
  false
);

const started = Date.now();
assert.equal(
  payloadSignedThisSession(
    {
      meta: { signed: true, resolved_at: new Date(started - 60_000).toISOString() },
      response: { account, resolved_at: new Date(started - 60_000).toISOString() }
    },
    started
  ),
  false
);
assert.equal(
  payloadSignedThisSession(
    {
      meta: { signed: true, resolved_at: new Date(started + 1000).toISOString() },
      response: { account, hex: "AA", resolved_at: new Date(started + 1000).toISOString() }
    },
    started
  ),
  true
);

assert.equal(isReusableUnsignedPayload({ meta: { signed: false, resolved: false } }), true);
assert.equal(isReusableUnsignedPayload({ meta: { signed: true, resolved: true } }), false);
assert.equal(isFreshXamanCreate({ uuid, meta: {} }), true);
assert.equal(isFreshXamanCreate({ uuid, meta: { signed: true, resolved: true } }), false);

const sale = txjsonFor(
  "sale",
  { NFTokenID: "A".repeat(64), amount: "1", currency: "XRP" },
  account
);
const marker = extractTradeMarker(sale);
assert.match(marker, /^[0-9a-f]{16,32}$/);
assert.equal(hexToAscii(sale.Memos.at(-1).Memo.MemoType), SIGN_MEMO_TYPE);
assert.equal(xamanSignIdentifier(marker).startsWith("dpmf:"), true);

const payment = stampTradeTxjson({ TransactionType: "Payment", Amount: "1" });
assert.equal(payment.txjson.InvoiceID, invoiceIdFromMarker(payment.marker));
const again = stampTradeTxjson(payment.txjson, nextSignMarker());
assert.equal(again.marker, payment.marker);

withMemoryStorage(() => {
  rememberPendingPayload(uuid, {
    watchTrade: true,
    txjson: { TransactionType: "NFTokenCreateOffer" },
    trade: { action: "buy" }
  });
  assert.equal(shouldAutoClaimPendingTrade(""), false);
  assert.equal(shouldAutoClaimPendingTrade(`?xaman=${uuid}`), true);

  const newer = "11111111-2222-4333-a444-555555555555";
  rememberPendingPayload(newer, {
    watchTrade: true,
    txjson: { TransactionType: "NFTokenCreateOffer" }
  });
  assert.equal(peekXamanUuid(`?xaman=${uuid}`), newer);

  rememberConsumedUuid(newer);
  assert.equal(isConsumedUuid(newer), true);
  assert.equal(canClaimExecutedTrade(newer), false);
  assert.equal(shouldAutoClaimPendingTrade(`?xaman=${newer}`), false);
});

withMemoryStorage(() => {
  const { txjson, marker: signMarker } = stampTradeTxjson({
    TransactionType: "NFTokenCreateOffer",
    NFTokenID: "A".repeat(64)
  });
  rememberPendingPayload(uuid, {
    watchTrade: true,
    txjson,
    signMarker,
    signState: "unsigned"
  });
  const leftover = {
    payload: {
      tx_type: "NFTokenCreateOffer",
      request_json: { TransactionType: "NFTokenCreateOffer", NFTokenID: "A".repeat(64) }
    },
    meta: { signed: true, submitted: true, resolved_at: new Date().toISOString() },
    response: { dispatched_result: "tesSUCCESS", account }
  };
  assert.equal(payloadMatchesPendingTrade(peekPendingPayload(), leftover), false);
  assert.equal(canClaimExecutedTrade(uuid, undefined, leftover), false);

  const matched = {
    ...leftover,
    payload: { tx_type: "NFTokenCreateOffer", request_json: txjson }
  };
  assert.equal(payloadMatchesPendingTrade(peekPendingPayload(), matched), true);
  assert.equal(extractTradeMarkerFromPayload({ payload: { request_json: txjson } }), signMarker);

  rememberConsumedUuid(uuid, signMarker);
  assert.equal(isConsumedMarker(signMarker), true);
  assert.equal(canClaimExecutedTrade(uuid), false);
});

withMemoryStorage(() => {
  rememberPendingPayload(uuid, {
    watchTrade: true,
    txjson: { TransactionType: "NFTokenCreateOffer" }
  });
  const record = peekPendingPayload();
  assert.equal(
    payloadMatchesPendingTrade(record, {
      payload: { tx_type: "SignIn" },
      meta: { signed: true, submitted: true, resolved_at: new Date().toISOString() },
      response: { dispatched_result: "tesSUCCESS", account }
    }),
    false
  );
  assert.equal(
    payloadMatchesPendingTrade(record, {
      payload: { tx_type: "TrustSet" },
      meta: { signed: true, submitted: true, resolved_at: new Date().toISOString() },
      response: { dispatched_result: "tesSUCCESS", account }
    }),
    false
  );
  assert.equal(
    payloadMatchesPendingTrade(record, {
      payload: { tx_type: "NFTokenCreateOffer" },
      meta: { signed: true, submitted: true, resolved_at: new Date(Date.now() - 60_000).toISOString() },
      response: { dispatched_result: "tesSUCCESS", account }
    }),
    false
  );
});

withMemoryStorage(() => {
  rememberPendingPayload(uuid, {
    watchTrade: true,
    txjson: { TransactionType: "NFTokenCreateOffer" }
  });
  assert.equal(discardStalePendingTrade({ force: true }), true);
  assert.equal(peekPendingPayload(), null);
  assert.equal(shouldAutoClaimPendingTrade(`?xaman=${uuid}`), false);
});

const emptyPanel = openNftTradePanel("buy");
assert.equal(emptyPanel.activeUuid, "");
assert.equal(
  executionBelongsToOpenTrade(emptyPanel, {
    uuid,
    txType: "NFTokenCreateOffer",
    resolved_at: new Date().toISOString()
  }),
  false
);
assert.equal(
  executionBelongsToOpenTrade(
    { ...emptyPanel, activeUuid: uuid, signMarker: "ab".repeat(16) },
    {
      uuid,
      txType: "TrustSet",
      signMarker: "ab".repeat(16),
      resolved_at: new Date().toISOString()
    }
  ),
  false
);
assert.equal(
  executionBelongsToOpenTrade(
    { action: "buy", openId: Date.now(), activeUuid: uuid, signMarker: "ab".repeat(16) },
    {
      uuid,
      txType: "NFTokenCreateOffer",
      signMarker: "ab".repeat(16),
      resolved_at: new Date().toISOString()
    }
  ),
  true
);

assert.equal(
  shouldFinishXamanPoll(
    {
      status: 200,
      data: {
        status: "completed",
        executed: true,
        meta: { signed: true, resolved_at: new Date(Date.now() - 60_000).toISOString() },
        response: { dispatched_result: "tesSUCCESS", account }
      }
    },
    { startedAt: Date.now(), uuid }
  ),
  "wait"
);

process.env.XUMM_API_KEY = process.env.XUMM_API_KEY || "test-key";
process.env.XUMM_API_SECRET = process.env.XUMM_API_SECRET || "test-secret";

const createdAlreadySigned = await createPayload(
  { TransactionType: "SignIn" },
  {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        uuid,
        meta: { signed: true, resolved: true },
        refs: { qr_png: "https://xumm.app/sign/x_q.png" }
      })
    })
  }
);
assert.equal(createdAlreadySigned.ok, false);
assert.equal(createdAlreadySigned.status, 409);
assert.match(createdAlreadySigned.error, /already signed/i);

console.log("xaman leftover-sign countermeasures ok");

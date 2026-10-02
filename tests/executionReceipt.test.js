import test from "node:test";
import assert from "node:assert/strict";
import { XDX_ISSUER } from "../src/constants/ledger.js";
import { executionReceipt, formatReceiptHash, lpDeltaFromLedger } from "../src/wallet/executionReceipt.js";
import { ackTradeNotice, peekTradeNotice, rememberTradeNotice } from "../src/wallet/tradeNotice.js";

function memoryStore() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test("executionReceipt reads AMMDeposit amounts and LP from ledger", () => {
  const receipt = executionReceipt({
    txid: "A".repeat(64),
    engineResult: "tesSUCCESS",
    account: "rHolder",
    txjson: {
      TransactionType: "AMMDeposit",
      Asset: { currency: "XDX", issuer: XDX_ISSUER },
      Asset2: { currency: "XRP" },
      Amount: { currency: "XDX", issuer: XDX_ISSUER, value: "1000" },
      Amount2: "5000000",
    },
    ledger: {
      ledger_index: 99123,
      hash: "A".repeat(64),
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          {
            ModifiedNode: {
              LedgerEntryType: "RippleState",
              FinalFields: {
                Balance: { currency: "03E7A465A6E95CDA21E1110056AA51A71FA55CB9", value: "12.5" },
                HighLimit: { issuer: "rHolder" },
                LowLimit: { issuer: "rAmm" },
              },
              PreviousFields: {
                Balance: { currency: "03E7A465A6E95CDA21E1110056AA51A71FA55CB9", value: "10" },
              },
            },
          },
        ],
      },
    },
  });
  assert.equal(receipt.pair, "XDX/XRP");
  assert.equal(receipt.paid[0].asset, "XDX");
  assert.equal(receipt.paid[0].value, 1000);
  assert.equal(receipt.paid[1].asset, "XRP");
  assert.equal(receipt.paid[1].value, 5);
  assert.equal(receipt.received[0].asset, "LP");
  assert.equal(receipt.received[0].value, 2.5);
  assert.equal(receipt.ledgerIndex, 99123);
  assert.equal(formatReceiptHash("A".repeat(64)), `${"A".repeat(10)}…${"A".repeat(8)}`);
  assert.equal(
    lpDeltaFromLedger(
      {
        meta: {
          AffectedNodes: [
            {
              ModifiedNode: {
                LedgerEntryType: "RippleState",
                FinalFields: {
                  Balance: { currency: "03E7A465A6E95CDA21E1110056AA51A71FA55CB9", value: "12.5" },
                  HighLimit: { issuer: "rHolder" },
                },
                PreviousFields: { Balance: { value: "10" } },
              },
            },
          ],
        },
      },
      "rHolder"
    ),
    2.5
  );
});

const SWAP_HASH = "44C29440DE39822B963D66C87140AC6AD32371410D72C6434770E59353AF69D3";
const SWAP_ACCOUNT = "r4TcNpqKfVKF5P8EknYJGN4TztvfCcVVW7";

test("swap receipt uses the XRP actually spent, not the SendMax pad", () => {
  const receipt = executionReceipt({
    txid: SWAP_HASH,
    engineResult: "tesSUCCESS",
    account: SWAP_ACCOUNT,
    txjson: {
      TransactionType: "Payment",
      Account: SWAP_ACCOUNT,
      Destination: SWAP_ACCOUNT,
      Amount: { currency: "XDX", issuer: XDX_ISSUER, value: "75551.99625416" },
      SendMax: "3413709",
    },
    ledger: {
      hash: SWAP_HASH,
      ledger_index: 107385414,
      Fee: "12",
      Account: SWAP_ACCOUNT,
      SendMax: "3413709",
      meta: {
        TransactionResult: "tesSUCCESS",
        delivered_amount: { currency: "XDX", issuer: XDX_ISSUER, value: "75551.99625416" },
        AffectedNodes: [
          {
            ModifiedNode: {
              LedgerEntryType: "AccountRoot",
              FinalFields: { Account: SWAP_ACCOUNT, Balance: "74922302" },
              PreviousFields: { Balance: "77922315" },
            },
          },
          {
            ModifiedNode: {
              LedgerEntryType: "RippleState",
              FinalFields: {
                Balance: { currency: "XDX", issuer: "rrrrrrrrrrrrrrrrrrrrBZbvji", value: "-278914812.3661045" },
                HighLimit: { issuer: SWAP_ACCOUNT, currency: "XDX", value: "1000000000000000" },
                LowLimit: { issuer: XDX_ISSUER, currency: "XDX", value: "0" },
              },
              PreviousFields: {
                Balance: { currency: "XDX", issuer: "rrrrrrrrrrrrrrrrrrrrBZbvji", value: "-278839260.3698503" },
              },
            },
          },
        ],
      },
    },
  });
  assert.equal(receipt.pair, "XDX/XRP");
  assert.equal(receipt.settled, true);
  assert.equal(receipt.paid.length, 1);
  assert.equal(receipt.paid[0].asset, "XRP");
  assert.equal(receipt.paid[0].value, 3.000001);
  assert.equal(receipt.received[0].asset, "XDX");
  assert.equal(receipt.received[0].value, 75551.99625416);
  assert.equal(receipt.fee.value, 0.000012);
  assert.equal(receipt.fee.asset, "XRP");
  assert.equal(receipt.ledgerIndex, 107385414);
});

test("selling XDX reports the XDX spent and the XRP delivered", () => {
  const account = "rSeller";
  const receipt = executionReceipt({
    engineResult: "tesSUCCESS",
    account,
    txjson: {
      TransactionType: "Payment",
      Account: account,
      SendMax: { currency: "XDX", issuer: XDX_ISSUER, value: "1200" },
      Amount: "2000000",
    },
    ledger: {
      Fee: "12",
      meta: {
        TransactionResult: "tesSUCCESS",
        delivered_amount: "2500000",
        AffectedNodes: [
          {
            ModifiedNode: {
              LedgerEntryType: "AccountRoot",
              FinalFields: { Account: account, Balance: "7499988" },
              PreviousFields: { Balance: "5000000" },
            },
          },
          {
            ModifiedNode: {
              LedgerEntryType: "RippleState",
              FinalFields: {
                Balance: { currency: "XDX", value: "-4000" },
                HighLimit: { issuer: account },
                LowLimit: { issuer: XDX_ISSUER },
              },
              PreviousFields: { Balance: { currency: "XDX", value: "-5000" } },
            },
          },
        ],
      },
    },
  });
  assert.equal(receipt.paid[0].asset, "XDX");
  assert.equal(receipt.paid[0].value, 1000);
  assert.equal(receipt.received[0].asset, "XRP");
  assert.equal(receipt.received[0].value, 2.5);
  assert.equal(receipt.fee.value, 0.000012);
});

test("an IOU to IOU swap uses that asset's balance change and keeps the fee separate", () => {
  const account = "rTrader";
  const createHex = "4352454154450000000000000000000000000000";
  const createIssuer = "rMqZY49eXVxU9rgrHVix7jkLeZcEeni9nU";
  const receipt = executionReceipt({
    engineResult: "tesSUCCESS",
    account,
    txjson: {
      TransactionType: "Payment",
      Account: account,
      SendMax: { currency: createHex, issuer: createIssuer, value: "18" },
      Amount: { currency: "XDX", issuer: XDX_ISSUER, value: "20" },
    },
    ledger: {
      Fee: "12",
      meta: {
        TransactionResult: "tesSUCCESS",
        delivered_amount: { currency: "XDX", issuer: XDX_ISSUER, value: "20" },
        AffectedNodes: [
          {
            ModifiedNode: {
              LedgerEntryType: "AccountRoot",
              FinalFields: { Account: account, Balance: "1999988" },
              PreviousFields: { Balance: "2000000" },
            },
          },
          {
            ModifiedNode: {
              LedgerEntryType: "RippleState",
              FinalFields: {
                Balance: { currency: createHex, value: "-90" },
                HighLimit: { issuer: account },
                LowLimit: { issuer: createIssuer },
              },
              PreviousFields: { Balance: { currency: createHex, value: "-100" } },
            },
          },
        ],
      },
    },
  });
  assert.equal(receipt.paid[0].asset, "CREATE");
  assert.equal(receipt.paid[0].value, 10);
  assert.equal(receipt.received[0].asset, "XDX");
  assert.equal(receipt.received[0].value, 20);
  assert.notEqual(receipt.paid[0].asset, "XRP");
});

test("a swap with no delivered_amount still uses the sender balance change", () => {
  const account = "rSeller";
  const receipt = executionReceipt({
    engineResult: "tesSUCCESS",
    account,
    txjson: {
      TransactionType: "Payment",
      Account: account,
      SendMax: { currency: "XDX", issuer: XDX_ISSUER, value: "1200" },
      Amount: "2000000",
    },
    ledger: {
      Fee: "12",
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          {
            ModifiedNode: {
              LedgerEntryType: "AccountRoot",
              FinalFields: { Account: account, Balance: "7499988" },
              PreviousFields: { Balance: "5000000" },
            },
          },
          {
            ModifiedNode: {
              LedgerEntryType: "RippleState",
              FinalFields: {
                Balance: { currency: "XDX", value: "-4000" },
                HighLimit: { issuer: account },
                LowLimit: { issuer: XDX_ISSUER },
              },
              PreviousFields: { Balance: { currency: "XDX", value: "-5000" } },
            },
          },
        ],
      },
    },
  });
  assert.equal(receipt.paid[0].value, 1000);
  assert.equal(receipt.received[0].value, 2.5);
  assert.equal(receipt.received[0].asset, "XRP");
});

test("without validated metadata the receipt still shows the submitted SendMax", () => {
  const receipt = executionReceipt({
    engineResult: "tesSUCCESS",
    txjson: {
      TransactionType: "Payment",
      SendMax: "3413709",
      Amount: { currency: "XDX", issuer: XDX_ISSUER, value: "75551.99625416" },
    },
  });
  assert.equal(receipt.settled, false);
  assert.equal(receipt.paid[0].value, 3.413709);
  assert.equal(receipt.fee, null);
});

test("trade notice survives a new tab until Close", () => {
  const previous = {
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
  };
  globalThis.localStorage = memoryStore();
  globalThis.sessionStorage = memoryStore();
  try {
    rememberTradeNotice({
      kind: "executed",
      txid: "B".repeat(64),
      txjson: { TransactionType: "AMMWithdraw" },
    });
    const stored = peekTradeNotice();
    assert.equal(stored.txid, "B".repeat(64));
    ackTradeNotice();
    assert.equal(peekTradeNotice(), null);
  } finally {
    if (previous.localStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous.localStorage;
    if (previous.sessionStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous.sessionStorage;
  }
});

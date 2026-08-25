import test from "node:test";
import assert from "node:assert/strict";
import {
  activityFromAccountTx,
  activityFromAmmLpTx,
  activityFromOfferTx,
  activityFromPaymentTx,
  activityFromTrustSetTx,
  mergeWalletActivity,
  mergeWalletOrders,
  orderFromTxjson,
  ordersFromAccountOffers,
  pendingFor,
  pendingFromExecution,
  rememberPending,
  rippleIso,
} from "../src/wallet/ledgerOrders.js";
import { XDX_ISSUER } from "../src/constants/ledger.js";

const BUY = {
  TransactionType: "OfferCreate",
  Account: "rBuyer",
  TakerPays: { currency: "XDX", issuer: XDX_ISSUER, value: "1000" },
  TakerGets: "30000",
};

test("orderFromTxjson reads a limit buy as an XDX/XRP bid", () => {
  const order = orderFromTxjson(BUY);
  assert.equal(order.side, "bid");
  assert.equal(order.pair, "XDX/XRP");
  assert.equal(order.amount, 1000);
  assert.ok(Math.abs(order.price - 0.00003) < 1e-12);
});

test("orderFromTxjson reads a limit sell as an XDX/XRP ask", () => {
  const order = orderFromTxjson({
    TransactionType: "OfferCreate",
    Account: "rSeller",
    TakerGets: { currency: "XDX", issuer: XDX_ISSUER, value: "400" },
    TakerPays: "16000",
  });
  assert.equal(order.side, "ask");
  assert.equal(order.amount, 400);
  assert.ok(Math.abs(order.price - 0.00004) < 1e-12);
});

test("ordersFromAccountOffers keeps the signed-in wallet only", () => {
  const rows = ordersFromAccountOffers(
    [
      BUY,
      {
        Account: "rOther",
        TakerPays: { currency: "XDX", issuer: XDX_ISSUER, value: "10" },
        TakerGets: "100",
      },
    ],
    "rBuyer"
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].account, "rBuyer");
});

test("activityFromOfferTx keeps a resting limit as open recent activity", () => {
  const row = activityFromOfferTx(
    {
      hash: "A".repeat(64),
      date: 0,
      tx: BUY,
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          {
            CreatedNode: {
              LedgerEntryType: "Offer",
              NewFields: { Account: "rBuyer" },
            },
          },
        ],
      },
    },
    "rBuyer"
  );
  assert.equal(row.side, "buy");
  assert.equal(row.xdx, 1000);
  assert.equal(row.status, "open");
  assert.equal(row.txid, "A".repeat(64));
});

test("activityFromAccountTx unwraps tx_json and marks a consumed offer filled", () => {
  const rows = activityFromAccountTx(
    [
      {
        hash: "B".repeat(64),
        close_time_iso: "2026-08-23T01:50:00.000Z",
        tx_json: BUY,
        meta: {
          TransactionResult: "tesSUCCESS",
          AffectedNodes: [
            {
              DeletedNode: {
                LedgerEntryType: "Offer",
                FinalFields: { Account: "rBuyer" },
              },
            },
          ],
        },
      },
    ],
    "rBuyer"
  );
  assert.equal(rows[0].status, "filled");
  assert.equal(rows[0].timestamp, "2026-08-23T01:50:00.000Z");
});

test("pendingFromExecution paints the buy immediately and skips IOC as an open order", () => {
  const limit = pendingFromExecution({ txjson: BUY, txid: "C".repeat(64) }, "rBuyer");
  assert.equal(limit.order.side, "bid");
  assert.equal(limit.activity.side, "buy");
  const ioc = pendingFromExecution(
    { txjson: { ...BUY, Flags: 131072 }, txid: "D".repeat(64) },
    "rBuyer"
  );
  assert.equal(ioc.order, null);
  assert.equal(ioc.activity.status, "filled");
  const swap = pendingFromExecution(
    {
      txjson: {
        TransactionType: "Payment",
        Account: "rBuyer",
        Destination: "rBuyer",
        Amount: { currency: "XDX", issuer: XDX_ISSUER, value: "10" },
        SendMax: "313",
        Flags: 131072,
      },
      txid: "E".repeat(64),
    },
    "rBuyer"
  );
  assert.equal(swap.order, null);
  assert.equal(swap.activity.side, "buy");
  assert.equal(swap.activity.status, "filled");
});

test("activityFromAmmLpTx reads LP tokens received from ledger metadata", () => {
  const history = activityFromAmmLpTx(
    {
      hash: "A".repeat(64),
      close_time_iso: "2026-08-23T10:00:00.000Z",
      tx: {
        TransactionType: "AMMDeposit",
        Account: "rLp",
        Asset: { currency: "XDX", issuer: XDX_ISSUER },
        Asset2: { currency: "XRP" },
      },
      meta: {
        TransactionResult: "tesSUCCESS",
        AffectedNodes: [
          {
            ModifiedNode: {
              LedgerEntryType: "RippleState",
              FinalFields: {
                Balance: { currency: "03E7A465A6E95CDA21E1110056AA51A71FA55CB9", value: "6100.5985" },
                HighLimit: { issuer: "rLp" },
                LowLimit: { issuer: "rAmm" },
              },
              PreviousFields: {
                Balance: { currency: "03E7A465A6E95CDA21E1110056AA51A71FA55CB9", value: "0" },
              },
            },
          },
        ],
      },
    },
    "rLp"
  );
  assert.equal(history.side, "addLp");
  assert.equal(history.pair, "XDX/XRP");
  assert.equal(history.lp, 6100.5985);
});

test("pendingFromExecution records an AMM deposit as filled LP activity", () => {
  const pending = pendingFromExecution(
    {
      txjson: {
        TransactionType: "AMMDeposit",
        Account: "rLp",
        Asset: { currency: "XDX", issuer: XDX_ISSUER },
        Asset2: { currency: "XRP" },
      },
      txid: "F".repeat(64),
    },
    "rLp"
  );
  assert.equal(pending.order, null);
  assert.equal(pending.activity.side, "addLp");
  assert.equal(pending.activity.pair, "XDX/XRP");
  assert.equal(pending.activity.status, "filled");
});

test("mergeWalletOrders and mergeWalletActivity keep the first copy", () => {
  const orders = mergeWalletOrders(
    [{ account: "rBuyer", pair: "XDX/XRP", side: "bid", price: 0.03, amount: 1000 }],
    [{ account: "rBuyer", pair: "XDX/XRP", side: "bid", price: 0.03, amount: 1000 }]
  );
  assert.equal(orders.length, 1);
  const activity = mergeWalletActivity(
    [{ account: "rBuyer", side: "buy", xdx: 1000, price: 0.03, txid: "E".repeat(64) }],
    [{ account: "rBuyer", side: "buy", xdx: 1000, price: 0.03, txid: "e".repeat(64) }]
  );
  assert.equal(activity.length, 1);
});

test("rippleIso uses the XRPL epoch", () => {
  assert.equal(rippleIso(0), "2000-01-01T00:00:00.000Z");
});

test("activityFromPaymentTx keeps a confirmed market buy and drops engine failures", () => {
  const buy = {
    TransactionType: "Payment",
    Account: "rBuyer",
    Destination: "rBuyer",
    Amount: { currency: "XDX", issuer: XDX_ISSUER, value: "10" },
    SendMax: "313",
  };
  const filled = activityFromPaymentTx(
    {
      hash: "1".repeat(64),
      close_time_iso: "2026-08-23T13:50:00.000Z",
      tx: buy,
      meta: { TransactionResult: "tesSUCCESS" },
    },
    "rBuyer"
  );
  assert.equal(filled.side, "buy");
  assert.equal(filled.status, "filled");
  assert.equal(filled.xdx, 10);
  assert.equal(
    activityFromPaymentTx(
      { tx: buy, meta: { TransactionResult: "tecPATH_DRY" } },
      "rBuyer"
    ),
    null
  );
});

test("activityFromTrustSetTx records a confirmed XDX line", () => {
  const row = activityFromTrustSetTx(
    {
      hash: "2".repeat(64),
      tx: {
        TransactionType: "TrustSet",
        Account: "rBuyer",
        LimitAmount: { currency: "XDX", issuer: XDX_ISSUER, value: "10000000000" },
      },
      meta: { TransactionResult: "tesSUCCESS" },
    },
    "rBuyer"
  );
  assert.equal(row.side, "trustline");
  assert.equal(row.currency, "XDX");
  const pending = pendingFromExecution(
    {
      txjson: {
        TransactionType: "TrustSet",
        Account: "rBuyer",
        LimitAmount: { currency: "XDX", issuer: XDX_ISSUER, value: "10000000000" },
      },
      txid: "3".repeat(64),
    },
    "rBuyer"
  );
  assert.equal(pending.activity.side, "trustline");
  const history = activityFromAccountTx(
    [
      {
        hash: "4".repeat(64),
        tx: {
          TransactionType: "Payment",
          Account: "rBuyer",
          Destination: "rBuyer",
          Amount: { currency: "XDX", issuer: XDX_ISSUER, value: "5" },
          SendMax: "160",
        },
        meta: { TransactionResult: "tesSUCCESS" },
      },
    ],
    "rBuyer"
  );
  assert.equal(history[0].side, "buy");
});

test("rememberPending keeps a just-signed limit until the ledger fetch catches up", () => {
  const pending = pendingFromExecution({ txjson: BUY, txid: "F".repeat(64) }, "rBuyer");
  rememberPending("rBuyer", pending);
  assert.equal(pendingFor("rBuyer").orders[0].amount, 1000);
  assert.equal(pendingFor("rBuyer", { offersKnown: true }).activity[0].side, "buy");
});

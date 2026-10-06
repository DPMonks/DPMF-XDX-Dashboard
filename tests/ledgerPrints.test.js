import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregatePrints,
  change24hFromCandles,
  printsFromAccountTx,
  pruneCandles,
  volumeSince,
} from "../src/utils/ledgerPrints.js";

const AMM = "rPoolAmm111111111111111111111111111";

function payment({ xdxBefore, xdxAfter, xrpBefore, xrpAfter, type = "Payment", result = "tesSUCCESS", iso, hash }) {
  return {
    hash,
    close_time_iso: iso,
    tx: { TransactionType: type, Account: AMM, Fee: "12" },
    meta: {
      TransactionResult: result,
      AffectedNodes: [
        {
          ModifiedNode: {
            LedgerEntryType: "RippleState",
            FinalFields: {
              Balance: { currency: "XDX", value: String(xdxAfter) },
              HighLimit: { issuer: "rXdxIssuer" },
              LowLimit: { issuer: AMM },
            },
            PreviousFields: { Balance: { currency: "XDX", value: String(xdxBefore) } },
          },
        },
        {
          ModifiedNode: {
            LedgerEntryType: "AccountRoot",
            FinalFields: { Account: AMM, Balance: String(xrpAfter) },
            PreviousFields: { Balance: String(xrpBefore) },
          },
        },
      ],
    },
  };
}

test("trade prints use XRP paid per XDX and skip failed or non-swap rows", () => {
  const prints = printsFromAccountTx(
    [
      payment({
        hash: "A",
        iso: "2026-08-26T15:00:00.000Z",
        xdxBefore: 0,
        xdxAfter: 100,
        xrpBefore: 2_000_000,
        xrpAfter: 1_000_000,
      }),
      payment({
        hash: "B",
        iso: "2026-08-26T15:05:00.000Z",
        type: "OfferCreate",
        xdxBefore: 100,
        xdxAfter: 80,
        xrpBefore: 1_000_000,
        xrpAfter: 1_500_000,
      }),
      payment({
        hash: "C",
        iso: "2026-08-26T15:06:00.000Z",
        result: "tecPATH_DRY",
        xdxBefore: 80,
        xdxAfter: 90,
        xrpBefore: 1_500_000,
        xrpAfter: 1_400_000,
      }),
      payment({
        hash: "D",
        iso: "2026-08-26T15:07:00.000Z",
        type: "TrustSet",
        xdxBefore: 80,
        xdxAfter: 80,
        xrpBefore: 1_500_000,
        xrpAfter: 1_499_988,
      }),
    ],
    { account: AMM }
  );
  assert.equal(prints.length, 2);
  assert.equal(prints[0].source, "xrpl-amm");
  assert.equal(prints[0].side, "buy");
  assert.equal(prints[0].xdx, 100);
  assert.ok(Math.abs(prints[0].price - 1.000012 / 100) < 1e-12);
  assert.equal(prints[1].source, "xrpl-offer");
  assert.equal(prints[1].side, "sell");
  assert.equal(prints[1].xdx, 20);
});

test("hourly candles keep OHLC and 1m rows older than 7 days are pruned", () => {
  const now = Date.parse("2026-08-26T16:30:00.000Z");
  const hour = aggregatePrints(
    [
      { timestamp: "2026-08-26T15:10:00.000Z", price: 0.00004, xdx: 10 },
      { timestamp: "2026-08-26T15:40:00.000Z", price: 0.00006, xdx: 15 },
      { timestamp: "2026-08-26T15:50:00.000Z", price: 0.00005, xdx: 5 },
    ],
    "1h",
    now
  );
  assert.equal(hour.length, 1);
  assert.equal(hour[0].open, 0.00004);
  assert.equal(hour[0].high, 0.00006);
  assert.equal(hour[0].low, 0.00004);
  assert.equal(hour[0].close, 0.00005);
  assert.equal(hour[0].volume_xdx, 30);
  assert.equal(hour[0].trades, 3);
  const old = now - 8 * 24 * 60 * 60_000;
  const kept = pruneCandles(
    [
      { bucket: old, close: 1 },
      { bucket: now - 60_000, close: 2 },
    ],
    "1m",
    now
  );
  assert.equal(kept.length, 1);
  assert.equal(kept[0].close, 2);
  assert.equal(pruneCandles([{ bucket: old, close: 1 }], "1d", now).length, 1);
});

test("change and 24h volume come from candle closes", () => {
  const now = Date.parse("2026-08-26T16:00:00.000Z");
  const rows = [
    { bucket: now - 25 * 60 * 60_000, close: 0.00004, volume_xdx: 100 },
    { bucket: now - 60 * 60_000, close: 0.00005, volume_xdx: 40 },
  ];
  assert.ok(Math.abs(change24hFromCandles(rows, now) - 25) < 1e-9);
  assert.equal(volumeSince(rows, now), 40);
  assert.equal(change24hFromCandles([rows[1]], now), null);
});

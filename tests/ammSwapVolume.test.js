import test from "node:test";
import assert from "node:assert/strict";
import { XDX_HEX } from "../src/constants/ledger.js";
import { rippleCloseIso, swapVolumeFromAccountTx, xdxDeltaFromAmmMeta } from "../src/utils/ammSwapVolume.js";
import { mergeTradePrints } from "../src/xdxTrades.js";
import { mergeTradeFlows } from "../server/catalogSwitch.js";
import { mergeVolumeMaps } from "../server/ammPoolVolume.js";
import { preferRailwayXdxVolume } from "../src/utils/lpVolume.js";

const AMM = "rPoolAmm111111111111111111111111111";

function rippleState(prev, next) {
  return {
    ModifiedNode: {
      LedgerEntryType: "RippleState",
      FinalFields: {
        Balance: { currency: XDX_HEX, value: String(next) },
        HighLimit: { issuer: AMM },
        LowLimit: { issuer: "rOther" },
      },
      PreviousFields: {
        Balance: { currency: XDX_HEX, value: String(prev) },
      },
    },
  };
}

test("xdxDeltaFromAmmMeta reads the AMM XDX trust line only", () => {
  const delta = xdxDeltaFromAmmMeta(
    {
      AffectedNodes: [
        rippleState(1000, 800),
        {
          ModifiedNode: {
            LedgerEntryType: "RippleState",
            FinalFields: {
              Balance: { currency: "USD", value: "5" },
              HighLimit: { issuer: AMM },
            },
            PreviousFields: { Balance: { currency: "USD", value: "4" } },
          },
        },
      ],
    },
    AMM
  );
  assert.equal(delta, -200);
});

test("swapVolumeFromAccountTx sums 24h Payments and skips LP deposits", () => {
  const now = Date.parse("2026-08-26T16:00:00.000Z");
  const counted = swapVolumeFromAccountTx(
    [
      {
        close_time_iso: "2026-08-26T15:00:00.000Z",
        tx: { TransactionType: "Payment" },
        meta: { TransactionResult: "tesSUCCESS", AffectedNodes: [rippleState(1000, 700)] },
      },
      {
        close_time_iso: "2026-08-26T14:00:00.000Z",
        tx: { TransactionType: "AMMDeposit" },
        meta: { TransactionResult: "tesSUCCESS", AffectedNodes: [rippleState(700, 900)] },
      },
      {
        close_time_iso: "2026-08-24T15:00:00.000Z",
        tx: { TransactionType: "Payment" },
        meta: { TransactionResult: "tesSUCCESS", AffectedNodes: [rippleState(900, 400)] },
      },
    ],
    { ammAccount: AMM, now }
  );
  assert.equal(counted.volume24hXdx, 300);
  assert.equal(counted.trades24h, 1);
  assert.equal(counted.complete, true);
  assert.equal(counted.source, "xrpl-amm");
});

test("rippleCloseIso understands ledger close times and ripple epoch", () => {
  assert.equal(rippleCloseIso({ close_time_iso: "2026-08-26T16:48:01.000Z" }), "2026-08-26T16:48:01.000Z");
  const iso = rippleCloseIso({ date: 804556800 });
  assert.ok(iso.startsWith("2025-") || iso.startsWith("2026-") || iso.startsWith("20"));
});

test("mergeTradePrints keeps other-pair history next to a stale XRP tape", () => {
  const merged = mergeTradePrints(
    [{ timestamp: "2026-08-23T23:00:00.000Z", pool: "XDX/XRP", xdx: 10, side: "buy" }],
    [{ timestamp: "2026-08-26T12:00:00.000Z", pool: "XDX/CSC", xdx: 40, side: "sell" }]
  );
  assert.equal(merged[0].pool, "XDX/CSC");
  assert.equal(merged.length, 2);
});

test("mergeTradeFlows does not let a stale XRP-only DB tape hide live prints", () => {
  const merged = mergeTradeFlows(
    [{ timestamp: "2026-08-23T23:00:00.000Z", pool: "XDX/XRP", xdx: 10 }],
    [{ timestamp: "2026-08-26T16:00:00.000Z", pool: "XDX/XIO", xdx: 13325 }]
  );
  assert.ok(merged.some((row) => row.pool === "XDX/XIO"));
  assert.ok(merged.some((row) => row.pool === "XDX/XRP"));
});

test("mergeVolumeMaps keeps the larger 24h XDX print", () => {
  const merged = mergeVolumeMaps(
    { "XDX/XRP": { volume24hXdx: 1_400_000, source: "xrpl.to-history" } },
    { "XDX/XIO": { volume24hXdx: 13325, source: "xrpl-amm" }, "XDX/XRP": { volume24hXdx: 1_200_000, source: "xrpl-amm" } }
  );
  assert.equal(merged["XDX/XRP"].volume24hXdx, 1_400_000);
  assert.equal(merged["XDX/XIO"].volume24hXdx, 13325);
});

test("preferRailwayXdxVolume keeps a tagged thin-pool print", () => {
  const kept = preferRailwayXdxVolume(
    { volume24hXdx: 6037, volumeSource: "xrpl-amm" },
    { volume24h: 0 }
  );
  assert.equal(kept.volume24hXdx, 6037);
  const usd = preferRailwayXdxVolume(
    { volume24h: 197, xrpUsd: 1.48 },
    { volume24hXdx: 4_200_000, volumeSource: "xrpl.to-token" }
  );
  assert.equal(usd.volume24hXdx, 4_200_000);
});

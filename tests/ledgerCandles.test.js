import test from "node:test";
import assert from "node:assert/strict";
import { loadLedgerCandles, resetLedgerCandleCache } from "../server/ledgerCandles.js";

const AMM = "rPoolAmm111111111111111111111111111";

function payment(hash, iso) {
  return {
    hash,
    close_time_iso: iso,
    tx: { TransactionType: "Payment", Account: AMM, Fee: "12" },
    meta: {
      TransactionResult: "tesSUCCESS",
      AffectedNodes: [
        {
          ModifiedNode: {
            LedgerEntryType: "RippleState",
            FinalFields: {
              Balance: { currency: "XDX", value: "100" },
              HighLimit: { issuer: "rXdxIssuer" },
              LowLimit: { issuer: AMM },
            },
            PreviousFields: { Balance: { currency: "XDX", value: "0" } },
          },
        },
        {
          ModifiedNode: {
            LedgerEntryType: "AccountRoot",
            FinalFields: { Account: AMM, Balance: "1000000" },
            PreviousFields: { Balance: "2000000" },
          },
        },
      ],
    },
  };
}

test("ledger candles price in live XRP and do not double count a seen hash", async () => {
  resetLedgerCandleCache();
  const now = Date.parse("2026-08-26T16:00:00.000Z");
  let calls = 0;
  const fetchImpl = async (_url, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    if (body.method !== "account_tx") {
      return { ok: true, json: async () => ({ result: {} }) };
    }
    calls += 1;
    return {
      ok: true,
      json: async () => ({
        result: {
          status: "success",
          transactions: [payment("HASH1", "2026-08-26T15:00:00.000Z")],
          marker: { ledger: calls },
        },
      }),
    };
  };
  const first = await loadLedgerCandles({
    fetchImpl,
    skipStore: true,
    now,
    xrpUsd: 2,
    fresh: true,
    account: AMM,
  });
  assert.equal(first.source, "xrpl-ledger");
  assert.equal(first.stored, "memory");
  assert.equal(first.partial, true);
  assert.equal(first.price_usd_basis, "live-xrp-usd");
  assert.equal(first.rows.length, 1);
  assert.ok(Math.abs(first.rows[0].price_xrp - 1.000012 / 100) < 1e-12);
  assert.ok(Math.abs(first.rows[0].price_usd - (1.000012 / 100) * 2) < 1e-12);
  assert.equal(first.rows[0].volume_xdx, 100);
  assert.equal(first.intervals["1h"].count, 1);
  assert.ok(first.intervals["1m"].count >= 1);
  const second = await loadLedgerCandles({
    fetchImpl,
    skipStore: true,
    now: now + 1000,
    xrpUsd: 2,
    fresh: true,
    account: AMM,
  });
  assert.equal(second.partial, true);
  assert.equal(second.rows[0].volume_xdx, 100);
  assert.equal(second.rows[0].trades, 1);
  resetLedgerCandleCache();
});

test("a busy ledger node stops the candle page walk", async () => {
  resetLedgerCandleCache();
  const started = Date.now();
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ result: { error: "tooBusy" } }),
  });
  const body = await loadLedgerCandles({
    fetchImpl,
    skipStore: true,
    now: Date.parse("2026-08-26T16:00:00.000Z"),
    fresh: true,
    account: AMM,
  });
  assert.equal(body.stale, true);
  assert.equal(body.rows.length, 0);
  assert.ok(Date.now() - started >= 1000);
  resetLedgerCandleCache();
});

import test from "node:test";
import assert from "node:assert/strict";
import { RLUSD_HEX, RLUSD_ISSUER } from "../src/constants/ledger.js";
import { loadLedgerXrpUsd, loadXrpSpot, resetFiatQuoteMemory } from "../server/fiatQuotes.js";

const rlusd = (value) => ({ currency: RLUSD_HEX, issuer: RLUSD_ISSUER, value: String(value) });

test("XRP/USD comes from the ledger XRP/RLUSD pool, with a 24h change from a day of ledgers back", async () => {
  const calls = [];
  const rpc = async (method, params) => {
    calls.push(params.ledger_index);
    if (params.ledger_index === "validated") return { ledger_index: 100_000, amm: { amount: "1000000000", amount2: rlusd(2500) } };
    return { amm: { amount: "1000000000", amount2: rlusd(2000) } };
  };
  const quote = await loadLedgerXrpUsd({ rpc, ledgerRate: async () => 0.4 });
  assert.equal(quote.source, "xrpl_rlusd");
  assert.ok(Math.abs(quote.usd - 2.5) < 1e-9);
  assert.ok(Math.abs(quote.change24h - 25) < 1e-9);
  assert.deepEqual(calls, ["validated", 100_000 - 21_600]);
});

test("an insane ledger rate is refused", async () => {
  assert.equal(await loadLedgerXrpUsd({ rpc: async () => ({}), ledgerRate: async () => 1e-6 }), null);
});

test("outside quote only when the ledger read fails", async () => {
  resetFiatQuoteMemory();
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return { ok: true, json: async () => ({ ripple: { usd: 2.4, usd_24h_change: 1 } }) };
  };
  const ok = await loadXrpSpot({ fetchImpl, rpc: async () => ({}), ledgerRate: async () => 0.4 });
  assert.equal(ok.source, "xrpl_rlusd");
  assert.equal(seen.length, 0);
  const fallback = await loadXrpSpot({ fetchImpl, rpc: async () => ({}), ledgerRate: async () => 0 });
  assert.equal(fallback.source, "coingecko");
  assert.equal(seen.length, 1);
});

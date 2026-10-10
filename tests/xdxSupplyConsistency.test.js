import test from "node:test";
import assert from "node:assert/strict";
import { XDX_ISSUER } from "../src/constants/ledger.js";
import {
  discoverLedgerXdxPools,
  recordXdxHolderLines,
  resetLedgerAmmDiscoveryCache,
} from "../server/ledgerAmmDiscover.js";
import { issuerSupplyFromGatewayBalances } from "../server/liveCatalog.js";
import { dbHolderCountsVerified } from "../server/readIndexerDb.js";
import { mergeCountPayload, mergeLiveOverview } from "../server/catalogSwitch.js";
import { composeTokenDetails } from "../src/tokenDetails.js";
import { keepKnownTokenDetails, pickLedgerCount, pickLedgerSupply } from "../src/tokenDetails.js";

const LEDGER_ISSUED = 9_982_003_928.375591;
const LEDGER_LOCKED = 17_996_071.62440872;

function rpcFetch(handler) {
  return async (_url, options) => {
    const body = JSON.parse(options.body);
    const result = await handler(body.method, body.params?.[0] || {});
    return { ok: true, json: async () => ({ result }) };
  };
}

test("a replayed account_lines page cannot count the same holder twice", () => {
  const map = new Map();
  const page = [
    { account: "rA", currency: "XDX", balance: "-10" },
    { account: "rB", currency: "XDX", balance: "0" },
  ];
  recordXdxHolderLines(map, page);
  const again = recordXdxHolderLines(map, page);
  assert.equal(again.holders, 1);
  assert.equal(again.trustlines, 2);
  assert.equal(again.sum, 10);
});

test("the issuer line walk dedupes overlap when a marker restarts on another node", async () => {
  resetLedgerAmmDiscoveryCache();
  let reads = 0;
  const fetchImpl = rpcFetch((method, params) => {
    if (method === "account_lines") {
      reads += 1;
      const lines = [
        { account: "rHolder1", currency: "XDX", balance: "-5", limit_peer: "10" },
        { account: "rHolder2", currency: "XDX", balance: "-7", limit_peer: "10" },
        { account: "rEmpty1", currency: "XDX", balance: "0", limit_peer: "10" },
      ];
      // Page 2 replays page 1 (what a marker handed to a different node can do).
      if (!params.marker) return { lines, marker: "m1", ledger_index: 100 };
      if (params.marker === "m1") {
        return { lines: [...lines, { account: "rHolder3", currency: "XDX", balance: "-1", limit_peer: "10" }], ledger_index: 100 };
      }
    }
    return { error: "actNotFound" };
  });
  const found = await discoverLedgerXdxPools({ fetchImpl, fresh: true, now: 1_000, confirmBudgetMs: 0 });
  assert.equal(reads, 2);
  assert.equal(found.holders, 3);
  assert.equal(found.trustlines, 4);
  resetLedgerAmmDiscoveryCache();
});

test("every page after the first is pinned to the first page's ledger", async () => {
  resetLedgerAmmDiscoveryCache();
  const seen = [];
  const fetchImpl = rpcFetch((method, params) => {
    if (method === "account_lines") {
      seen.push(params.ledger_index);
      if (!params.marker) return { lines: [{ account: "rH1", currency: "XDX", balance: "-1" }], marker: "m1", ledger_index: 555 };
      return { lines: [{ account: "rH2", currency: "XDX", balance: "-1" }], ledger_index: 555 };
    }
    return { error: "actNotFound" };
  });
  await discoverLedgerXdxPools({ fetchImpl, fresh: true, now: 1_000, confirmBudgetMs: 0 });
  assert.deepEqual(seen, ["validated", 555]);
  resetLedgerAmmDiscoveryCache();
});

test("a walk that has not reached the last page reports no holder figure", async () => {
  resetLedgerAmmDiscoveryCache();
  const fetchImpl = rpcFetch((method, params) => {
    if (method === "account_lines") {
      if (!params.marker) return { lines: [{ account: "rH1", currency: "XDX", balance: "-1" }], marker: "m1", ledger_index: 9 };
      return { error: "noNetwork" };
    }
    return { error: "actNotFound" };
  });
  const found = await discoverLedgerXdxPools({ fetchImpl, fresh: true, now: 1_000, lineBudgetMs: 1_200, confirmBudgetMs: 0 });
  assert.equal(found.holders, null);
  assert.equal(found.trustlines, null);
  assert.equal(found.holders_stale, true);
  resetLedgerAmmDiscoveryCache();
});

test("gateway_balances gives circulating as the obligation and the rest as issuer locked", () => {
  const body = issuerSupplyFromGatewayBalances({
    account: XDX_ISSUER,
    obligations: { XDX: "9982003928.375591" },
    ledger_index: 107562448,
  });
  assert.equal(body.circulating, LEDGER_ISSUED);
  assert.equal(body.issued, LEDGER_ISSUED);
  assert.ok(Math.abs(body.issuer_locked - 17_996_071.624409) < 0.001);
  assert.equal(body.source, "xrpl");
});

test("an empty or busy gateway_balances reply is unknown, never the full 10B", () => {
  assert.equal(issuerSupplyFromGatewayBalances({ obligations: {} }), null);
  assert.equal(issuerSupplyFromGatewayBalances({ error: "tooBusy" }), null);
  assert.equal(issuerSupplyFromGatewayBalances(null), null);
});

test("indexer holder rows only count when they add up to the ledger obligation", () => {
  // Complete snapshot.
  assert.deepEqual(
    dbHolderCountsVerified({ issued: LEDGER_ISSUED, holders: 15_892, lines: 19_986 }, LEDGER_ISSUED),
    { holders: 15_892, trustlines: 19_986 }
  );
  // Half written snapshot: the 3.28B sum seen on bad loads.
  assert.equal(dbHolderCountsVerified({ issued: 3_277_845_195, holders: 30_137, lines: 30_137 }, LEDGER_ISSUED), null);
  // Doubled snapshot.
  assert.equal(dbHolderCountsVerified({ issued: LEDGER_ISSUED * 2, holders: 31_784 }, LEDGER_ISSUED), null);
  // Ledger unknown.
  assert.equal(dbHolderCountsVerified({ issued: LEDGER_ISSUED, holders: 15_892 }, 0), null);
  // A table of holders only cannot give a trust line count.
  assert.deepEqual(
    dbHolderCountsVerified({ issued: LEDGER_ISSUED, holders: 15_892, lines: 15_892 }, LEDGER_ISSUED),
    { holders: 15_892, trustlines: null }
  );
});

test("a partial live line count does not replace the stored ledger count", () => {
  const merged = mergeCountPayload({ count: 15_892, source: "db" }, { count: null, source: "xrpl-lines", stale: true });
  assert.equal(merged.count, 15_892);
});

test("overview keeps one ledger pair for circulating and issuer locked", () => {
  const db = { circulating: null, issuer_locked: null, holder_count: null, xdxUsd: 0.00005 };
  const live = {
    xdxUsd: 0.00005,
    circulating: LEDGER_ISSUED,
    circulating_supply: LEDGER_ISSUED,
    burned_supply: LEDGER_LOCKED,
    issuer_locked: LEDGER_LOCKED,
    holder_count: 15_892,
    trustline_count: 19_986,
    holders_source: "xrpl-lines",
  };
  const merged = mergeLiveOverview(db, live);
  assert.equal(merged.circulating, LEDGER_ISSUED);
  assert.equal(merged.issuer_locked, LEDGER_LOCKED);
  assert.equal(merged.holder_count, 15_892);
  assert.equal(merged.trustline_count, 19_986);
});

test("client picks the ledger issuer read over an overview figure that disagrees", () => {
  const supply = pickLedgerSupply(
    { circulating: 3_277_845_195, issuer_locked: 6_722_154_805 },
    { circulating: LEDGER_ISSUED, issued: LEDGER_ISSUED, issuer_locked: LEDGER_LOCKED, source: "xrpl" }
  );
  assert.equal(supply.circulating, LEDGER_ISSUED);
  assert.equal(supply.issuer_locked, LEDGER_LOCKED);
});

test("client never shows circulating and burned that do not add up to 10B", () => {
  const supply = pickLedgerSupply({ circulating: 3_277_845_195, issuer_locked: LEDGER_LOCKED }, {});
  assert.equal(supply.circulating, null);
  assert.equal(supply.issuer_locked, null);
  const derived = pickLedgerSupply({ circulating: LEDGER_ISSUED, issuer_locked: null }, {});
  assert.equal(derived.circulating, LEDGER_ISSUED);
  assert.ok(Math.abs(derived.issuer_locked - LEDGER_LOCKED) < 0.001);
});

test("client takes the complete ledger line count and never the larger of two", () => {
  assert.equal(pickLedgerCount({ count: 15_892, source: "xrpl-lines", stale: false }, 30_137).count, 15_892);
  assert.equal(pickLedgerCount({ count: null, source: "xrpl-lines", stale: true }, 15_892).count, 15_892);
  assert.equal(pickLedgerCount({ count: 30_137, source: "db" }, 15_892, "xrpl-lines").count, 15_892);
  assert.equal(pickLedgerCount({}, null).count, null);
});

test("a refresh with a missing figure keeps the last ledger figure on screen", () => {
  const prev = composeTokenDetails({
    overview: { circulating: LEDGER_ISSUED, issuer_locked: LEDGER_LOCKED, holder_count: 15_892, trustline_count: 19_986 },
  });
  const next = composeTokenDetails({ overview: {} });
  const kept = keepKnownTokenDetails(prev, next);
  assert.equal(kept.circulating, LEDGER_ISSUED);
  assert.equal(kept.issuerLocked, LEDGER_LOCKED);
  assert.equal(kept.holders, 15_892);
  assert.equal(kept.trustlines, 19_986);
  const moved = keepKnownTokenDetails(prev, composeTokenDetails({ overview: { holder_count: 15_900 } }));
  assert.equal(moved.holders, 15_900);
});

test("look alike issuer codes are not counted as XDX holders or trust lines", () => {
  const totals = recordXdxHolderLines(new Map(), [
    { account: "rA", currency: "XDX", balance: "-1" },
    { account: "rB", currency: "xdx", balance: "-1" },
    { account: "rC", currency: "Xdx", balance: "0" },
    { account: "rD", currency: "5844580000000000000000000000000000000000", balance: "-2" },
  ]);
  assert.equal(totals.holders, 1);
  assert.equal(totals.trustlines, 1);
  assert.equal(totals.sum, 1);
});

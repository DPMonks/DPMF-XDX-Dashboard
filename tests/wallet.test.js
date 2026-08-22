import test from "node:test";
import assert from "node:assert/strict";
import {
  compareBarPercents,
  composeWalletSnapshot,
  emptyWalletSnapshot,
  lpPositionFromPool,
  supplyShares,
  walletActivity,
  xrpReserveBreakdown,
  xdxFiatValues,
} from "../src/wallet/composeWallet.js";

test("xrpReserveBreakdown stacks spendable on top of base and owner reserve", () => {
  const row = xrpReserveBreakdown({
    balance: 25,
    ownerCount: 10,
    reserveBaseDrops: 1_000_000,
    reserveIncDrops: 200_000,
  });
  assert.equal(row.baseReserve, 1);
  assert.equal(row.ownerReserve, 2);
  assert.equal(row.reserved, 3);
  assert.equal(row.spendable, 22);
});

test("compareBarPercents sizes three XRP bars against the largest value", () => {
  const [reserve, spendable, total] = compareBarPercents(3, 22, 25);
  assert.equal(reserve, 12);
  assert.equal(spendable, 88);
  assert.equal(total, 100);
  assert.deepEqual(compareBarPercents(0, 0, 0), [0, 0, 0]);
});

test("supplyShares uses circulating and AMM XDX, not arcs", () => {
  const shares = supplyShares(1_200_000, 10_000_000_000, 80_000_000);
  assert.ok(Math.abs(shares.circulatingPct - 0.012) < 1e-9);
  assert.ok(Math.abs(shares.ammPct - 1.5) < 1e-9);
});

test("xdxFiatValues keeps USD and GBP from recorded prices", () => {
  const fiat = xdxFiatValues(1000, { xdxUsd: 0.00004, xdxGbp: 0.00003, xdxXrp: 0.00003 });
  assert.ok(Math.abs(fiat.usd - 0.04) < 1e-12);
  assert.ok(Math.abs(fiat.gbp - 0.03) < 1e-12);
  assert.ok(Math.abs(fiat.xrp - 0.03) < 1e-12);
});

test("lpPositionFromPool estimates withdraw from pool share", () => {
  const row = lpPositionFromPool(100, {
    pool_name: "XDX/XRP",
    lp_supply: 1000,
    reserve_asset: 50_000,
    reserve_currency: 2,
    xdx_pct: 55,
    quote_pct: 45,
  });
  assert.equal(row.lp_share_percent, 10);
  assert.equal(row.withdraw_estimate_xdx, 5000);
  assert.equal(row.withdraw_estimate_quote, 0.2);
});

test("composeWalletSnapshot stays blank until an address is signed in", () => {
  const empty = emptyWalletSnapshot(null);
  assert.equal(empty.signedIn, false);
  assert.equal(empty.filled, false);
  assert.equal(empty.xdx.usd, null);

  const filled = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 12, xdx: 5000 },
    prices: { xdxUsd: 0.00004, xdxGbp: 0.00003 },
    token: { circulating: 10_000_000_000, xdxPerXrp: 0.00003 },
    pools: [{ pool_name: "XDX/XRP", reserve_asset: 60_000_000 }],
  });
  assert.equal(filled.signedIn, true);
  assert.equal(filled.filled, true);
  assert.equal(filled.xdx.usd, 0.2);
});

test("walletActivity only keeps the signed-in account", () => {
  const rows = walletActivity(
    [
      { account: "rMine", side: "buy", xdx: 10, timestamp: "2026-08-22T00:00:00Z" },
      { account: "rOther", side: "sell", xdx: 4, timestamp: "2026-08-22T00:01:00Z" },
    ],
    "rMine"
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].xdx, 10);
});

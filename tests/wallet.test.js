import test from "node:test";
import assert from "node:assert/strict";
import {
  composeWalletSnapshot,
  emptyWalletSnapshot,
  lpFeeEarnings,
  lpPositionFromPool,
  normalizeWalletPair,
  preferredWalletPair,
  sortWalletPairs,
  supplyShares,
  tradingFeeRate,
  ammFeePercent,
  formatAmmFee,
  walletActivity,
  xrpBarPercents,
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

test("xrpReserveBreakdown prefers ledger drops and does not reserve more than the total", () => {
  const row = xrpReserveBreakdown({
    balance: 0,
    balanceDrops: 25_000_000,
    ownerCount: 10,
    reserveBaseDrops: 1_000_000,
    reserveIncDrops: 200_000,
  });
  assert.equal(row.balance, 25);
  assert.equal(row.reserved, 3);
  assert.equal(row.spendable, 22);

  const emptyHold = xrpReserveBreakdown({
    balance: 0,
    balanceDrops: 0,
    ownerCount: 25,
  });
  assert.equal(emptyHold.balance, 0);
  assert.equal(emptyHold.reserved, 0);
  assert.equal(emptyHold.spendable, 0);
  assert.equal(emptyHold.required, 6);
});

test("xrpBarPercents keeps total XRP as a full reference bar", () => {
  const bars = xrpBarPercents({ reserved: 3, spendable: 22, total: 25 });
  assert.equal(bars.reservePct, 12);
  assert.equal(bars.spendPct, 88);
  assert.equal(bars.totalPct, 100);

  const zero = xrpBarPercents({ reserved: 0, spendable: 0, total: 0 });
  assert.equal(zero.reservePct, 0);
  assert.equal(zero.spendPct, 0);
  assert.equal(zero.totalPct, 100);

  const blank = xrpBarPercents({ reserved: 3, spendable: 22, total: 25 }, false);
  assert.equal(blank.totalPct, 0);
});

test("supplyShares compares the wallet to circulating and total XDX, never above 100%", () => {
  const shares = supplyShares(1_200_000, 10_000_000_000, 10_000_000_000);
  assert.ok(Math.abs(shares.circulatingPct - 0.012) < 1e-9);
  assert.ok(Math.abs(shares.supplyPct - 0.012) < 1e-9);

  const capped = supplyShares(20_000_000_000, 5_000_000_000, 10_000_000_000);
  assert.equal(capped.circulatingPct, 100);
  assert.equal(capped.supplyPct, 100);
});

test("preferredWalletPair always defaults to XDX/XRP when that pool is held", () => {
  assert.deepEqual(sortWalletPairs(["XDX/USDC", "XDX/XRP", "XDX/RLUSD"]), [
    "XDX/XRP",
    "XDX/RLUSD",
    "XDX/USDC",
  ]);
  assert.equal(preferredWalletPair(["XDX/USDC", "XDX/XRP"], ""), "XDX/XRP");
  assert.equal(preferredWalletPair(["XDX/USDC", "XDX/XRP"], "XDX/XRP"), "XDX/XRP");
  assert.equal(preferredWalletPair(["XDX/USDC", "XDX/XRP"], "XDX/USDC"), "XDX/USDC");
  assert.equal(preferredWalletPair(["XDX/USDC"], ""), "XDX/USDC");
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

test("lpPositionFromPool keeps a known share when catalog supply is missing", () => {
  const row = lpPositionFromPool(2840.23, {
    pool_name: "XDX/USDC",
    quote: "USDC",
    lp_share_percent: 1.25,
    withdraw_estimate_xdx: 4000,
    withdraw_estimate_quote: 12.5,
  });
  assert.equal(row.pool, "XDX/USDC");
  assert.equal(row.lp_share_percent, 1.25);
  assert.equal(row.withdraw_estimate_xdx, 4000);
  assert.equal(row.withdraw_estimate_quote, 12.5);
});

test("composeWalletSnapshot fills non-XRP LP share and does not drop it when AMM supply is blank", () => {
  const computed = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 10, xdx: 1 },
    token: { circulating: 10_000_000_000 },
    pools: [
      { pool_name: "XDX/USDC", quote: "USDC", lp_supply: 284_023, reserve_asset: 80_000, reserve_currency: 250 },
    ],
    lpRows: [{ pool_name: "XDX/USDC", lp_balance: 2840.23 }],
  });
  const usdc = computed.lp.find((row) => row.pool === "XDX/USDC");
  assert.ok(usdc);
  assert.ok(Math.abs(usdc.lp_share_percent - 1) < 1e-9);
  assert.ok(Math.abs(usdc.withdraw_estimate_xdx - 800) < 1e-6);
  assert.ok(Math.abs(usdc.withdraw_estimate_quote - 2.5) < 1e-6);

  const kept = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 10, xdx: 1 },
    token: { circulating: 10_000_000_000 },
    pools: [{ pool_name: "XDX/USDC", quote: "USDC" }],
    lpRows: [
      {
        pool_name: "XDX/USDC",
        lp_balance: 2840.23,
        lp_share_percent: 1.25,
        withdraw_estimate_xdx: 4000,
        withdraw_estimate_quote: 12.5,
      },
    ],
  });
  const keptUsdc = kept.lp.find((row) => row.pool === "XDX/USDC");
  assert.equal(keptUsdc.lp_share_percent, 1.25);
  assert.equal(keptUsdc.withdraw_estimate_xdx, 4000);
});

test("composeWalletSnapshot keeps every LP pair and the rich-list rank", () => {
  assert.equal(normalizeWalletPair("rlusd"), "XDX/RLUSD");
  const filled = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 0, xdx: 5000 },
    account: { balance_drops: 12_000_000, owner_count: 5 },
    prices: { xdxUsd: 0.00004, xdxGbp: 0.00003 },
    token: { circulating: 10_000_000_000, xdxPerXrp: 0.00003 },
    rank: 4,
    pools: [
      { pool_name: "XDX/XRP", lp_supply: 1000, reserve_asset: 50_000, reserve_currency: 2, xdx_pct: 50, quote_pct: 50 },
      { pool_name: "XDX/RLUSD", lp_supply: 200, reserve_asset: 8000, reserve_currency: 10, xdx_pct: 40, quote_pct: 60 },
    ],
    lpRows: [
      { pool_name: "XDX/XRP", lp_balance: 100 },
      { pool: "XDX/RLUSD", lp_balance: 20 },
    ],
  });
  assert.equal(filled.rank, 4);
  assert.equal(filled.xrp.balance, 12);
  assert.deepEqual(
    filled.lp.map((row) => row.pool).sort(),
    ["XDX/RLUSD", "XDX/XRP"]
  );
  const rlusd = filled.lp.find((row) => row.pool === "XDX/RLUSD");
  assert.equal(rlusd.withdraw_estimate_xdx, 800);
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

test("lpFeeEarnings sums 24h pool fees across every LP position", () => {
  assert.equal(tradingFeeRate(1000), 0.01);
  assert.equal(ammFeePercent(0), 0);
  assert.equal(ammFeePercent(null), 0);
  assert.equal(ammFeePercent(1), 1);
  assert.equal(ammFeePercent(1000), 1);
  assert.equal(ammFeePercent(500), 0.5);
  assert.equal(formatAmmFee(null), "0%");
  assert.equal(formatAmmFee(0), "0%");
  assert.equal(formatAmmFee(1), "1%");
  assert.equal(formatAmmFee(1000), "1%");
  assert.match(formatAmmFee(0.000001), /0\.000001%/);
  const now = Date.parse("2026-08-22T12:00:00.000Z");
  const fees = lpFeeEarnings(
    [
      {
        pool: "XDX/XRP",
        lp_share_percent: 10,
        withdraw_estimate_xdx: 1000,
        trading_fee: 1000,
      },
      {
        pool: "XDX/USDC",
        lp_share_percent: 1,
        withdraw_estimate_xdx: 800,
        trading_fee: 500,
        volume24h: 20_000,
      },
    ],
    {
      xdxUsd: 0.00004,
      now,
      flows: [
        { pool: "XDX/XRP", xdx: 10_000, timestamp: "2026-08-22T10:00:00.000Z" },
        { pool: "XDX/XRP", xdx: 5_000, timestamp: "2026-08-21T10:00:00.000Z" },
      ],
    }
  );
  assert.equal(fees.xdx, 10_000 * 0.01 * 0.1 + 20_000 * 0.005 * 0.01);
  assert.ok(Math.abs(fees.usd - fees.xdx * 0.00004) < 1e-12);
  assert.ok(fees.pct24h > 0);
  assert.ok(fees.pct24h <= 100);
});

test("composeWalletSnapshot totals LP fee earnings after sign-in", () => {
  const filled = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 10, xdx: 1 },
    prices: { xdxUsd: 0.00004 },
    token: { circulating: 10_000_000_000 },
    pools: [
      {
        pool_name: "XDX/XRP",
        lp_supply: 1000,
        reserve_asset: 50_000,
        reserve_currency: 2,
        trading_fee: 1000,
      },
    ],
    lpRows: [{ pool_name: "XDX/XRP", lp_balance: 100 }],
    flows: [{ pool: "XDX/XRP", xdx: 5_000, timestamp: new Date().toISOString() }],
  });
  assert.ok(filled.fees.xdx > 0);
  assert.ok(filled.fees.usd > 0);
  assert.equal(emptyWalletSnapshot(null).fees.xdx, null);
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

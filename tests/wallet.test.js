import test from "node:test";
import assert from "node:assert/strict";
import {
  composeWalletSnapshot,
  emptyWalletSnapshot,
  preferFilledWalletSnapshot,
  walletAvailableAmounts,
  lpFeeEarnings,
  lpPositionFromPool,
  resolveLpPairName,
  normalizeWalletPair,
  preferredWalletPair,
  sortWalletPairs,
  walletXdxPairs,
  supplyShares,
  tradingFeeRate,
  ammFeePercent,
  formatAmmFee,
  walletActivity,
  withdrawQuoteLabel,
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
  assert.equal(emptyHold.balance, null);
  assert.equal(emptyHold.reserved, null);
  assert.equal(emptyHold.spendable, null);
  assert.equal(emptyHold.required, null);

  const missingLedger = xrpReserveBreakdown({
    balance: 18.5,
    balanceDrops: null,
    ownerCount: 4,
  });
  assert.equal(missingLedger.balance, 18.5);
  assert.equal(missingLedger.spendable, 16.7);

  const zeroDrops = xrpReserveBreakdown({
    balance: 57.1375,
    balanceDrops: 0,
    ownerCount: 4,
  });
  assert.equal(zeroDrops.balance, 57.1375);
});

test("xrpBarPercents keeps total XRP as a full reference bar", () => {
  const bars = xrpBarPercents({ reserved: 3, spendable: 22, total: 25 });
  assert.equal(bars.reservePct, 12);
  assert.equal(bars.spendPct, 88);
  assert.equal(bars.totalPct, 100);

  const zero = xrpBarPercents({ reserved: 0, spendable: 0, total: 0 });
  assert.equal(zero.reservePct, 0);
  assert.equal(zero.spendPct, 0);
  assert.equal(zero.totalPct, 0);

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

test("composeWalletSnapshot adds XDX line positions the LP API omitted", () => {
  const snap = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 10, xdx: 1000 },
    lpRows: [{ pool_name: "XDX/XRP", lp_balance: 100 }],
    lines: [
      { currency: "03BCD44104644B711C58CD14CD13CBA65757CFBE", issuer: "rLbBzF9oxntVf4XxcyakNKJTci4yqSmQUu", balance: "20", lp: true },
      { currency: "03CCC22222222222222222222222222222222222", issuer: "rXioAmm111111111111111111111111111", balance: "5", lp: true },
    ],
    pools: [
      { pool_name: "XDX/XRP", lp_supply: 1000, reserve_asset: 50_000, reserve_currency: 2 },
      { pool_name: "XDX/RLUSD", lp_supply: 200, reserve_asset: 8000, reserve_currency: 10, amm_account: "rLbBzF9oxntVf4XxcyakNKJTci4yqSmQUu", lp_currency: "03BCD44104644B711C58CD14CD13CBA65757CFBE" },
      { pool_name: "XDX/XIO", lp_supply: 50, reserve_asset: 2000, reserve_currency: 1, amm_account: "rXioAmm111111111111111111111111111", lp_currency: "03CCC22222222222222222222222222222222222" },
      { pool_name: "SOLO/XRP", lp_supply: 10, reserve_asset: 1, reserve_currency: 1, amm_account: "rOther", lp_currency: "03AAA11111111111111111111111111111111111" },
    ],
  });
  assert.deepEqual(walletXdxPairs(snap.lp), ["XDX/XRP", "XDX/RLUSD", "XDX/XIO"]);
  assert.equal(snap.lp.find((row) => row.pool === "XDX/XIO").lp_balance, 5);
  assert.ok(!snap.lp.some((row) => String(row.pool).includes("SOLO")));
});

test("xdxFiatValues keeps USD and GBP from recorded prices", () => {
  const fiat = xdxFiatValues(1000, { xdxUsd: 0.00004, xdxGbp: 0.00003, xdxXrp: 0.00003 });
  assert.ok(Math.abs(fiat.usd - 0.04) < 1e-12);
  assert.ok(Math.abs(fiat.gbp - 0.03) < 1e-12);
  assert.ok(Math.abs(fiat.xrp - 0.03) < 1e-12);
  assert.ok(Math.abs(fiat.rlusd - 0.04) < 1e-12);
});

test("xdxFiatValues prices the XDX stack in XRP and RLUSD, not other wallet holdings", () => {
  const stack = 3_004_952_684.62;
  const fiat = xdxFiatValues(stack, {
    xdxUsd: 0.0000498,
    xrpUsd: 2.62,
    rlusdUsd: 1,
    xdxXrp: 0.000019,
  });
  assert.equal(fiat.xdx, stack);
  assert.ok(Math.abs(fiat.xrp - stack * 0.000019) < 1e-6);
  assert.ok(Math.abs(fiat.rlusd - stack * 0.0000498) < 1e-4);
  assert.ok(fiat.xrp > 50_000);
  assert.ok(Math.abs(fiat.rlusd - 149_646.64) < 1);
});

test("xdxFiatValues fills XRP worth from USD when the XDX/XRP mark is missing", () => {
  const fiat = xdxFiatValues(1_000_000, { xdxUsd: 0.00005, xrpUsd: 2 });
  assert.ok(Math.abs(fiat.usd - 50) < 1e-12);
  assert.ok(Math.abs(fiat.xrp - 25) < 1e-12);
  assert.ok(Math.abs(fiat.rlusd - 50) < 1e-12);
});

test("xdxFiatValues fills EUR and JPY from XRP FX when those marks are missing", () => {
  const fiat = xdxFiatValues(1000, {
    xdxUsd: 0.00005,
    xrpUsd: 2,
    xrpEur: 1.8,
    xrpJpy: 300,
    xdxXrp: 0.000025,
  });
  assert.ok(Math.abs(fiat.usd - 0.05) < 1e-12);
  assert.ok(Math.abs(fiat.eur - 0.045) < 1e-12);
  assert.ok(Math.abs(fiat.jpy - 7.5) < 1e-12);
  assert.equal(fiat.gbp, null);
});

test("resolveLpPairName does not stamp an unknown LP line as XDX/XRP", () => {
  assert.equal(
    resolveLpPairName({
      pool_name: "XDX/XRP",
      amm_account: "rXsquadAmm11111111111111111111111",
      lp_currency: "03AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      quote: "XSQUAD",
    }),
    "XDX/XSQUAD"
  );
  assert.equal(
    resolveLpPairName(
      {
        amm_account: "rXsquadAmm11111111111111111111111",
        lp_currency: "03AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
      "XDX/XRP"
    ) === "XDX/XRP",
    false
  );
  const row = lpPositionFromPool(80, {
    quote: "XSQUAD",
    amm_account: "rXsquadAmm11111111111111111111111",
    lp_currency: "03AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    lp_supply: 800,
    reserve_asset: 1000,
    reserve_currency: 40,
  });
  assert.equal(row.pool, "XDX/XSQUAD");
  assert.equal(row.quote, "XSQUAD");
});

test("withdrawQuoteLabel names the other asset in the pair", () => {
  assert.equal(withdrawQuoteLabel("XSQUAD"), "Withdraw XSQUAD quote");
  assert.equal(withdrawQuoteLabel("BTC", "Withdraw {asset} quote"), "Withdraw BTC quote");
  assert.equal(withdrawQuoteLabel("", "Withdraw {asset} quote"), "Withdraw quote");
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

test("composeWalletSnapshot keeps DB XRP when ledger drops are missing", () => {
  const filled = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 18.5, xdx: 5000 },
    account: { balance_drops: null, owner_count: 4 },
    prices: { xdxUsd: 0.00004, xrpUsd: 2 },
    token: { circulating: 10_000_000_000 },
  });
  assert.equal(filled.xrp.balance, 18.5);
  assert.ok(filled.xrp.spendable > 0);
});

test("composeWalletSnapshot does not treat a failed XRP lookup as a zero hold", () => {
  const missed = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 0, xdx: 5000 },
    account: { balance_drops: 0, owner_count: 4, source: "empty" },
    prices: { xdxUsd: 0.00004, xrpUsd: 2 },
    token: { circulating: 10_000_000_000 },
    lpRows: [{ pool_name: "XDX/XRP", lp_balance: 10 }],
    pools: [{ pool_name: "XDX/XRP", lp_supply: 1000, reserve_asset: 50_000, reserve_currency: 2 }],
  });
  assert.equal(missed.xrp.balance, null);
  assert.equal(missed.xrp.reserved, null);
  assert.equal(missed.xrp.spendable, null);
  assert.equal(missed.filled, true);
  assert.equal(xrpBarPercents({ reserved: 0, spendable: 0, total: missed.xrp.balance || 0 }).totalPct, 0);
});

test("walletAvailableAmounts reports spendable XRP and issued quote", () => {
  const hold = walletAvailableAmounts({
    balances: { xrp: 10, xdx: 2000 },
    account: { balance_drops: 12_000_000, owner_count: 5 },
    quote: { currency: "XRP" },
  });
  assert.equal(hold.xrp, 10);
  assert.equal(hold.xdx, 2000);
  assert.equal(hold.quote, 10);

  const rlusd = walletAvailableAmounts({
    balances: { xrp: 4, xdx: 100 },
    lines: [{ currency: "RLUSD", issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", balance: "12.5" }],
    quote: { currency: "RLUSD", issuer: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", id: "RLUSD" },
  });
  assert.equal(rlusd.quote, 12.5);

  const usdc = walletAvailableAmounts({
    balances: { xrp: 8, xdx: 50 },
    lines: [{ currency: "5553444300000000000000000000000000000000", issuer: "rUsdcIssuer", ticker: "USDC", balance: "77.25" }],
    quote: { id: "USDC", currency: "USDC", pair: "XDX/USDC" },
  });
  assert.equal(usdc.quote, 77.25);
  assert.notEqual(usdc.quote, usdc.xrp);
});

test("preferFilledWalletSnapshot keeps last XDX when a refresh returns zero", () => {
  const filled = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 57.1375, xdx: 3_004_952_684.62, rlusd: 127.3 },
    prices: { xdxUsd: 0.0000469, xrpUsd: 1.48 },
    token: { circulating: 10_000_000_000 },
    rank: 1,
  });
  const hollow = emptyWalletSnapshot("rExample");
  const kept = preferFilledWalletSnapshot(filled, hollow);
  assert.equal(kept.filled, true);
  assert.equal(kept.holdings.xdx, filled.holdings.xdx);
  assert.equal(kept.xdx.usd, filled.xdx.usd);
  assert.equal(kept.supply.supplyPct, filled.supply.supplyPct);

  const zeroed = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 0, xdx: 0, rlusd: 0 },
    account: { balance_drops: 0 },
    prices: { xdxUsd: 0.0000469, xrpUsd: 1.48 },
    token: { circulating: 10_000_000_000 },
  });
  const held = preferFilledWalletSnapshot(filled, zeroed);
  assert.equal(held.holdings.xdx, filled.holdings.xdx);
  assert.equal(held.xdx.usd, filled.xdx.usd);
  assert.equal(held.holdings.xrp, filled.holdings.xrp);
  assert.equal(held.supply.circulatingPct, filled.supply.circulatingPct);
  assert.equal(held.rank, 1);

  const next = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 60, xdx: 3_100_000_000, rlusd: 130 },
    prices: { xdxUsd: 0.00005, xrpUsd: 1.5 },
    token: { circulating: 10_000_000_000 },
    rank: 1,
  });
  const updated = preferFilledWalletSnapshot(filled, next);
  assert.equal(updated.holdings.xdx, 3_100_000_000);
  assert.equal(updated.holdings.xrp, 60);

  const other = emptyWalletSnapshot("rOther");
  assert.equal(preferFilledWalletSnapshot(filled, other).address, "rOther");
  assert.equal(preferFilledWalletSnapshot(filled, other).filled, false);
});

test("preferFilledWalletSnapshot keeps last balances when a refresh is hollow", () => {
  const filled = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 57.1375, xdx: 3_004_952_684.62, rlusd: 127.3 },
    prices: { xdxUsd: 0.0000469, xrpUsd: 1.48 },
    token: { circulating: 10_000_000_000 },
    rank: 1,
  });
  const hollow = emptyWalletSnapshot("rExample");
  const kept = preferFilledWalletSnapshot(filled, hollow);
  assert.equal(kept.filled, true);
  assert.equal(kept.holdings.xdx, filled.holdings.xdx);
  assert.equal(kept.holdings.xrp, filled.holdings.xrp);
  assert.equal(kept.holdings.rlusd, filled.holdings.rlusd);
  assert.equal(kept.xdx.usd, filled.xdx.usd);
  assert.equal(kept.rank, 1);

  const next = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 60, xdx: 3_100_000_000, rlusd: 130 },
    prices: { xdxUsd: 0.00005, xrpUsd: 1.5 },
    token: { circulating: 10_000_000_000 },
    rank: 1,
  });
  const updated = preferFilledWalletSnapshot(filled, next);
  assert.equal(updated.holdings.xrp, 60);
  assert.equal(updated.holdings.rlusd, 130);

  const other = emptyWalletSnapshot("rOther");
  assert.equal(preferFilledWalletSnapshot(filled, other).address, "rOther");
  assert.equal(preferFilledWalletSnapshot(filled, other).filled, false);

  const zeroed = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 0, xdx: 3_004_952_684.62, rlusd: 0 },
    account: { balance_drops: 0 },
    prices: { xdxUsd: 0.0000469, xrpUsd: 1.48 },
    token: { circulating: 10_000_000_000 },
  });
  const held = preferFilledWalletSnapshot(filled, zeroed);
  assert.equal(held.holdings.xrp, filled.holdings.xrp);
  assert.equal(held.xrp.balance, filled.xrp.balance);
  assert.equal(held.holdings.rlusd, filled.holdings.rlusd);
});

test("preferFilledWalletSnapshot keeps last LP earnings when a refresh returns zeros", () => {
  const filled = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 57.1375, xdx: 3_004_952_684.62, rlusd: 127.3 },
    prices: { xdxUsd: 0.0000469, xrpUsd: 1.48 },
    token: { circulating: 10_000_000_000 },
    flows: [{ pool: "XDX/XRP", xdx: 100, quote: 0.003, timestamp: Date.now() }],
    lpRows: [
      {
        pool: "XDX/XRP",
        lp_balance: 10,
        lp_share_percent: 4,
      },
    ],
  });
  filled.fees = {
    ...filled.fees,
    earnings: {
      ...filled.fees.earnings,
      xrp24h: 0.0034,
      xrp24hUsd: 0.005,
      usd24h: 0.01,
      usd7d: 0.07,
    },
  };
  const next = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 57.1375, xdx: 3_004_952_684.62, rlusd: 127.3 },
    prices: { xdxUsd: 0.0000469, xrpUsd: 1.48 },
    token: { circulating: 10_000_000_000 },
  });
  const kept = preferFilledWalletSnapshot(filled, next);
  assert.equal(kept.holdings.xdx, filled.holdings.xdx);
  assert.equal(kept.fees.earnings.usd24h, 0.01);
  assert.equal(kept.fees.earnings.xrp24h, 0.0034);
  assert.equal(kept.lp.length, 1);
});

test("composeWalletSnapshot stays blank until an address is signed in", () => {
  const empty = emptyWalletSnapshot(null);
  assert.equal(empty.signedIn, false);
  assert.equal(empty.filled, false);
  assert.equal(empty.xdx.usd, null);
  assert.equal(empty.xdx.rlusd, null);

  const filled = composeWalletSnapshot({
    address: "rExample",
    balances: { xrp: 12, xdx: 5000, rlusd: 127.3 },
    prices: {
      xdxUsd: 0.00004,
      xdxGbp: 0.00003,
      xrpUsd: 2,
      xrpEur: 1.8,
      xrpJpy: 300,
    },
    token: { circulating: 10_000_000_000, xdxPerXrp: 0.00003 },
    pools: [{ pool_name: "XDX/XRP", reserve_asset: 60_000_000 }],
  });
  assert.equal(filled.signedIn, true);
  assert.equal(filled.filled, true);
  assert.equal(filled.holdings.xdx, 5000);
  assert.equal(filled.holdings.xrp, 12);
  assert.equal(filled.holdings.rlusd, 127.3);
  assert.equal(filled.xdx.xdx, 5000);
  assert.equal(filled.xdx.usd, 0.2);
  assert.equal(filled.xdx.rlusd, 0.2);
  assert.equal(filled.xdx.xrp, 0.15);
  assert.equal(filled.xdx.gbp, 0.15);
  assert.ok(Math.abs(filled.xdx.eur - 0.18) < 1e-12);
  assert.ok(Math.abs(filled.xdx.jpy - 30) < 1e-12);
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
  const priced = lpFeeEarnings(
    [
      {
        pool: "XDX/XRP",
        quote: "XRP",
        lp_share_percent: 10,
        withdraw_estimate_xdx: 1000,
        trading_fee: 1000,
        reserve_asset: 50_000,
        reserve_currency: 2,
      },
    ],
    {
      xdxUsd: 0.00004,
      xrpUsd: 1,
      now,
      flows: [
        { pool: "XDX/XRP", xdx: 10_000, timestamp: "2026-08-22T10:00:00.000Z" },
        { pool: "XDX/XRP", xdx: 5_000, timestamp: "2026-08-21T10:00:00.000Z" },
      ],
    }
  );
  assert.equal(priced.earnings.xdx24h, 5);
  assert.equal(priced.earnings.xrp24h, 5 * (2 / 50_000));
  assert.equal(priced.earnings.rlusd24h, 0);
  assert.equal(priced.earnings.xdx24hUsd, 5 * 0.00004);
  assert.equal(priced.earnings.xrp24hUsd, priced.earnings.xrp24h * 1);
  assert.equal(priced.earnings.rlusd24hUsd, 0);
  assert.equal(priced.earnings.xdx7d, 7.5);
  assert.equal(priced.earnings.xrp7d, 7.5 * (2 / 50_000));
  assert.equal(priced.earnings.rlusd7d, 0);
  assert.equal(priced.earnings.xdx7dUsd, 7.5 * 0.00004);
  assert.equal(priced.earnings.xrp7dUsd, priced.earnings.xrp7d * 1);
  assert.ok(priced.earnings.usd24h > 0);
  assert.ok(priced.earnings.usd7d > priced.earnings.usd24h);
  const rlusd = lpFeeEarnings(
    [
      {
        pool: "XDX/RLUSD",
        quote: "RLUSD",
        lp_share_percent: 10,
        withdraw_estimate_xdx: 800,
        trading_fee: 1000,
        reserve_asset: 8000,
        reserve_currency: 10,
      },
    ],
    {
      xdxUsd: 0.00004,
      xrpUsd: 1,
      rlusdUsd: 1,
      now,
      flows: [
        { pool: "XDX/RLUSD", xdx: 10_000, timestamp: "2026-08-22T10:00:00.000Z" },
        { pool: "XDX/RLUSD", xdx: 5_000, timestamp: "2026-08-21T10:00:00.000Z" },
      ],
    }
  );
  assert.equal(rlusd.earnings.xdx24h, 5);
  assert.equal(rlusd.earnings.xrp24h, 0);
  assert.equal(rlusd.earnings.rlusd24h, 5 * (10 / 8000));
  assert.equal(rlusd.earnings.xdx24hUsd, 5 * 0.00004);
  assert.equal(rlusd.earnings.rlusd24hUsd, rlusd.earnings.rlusd24h * 1);
  assert.equal(rlusd.earnings.xdx7d, 7.5);
  assert.equal(rlusd.earnings.rlusd7d, 7.5 * (10 / 8000));
  assert.equal(rlusd.earnings.rlusd7dUsd, rlusd.earnings.rlusd7d * 1);
  assert.ok(Math.abs(rlusd.earnings.usd24h - (5 * 0.00004 + 5 * (10 / 8000))) < 1e-12);
  const both = lpFeeEarnings(
    [
      {
        pool: "XDX/XRP",
        quote: "XRP",
        lp_share_percent: 10,
        trading_fee: 1000,
        reserve_asset: 50_000,
        reserve_currency: 2,
      },
      {
        pool: "XDX/RLUSD",
        quote: "RLUSD",
        lp_share_percent: 100,
        trading_fee: 1000,
        reserve_asset: 8000,
        reserve_currency: 10,
      },
    ],
    {
      xdxUsd: 0.00004,
      xrpUsd: 1,
      rlusdUsd: 1,
      now,
      flows: [
        { pool: "XDX/XRP", xdx: 10_000, timestamp: "2026-08-22T10:00:00.000Z" },
        { pool: "XDX/RLUSD", xdx: 2_000, timestamp: "2026-08-22T10:00:00.000Z" },
      ],
    }
  );
  assert.equal(both.earnings.pools["XDX/XRP"].xdx24h, 5);
  assert.equal(both.earnings.pools["XDX/XRP"].quote24h, 5 * (2 / 50_000));
  assert.equal(both.earnings.pools["XDX/RLUSD"].xdx24h, 10);
  assert.equal(both.earnings.pools["XDX/RLUSD"].quote24h, 10 * (10 / 8000));
  assert.ok(both.earnings.pools["XDX/XRP"].usd24h > 0);
  assert.ok(both.earnings.pools["XDX/RLUSD"].usd24h > both.earnings.pools["XDX/XRP"].usd24h);

  const spiked = lpFeeEarnings(
    [
      {
        pool: "XDX/XRP",
        quote: "XRP",
        lp_share_percent: 10,
        trading_fee: 1000,
        reserve_asset: 2,
        reserve_currency: 50_000,
      },
    ],
    {
      xdxUsd: 0.00004,
      xrpUsd: 1 / 0.00004,
      xdxXrp: 0.00004,
      now,
      flows: [{ pool: "XDX/XRP", xdx: 10_000, timestamp: "2026-08-22T10:00:00.000Z" }],
    }
  );
  assert.equal(spiked.earnings.xrp24h, 5 * (2 / 50_000));
  assert.ok(spiked.earnings.xrp24hUsd < 1);
  assert.ok(spiked.earnings.xrp24hUsd > 0);
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

test("composeWalletSnapshot keeps ledger offers and activity for the signed-in wallet", () => {
  const snap = composeWalletSnapshot({
    address: "rBuyer",
    balances: { xrp: 20, xdx: 1000 },
    offers: [{ account: "rBuyer", pair: "XDX/XRP", side: "bid", price: 0.03, amount: 1000 }],
    ledgerActivity: [
      {
        account: "rBuyer",
        side: "buy",
        xdx: 1000,
        price: 0.03,
        timestamp: "2026-08-23T01:50:00.000Z",
      },
    ],
  });
  assert.equal(snap.orders[0].price, 0.03);
  assert.equal(snap.activity[0].side, "buy");
  assert.equal(snap.activity[0].xdx, 1000);
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

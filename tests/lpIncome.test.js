import test from "node:test";
import assert from "node:assert/strict";
import { lpFeeEarnings } from "../src/wallet/composeWallet.js";
import {
  isXdxAmmPair,
  lpDepositIncomeRows,
  lpFeeIncomeRows,
  lpIncomeCsv,
  lpTokenUsd,
  mergeLpIncomeRows,
  pageLpIncome,
} from "../src/wallet/lpIncome.js";

test("only XDX AMM pairs count as earn pools", () => {
  assert.equal(isXdxAmmPair("XDX/XRP"), true);
  assert.equal(isXdxAmmPair("XDX/RLUSD"), true);
  assert.equal(isXdxAmmPair({ pool: "XDX/XIO" }), true);
  assert.equal(isXdxAmmPair("SOLO/USD"), false);
  assert.equal(isXdxAmmPair({ pool_name: "RLUSD/XRP" }), false);
});

test("lp fee earnings ignore non-XDX AMM positions", () => {
  const now = Date.parse("2026-08-22T12:00:00.000Z");
  const fees = lpFeeEarnings(
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
      {
        pool: "RLUSD/XRP",
        quote: "XRP",
        lp_share_percent: 50,
        withdraw_estimate_xdx: 1000,
        trading_fee: 1000,
        reserve_asset: 10,
        reserve_currency: 20,
      },
    ],
    {
      xdxUsd: 0.00004,
      xrpUsd: 1,
      now,
      flows: [
        { pool: "XDX/XRP", xdx: 10_000, timestamp: "2026-08-22T10:00:00.000Z" },
        { pool: "RLUSD/XRP", xdx: 1_000_000, timestamp: "2026-08-22T10:00:00.000Z" },
      ],
    }
  );
  assert.equal(fees.earnings.xdx24h, 5);
  assert.equal(fees.earnings.xrp24h, 5 * (2 / 50_000));
});

test("income list is newest XDX pair days first and pages by 10 days", () => {
  const rows = lpFeeIncomeRows({
    positions: [
      {
        pool: "XDX/RLUSD",
        quote: "RLUSD",
        lp_share_percent: 10,
        trading_fee: 1000,
        reserve_asset: 8000,
        reserve_currency: 10,
        lp_supply: 400,
      },
    ],
    flows: [
      { pool: "XDX/RLUSD", xdx: 10_000, timestamp: "2026-08-22T10:00:00.000Z" },
      { pool: "XDX/RLUSD", xdx: 4_000, timestamp: "2026-08-21T10:00:00.000Z" },
      { pool: "RLUSD/XRP", xdx: 9_000, timestamp: "2026-08-22T11:00:00.000Z" },
    ],
    xdxUsd: 0.00004,
    rlusdUsd: 1,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, "2026-08-22");
  assert.equal(rows[0].pair, "XDX/RLUSD");
  assert.ok(Math.abs(rows[0].lpTokens - 0.5) < 1e-12);
  // 0.5 LP of 400 = 1/800 of a pool with 8000 XDX + 10 RLUSD.
  assert.ok(Math.abs(rows[0].usd - 0.0129) < 1e-12);
  const paged = pageLpIncome(
    mergeLpIncomeRows(
      rows,
      Array.from({ length: 12 }, (_, index) => ({
        date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        pair: "XDX/XRP",
        lpTokens: 1,
        usd: 1,
      }))
    ),
    10
  );
  assert.equal(new Set(paged.map((row) => row.date)).size, 10);
  assert.match(lpIncomeCsv(rows), /^Date,LP tokens received,Trading pair,USD\n/);
});

test("lpTokenUsd prices both pool reserves at the quote mark, not 2x XDX", () => {
  const pool = {
    pool: "XDX/XIO",
    quote: "XIO",
    reserve_asset: 52_286_366.55495586,
    reserve_currency: 59.83194412724561,
    lp_supply: 44_896.64667926788,
  };
  const prices = { xdxUsd: 0.00004, xrpUsd: 2, xioXrp: 10, XIO: 20 };
  const tenth = pool.lp_supply / 10;
  const usd = lpTokenUsd(tenth, pool, prices);
  const xdxSide = pool.reserve_asset * 0.00004;
  const quoteSide = pool.reserve_currency * 20;
  assert.ok(Math.abs(usd - 0.1 * (xdxSide + quoteSide)) < 1e-6);
  assert.ok(usd < 0.1 * xdxSide * 2);
  const deposited = lpDepositIncomeRows({
    activity: [{ side: "addLp", pair: "XDX/XIO", lp: tenth, timestamp: "2026-08-22T10:00:00.000Z" }],
    positions: [pool],
    prices,
  });
  assert.equal(deposited.length, 1);
  assert.ok(Math.abs(deposited[0].usd - usd) < 1e-9);
});

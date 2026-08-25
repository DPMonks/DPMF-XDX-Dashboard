import test from "node:test";
import assert from "node:assert/strict";
import { lpFeeEarnings } from "../src/wallet/composeWallet.js";
import {
  DEFAULT_INCOME_PAIR,
  filterIncomeByPair,
  incomePairChoices,
  incomeRowsForPair,
  isXdxAmmPair,
  lpDepositIncomeRows,
  lpFeeIncomeRows,
  lpIncomeCsv,
  lpTokenUsd,
  mergeLpIncomeRows,
  pageLpIncome,
  poolForIncomePair,
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
  // Same 50/50 split as the earn board: 5 XDX + 0.00625 RLUSD.
  assert.ok(Math.abs(rows[0].usd - (5 * 0.00004 + 5 * (10 / 8000))) < 1e-12);
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

test("income pair list defaults to XDX/XRP and keeps live plus featured pairs", () => {
  const pairs = incomePairChoices({
    positions: [{ pool: "XDX/XIO" }, { pool: "XDX/RLUSD" }],
    activity: [{ pair: "XDX/XSQUAD" }],
  });
  assert.equal(pairs[0], DEFAULT_INCOME_PAIR);
  assert.deepEqual(pairs, ["XDX/XRP", "XDX/RLUSD", "XDX/XIO", "XDX/XSQUAD"]);
});

test("income rows keep one selected pair and replace snapshot deposits with wallet history", () => {
  const snapshot = [
    { date: "2026-08-23", pair: "XDX/XRP", lpTokens: 1, usd: 0.01, kind: "deposit" },
    { date: "2026-08-23", pair: "XDX/XIO", lpTokens: 9, usd: 0.02, kind: "deposit" },
    { date: "2026-08-22", pair: "XDX/XRP", lpTokens: 0.2, usd: 0.001, kind: "fee" },
  ];
  assert.deepEqual(
    filterIncomeByPair(snapshot, "XDX/XRP").map((row) => row.kind),
    ["deposit", "fee"]
  );
  const history = incomeRowsForPair({
    pair: "XDX/XRP",
    snapshotRows: snapshot,
    historyActivity: [
      { side: "addLp", pair: "XDX/XRP", lp: 6100.5985, timestamp: "2026-08-23T10:00:00.000Z", txid: "A" },
      { side: "createPool", pair: "XDX/XRP", lp: 12, timestamp: "2026-06-01T10:00:00.000Z", txid: "B" },
      { side: "addLp", pair: "XDX/RLUSD", lp: 40, timestamp: "2026-08-21T10:00:00.000Z", txid: "C" },
    ],
    positions: [{ pool: "XDX/XRP", reserve_asset: 1000, reserve_currency: 1, lp_supply: 100 }],
    xdxUsd: 0.00004,
    xrpUsd: 2,
  });
  assert.equal(history.some((row) => row.kind === "fee"), true);
  assert.equal(history.some((row) => row.lpTokens === 1), false);
  assert.equal(history.filter((row) => row.kind !== "fee").length, 2);
  assert.ok(history.every((row) => row.pair === "XDX/XRP"));
});

test("each pair marks LP tokens from that pool's reserves, including a missing quote side", () => {
  const xrpPool = {
    pool: "XDX/XRP",
    quote: "XRP",
    reserve_asset: 64_520_961.62244989,
    reserve_currency: 2094.628968,
    lp_supply: 233_179_846.2759734,
  };
  const rlusdPool = {
    pool: "XDX/RLUSD",
    quote: "RLUSD",
    reserve_asset: 2_607_820.43763469,
    reserve_currency: 123.1704222066608,
    lp_supply: 17_907.41480903618,
  };
  const prices = { xdxUsd: 0.0000473979, xrpUsd: 1.46, RLUSD: 1 };
  const xrpUsd = lpTokenUsd(6100.5985, xrpPool, prices);
  const xrpHalf = (6100.5985 / xrpPool.lp_supply) * (xrpPool.reserve_asset * prices.xdxUsd);
  assert.ok(Math.abs(xrpUsd - xrpHalf * 2) < 0.01);
  assert.ok(xrpUsd > 0.15);

  const rlusdUsd = lpTokenUsd(13_524.1529, rlusdPool, prices);
  const rlusdTvl = rlusdPool.reserve_asset * prices.xdxUsd + rlusdPool.reserve_currency;
  assert.ok(Math.abs(rlusdUsd - (13_524.1529 / rlusdPool.lp_supply) * rlusdTvl) < 0.05);

  const xrpMissingQuote = lpTokenUsd(6100.5985, { ...xrpPool, reserve_currency: 0 }, prices);
  assert.ok(Math.abs(xrpMissingQuote - xrpUsd) < 0.02);

  const fromCatalog = lpDepositIncomeRows({
    activity: [{ side: "addLp", pair: "XDX/RLUSD", lp: 13_524.1529, timestamp: "2026-08-24T10:00:00.000Z" }],
    positions: [{ pool: "XDX/RLUSD", lp_supply: 13_524.1529, reserve_asset: 100, reserve_currency: 1 }],
    pools: [rlusdPool],
    prices,
  });
  assert.equal(fromCatalog.length, 1);
  assert.ok(Math.abs(fromCatalog[0].usd - rlusdUsd) < 0.05);
  assert.equal(poolForIncomePair("XDX/RLUSD", [], [rlusdPool]).lp_supply, rlusdPool.lp_supply);
});

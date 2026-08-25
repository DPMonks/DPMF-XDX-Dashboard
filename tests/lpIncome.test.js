import test from "node:test";
import assert from "node:assert/strict";
import { lpFeeEarnings } from "../src/wallet/composeWallet.js";
import {
  DEFAULT_INCOME_PAIR,
  HISTORICAL_INCOME_DAYS,
  dailyLpIncomeTotals,
  fillContinuousVolumeDays,
  filterIncomeByPair,
  incomePairChoices,
  incomeRowsForPair,
  isXdxAmmPair,
  lpDepositIncomeRows,
  lpFeeIncomeRows,
  lpIncomeCsv,
  lpTokenUsd,
  mergeLpIncomeRows,
  mergeRecordedLpIncome,
  pageLpIncome,
  poolForIncomePair,
  readRecordedLpIncome,
  writeRecordedLpIncome,
} from "../src/wallet/lpIncome.js";
import { composeWalletSnapshot } from "../src/wallet/composeWallet.js";
import { XDX_XRP_AMM, XDX_XRP_LP_HEX } from "../src/constants/ledger.js";

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
    now: Date.parse("2026-08-22T18:00:00.000Z"),
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

test("lpTokenUsd does not mark LP tokens at the XRP price when quote reserve is LP supply", () => {
  const pool = {
    pool: "XDX/XRP",
    quote: "XRP",
    reserve_asset: 64_520_961.62244989,
    reserve_currency: 233_179_846.2759734,
    lp_supply: 233_179_846.2759734,
  };
  const prices = { xdxUsd: 0.0000473979, xrpUsd: 1.47 };
  const tokens = 5_654_599.2309;
  const usd = lpTokenUsd(tokens, pool, prices);
  const xdxSide = pool.reserve_asset * prices.xdxUsd;
  assert.ok(usd > 100);
  assert.ok(usd < 1_000);
  assert.ok(Math.abs(usd - (tokens / pool.lp_supply) * xdxSide * 2) < 1);
  assert.ok(Math.abs(usd - tokens * prices.xrpUsd) > 1_000_000);
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
    { date: "2026-08-21", pair: "XDX/XRP", lpTokens: 0.1, usd: 0.0004, kind: "fee" },
  ];
  assert.deepEqual(
    filterIncomeByPair(snapshot, "XDX/XRP").map((row) => row.kind),
    ["deposit", "fee", "fee"]
  );
  const history = incomeRowsForPair({
    pair: "XDX/XRP",
    snapshotRows: snapshot,
    historyActivity: [
      { side: "addLp", pair: "XDX/XRP", lp: 100, timestamp: "2026-08-21T10:00:00.000Z", txid: "A" },
      { side: "addLp", pair: "XDX/RLUSD", lp: 40, timestamp: "2026-08-21T10:00:00.000Z", txid: "C" },
    ],
    recordedRows: [{ date: "2026-08-20", pair: "XDX/XRP", lpTokens: 0.05, usd: 0.0002, kind: "fee" }],
    positions: [{ pool: "XDX/XRP", reserve_asset: 1000, reserve_currency: 1, lp_supply: 100, lp_balance: 100 }],
    xdxUsd: 0.00004,
    xrpUsd: 2,
  });
  assert.deepEqual(
    history.map((row) => row.date),
    ["2026-08-22", "2026-08-21"]
  );
  assert.ok(history.every((row) => row.pair === "XDX/XRP" && row.kind === "fee"));
  assert.equal(history.some((row) => row.lpTokens === 1), false);
});

test("continuous volume days fill every 24h UTC date newest-ready", () => {
  const buckets = new Map([
    ["2026-08-01|XDX/XRP", { date: "2026-08-01", pair: "XDX/XRP", xdx: 100 }],
    ["2026-08-04|XDX/XRP", { date: "2026-08-04", pair: "XDX/XRP", xdx: 400 }],
  ]);
  fillContinuousVolumeDays(buckets, "XDX/XRP", "2026-08-01", "2026-08-04");
  assert.deepEqual(
    [...buckets.keys()].sort(),
    ["2026-08-01|XDX/XRP", "2026-08-02|XDX/XRP", "2026-08-03|XDX/XRP", "2026-08-04|XDX/XRP"]
  );
  assert.ok(Math.abs(buckets.get("2026-08-02|XDX/XRP").xdx - 200) < 1e-9);
  assert.ok(Math.abs(buckets.get("2026-08-03|XDX/XRP").xdx - 300) < 1e-9);
});

test("daily totals record each UTC day and keep stored history", () => {
  const rows = dailyLpIncomeTotals([
    { date: "2026-08-23", pair: "XDX/XRP", lpTokens: 0.2, usd: 0.001, kind: "fee" },
    { date: "2026-08-23", pair: "XDX/XRP", lpTokens: 0.1, usd: 0.0005, kind: "fee" },
    { date: "2026-08-23", pair: "XDX/XRP", lpTokens: 9, usd: 1, kind: "deposit" },
    { date: "2026-08-22", pair: "XDX/RLUSD", lpTokens: 0.4, usd: 0.002, kind: "fee" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, "2026-08-23");
  assert.ok(Math.abs(rows[0].lpTokens - 0.3) < 1e-12);
  const storage = new Map();
  const memory = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  };
  writeRecordedLpIncome("rWallet", rows, memory);
  const merged = mergeRecordedLpIncome(readRecordedLpIncome("rWallet", memory), [
    { date: "2026-08-24", pair: "XDX/XRP", lpTokens: 0.08, usd: 0.0003, kind: "fee" },
  ]);
  assert.deepEqual(
    merged.map((row) => row.date),
    ["2026-08-24", "2026-08-23", "2026-08-22"]
  );
});

test("fee history fills missing recent days from catalog volume after sign-in", () => {
  const now = Date.parse("2026-08-25T18:00:00.000Z");
  const rows = lpFeeIncomeRows({
    now,
    positions: [
      {
        pool: "XDX/XRP",
        quote: "XRP",
        lp_share_percent: 4,
        trading_fee: 1000,
        reserve_asset: 50_000,
        reserve_currency: 2,
        lp_supply: 1000,
        volume24hXdx: 8_000_000,
        volume7dXdx: 20_000_000,
      },
    ],
    flows: [{ pool: "XDX/XRP", xdx: 10_000, timestamp: "2026-08-23T10:00:00.000Z" }],
    xdxUsd: 0.00004,
    xrpUsd: 2,
  });
  const days = rows.map((row) => row.date);
  assert.ok(days.includes("2026-08-25"));
  assert.ok(days.includes("2026-08-23"));
  assert.ok(days.includes("2026-08-24"));
  assert.ok(days.length >= 7);
  assert.ok(rows.every((row) => row.kind === "fee" && row.lpTokens > 0));
});

test("fee history records each historical day from the volume series, not only today", () => {
  const now = Date.parse("2026-08-25T18:00:00.000Z");
  const volumeDays = [
    { pair: "XDX/XRP", xdx: 1_000_000, timestamp: "2026-08-01T00:00:00.000Z" },
    { pair: "XDX/XRP", xdx: 2_000_000, timestamp: "2026-08-10T00:00:00.000Z" },
    { pair: "XDX/XRP", xdx: 3_000_000, timestamp: "2026-08-24T00:00:00.000Z" },
    { pair: "XDX/XRP", xdx: 4_000_000, timestamp: "2026-08-25T00:00:00.000Z" },
  ];
  const rows = lpFeeIncomeRows({
    now,
    positions: [
      {
        pool: "XDX/XRP",
        quote: "XRP",
        lp_share_percent: 10,
        trading_fee: 1000,
        reserve_asset: 50_000,
        reserve_currency: 2,
        lp_supply: 1000,
      },
    ],
    flows: [{ pool: "XDX/XRP", xdx: 500, timestamp: "2026-08-25T10:00:00.000Z" }],
    volumeDays,
    xdxUsd: 0.00004,
    xrpUsd: 2,
  });
  const days = rows.map((row) => row.date);
  assert.equal(days[0], "2026-08-25");
  assert.equal(days[days.length - 1], "2026-08-01");
  assert.equal(days.length, 25);
  for (let i = 1; i < days.length; i += 1) {
    assert.ok(days[i - 1] > days[i]);
  }
  const today = rows.find((row) => row.date === "2026-08-25");
  const fromTape = 500 * 0.01 * 0.1;
  const fromOhlc = 4_000_000 * 0.01 * 0.1;
  assert.ok(today.lpTokens > 0);
  assert.ok(Math.abs(today.lpTokens - (fromOhlc / 50_000) * 1000) < 1e-9);
  assert.ok(fromOhlc > fromTape);
  assert.equal(HISTORICAL_INCOME_DAYS, 365);
});

test("signed-in LP lines still produce daily income when wallet/lp is empty", () => {
  const snap = composeWalletSnapshot({
    address: "rWallet",
    balances: { xrp: 10, xdx: 1 },
    prices: { xdxUsd: 0.00004, xrpUsd: 2 },
    token: { circulating: 10_000_000_000 },
    pools: [
      {
        pool_name: "XDX/XRP",
        amm_account: XDX_XRP_AMM,
        lp_currency: XDX_XRP_LP_HEX,
        lp_supply: 1000,
        reserve_asset: 50_000,
        reserve_currency: 2,
        trading_fee: 1000,
        volume24hXdx: 5_000_000,
      },
    ],
    lpRows: [],
    lines: [{ account: XDX_XRP_AMM, currency: XDX_XRP_LP_HEX, balance: "100" }],
    flows: [{ pool: "XDX/XRP", xdx: 10_000, timestamp: "2026-08-23T10:00:00.000Z" }],
  });
  assert.equal(snap.lp[0]?.pool, "XDX/XRP");
  assert.ok(snap.lp[0]?.lp_share_percent > 0);
  assert.ok(snap.income.some((row) => row.date === "2026-08-23" && row.kind === "fee"));
  assert.ok(snap.income.every((row) => row.pair === "XDX/XRP" && row.kind === "fee"));
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

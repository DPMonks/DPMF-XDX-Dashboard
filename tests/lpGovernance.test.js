import test from "node:test";
import assert from "node:assert/strict";
import { XDX_XRP_AMM, XDX_XRP_LP_HEX, SWAP_LP_GOVERNANCE_PAIRS, SWAP_LP_GOVERNANCE_USD } from "../src/constants/ledger.js";
import {
  needsSwapLpGovernance,
  swapLpGovernance,
} from "../src/swap/lpGovernance.js";

const prices = { xdxUsd: 0.0001, xrpUsd: 2, XIO: 20, XSQUAD: 1, quotes: { RLUSD: 1, XIO: 20, XSQUAD: 1 } };

function pool(pair, quote, extra = {}) {
  return {
    pool: pair,
    quote,
    reserve_asset: 100_000,
    reserve_currency: quote === "XRP" ? 5 : quote === "RLUSD" ? 10 : 1,
    lp_supply: 100,
    ...extra,
  };
}

const pools = [
  pool("XDX/XRP", "XRP", { amm_account: XDX_XRP_AMM, lp_currency: XDX_XRP_LP_HEX }),
  pool("XDX/RLUSD", "RLUSD"),
  pool("XDX/XIO", "XIO"),
  pool("XDX/XSQUAD", "XSQUAD"),
];

test("any-asset swaps need LP governance when neither side is XDX", () => {
  assert.equal(needsSwapLpGovernance("BITX", "USD"), true);
  assert.equal(needsSwapLpGovernance("XRP", "RLUSD"), true);
  assert.equal(needsSwapLpGovernance("XDX", "XRP"), false);
  assert.equal(needsSwapLpGovernance("XIO", "XDX"), false);
  assert.deepEqual(SWAP_LP_GOVERNANCE_PAIRS, ["XDX/XRP", "XDX/RLUSD", "XDX/XIO", "XDX/XSQUAD"]);
  assert.equal(SWAP_LP_GOVERNANCE_USD, 10);
});

test("ten dollars of LP in any one listed pool unlocks the swap", () => {
  const xrp = swapLpGovernance({
    positions: [{ pool: "XDX/XRP", lp_balance: 50, amm_account: XDX_XRP_AMM, lp_currency: XDX_XRP_LP_HEX }],
    pools,
    prices,
  });
  assert.equal(xrp.ok, true);
  assert.ok(xrp.unlocked.includes("XDX/XRP"));

  const xio = swapLpGovernance({
    positions: [{ pool: "XDX/XIO", lp_balance: 80 }],
    pools,
    prices,
  });
  assert.equal(xio.ok, true);
  assert.ok(xio.unlocked.includes("XDX/XIO"));

  const squad = swapLpGovernance({
    positions: [{ pool: "XDX/XSQUAD", lp_balance: 95 }],
    pools,
    prices,
  });
  assert.equal(squad.ok, true);
  assert.ok(squad.unlocked.includes("XDX/XSQUAD"));
});

test("split LP under ten dollars on every pool stays locked", () => {
  const split = swapLpGovernance({
    positions: [
      { pool: "XDX/XRP", lp_balance: 20, amm_account: XDX_XRP_AMM, lp_currency: XDX_XRP_LP_HEX },
      { pool: "XDX/XIO", lp_balance: 20 },
    ],
    pools,
    prices,
  });
  assert.equal(split.ok, false);
  assert.ok(split.bestUsd < 10);
});

test("a two-asset LP unlocks when either volatile mark crosses ten dollars", () => {
  const positions = [{ pool: "XDX/XIO", lp_balance: 50 }];
  const xioPools = [
    {
      pool: "XDX/XIO",
      quote: "XIO",
      reserve_asset: 100_000,
      reserve_currency: 50,
      lp_supply: 100,
    },
  ];

  const locked = swapLpGovernance({
    positions,
    pools: xioPools,
    prices: { xdxUsd: 0.00008, XIO: 0.16, quotes: { XIO: 0.16 } },
  });
  assert.equal(needsSwapLpGovernance("XRP", "RLUSD"), true);
  assert.equal(locked.ok, false);
  assert.ok(locked.bestUsd < 10);

  const xioUp = swapLpGovernance({
    positions,
    pools: xioPools,
    prices: { xdxUsd: 0.00008, XIO: 0.24, quotes: { XIO: 0.24 } },
  });
  assert.equal(xioUp.ok, true);
  assert.ok(xioUp.unlocked.includes("XDX/XIO"));
  assert.ok(xioUp.bestUsd >= 10);

  const xdxUp = swapLpGovernance({
    positions,
    pools: xioPools,
    prices: { xdxUsd: 0.00012, XIO: 0.16, quotes: { XIO: 0.16 } },
  });
  assert.equal(xdxUp.ok, true);
  assert.ok(xdxUp.unlocked.includes("XDX/XIO"));
});

test("live reserves revalue a non-stable pair and can unlock without a listed quote mark", () => {
  const positions = [{ pool: "XDX/XSQUAD", lp_balance: 50 }];
  const catalog = [
    {
      pool: "XDX/XSQUAD",
      quote: "XSQUAD",
      reserve_asset: 10_000,
      reserve_currency: 10,
      lp_supply: 100,
    },
  ];
  const stale = swapLpGovernance({
    positions,
    pools: catalog,
    prices: { xdxUsd: 0.00008 },
  });
  assert.equal(stale.ok, false);

  const live = swapLpGovernance({
    positions,
    pools: catalog,
    liveByPair: {
      "XDX/XSQUAD": {
        pair: "XDX/XSQUAD",
        reserve_xdx: 200_000,
        reserve_currency: 80,
        lp_supply: 100,
      },
    },
    prices: { xdxUsd: 0.00008 },
  });
  assert.equal(live.ok, true);
  assert.ok(live.unlocked.includes("XDX/XSQUAD"));
});

test("XRP is not treated as a stable: its USD mark can unlock XDX/XRP LP", () => {
  const positions = [{ pool: "XDX/XRP", lp_balance: 40, amm_account: XDX_XRP_AMM, lp_currency: XDX_XRP_LP_HEX }];
  const xrpPools = [pool("XDX/XRP", "XRP", { amm_account: XDX_XRP_AMM, lp_currency: XDX_XRP_LP_HEX })];

  const cheapXrp = swapLpGovernance({
    positions,
    pools: xrpPools,
    prices: { xdxUsd: 0.0001, xrpUsd: 2 },
  });
  assert.equal(cheapXrp.ok, false);

  const dearXrp = swapLpGovernance({
    positions,
    pools: xrpPools,
    prices: { xdxUsd: 0.0001, xrpUsd: 3 },
  });
  assert.equal(dearXrp.ok, true);
  assert.ok(dearXrp.unlocked.includes("XDX/XRP"));
});

test("the LP dollar floor can change without new pair logic", () => {
  const lowered = swapLpGovernance({
    positions: [{ pool: "XDX/RLUSD", lp_balance: 20 }],
    pools,
    prices,
    threshold: 2,
  });
  assert.equal(lowered.ok, true);
  const raised = swapLpGovernance({
    positions: [{ pool: "XDX/XRP", lp_balance: 50, amm_account: XDX_XRP_AMM, lp_currency: XDX_XRP_LP_HEX }],
    pools,
    prices,
    threshold: 50,
  });
  assert.equal(raised.ok, false);
});

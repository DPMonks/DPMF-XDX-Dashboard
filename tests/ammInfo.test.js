import test from "node:test";
import assert from "node:assert/strict";
import { XDX_ISSUER } from "../src/constants/ledger.js";
import {
  issuedAmountValue,
  lpShareAmounts,
  overlayLiveAmmReserves,
  poolReservesFromAmmInfo,
} from "../src/utils/ammInfo.js";

test("issuedAmountValue reads IOU value and XRP drops", () => {
  assert.equal(issuedAmountValue({ value: "12.5" }), 12.5);
  assert.equal(issuedAmountValue("2500000"), 2.5);
});

test("poolReservesFromAmmInfo reads XDX/USDC ledger reserves", () => {
  const row = poolReservesFromAmmInfo({
    amm: {
      account: "rUsdcAmm",
      amount: { currency: "XDX", issuer: XDX_ISSUER, value: "80000" },
      amount2: { currency: "USDC", issuer: "rUsdc", value: "250" },
      lp_token: { currency: "03ABCDEF", issuer: "rUsdcAmm", value: "284023" },
      trading_fee: 500,
    },
  });
  assert.equal(row.amm_account, "rUsdcAmm");
  assert.equal(row.lp_supply, 284023);
  assert.equal(row.reserve_xdx, 80000);
  assert.equal(row.reserve_currency, 250);
});

test("overlayLiveAmmReserves replaces leftover quote reserves and LP supply", () => {
  const row = overlayLiveAmmReserves(
    {
      pool: "XDX/XIO",
      reserve_xdx: 52286366,
      reserve_asset: 52286366,
      reserve_currency: 1947.36782,
      lp_supply: 220280408.7293996,
    },
    {
      reserve_xdx: 52286366.55495586,
      reserve_currency: 59.93807084355173,
      lp_supply: 44936.64667926788,
      trading_fee: 1000,
    }
  );
  assert.equal(row.reserve_currency, 59.93807084355173);
  assert.equal(row.lp_supply, 44936.64667926788);
  assert.equal(row.reserve_source, "amm_info");
  const share = lpShareAmounts(4493.664667926788, row.reserve_xdx, row.reserve_currency, row.lp_supply);
  assert.ok(Math.abs(share.quote - 5.993807084355173) < 1e-9);
});

test("poolReservesFromAmmInfo treats XRP drops as the quote reserve", () => {
  const row = poolReservesFromAmmInfo({
    amm: {
      account: "rXrpAmm",
      amount: { currency: "XDX", issuer: XDX_ISSUER, value: "50000" },
      amount2: "2000000",
      lp_token: { currency: "0397", issuer: "rXrpAmm", value: "1000" },
    },
  });
  assert.equal(row.reserve_asset, 50000);
  assert.equal(row.reserve_quote, 2);
  assert.equal(row.lp_supply, 1000);
});

import test from "node:test";
import assert from "node:assert/strict";
import { XDX_ISSUER } from "../src/constants/ledger.js";
import { issuedAmountValue, poolReservesFromAmmInfo } from "../src/utils/ammInfo.js";

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

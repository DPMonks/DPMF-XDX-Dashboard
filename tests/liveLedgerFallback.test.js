import test from "node:test";
import assert from "node:assert/strict";
import {
  XDX_ISSUER,
  XDX_XRP_AMM,
  XDX_XRP_LP_HEX,
} from "../src/constants/ledger.js";
import {
  lpHoldingsFromLines,
  loadWalletBalancesFromLedger,
  xdxBalanceFromLines,
} from "../server/walletLedger.js";
import { liveCatalogPayload } from "../server/liveCatalog.js";

test("XDX and LP holdings are read from account_lines", () => {
  assert.equal(
    xdxBalanceFromLines([
      { account: XDX_ISSUER, currency: "XDX", balance: "12.5" },
      { account: XDX_ISSUER, currency: "5844580000000000000000000000000000000000", balance: "1.5" },
    ]),
    14
  );
  assert.equal(xdxBalanceFromLines([{ account: "rOther", currency: "XDX", balance: "9" }]), null);
  const lps = lpHoldingsFromLines([
    { account: XDX_XRP_AMM, currency: XDX_XRP_LP_HEX, balance: "3.25" },
    { account: XDX_XRP_AMM, currency: XDX_XRP_LP_HEX, balance: "0" },
  ]);
  assert.equal(lps.length, 1);
  assert.equal(lps[0].lp_balance, 3.25);
  assert.equal(lps[0].amm_account, XDX_XRP_AMM);
});

test("live wallet balances prefer the XRPL account and XDX line", async () => {
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    if (body.method === "account_info") {
      return {
        ok: true,
        json: async () => ({
          result: { status: "success", account_data: { Balance: "25000000", OwnerCount: 4 } },
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        result: {
          status: "success",
          lines: [{ account: XDX_ISSUER, currency: "XDX", balance: "88" }],
        },
      }),
    };
  };
  const snap = await loadWalletBalancesFromLedger("rWallet111111111111111111111111111", {
    fetchImpl,
    fresh: true,
  });
  assert.equal(snap.source, "xrpl");
  assert.equal(snap.xrp, 25);
  assert.equal(snap.xdx, 88);
  assert.equal(snap.balance_drops, 25_000_000);
});

test("a down database still has a live token and price payload", async () => {
  const empty = await liveCatalogPayload("prices/change24h");
  assert.equal(empty.source, "xrpl");
  const charts = await liveCatalogPayload("charts/activity");
  assert.equal(charts.catching_up, true);
  assert.ok(Array.isArray(charts.rows));
  const flows = await liveCatalogPayload("xdx-flows");
  assert.deepEqual(flows, []);
});

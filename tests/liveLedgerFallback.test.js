import test from "node:test";
import assert from "node:assert/strict";
import {
  XDX_ISSUER,
  XDX_XRP_AMM,
  XDX_XRP_LP_HEX,
} from "../src/constants/ledger.js";
import {
  iouFromGatewayBalances,
  lpHoldingsFromLines,
  loadWalletBalancesFromLedger,
  rlusdBalanceFromLines,
  xdxBalanceFromLines,
} from "../server/walletLedger.js";
import { liveCatalogPayload } from "../server/liveCatalog.js";
import { RLUSD_HEX, RLUSD_ISSUER } from "../src/constants/ledger.js";

test("XDX and LP holdings are read from account_lines", () => {
  assert.equal(
    xdxBalanceFromLines([
      { account: XDX_ISSUER, currency: "XDX", balance: "12.5" },
      { account: XDX_ISSUER, currency: "5844580000000000000000000000000000000000", balance: "1.5" },
    ]),
    14
  );
  assert.equal(xdxBalanceFromLines([{ account: "rOther", currency: "XDX", balance: "9" }]), null);
  assert.equal(
    rlusdBalanceFromLines([{ account: RLUSD_ISSUER, currency: RLUSD_HEX, balance: "7.25" }]),
    7.25
  );
  assert.equal(
    iouFromGatewayBalances(
      { balances: { [XDX_ISSUER]: [{ currency: "XDX", value: "42" }] } },
      XDX_ISSUER,
      /^(XDX|5844580000000000000000000000000000000000)$/i
    ),
    42
  );
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
    if (body.method === "gateway_balances") {
      return { ok: true, json: async () => ({ result: { balances: {} } }) };
    }
    return {
      ok: true,
      json: async () => ({
        result: {
          status: "success",
          lines: [
            { account: XDX_ISSUER, currency: "XDX", balance: "88" },
            { account: RLUSD_ISSUER, currency: RLUSD_HEX, balance: "3" },
          ],
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
  assert.equal(snap.rlusd, 3);
  assert.equal(snap.balance_drops, 25_000_000);
});

test("a down database still has a live token and price payload", async () => {
  const now = Date.now();
  const fetchImpl = async (url, options = {}) => {
    const target = String(url || "");
    if (target.includes("coingecko")) {
      return { ok: true, json: async () => ({ ripple: { usd: 2, gbp: 1.5, eur: 1.8, jpy: 300 } }) };
    }
    if (target.includes("xrpl.to")) {
      return {
        ok: true,
        json: async () => ({
          token: {
            holders: 15941,
            trustlines: 19973,
            lpHolderCount: 80,
            exch: 0.00003,
            pro24h: -3.6,
            vol24hxrp: 400,
            usd: 0.00006,
          },
        }),
      };
    }
    const body = JSON.parse(options.body || "{}");
    if (body.method === "amm_info") {
      return {
        ok: true,
        json: async () => ({
          result: {
            amm: {
              account: XDX_XRP_AMM,
              amount: { currency: "XDX", issuer: XDX_ISSUER, value: "1000000" },
              amount2: "2000000",
              lp_token: { currency: XDX_XRP_LP_HEX, issuer: XDX_XRP_AMM, value: "1000" },
              trading_fee: 1000,
            },
          },
        }),
      };
    }
    if (body.method === "gateway_balances") {
      return { ok: true, json: async () => ({ result: { obligations: { XDX: "9000000000" } } }) };
    }
    return { ok: true, json: async () => ({ result: { offers: [] } }) };
  };
  const empty = await liveCatalogPayload("prices/change24h", { fetchImpl, fresh: true, now });
  assert.equal(empty.source, "xrpl");
  assert.equal(empty.xdx, -3.6);
  const counts = await liveCatalogPayload("holders/count", { fetchImpl, fresh: true, now });
  assert.equal(counts.count, 15941);
  const charts = await liveCatalogPayload("charts/activity", { fetchImpl, fresh: true, now });
  assert.equal(charts.catching_up, true);
  assert.ok(Array.isArray(charts.rows));
  const flows = await liveCatalogPayload("xdx-flows", { fetchImpl, fresh: true, now });
  assert.deepEqual(flows, []);
});

import test from "node:test";
import assert from "node:assert/strict";
import { XDX_ISSUER, XIO_ISSUER } from "../src/constants/ledger.js";
import { loadLiveAmmReserves } from "../server/liveAmmReserves.js";

function rpcFetch(handler) {
  return async (_url, options) => {
    const body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ result: handler(body.method, body.params?.[0] || {}) }),
    };
  };
}

test("loadLiveAmmReserves reads a new XDX/XIO pool from amm_info by asset pair", async () => {
  const fetchImpl = rpcFetch((method, params) => {
    assert.equal(method, "amm_info");
    assert.equal(params.asset.currency, "XDX");
    assert.equal(params.asset2.currency, "XIO");
    assert.equal(params.asset2.issuer, XIO_ISSUER);
    return {
      amm: {
        account: "rDJXzsZGACeHGJQYfaudsYshaC5zJxqsHr",
        amount: { currency: "XDX", issuer: XDX_ISSUER, value: "52286366.55495586" },
        amount2: { currency: "XIO", issuer: XIO_ISSUER, value: "59.93807084355173" },
        lp_token: {
          currency: "03E7A465A6E95CDA21E1110056AA51A71FA55CB9",
          issuer: "rDJXzsZGACeHGJQYfaudsYshaC5zJxqsHr",
          value: "44936.64667926788",
        },
        trading_fee: 1000,
      },
    };
  });
  const live = await loadLiveAmmReserves(
    { pair: "XDX/XIO", quote: "XIO", issuer: XIO_ISSUER, fresh: true },
    { fetchImpl, now: Date.now() }
  );
  assert.equal(live.reserve_source, "amm_info");
  assert.equal(live.amm_account, "rDJXzsZGACeHGJQYfaudsYshaC5zJxqsHr");
  assert.ok(Math.abs(live.reserve_currency - 59.93807084355173) < 1e-9);
  assert.ok(Math.abs(live.lp_supply - 44936.64667926788) < 1e-9);
});

test("loadLiveAmmReserves does not look up XDX/XRP when an unknown IOU has no issuer", async () => {
  let called = 0;
  const fetchImpl = rpcFetch(() => {
    called += 1;
    return {};
  });
  const live = await loadLiveAmmReserves(
    { pair: "XDX/NEWCOIN", quote: "NEWCOIN", fresh: true },
    { fetchImpl, now: Date.now() }
  );
  assert.equal(called, 0);
  assert.equal(live.reserve_source, "empty");
});

test("loadLiveAmmReserves falls back to asset pair when amm_account fails", async () => {
  const fetchImpl = rpcFetch((method, params) => {
    if (params.amm_account === "rMissing") {
      return {};
    }
    return {
      amm: {
        account: "rUsdcAmm",
        amount: { currency: "XDX", issuer: XDX_ISSUER, value: "80000" },
        amount2: { currency: "USDC", issuer: "rUsdc", value: "250" },
        lp_token: { currency: "03ABCDEF0123456789ABCDEF0123456789ABCDEF", issuer: "rUsdcAmm", value: "4000" },
      },
    };
  });
  const live = await loadLiveAmmReserves(
    {
      pair: "XDX/USDC",
      quote: "USDC",
      issuer: "rUsdc",
      ammAccount: "rMissing",
      fresh: true,
    },
    { fetchImpl, now: Date.now() }
  );
  assert.equal(live.reserve_source, "amm_info");
  assert.equal(live.reserve_currency, 250);
  assert.equal(live.amm_account, "rUsdcAmm");
});

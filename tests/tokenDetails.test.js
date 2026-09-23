import test from "node:test";
import assert from "node:assert/strict";
import { composeTokenDetails, keepLastGoodTokenDetails } from "../src/tokenDetails.js";

test("composeTokenDetails paints price and supply without Node 3 LP counts", () => {
  const row = composeTokenDetails({
    overview: {
      holder_count: 235,
      trustline_count: 412,
      circulating: 9_800_000_000,
      issuer_locked: 200_000_000,
      xdxUsd: 0.000045,
      xrpUsd: 2.4,
      issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo",
      source: "db",
    },
    prices: { xdxUsd: 0.000045, xrpUsd: 2.4 },
    change: { xdx: 1.2 },
  });

  assert.equal(row.tokenType, "XDX");
  assert.equal(row.price, 0.000045);
  assert.equal(row.holders, 235);
  assert.equal(row.trustlines, 412);
  assert.equal(row.lp_holder_count, null);
  assert.equal(row.lp_trustline_count, null);
  assert.equal(row.change24h, 1.2);
});

test("composeTokenDetails fills LP counts after Node 3 returns", () => {
  const row = composeTokenDetails({
    overview: { holder_count: 235, lp_holder_count: null },
    lpHolders: { count: 88 },
    lpTrustlines: { count: 120 },
  });
  assert.equal(row.lp_holder_count, 88);
  assert.equal(row.lp_trustline_count, 120);
});

test("keepLastGoodTokenDetails holds balances until a new total arrives", () => {
  const good = composeTokenDetails({
    overview: {
      holder_count: 235,
      circulating: 9_800_000_000,
      xdxUsd: 0.000045,
      xrpUsd: 2.4,
    },
    prices: { xdxUsd: 0.000045, xrpUsd: 2.4 },
    lpHolders: { count: 88 },
  });
  const hollow = composeTokenDetails({
    overview: {},
    prices: {},
    change: {},
  });
  const kept = keepLastGoodTokenDetails(good, hollow);
  assert.equal(kept.holders, 235);
  assert.equal(kept.lp_holder_count, 88);
  assert.equal(kept.recorded_price, 0.000045);
  assert.equal(kept.xdxUsd, 0.000045);
  assert.equal(kept.circulating, 9_800_000_000);

  const next = composeTokenDetails({
    overview: { holder_count: 240, xdxUsd: 0.00005, xrpUsd: 2.5 },
    prices: { xdxUsd: 0.00005, xrpUsd: 2.5 },
    lpHolders: { count: 90 },
  });
  const updated = keepLastGoodTokenDetails(good, next);
  assert.equal(updated.holders, 240);
  assert.equal(updated.lp_holder_count, 90);
  assert.equal(updated.xdxUsd, 0.00005);
});

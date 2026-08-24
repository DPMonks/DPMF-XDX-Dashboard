import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogSource,
  mergeCatalogPayload,
  mergeChange24h,
  mergeCountPayload,
  mergeIssuerLocked,
  mergeLiveOverview,
  mergeLivePrices,
  overlayDbResultWithLive,
} from "../server/catalogSwitch.js";

test("empty DB prices take the live AMM quote", () => {
  const merged = mergeLivePrices(
    { xdxUsd: 0, xrpUsd: 1.48, XSQUAD: 0.4, source: "db" },
    { xdxUsd: 0.000046, recorded_price: 0.000046, xdxGbp: 0.000034, xrpUsd: 1.5, source: "xrpl" }
  );
  assert.equal(merged.xdxUsd, 0.000046);
  assert.equal(merged.recorded_price, 0.000046);
  assert.equal(merged.xrpUsd, 1.5);
  assert.equal(merged.XSQUAD, 0.4);
  assert.equal(merged.source, "hybrid");
});

test("DB holders stay when present and live fills a zero price", () => {
  const merged = mergeLiveOverview(
    { xdxUsd: 0, holder_count: 1800, trustlines: 2200, reserve_asset: 0, source: "db" },
    { xdxUsd: 0.00005, holder_count: 15941, reserve_asset: 64_000_000, reserve_currency: 2000, source: "xrpl" }
  );
  assert.equal(merged.xdxUsd, 0.00005);
  assert.equal(merged.holder_count, 1800);
  assert.equal(merged.reserve_asset, 64_000_000);
  assert.equal(merged.source, "hybrid");
});

test("zero DB holder counts take the live token stats", () => {
  const merged = mergeCountPayload({ count: 0, source: "db" }, { count: 15941, source: "xrpl.to" });
  assert.equal(merged.count, 15941);
  assert.equal(merged.source, "xrpl");
});

test("issuer lock stays on DB when issued is present", () => {
  const db = mergeIssuerLocked({ issued: 9_000_000_000, issuer_locked: 1_000_000_000, source: "db" }, {
    issued: 8,
    issuer_locked: 2,
    source: "xrpl",
  });
  assert.equal(db.issued, 9_000_000_000);
  const live = mergeIssuerLocked({ issued: 0, issuer_locked: 0, source: "db" }, {
    issued: 9_100_000_000,
    issuer_locked: 900_000_000,
    source: "xrpl",
  });
  assert.equal(live.issued, 9_100_000_000);
  assert.equal(live.source, "xrpl");
});

test("change24h uses live only when the DB row is blank", () => {
  assert.equal(mergeChange24h({ xdx: -2, xrp: 1 }, { xdx: -4, xrp: 0 }).xdx, -2);
  assert.equal(mergeChange24h({ xdx: 0, xrp: 0 }, { xdx: -3.6, xrp: 0.2 }).xdx, -3.6);
});

test("mergeCatalogPayload routes prices, overview, and lists", () => {
  const prices = mergeCatalogPayload("prices", { xdxUsd: 0 }, { xdxUsd: 0.1 });
  assert.equal(prices.xdxUsd, 0.1);
  const holders = mergeCatalogPayload("top-holders", { holders: [{ account: "r1" }] }, { rows: [] });
  assert.equal(holders.holders[0].account, "r1");
  const emptyHolders = mergeCatalogPayload("top-holders", { holders: [] }, { rows: [], catching_up: true });
  assert.equal(emptyHolders.catching_up, true);
  assert.equal(catalogSource(true, true), "hybrid");
});

test("overlayDbResultWithLive rewrites an empty 200 from Postgres", async () => {
  const overlaid = await overlayDbResultWithLive(
    "prices",
    { status: 200, body: JSON.stringify({ xdxUsd: 0, xrpUsd: 1.4, source: "db" }), source: "postgres" },
    async () => ({ xdxUsd: 0.00004, recorded_price: 0.00004, xrpUsd: 1.45, source: "xrpl" })
  );
  const body = JSON.parse(overlaid.body);
  assert.equal(body.xdxUsd, 0.00004);
  assert.equal(body.source, "hybrid");
});

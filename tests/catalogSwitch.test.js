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
  serveCatalogFallback,
} from "../server/catalogSwitch.js";
import { rememberCatalog, resetCatalogMemory } from "../server/sourceControl.js";

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

test("mergeCatalogPayload keeps a single pair book instead of swapping in XDX/XRP", () => {
  const db = {
    pair: "XDX/XIO",
    bids: [{ price: 0.0000012, base_size: 4000, source: "bridge" }],
    asks: [{ price: 0.00000128, base_size: 100, source: "amm" }],
    source: "db",
  };
  const live = {
    pair: "XDX/XRP",
    bids: [{ price: 0.00003, base_size: 1000, source: "dex" }],
    asks: [],
    source: "xrpl",
  };
  const merged = mergeCatalogPayload("orderbook", db, live);
  assert.equal(merged.pair, "XDX/XIO");
  assert.equal(merged.bids[0].source, "bridge");
});

test("overlayDbResultWithLive rewrites an empty 200 from Postgres", async () => {
  resetCatalogMemory();
  const overlaid = await overlayDbResultWithLive(
    "prices",
    { status: 200, body: JSON.stringify({ xdxUsd: 0, xrpUsd: 1.4, source: "db" }), source: "postgres" },
    async () => ({ xdxUsd: 0.00004, recorded_price: 0.00004, xrpUsd: 1.45, source: "xrpl" })
  );
  const body = JSON.parse(overlaid.body);
  assert.equal(body.xdxUsd, 0.00004);
  assert.equal(body.source, "hybrid");
  assert.equal(overlaid.catalogOverlaid, true);
});

test("empty Railway rows take last-good when free APIs fail", async () => {
  resetCatalogMemory();
  rememberCatalog("prices", { xdxUsd: 0.00004, recorded_price: 0.00004, source: "xrpl.to" });
  const overlaid = await overlayDbResultWithLive(
    "prices",
    { status: 200, body: JSON.stringify({ xdxUsd: 0, source: "db" }), source: "postgres" },
    async () => {
      throw new Error("xrpl.to down");
    }
  );
  assert.equal(JSON.parse(overlaid.body).xdxUsd, 0.00004);
});

test("already overlaid catalog results are not fetched twice", async () => {
  let calls = 0;
  const first = await overlayDbResultWithLive(
    "prices",
    { status: 200, body: JSON.stringify({ xdxUsd: 0 }), source: "postgres", catalogOverlaid: true },
    async () => {
      calls += 1;
      return { xdxUsd: 1 };
    }
  );
  assert.equal(calls, 0);
  assert.equal(JSON.parse(first.body).xdxUsd, 0);
});

test("wallet rank keeps a Railway rank and fills a blank one", () => {
  const kept = mergeCatalogPayload(
    "wallet/rank/rABC",
    { account: "rABC", rank: 4, source: "db" },
    { account: "rABC", rank: 1, source: "xrpl.to" }
  );
  assert.equal(kept.rank, 4);
  const filled = mergeCatalogPayload(
    "wallet/rank/rABC",
    { account: "rABC", rank: null, source: "empty" },
    { account: "rABC", rank: 1, source: "xrpl.to" }
  );
  assert.equal(filled.rank, 1);
  assert.equal(filled.source, "xrpl");
});

test("populated Railway history wins over the free tape", () => {
  const db = [{ timestamp: "2026-01-01T00:00:00.000Z", xdx: 10, side: "buy" }];
  const live = [{ timestamp: "2026-08-24T00:00:00.000Z", xdx: 99, side: "sell", source: "xrpl.to" }];
  const kept = mergeCatalogPayload("xdx-flows", db, live);
  assert.equal(kept[0].xdx, 10);
  const empty = mergeCatalogPayload("xdx-flows", [], live);
  assert.equal(empty[0].xdx, 99);
});

test("serveCatalogFallback returns last-good when the free API throws", async () => {
  resetCatalogMemory();
  rememberCatalog("overview", { xdxUsd: 0.00005, holder_count: 15000, source: "xrpl.to" });
  const result = await serveCatalogFallback("overview", async () => {
    throw new Error("down");
  });
  assert.equal(JSON.parse(result.body).holder_count, 15000);
  assert.equal(result.status, 200);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogHealth,
  catalogMode,
  payloadUsable,
  preferUsable,
  recallCatalog,
  rememberCatalog,
  resetCatalogMemory,
} from "../server/sourceControl.js";
import {
  FREE_API_HEADERS,
  holdersFromXrplTo,
  flowsFromXrplToHistory,
  candlesFromOhlc,
  loadXrplToHolders,
} from "../server/xrplToCatalog.js";

test("last-good catalog memory keeps a usable free-API payload", () => {
  resetCatalogMemory();
  assert.equal(payloadUsable("prices", { xdxUsd: 0 }), false);
  assert.equal(rememberCatalog("prices", { xdxUsd: 0.00004 }), true);
  assert.equal(recallCatalog("prices").xdxUsd, 0.00004);
  const kept = preferUsable("prices", { xdxUsd: 0, source: "db" }, recallCatalog("prices"));
  assert.equal(kept.xdxUsd, 0.00004);
  assert.equal(catalogMode({ postgresDown: true, liveUsed: true }), "free");
  assert.equal(catalogMode({ dbUsed: true, liveUsed: true }), "hybrid");
  assert.equal(catalogMode({ dbUsed: true }), "railway");
  assert.equal(payloadUsable("prices/change24h", { xdx: -3.6, source: "xrpl.to" }), true);
  assert.equal(payloadUsable("prices/change24h", { xdx: 0, xrp: 0, source: "db" }), false);
  resetCatalogMemory();
});

test("catalog health reports armed Railway and active free failover", () => {
  const armed = catalogHealth({ postgresDown: false, dbOk: true });
  assert.equal(armed.status, "ok");
  assert.equal(armed.mode, "railway");
  assert.equal(armed.failover, "armed");
  const active = catalogHealth({ postgresDown: true, dbOk: false });
  assert.equal(active.status, "degraded");
  assert.equal(active.mode, "free");
  assert.equal(active.failover, "active");
});

test("xrpl.to rich list and OHLC map onto dashboard shapes", () => {
  const page = holdersFromXrplTo({
    length: 19973,
    richList: [{ account: "rDPMFBANKMexTKkC7e4n3ekD9HfhmWHva8", balance: 3004952684.62, rank: 1 }],
  });
  assert.equal(page.holders[0].rank, 1);
  assert.equal(page.count, 19973);
  assert.equal(page.catching_up, false);
  const candles = candlesFromOhlc({
    ohlc: [[1787526000000, 0.000047, 0.000048, 0.000046, 0.0000475, 10]],
  });
  assert.equal(candles.length, 1);
  assert.equal(candles[0].price_usd, 0.0000475);
  const flows = flowsFromXrplToHistory({
    data: [
      {
        paid: { currency: "XRP", value: 1 },
        got: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo", value: 20000 },
        taker: "r1",
        time: 1787526000,
      },
    ],
  });
  assert.equal(flows[0].side, "buy");
  assert.equal(flows[0].xdx, 20000);
});

test("free API fetches send a dashboard User-Agent so Cloudflare does not 403", async () => {
  assert.match(FREE_API_HEADERS["user-agent"], /DPMF-XDX-Dashboard/);
  let headers = {};
  const page = await loadXrplToHolders({
    limit: 1,
    fetchImpl: async (_url, options) => {
      headers = options.headers || {};
      return {
        ok: true,
        json: async () => ({ length: 1, richList: [{ account: "r1", balance: 2, rank: 1 }] }),
      };
    },
  });
  assert.equal(headers["user-agent"], "DPMF-XDX-Dashboard/1.1");
  assert.equal(page.holders[0].account, "r1");
});

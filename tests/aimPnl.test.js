import test from "node:test";
import assert from "node:assert/strict";
import { AIM_ADMIN_WALLET } from "../src/constants/ledger.js";
import {
  AIM_PNL_EMPTY,
  formatLondonStamp,
  formatLondonWindow,
  formatUsd,
  interpretPnlRecent,
  interpretPnlSummary,
  normalizeRecentTrades,
} from "../src/aimPnlFormat.js";
import { aimPnlRecentPayload, aimPnlSummaryPayload } from "../server/aimPnl.js";

const ADMIN = AIM_ADMIN_WALLET;
const OTHER = "rN7n7otQDd6FczFgLdphjsiEaUsfoe5bX";
const TOKEN = "desk-secret-token";

function req({ wallet = "", url = "/api/aim/admin/pnl/recent?limit=50", method = "GET", query = {} } = {}) {
  return {
    method,
    url,
    query,
    headers: wallet ? { "x-aim-wallet": wallet } : {},
  };
}

test("London stamps use Europe/London in winter and summer", () => {
  const winter = formatLondonStamp("2026-01-15T12:00:00.000Z");
  assert.match(winter, /15 Jan/);
  assert.match(winter, /12:00/);
  assert.match(winter, /GMT/);
  const summer = formatLondonStamp("2026-07-15T12:00:00.000Z");
  assert.match(summer, /15 Jul/);
  assert.match(summer, /13:00/);
  assert.match(summer, /BST/);
  const windowLabel = formatLondonWindow("2026-01-15T12:00:00.000Z", "2026-01-16T12:00:00.000Z");
  assert.match(windowLabel, /15 Jan/);
  assert.match(windowLabel, /to/);
  assert.match(windowLabel, /16 Jan/);
});

test("USD labels stay grouped and signed", () => {
  assert.equal(formatUsd(12.5), "+$12.50");
  assert.equal(formatUsd(0), "$0.00");
  assert.equal(formatUsd(1234.5), "+$1,234.50");
  assert.equal(formatUsd(-3), "-$3.00");
  assert.equal(formatUsd("nope"), "n/a");
});

test("recent trades keep profitable fills, newest first", () => {
  const trades = normalizeRecentTrades({
    trades: [
      { id: "old", created_at: "2026-09-23T10:00:00.000Z", agent: "agent1", pair: "XDX/XRP", realized_pnl_usd: "4.5", tx_hash: "aa".repeat(32), seed: "nope" },
      { id: "loss", created_at: "2026-09-23T18:00:00.000Z", agent: "agent2", pair: "XDX/RLUSD", realized_pnl_usd: -2 },
      { id: "new", created_at: "2026-09-23T19:00:00.000Z", agent: "agent4", pair: "XRP/RLUSD", realized_pnl_usd: 9.25, tx_hash: "not-a-hash" },
    ],
  });
  assert.deepEqual(trades.map((row) => row.id), ["new", "old"]);
  assert.equal(trades[1].tx_hash.length, 64);
  assert.equal(trades[0].tx_hash, "");
  assert.equal(JSON.stringify(trades).includes("nope"), false);
  assert.equal(interpretPnlRecent({ trades: [], configured: true, available: true }).note, AIM_PNL_EMPTY);
  assert.match(interpretPnlRecent({ configured: false }).note, /not connected/);
  assert.match(interpretPnlSummary({ code: "AIM_PNL_UNAVAILABLE" }).note, /not available/);
});

test("non-admin cannot read PnL and the desk is not called", async () => {
  let called = 0;
  const fetchImpl = async () => {
    called += 1;
    throw new Error("should not fetch");
  };
  const missing = await aimPnlRecentPayload(req(), { fetchImpl, env: { AIM_DESK_BASE_URL: "https://aim.example" } });
  const stranger = await aimPnlSummaryPayload(req({ wallet: OTHER }), {
    fetchImpl,
    env: { AIM_DESK_BASE_URL: "https://aim.example", AIM_ADMIN_TOKEN: TOKEN },
  });
  const posted = await aimPnlRecentPayload(req({ wallet: ADMIN, method: "POST" }), {
    fetchImpl,
    env: { AIM_DESK_BASE_URL: "https://aim.example", AIM_ADMIN_TOKEN: TOKEN },
  });
  assert.equal(missing.status, 403);
  assert.equal(stranger.status, 403);
  assert.equal(posted.status, 405);
  assert.equal(called, 0);
  assert.equal(JSON.stringify(missing.body).includes("trades"), false);
  assert.equal(JSON.stringify(stranger.body).includes(TOKEN), false);
});

test("admin proxy sends the bearer, hides it from the browser payload, and clamps limit", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (String(url).includes("summary-24h")) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            total_earned_usd: 21.5,
            trade_count: 2,
            by_agent: { agent1: { realized_pnl_usd: 12, trade_count: 1 }, agent4: 9.5 },
            window_start: "2026-09-22T20:00:00.000Z",
            window_end: "2026-09-23T20:00:00.000Z",
            authorization: TOKEN,
          }),
      };
    }
    return {
      status: 200,
      ok: true,
      text: async () =>
        JSON.stringify({
          trades: [
            { id: "a", created_at: "2026-09-23T18:00:00.000Z", agent: "agent1", pair: "XDX/XRP", realized_pnl_usd: 1.2 },
          ],
        }),
    };
  };
  const env = { AIM_DESK_BASE_URL: "https://aim.example/ignored", AIM_ADMIN_TOKEN: TOKEN };
  const recent = await aimPnlRecentPayload(req({ wallet: ADMIN, url: "/api/aim/admin/pnl/recent?limit=500" }), {
    fetchImpl,
    env,
    now: () => new Date("2026-09-23T20:27:00.000Z"),
  });
  const summary = await aimPnlSummaryPayload(req({ wallet: `signed ${ADMIN}`, url: AIM_SUMMARY }), {
    fetchImpl,
    env,
  });
  assert.equal(recent.status, 200);
  assert.equal(recent.body.trades.length, 1);
  assert.equal(calls[0].url, "https://aim.example/api/aim/admin/pnl/recent?limit=50");
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(JSON.stringify(recent.body).includes(TOKEN), false);
  assert.equal(summary.body.total_earned_usd, 21.5);
  assert.equal(summary.body.by_agent[0].agent, "agent1");
  assert.equal(summary.body.by_agent[1].realized_pnl_usd, 9.5);
  assert.equal(JSON.stringify(summary.body).includes(TOKEN), false);
  assert.equal(calls[1].url, "https://aim.example/api/aim/admin/pnl/summary-24h");
});

const AIM_SUMMARY = "/api/aim/admin/pnl/summary-24h";

test("missing desk config and a 404 feed stay graceful", async () => {
  const quiet = await aimPnlRecentPayload(req({ wallet: ADMIN }), { env: {}, fetchImpl: async () => { throw new Error("no"); } });
  assert.equal(quiet.status, 200);
  assert.equal(quiet.body.configured, false);
  assert.equal(quiet.body.trades.length, 0);
  const missingRoute = await aimPnlSummaryPayload(req({ wallet: ADMIN }), {
    env: { AIM_DESK_BASE_URL: "https://aim.example", AIM_ADMIN_TOKEN: TOKEN },
    fetchImpl: async () => ({ status: 404, ok: false, text: async () => "missing" }),
  });
  assert.equal(missingRoute.status, 200);
  assert.equal(missingRoute.body.code, "AIM_PNL_UNAVAILABLE");
  const blew = await aimPnlRecentPayload(req({ wallet: ADMIN }), {
    env: { AIM_DESK_BASE_URL: "http://127.0.0.1:9", AIM_ADMIN_TOKEN: `bad\n${TOKEN}` },
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers.Authorization, undefined);
      throw new Error(`connect ${TOKEN}`);
    },
  });
  assert.equal(blew.status, 502);
  assert.equal(JSON.stringify(blew.body).includes(TOKEN), false);
  assert.equal(blew.body.error.includes("127.0.0.1"), false);
});

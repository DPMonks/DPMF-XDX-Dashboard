import test from "node:test";
import assert from "node:assert/strict";
import { AIM_ADMIN_WALLET } from "../src/constants/ledger.js";
import {
  AIM_PNL_ALL_EMPTY,
  AIM_PNL_EMPTY,
  formatAllProfitLine,
  formatLondonStamp,
  formatLondonWhen,
  formatLondonWindow,
  formatUsd,
  interpretPnlAll,
  interpretPnlRecent,
  interpretPnlSummary,
  normalizePnlAll,
  normalizeRecentTrades,
} from "../src/aimPnlFormat.js";
import { aimPnlAllPayload, aimPnlRecentPayload, aimPnlRoute, aimPnlSummaryPayload } from "../server/aimPnl.js";

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

test("all-time line uses London time and stays free of long dashes", () => {
  assert.equal(formatLondonWhen("2026-01-15T12:00:00.000Z"), "15 Jan 2026, 12:00 GMT");
  assert.equal(formatLondonWhen("2026-07-15T12:00:00.000Z"), "15 Jul 2026, 13:00 BST");
  const line = formatAllProfitLine({
    wins_count: 1,
    losses_count: 2,
    closed_trades_count: 3,
    first_trade_at: "2026-07-15T12:00:00.000Z",
  });
  assert.equal(line, "1 win | 2 losses | 3 closed trades | since 15 Jul 2026, 13:00 BST");
  assert.equal(line.includes("\u2013"), false);
  assert.equal(line.includes("\u2014"), false);
  assert.equal(AIM_PNL_ALL_EMPTY.includes("\u2013") || AIM_PNL_ALL_EMPTY.includes("\u2014"), false);
  const roster = normalizePnlAll({
    realized_pnl_usd: "-4.25",
    gross_wins_usd: "10.00",
    gross_losses_usd: "-14.25",
    wins_count: 2,
    losses_count: 1,
    closed_trades_count: 3,
    first_trade_at: "2026-01-15T12:00:00.000Z",
    by_agent: [
      { agent_id: "agent2", role: "AMM", realized_pnl_usd: "3.50", wins_count: 1, losses_count: 0 },
      { agent_id: "Prime", role: "Token accumulation", realized_pnl_usd: "-7.75", wins_count: 1, losses_count: 1 },
      { agent_id: "Commander", role: "Desk lead", realized_pnl_usd: "99", wins_count: 1, losses_count: 0 },
    ],
    by_strategy: [{ strategy_id: "explorer", realized_pnl_usd: "-4.25", authorization: "desk-secret-token" }],
    source_note: "ledger closes",
  });
  assert.equal(roster.realized_pnl_usd, -4.25);
  assert.deepEqual(
    roster.by_agent.map((row) => row.agent_id),
    ["Prime", "Flux", "Vector", "Vortex", "Echo", "Ghost"]
  );
  assert.equal(roster.by_agent[0].realized_pnl_usd, -7.75);
  assert.equal(roster.by_agent[1].realized_pnl_usd, 3.5);
  assert.equal(roster.by_agent[2].realized_pnl_usd, 0);
  assert.equal(JSON.stringify(roster).includes("desk-secret-token"), false);
  assert.equal(JSON.stringify(roster).includes("Commander"), false);
  assert.equal(interpretPnlAll({ closed_trades_count: 0, realized_pnl_usd: 0, configured: true, available: true }).note, AIM_PNL_ALL_EMPTY);
  assert.match(interpretPnlAll({ configured: false }).note, /not connected/);
});

test("USD labels stay grouped and signed, including decimal strings", () => {
  assert.equal(formatUsd(12.5), "+$12.50");
  assert.equal(formatUsd("12.50"), "+$12.50");
  assert.equal(formatUsd(0), "$0.00");
  assert.equal(formatUsd("0.00"), "$0.00");
  assert.equal(formatUsd(1234.5), "+$1,234.50");
  assert.equal(formatUsd("-3.00"), "-$3.00");
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
  const strangerAll = await aimPnlAllPayload(req({ wallet: OTHER, url: "/api/aim/admin/pnl/summary-all" }), {
    fetchImpl,
    env: { AIM_DESK_BASE_URL: "https://aim.example", AIM_ADMIN_TOKEN: TOKEN },
  });
  const posted = await aimPnlRecentPayload(req({ wallet: ADMIN, method: "POST" }), {
    fetchImpl,
    env: { AIM_DESK_BASE_URL: "https://aim.example", AIM_ADMIN_TOKEN: TOKEN },
  });
  assert.equal(missing.status, 403);
  assert.equal(stranger.status, 403);
  assert.equal(strangerAll.status, 403);
  assert.equal(posted.status, 405);
  assert.equal(called, 0);
  assert.equal(JSON.stringify(missing.body).includes("trades"), false);
  assert.equal(JSON.stringify(stranger.body).includes(TOKEN), false);
  assert.equal(JSON.stringify(strangerAll.body).includes("realized_pnl_usd"), false);
  assert.equal(JSON.stringify(strangerAll.body).includes(TOKEN), false);
  assert.equal(aimPnlRoute("/api/aim/admin/pnl/summary-all"), "all");
});

test("admin proxy calls aim-commander with X-AIM-Admin-Token and the finalized paths", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (String(url).includes("/aim/realized-pnl/totals")) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            totals: {
              realized_pnl_usd: "21.50",
              count: 2,
              since: "2026-09-22T20:27:00.000Z",
              until: "2026-09-23T20:27:00.000Z",
            },
            by_agent: {
              Prime: { realized_pnl_usd: "12.00", count: 1 },
              Echo: { realized_pnl_usd: "0.00", count: 0 },
              Vector: { realized_pnl_usd: "0", count: 0 },
              Vortex: { realized_pnl_usd: "9.50", count: 1 },
              Flux: { realized_pnl_usd: "0.00", count: 0 },
              Ghost: { realized_pnl_usd: "0.00", count: 0 },
              Commander: { realized_pnl_usd: "0.00", count: 0 },
            },
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
            {
              id: "loss",
              created_at: "2026-09-23T19:00:00.000Z",
              agent: "Echo",
              pair: "XDX/RLUSD",
              realized_pnl_usd: "-2.00",
            },
            {
              id: "a",
              created_at: "2026-09-23T18:00:00.000Z",
              agent: "Prime",
              pair: "XDX/XRP",
              realized_pnl_usd: "1.20",
            },
          ],
        }),
    };
  };
  const env = { AIM_BASE_URL: "https://aim.example/ignored", AIM_ADMIN_TOKEN: TOKEN };
  const now = () => new Date("2026-09-23T20:27:00.000Z");
  const recent = await aimPnlRecentPayload(req({ wallet: ADMIN, url: "/api/aim/admin/pnl/recent?limit=500" }), {
    fetchImpl,
    env,
    now,
  });
  const summary = await aimPnlSummaryPayload(req({ wallet: `signed ${ADMIN}`, url: "/api/aim/admin/pnl/summary-24h" }), {
    fetchImpl,
    env,
    now,
  });
  const recentUrl = new URL(calls[0].url);
  assert.equal(recentUrl.origin + recentUrl.pathname, "https://aim.example/aim/realized-pnl/recent");
  assert.equal(recentUrl.searchParams.get("limit"), "50");
  assert.equal(recentUrl.searchParams.get("since"), "2026-09-22T20:27:00.000Z");
  assert.equal(calls[0].init.headers["X-AIM-Admin-Token"], TOKEN);
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.equal(recent.status, 200);
  assert.deepEqual(recent.body.trades.map((row) => row.id), ["a"]);
  assert.equal(recent.body.trades[0].realized_pnl_usd, 1.2);
  assert.equal(JSON.stringify(recent.body).includes(TOKEN), false);
  const totalsUrl = new URL(calls[1].url);
  assert.equal(totalsUrl.origin + totalsUrl.pathname, "https://aim.example/aim/realized-pnl/totals");
  assert.equal(totalsUrl.searchParams.get("hours"), "24");
  assert.equal(calls[1].init.headers["X-AIM-Admin-Token"], TOKEN);
  assert.equal(summary.body.total_earned_usd, 21.5);
  assert.equal(summary.body.trade_count, 2);
  assert.deepEqual(
    summary.body.by_agent.map((row) => row.agent),
    ["Prime", "Echo", "Vector", "Vortex", "Flux", "Ghost", "Commander"]
  );
  assert.equal(summary.body.by_agent[0].realized_pnl_usd, 12);
  assert.equal(summary.body.by_agent[3].realized_pnl_usd, 9.5);
  assert.equal(summary.body.by_agent[1].trade_count, 0);
  assert.equal(summary.body.window_start, "2026-09-22T20:27:00.000Z");
  assert.equal(JSON.stringify(summary.body).includes(TOKEN), false);
});

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
  let calls = 0;
  const unsetToken = await aimPnlRecentPayload(req({ wallet: ADMIN }), {
    env: { AIM_DESK_BASE_URL: "https://aim.example", AIM_ADMIN_TOKEN: `bad\n${TOKEN}` },
    fetchImpl: async () => {
      calls += 1;
      throw new Error("should not fetch");
    },
  });
  assert.equal(unsetToken.status, 200);
  assert.equal(unsetToken.body.configured, false);
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(unsetToken.body).includes(TOKEN), false);
  const blew = await aimPnlRecentPayload(req({ wallet: ADMIN }), {
    env: { AIM_DESK_BASE_URL: "http://127.0.0.1:9", AIM_ADMIN_TOKEN: TOKEN },
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers["X-AIM-Admin-Token"], TOKEN);
      assert.equal(init.headers.Authorization, undefined);
      throw new Error(`connect ${TOKEN}`);
    },
  });
  assert.equal(blew.status, 502);
  assert.equal(JSON.stringify(blew.body).includes(TOKEN), false);
  assert.equal(String(blew.body.error || "").includes("127.0.0.1"), false);
});

test("all-time proxy calls summary-all and treats a missing route as an empty ledger", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (String(url).endsWith("/api/aim/admin/pnl/summary-all") && calls.length === 1) {
      return {
        status: 200,
        ok: true,
        text: async () =>
          JSON.stringify({
            ok: true,
            realized_pnl_usd: "18.00",
            gross_wins_usd: "20.00",
            gross_losses_usd: "-2.00",
            wins_count: 2,
            losses_count: 1,
            closed_trades_count: 3,
            first_trade_at: "2026-03-01T00:30:00.000Z",
            last_trade_at: "2026-09-23T18:00:00.000Z",
            by_agent: [
              { agent_id: "agent5", role: "Mean reversion", realized_pnl_usd: "18.00", wins_count: 2, losses_count: 1 },
            ],
            by_strategy: [{ name: "echo", realized_pnl_usd: "18.00", secret: TOKEN }],
            source_note: "closed fills",
            authorization: TOKEN,
          }),
      };
    }
    if (calls.length === 2) return { status: 404, ok: false, text: async () => "missing" };
    return {
      status: 200,
      ok: true,
      text: async () => JSON.stringify({ service: "aim-commander", read_only: false, ok: true }),
    };
  };
  const env = { AIM_DESK_BASE_URL: "https://aim.example", AIM_ADMIN_TOKEN: TOKEN };
  const now = () => new Date("2026-09-23T20:27:00.000Z");
  const live = await aimPnlAllPayload(req({ wallet: ADMIN, url: "/api/aim/admin/pnl/summary-all" }), {
    fetchImpl,
    env,
    now,
  });
  const missing = await aimPnlAllPayload(req({ wallet: ADMIN, url: "/api/aim/admin/pnl/summary-all" }), {
    fetchImpl,
    env,
    now,
  });
  const stub = await aimPnlAllPayload(req({ wallet: ADMIN, url: "/api/aim/admin/pnl/summary-all" }), {
    fetchImpl,
    env,
    now,
  });
  assert.equal(new URL(calls[0].url).pathname, "/api/aim/admin/pnl/summary-all");
  assert.equal(calls[0].init.headers["X-AIM-Admin-Token"], TOKEN);
  assert.equal(calls[0].init.headers.Authorization, undefined);
  assert.equal(live.status, 200);
  assert.equal(live.body.realized_pnl_usd, 18);
  assert.equal(live.body.closed_trades_count, 3);
  assert.equal(live.body.by_agent[4].agent_id, "Echo");
  assert.equal(live.body.by_agent[4].realized_pnl_usd, 18);
  assert.equal(live.body.first_trade_at, "2026-03-01T00:30:00.000Z");
  assert.equal(JSON.stringify(live.body).includes(TOKEN), false);
  assert.equal(missing.status, 200);
  assert.equal(missing.body.configured, true);
  assert.equal(missing.body.available, true);
  assert.equal(missing.body.code, undefined);
  assert.equal(missing.body.closed_trades_count, 0);
  assert.equal(interpretPnlAll(missing.body).note, AIM_PNL_ALL_EMPTY);
  assert.equal(stub.status, 200);
  assert.equal(stub.body.closed_trades_count, 0);
  assert.equal(interpretPnlAll(stub.body).note, AIM_PNL_ALL_EMPTY);
  assert.equal(JSON.stringify(stub.body).includes("aim-commander"), false);
});

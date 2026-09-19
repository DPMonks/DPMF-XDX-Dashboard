import test from "node:test";
import assert from "node:assert/strict";
import {
  applyStandingOrders,
  commandAckText,
  CORE_DESK_PAIRS,
  extractCommandPair,
  isExecutableAdminCommand,
  isQuestionLike,
  looksLikeAdminCommand,
  normalizeDeskPair,
  parseAdminCommand,
  PRIMARY_DESK_PAIR,
  standingOrdersPublic,
} from "../server/aimAdminCommand.js";

test("normalize and extract desk pairs", () => {
  assert.equal(normalizeDeskPair("xdx-xio"), "XDX/XIO");
  assert.equal(normalizeDeskPair("RLUSD/XRP"), "XRP/RLUSD");
  assert.equal(extractCommandPair("watch the XDX/SOLO book"), "XDX/SOLO");
  assert.equal(PRIMARY_DESK_PAIR, "XRP/RLUSD");
  assert.ok(CORE_DESK_PAIRS.includes("XDX/XSQUAD"));
});

test("admin command verbs from natural language", () => {
  assert.equal(parseAdminCommand("watch XDX/XIO market").verb, "watch_market");
  assert.equal(parseAdminCommand("watch XDX/XIO market").pair, "XDX/XIO");
  assert.equal(parseAdminCommand("add a trustline for XDX/SOLO").verb, "trustline");
  assert.equal(parseAdminCommand("add a trustline for XDX/SOLO").quote, "SOLO");
  assert.equal(parseAdminCommand("activate all phases").verb, "activate_phases");
  assert.equal(parseAdminCommand("go live").verb, "activate_phases");
  assert.equal(parseAdminCommand("increase trades").verb, "increase_trades");
  assert.equal(parseAdminCommand("increase observe").verb, "observe");
  assert.equal(parseAdminCommand("explore the XRPL for extra pairs").verb, "explore_ledger");
  assert.equal(parseAdminCommand("Vortex open a weekly XDX/XIO pool").verb, "vortex_weekly");
  assert.equal(parseAdminCommand("Vortex open a weekly XDX/XIO pool").quote, "XIO");
  assert.equal(parseAdminCommand("counter bots on XDX pairs").verb, "counter_bots");
  assert.equal(parseAdminCommand("route traffic through XDX pools").verb, "route_xdx");
  assert.equal(parseAdminCommand("list standing orders").verb, "list_orders");
  assert.equal(parseAdminCommand("draw a bullish prediction on XDX/XRP").verb, "draw_prediction");
  assert.equal(parseAdminCommand("draw a bullish prediction on XDX/XRP").side, "bull");
  assert.equal(parseAdminCommand("draw a bullish prediction on XDX/XRP").durable, false);
});

test("command prefix remembers free-form orders", () => {
  const cmd = parseAdminCommand("command: stay aggressive on extra books");
  assert.equal(cmd.verb, "remember");
  assert.equal(cmd.durable, true);
  assert.equal(isExecutableAdminCommand("stay aggressive on extra books"), null);
  assert.equal(isExecutableAdminCommand("command: stay aggressive on extra books")?.verb, "remember");
});

test("regular questions are not executable commands", () => {
  assert.equal(looksLikeAdminCommand("what is the XDX price"), false);
  assert.equal(isExecutableAdminCommand("how do trust lines work"), null);
  assert.equal(isExecutableAdminCommand("good morning commander"), null);
  assert.equal(looksLikeAdminCommand("watch XDX/XIO"), true);
  assert.equal(isQuestionLike("which assets are we trading right now", "analyse"), true);
  assert.equal(isQuestionLike("can you look for something profitable", "analyse"), false);
  assert.equal(isQuestionLike("what is the spread?", "trade"), true);
});

test("xsquad trustline does not steal the open XRP/RLUSD chart pair", () => {
  const cmd = parseAdminCommand("add the xsquad trustline to the agent wallets", {
    chartPair: "XRP/RLUSD",
  });
  assert.equal(cmd.verb, "trustline");
  assert.equal(cmd.quote, "XSQUAD");
  assert.equal(cmd.pair, "XDX/XSQUAD");
  assert.match(commandAckText(cmd, applyStandingOrders([cmd])), /XSQUAD/);
  assert.doesNotMatch(commandAckText(cmd, applyStandingOrders([cmd])), /Add a RLUSD/);
});

test("analyse topic hunts markets for a profitable trade", () => {
  const cmd = parseAdminCommand("look to see opportunity for profitable trade", { topic: "analyse" });
  assert.equal(cmd.verb, "analyse_markets");
  assert.equal(cmd.durable, true);
  const standing = applyStandingOrders([cmd]);
  assert.equal(standing.analyse_markets, true);
});

test("loose wording still maps under the selected topic", () => {
  const pred = parseAdminCommand("use the chart to give me a bearish prediction", { topic: "analyse", chartPair: "XRP/RLUSD" });
  assert.equal(pred.verb, "draw_prediction");
  assert.equal(pred.side, "bear");
  assert.equal(isExecutableAdminCommand("which assets are we trading right now", { topic: "analyse" }), null);
  const hunt = isExecutableAdminCommand("find a fee clear trade on the books", { topic: "analyse" });
  assert.equal(hunt.verb, "analyse_markets");
  const looseHunt = isExecutableAdminCommand("can you look for something profitable", { topic: "analyse" });
  assert.equal(looseHunt.verb, "analyse_markets");
  const buy = isExecutableAdminCommand("get me some XDX with RLUSD", { topic: "trade" });
  assert.equal(buy.verb, "trade_buy");
  assert.equal(buy.quote, "RLUSD");
  const sell = isExecutableAdminCommand("offload XDX for XRP", { topic: "trade" });
  assert.equal(sell.verb, "trade_sell");
  const trust = isExecutableAdminCommand("we still need xsquad on the wallets", { topic: "trustline", chartPair: "XRP/RLUSD" });
  assert.equal(trust.verb, "trustline");
  assert.equal(trust.quote, "XSQUAD");
  const chart = isExecutableAdminCommand("put my orders on", { topic: "chart" });
  assert.equal(chart.verb, "show_ledger_orders");
  const live = isExecutableAdminCommand("unlock the desk and start trading", { topic: "desk" });
  assert.equal(live.verb, "activate_phases");
  const view = isExecutableAdminCommand("give me a bearish view on this", { topic: "predict", chartPair: "XRP/RLUSD" });
  assert.equal(view.verb, "draw_prediction");
  assert.equal(view.side, "bear");
  const liq = isExecutableAdminCommand("top up the XDX/XRP pool", { topic: "liquidity" });
  assert.equal(liq.verb, "amm_deposit");
  assert.equal(liq.quote, "XRP");
});

test("topic-scoped buy and trustline parse", () => {
  const buy = parseAdminCommand("buy XDX with RLUSD", { topic: "trade" });
  assert.equal(buy.verb, "trade_buy");
  assert.equal(buy.quote, "RLUSD");
  assert.equal(buy.order, "market");
  const limit = parseAdminCommand("sell XDX limit at 1.25 for XRP", { topic: "trade" });
  assert.equal(limit.verb, "trade_sell");
  assert.equal(limit.order, "limit");
  assert.equal(limit.price, 1.25);
  const trust = isExecutableAdminCommand("add trustline XSQUAD", { topic: "trustline", chartPair: "XRP/RLUSD" });
  assert.equal(trust.quote, "XSQUAD");
});

test("applyStandingOrders builds watch list on top of XRP/RLUSD", () => {
  const standing = applyStandingOrders([
    { verb: "watch_market", pair: "XDX/SOLO", summary: "Watch XDX/SOLO" },
    { verb: "trustline", quote: "SOLO", pair: "XDX/SOLO" },
    { verb: "activate_phases" },
    { verb: "increase_trades" },
    { verb: "explore_ledger" },
    { verb: "vortex_weekly", quote: "XIO", pair: "XDX/XIO" },
    { verb: "route_xdx" },
    { verb: "counter_bots" },
  ]);
  assert.equal(standing.watch_pairs[0], "XRP/RLUSD");
  assert.ok(standing.watch_pairs.includes("XDX/SOLO"));
  assert.ok(standing.watch_pairs.includes("XDX/XSQUAD"));
  assert.deepEqual(standing.extra_markets, ["XDX/SOLO"]);
  assert.deepEqual(standing.trustlines, ["SOLO"]);
  assert.equal(standing.live_all_phases, true);
  assert.equal(standing.increase_trades, true);
  assert.equal(standing.explore_ledger, true);
  assert.equal(standing.route_xdx, true);
  assert.equal(standing.counter_bots, true);
  assert.equal(standing.vortex_weekly.quote, "XIO");
  const pub = standingOrdersPublic(standing);
  assert.equal(pub.primary_pair, "XRP/RLUSD");
  assert.match(commandAckText({ verb: "watch_market", summary: "Watch XDX/SOLO." }, standing), /ack$/);
  assert.match(commandAckText({ verb: "list_orders" }, standing), /Watching XDX\/SOLO|Also watching/i);
});

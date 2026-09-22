/** Admin-wallet command box: parse, remember, and apply standing desk orders. */

import { AIM_COMMAND_TOPICS, commandTopicMeta, normalizeCommandTopic } from "../src/aimCommandTopics.js";

export { AIM_COMMAND_TOPICS, commandTopicMeta, normalizeCommandTopic };

export const AIM_ADMIN_COMMAND_KIND = "AIM_ADMIN_COMMAND";
export const PRIMARY_DESK_PAIR = "XRP/RLUSD";
export const CORE_DESK_PAIRS = ["XRP/RLUSD", "XDX/XRP", "XDX/RLUSD", "XDX/XIO", "XDX/XSQUAD"];
export const KNOWN_ASSETS = ["XSQUAD", "XIO", "RLUSD", "SOLO", "XDX", "XRP"];
export const DESK_AGENT_IDS = ["agent1", "agent2", "agent3", "agent4", "agent5", "agent6"];

const PAIR_RE = /\b([A-Za-z0-9$]{2,12})\s*[/-](?:\s*)([A-Za-z0-9$]{2,12})\b/;
const CMD_PREFIX_RE = /^\s*(?:command|cmd|order|standing|do)\s*[:.-]\s*/i;
export function normalizeDeskPair(raw) {
  const pair = String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "/")
    .toUpperCase();
  if (!pair) return "";
  if (pair === "RLUSD/XRP") return "XRP/RLUSD";
  if (pair.startsWith("XDX/") || pair.startsWith("XRP/")) return pair;
  if (/^[A-Z0-9$]{2,12}\/[A-Z0-9$]{2,12}$/.test(pair)) return pair;
  return "";
}

export function extractCommandPair(text, fallback = "") {
  const m = String(text || "").match(PAIR_RE);
  if (m) return normalizeDeskPair(`${m[1]}/${m[2]}`);
  return normalizeDeskPair(fallback);
}

function quoteFromPair(pair) {
  const name = normalizeDeskPair(pair);
  if (!name.includes("/")) return "";
  return name.split("/")[1] || "";
}

export function extractNamedAsset(text, { allowChartFallback = false, chartPair = "" } = {}) {
  const q = String(text || "");
  const fromPair = extractCommandPair(q);
  if (fromPair) {
    const quote = quoteFromPair(fromPair);
    if (quote) return quote;
  }
  for (const asset of KNOWN_ASSETS) {
    if (asset === "XDX" || asset === "XRP") continue;
    if (new RegExp(`\\b${asset}\\b`, "i").test(q)) return asset;
  }
  const named =
    q.match(/\btrust\s*lines?\s+(?:for\s+)?([A-Za-z0-9$]{2,12})\b/i) ||
    q.match(/\b(?:add|remove|set|open|check)\b.{0,32}\b([A-Za-z0-9$]{2,12})\s+trust/i) ||
    q.match(/\b([A-Za-z0-9$]{2,12})\s+trust\s*lines?\b/i) ||
    q.match(/\b(?:for|on|to)\s+([A-Za-z0-9$]{2,12})\b/i);
  if (named) {
    const asset = String(named[1] || "").toUpperCase();
    if (asset && !["THE", "A", "AN", "FOR", "AND", "WITH"].includes(asset)) return asset;
  }
  if (allowChartFallback) return quoteFromPair(chartPair);
  return "";
}

export function looksLikeAdminCommand(text) {
  const q = String(text || "").trim();
  if (!q) return false;
  if (CMD_PREFIX_RE.test(q)) return true;
  if (
    /^\s*(watch|add|draw|predict|lay|explore|hunt|analyse|analyze|activate|go live|increase|observe|trustline|vortex|counter|route|list orders|standing|buy|sell|cancel|objective|remove)\b/i.test(
      q
    )
  ) {
    return true;
  }
  return (
    /\b(watch|add|include|look at)\b.{0,40}\b(market|pair|book)\b/i.test(q) ||
    /\b(add|set|upload|open|remove|check)\b.{0,28}\btrust\s*lines?\b/i.test(q) ||
    /\b(increase|more|step up)\b.{0,20}\b(trades?|fills?|observe)\b/i.test(q) ||
    /\b(activate|enable|go)\b.{0,20}\b(all )?phases?\b/i.test(q) ||
    /\bgo live\b/i.test(q) ||
    /\b(draw|lay|plot)\b.{0,28}\b(prediction|estimate|tools?|fib|trend)\b/i.test(q) ||
    /\bvortex\b.{0,40}\b(weekly|pool|amm)\b/i.test(q) ||
    /\b(explore|hunt|scan|analyse|analyze|free.?think)\b.{0,40}\b(ledger|xrpl|opportunit|markets?|pairs?|trade)\b/i.test(q) ||
    /\bprofitable\b.{0,24}\b(trade|pair|market|opportunit)/i.test(q) ||
    /\bcounter\b.{0,20}\bbots?\b/i.test(q) ||
    /\b(route|direct)\b.{0,28}\bxdx\b/i.test(q) ||
    /\b(list|show)\b.{0,16}\b(standing )?orders?\b/i.test(q) ||
    /\b(buy|sell)\b.{0,20}\bxdx\b/i.test(q) ||
    /\b(add|remove)\b.{0,20}\bliquidity\b/i.test(q) ||
    /^\s*objective\b/i.test(q)
  );
}

function resolveSide(text) {
  const q = String(text || "");
  if (/\b(bear|bearish|short|sell|resist)\b/i.test(q)) return "bear";
  if (/\b(bull|bullish|long|buy|support)\b/i.test(q)) return "bull";
  return null;
}

function extractAmount(text) {
  const m = String(text || "").match(/\b(\d+(?:\.\d+)?)\s*(?:xdx|xrp|rlusd)?\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractLimitPrice(text) {
  const m = String(text || "").match(/\blimit(?:\s+at)?\s+(\d+(?:\.\d+)?)\b/i) || String(text || "").match(/\bat\s+(\d+(?:\.\d+)?)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function looksLikeQuery(text) {
  const q = String(text || "").trim();
  if (!q) return false;
  // Interrogatives, polite asks, and conversational chart/desk questions.
  if (
    /^(what|whats|what's|which|who|whose|how|why|where|when|are|is|am|can|could|would|should|do|does|did|give|tell|walk|explain|describe|show|use|please|help)\b/i.test(
      q
    )
  ) {
    return true;
  }
  if (/\?\s*$/.test(q)) return true;
  if (/\b(right now|at the moment|currently)\b/i.test(q) && /\b(what|which|who|how|where)\b/i.test(q)) {
    return true;
  }
  return false;
}

export function parseAdminCommand(text, { chartPair = "", topic = "chat" } = {}) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const topicId = normalizeCommandTopic(topic);
  const q = raw.replace(CMD_PREFIX_RE, "").trim();
  const pairFromText = extractCommandPair(q);
  const pair = pairFromText || (topicId === "trustline" ? "" : normalizeDeskPair(chartPair));
  const side = resolveSide(q);

  if (/\b(list|show)\b.{0,16}\b(standing )?orders?\b/i.test(q) && !/\b(open|my|ledger)\b/i.test(q)) {
    return { verb: "list_orders", topic: topicId, durable: false, summary: "List standing desk orders." };
  }
  if (/\b(clear|cancel|drop|forget)\b.{0,20}\b(standing|command|watch)\b/i.test(q)) {
    return {
      verb: "clear_order",
      topic: topicId,
      durable: true,
      pair,
      summary: pair ? `Clear standing orders for ${pair}.` : "Clear the latest standing order.",
    };
  }

  if (/\b(buy|sell)\b.{0,24}\bxdx\b/i.test(q) || (topicId === "trade" && /\b(buy|sell)\b/i.test(q))) {
    const sell = /\bsell\b/i.test(q);
    const quote =
      extractNamedAsset(q) ||
      (/\brlusd\b/i.test(q) ? "RLUSD" : "") ||
      (/\bxrp\b/i.test(q) ? "XRP" : "") ||
      "XRP";
    const limit = /\blimit\b/i.test(q);
    const price = extractLimitPrice(q);
    const amount = extractAmount(q);
    const tradePair = normalizeDeskPair(`XDX/${quote}`) || `XDX/${quote}`;
    return {
      verb: sell ? "trade_sell" : "trade_buy",
      topic: "trade",
      durable: true,
      pair: tradePair,
      quote,
      amount,
      price,
      order: limit || price ? "limit" : "market",
      summary: `${sell ? "Sell" : "Buy"} XDX ${limit || price ? `limit${price ? ` at ${price}` : ""}` : "market"} ${sell ? "for" : "with"} ${quote}${amount ? ` size ${amount}` : ""}. Agents take the fill.`,
    };
  }

  if (
    /\b(analyse|analyze|hunt|scan)\b.{0,40}\b(market|pair|book|trade|opportunit|profit|ledger|xrpl)\b/i.test(q) ||
    /\bprofitable\b.{0,24}\b(trade|pair|market|opportunit)/i.test(q) ||
    /\blook (to see|for|at)\b.{0,40}\b(opportunit|profit|pair|market|trade)\b/i.test(q) ||
    (topicId === "analyse" &&
      !looksLikeQuery(q) &&
      !/\btrust\s*lines?\b/i.test(q) &&
      !/\b(buy|sell)\b/i.test(q) &&
      /\b(analyse|analyze|hunt|scan|opportunit|profit|markets?)\b/i.test(q))
  ) {
    return {
      verb: "analyse_markets",
      topic: "analyse",
      durable: true,
      pair: pairFromText,
      summary: pairFromText
        ? `Hunt ${pairFromText} for a fee-clear profitable trade.`
        : "Hunt watched markets and extra XRPL pairs for a fee-clear profitable trade. Agents report and take the edge.",
    };
  }

  if (
    /\b(draw|lay|plot)\b.{0,40}\b(prediction|estimate|tools?|fib|trend|chart)\b/i.test(q) ||
    /\b(predict|prediction|estimate)\b/i.test(q) ||
    (topicId === "predict" && !looksLikeQuery(q))
  ) {
    // Questions still go to Commander chat (chart_predict). Imperative draw orders stay commands.
    if (!looksLikeQuery(q) || /\b(draw|lay|plot)\b/i.test(q)) {
      return {
        verb: "draw_prediction",
        topic: "predict",
        durable: false,
        pair: pairFromText || normalizeDeskPair(chartPair) || PRIMARY_DESK_PAIR,
        side,
        summary: `Draw a ${side || "chosen"} prediction on ${pairFromText || chartPair || PRIMARY_DESK_PAIR}.`,
      };
    }
  }

  if (
    topicId === "trustline" ||
    /\b(add|set|upload|open|remove|check)\b.{0,28}\btrust\s*lines?\b/i.test(q) ||
    /\btrustline\b/i.test(q)
  ) {
    // Conversational asks ("what assets lack a trustline") stay in chat, not a stock ack.
    if (looksLikeQuery(q) && !/\b(add|set|upload|open|remove)\b/i.test(q)) {
      return { verb: "topic_query", topic: "trustline", durable: false, summary: q.slice(0, 180) };
    }
    const asset = extractNamedAsset(q, { allowChartFallback: false, chartPair });
    const remove = /\b(remove|drop|close)\b/i.test(q);
    const check = /\b(check|have|walk)\b/i.test(q) && !/\badd\b/i.test(q);
    return {
      verb: check ? "trustline_check" : remove ? "trustline_remove" : "trustline",
      topic: "trustline",
      durable: !check,
      pair: asset ? `XDX/${asset}` : pairFromText,
      quote: asset,
      summary: check
        ? asset
          ? `Check the ${asset} trustline on agent wallets.`
          : "Check agent trustlines."
        : remove
          ? asset
            ? `Remove the ${asset} trustline when the desk chooses.`
            : "Remove the named trustline when the desk chooses."
          : asset
            ? `Add the ${asset} trustline on agent wallets and activate when convenient.`
            : "Add named trustlines on agent wallets at desk choice.",
    };
  }

  if (
    (topicId === "liquidity" && !looksLikeQuery(q)) ||
    /\b(add|remove|show)\b.{0,24}\b(liquidity|pool|amm)\b/i.test(q)
  ) {
    if (looksLikeQuery(q) && !/\b(add|remove)\b/i.test(q)) {
      return { verb: "topic_query", topic: "liquidity", durable: false, summary: q.slice(0, 180) };
    }
    const quote = extractNamedAsset(q) || quoteFromPair(pairFromText) || "XRP";
    const remove = /\bremove\b/i.test(q);
    const show = /\bshow\b/i.test(q);
    return {
      verb: show ? "show_pools" : remove ? "amm_withdraw" : "amm_deposit",
      topic: "liquidity",
      durable: !show,
      pair: normalizeDeskPair(`XDX/${quote}`) || `XDX/${quote}`,
      quote,
      summary: show
        ? `Show XDX/${quote} pool share.`
        : `${remove ? "Remove" : "Add"} liquidity on XDX/${quote}. XDX stays the primary asset.`,
    };
  }

  if (
    /^\s*objective\b/i.test(q) ||
    /\b(remove|what are|list|show)\b.{0,16}\bobjectives?\b/i.test(q) ||
    (topicId === "objective" && !looksLikeQuery(q) && /\b(objective|goal|target|aim to|work toward)\b/i.test(q))
  ) {
    if (looksLikeQuery(q) && !/\b(remove|what are|list|show)\b.{0,16}\bobjectives?\b/i.test(q) && !/^\s*objective\b/i.test(q)) {
      return { verb: "topic_query", topic: "objective", durable: false, summary: q.slice(0, 180) };
    }
    const remove = /\bremove\b/i.test(q);
    const list = /\b(what are|list|show)\b.{0,16}\bobjectives?\b/i.test(q);
    const idx = Number((q.match(/\bobjective\s+(\d+)\b/i) || [])[1] || 0);
    const goal = q.replace(/^\s*objective(?:\s*[:.-]\s*|\s+)/i, "").replace(/^remove\s+objective\s+\d+\s*/i, "").trim();
    return {
      verb: list ? "list_objectives" : remove ? "remove_objective" : "set_objective",
      topic: "objective",
      durable: !list,
      index: idx || null,
      summary: list
        ? "List standing desk objectives."
        : remove
          ? idx
            ? `Soft-remove objective ${idx}.`
            : `Soft-remove objective: ${goal.slice(0, 120)}`
          : `Objective: ${goal.slice(0, 180)}`,
    };
  }

  if (topicId === "chart" || /\b(show|hide|toggle|cancel|display)\b.{0,24}\b(orders?|orderbook|depth|chart|ledger)\b/i.test(q)) {
    if (/\bcancel all orders\b/i.test(q)) {
      return { verb: "cancel_all_orders", topic: "chart", durable: true, summary: "Cancel all open desk orders." };
    }
    if (/\bcancel order\b/i.test(q)) {
      return { verb: "cancel_order", topic: "chart", durable: true, summary: "Cancel the named open order." };
    }
    if (/\b(hide|off)\b.{0,16}\b(ledger )?orders\b/i.test(q)) {
      return { verb: "hide_ledger_orders", topic: "chart", durable: false, summary: "Hide ledger orders on the chart." };
    }
    if (/\b(show|display|toggle)\b.{0,20}\b(ledger )?orders\b/i.test(q) || /\btoggle orders on chart\b/i.test(q)) {
      return { verb: "show_ledger_orders", topic: "chart", durable: false, summary: "Show ledger orders on the HybridChart." };
    }
    if (/\b(show|display)\b.{0,16}\b(orderbook|depth)\b/i.test(q)) {
      return { verb: "show_orderbook", topic: "chart", durable: false, summary: "Show the live order book and depth." };
    }
    if (/\bshow chart\b/i.test(q)) {
      return { verb: "show_chart", topic: "chart", durable: false, summary: "Focus the shared HybridChart." };
    }
  }

  if (/\b(watch|add|include|look at|cover)\b.{0,48}\b(market|pair|book)\b/i.test(q) || (/\b(watch|add)\b/i.test(q) && pairFromText)) {
    if (!pairFromText) return null;
    return {
      verb: "watch_market",
      topic: topicId === "chat" ? "analyse" : topicId,
      durable: true,
      pair: pairFromText,
      summary: `Watch ${pairFromText} on top of ${PRIMARY_DESK_PAIR}.`,
    };
  }
  if (/\bvortex\b/i.test(q) && /\b(weekly|pool|amm|create)\b/i.test(q)) {
    const quote = quoteFromPair(pairFromText) || (/\bxdx\/([A-Z0-9$]{2,12})\b/i.exec(q) || [])[1] || "";
    return {
      verb: "vortex_weekly",
      topic: "liquidity",
      durable: true,
      pair: quote ? `XDX/${String(quote).toUpperCase()}` : "",
      quote: String(quote || "").toUpperCase(),
      summary: quote
        ? `Vortex opens a weekly XDX/${String(quote).toUpperCase()} pool.`
        : "Vortex opens a weekly XDX/??? pool after agents pick the quote.",
    };
  }
  if (/\b(activate|enable|unlock)\b.{0,24}\b(all )?phases?\b/i.test(q) || /\bgo live\b/i.test(q) || /\ball phases?\b/i.test(q)) {
    return { verb: "activate_phases", topic: "desk", durable: true, summary: "Activate all desk phases. Stay LIVE and trade." };
  }
  if (/\b(increase|more|step up|ramp)\b.{0,24}\b(trades?|fills?|size|observe)\b/i.test(q)) {
    const observe = /\bobserve\b/i.test(q) && !/\btrades?\b/i.test(q);
    return {
      verb: observe ? "observe" : "increase_trades",
      topic: "trade",
      durable: true,
      summary: observe ? "Increase observe coverage with all agents." : "Increase live trades across watched markets.",
    };
  }
  if (/\b(explore|hunt|scan|free.?think|look on the ledger)\b/i.test(q)) {
    return {
      verb: "explore_ledger",
      topic: "analyse",
      durable: true,
      summary: "Hunt the XRPL for extra liquid pairs and fee-clear trades.",
    };
  }
  if (/\bcounter\b.{0,24}\bbots?\b/i.test(q)) {
    return { verb: "counter_bots", topic: "trade", durable: true, summary: "Counter bots on XDX pairs." };
  }
  if (/\b(route|direct|push)\b.{0,36}\bxdx\b/i.test(q)) {
    return { verb: "route_xdx", topic: "liquidity", durable: true, summary: "Direct traffic through XDX trading pools." };
  }

  if (looksLikeQuery(q)) {
    return { verb: "topic_query", topic: topicId, durable: false, summary: q.slice(0, 180) };
  }
  // Free-form standing notes only with an explicit command prefix (never echo random chat).
  if (CMD_PREFIX_RE.test(raw)) {
    return { verb: "remember", topic: topicId === "chat" ? "chat" : topicId, durable: true, pair: pairFromText, summary: q.slice(0, 180) };
  }
  // Non-chat topics: unknown non-query text is still a chat ask, not a durable order.
  if (topicId !== "chat") {
    return { verb: "topic_query", topic: topicId, durable: false, summary: q.slice(0, 180) };
  }
  if (looksLikeAdminCommand(raw)) {
    return { verb: "remember", topic: "chat", durable: true, pair: pairFromText, summary: q.slice(0, 180) };
  }
  return null;
}

const COMMAND_INTENTS = {
  draw_prediction: "chart_predict",
  show_chart: "chart",
  show_orderbook: "orderbook",
  show_ledger_orders: "orderbook",
  hide_ledger_orders: "orderbook",
  trade_buy: "trade_opp",
  trade_sell: "trade_opp",
  analyse_markets: "xrpl_market",
  watch_market: "xrpl_market",
  show_pools: "pools",
  amm_deposit: "pools",
  amm_withdraw: "pools",
  list_orders: "desk",
  clear_order: "desk",
  cancel_order: "desk",
  cancel_all_orders: "desk",
  set_objective: "desk",
  list_objectives: "desk",
  remove_objective: "desk",
  activate_phases: "desk_mode",
  observe: "desk_mode",
  increase_trades: "desk_mode",
  explore_ledger: "xrpl",
  counter_bots: "desk",
  route_xdx: "pools",
  vortex_weekly: "chart",
};

export function intentForCommand(cmd) {
  if (!cmd || typeof cmd !== "object") return "";
  return COMMAND_INTENTS[cmd.verb] || "";
}

export function isExecutableAdminCommand(text, { chartPair = "", topic = "chat" } = {}) {
  const topicId = normalizeCommandTopic(topic);
  const cmd = parseAdminCommand(text, { chartPair, topic: topicId });
  if (!cmd) return null;
  // Always fall through to Commander chat for conversational / unanswered topic asks.
  if (cmd.verb === "topic_query") return null;
  if (cmd.verb === "remember" && !CMD_PREFIX_RE.test(String(text || ""))) return null;
  return cmd;
}

export function commandAckText(cmd, standing) {
  if (!cmd) return "Order received. Agents will comply. ack";
  if (cmd.verb === "list_orders" || cmd.verb === "list_objectives") {
    const lines = standing?.mandate || [];
    return lines.length
      ? `Standing orders: ${lines.join(" ")} Primary book stays ${PRIMARY_DESK_PAIR}. ack`
      : `No extra standing orders yet. Primary book is ${PRIMARY_DESK_PAIR}. ack`;
  }
  if (cmd.verb === "draw_prediction") {
    return `Laying the ${cmd.side || "selected"} prediction on ${cmd.pair}. Tools go on every AIM chart. ack`;
  }
  if (cmd.verb === "trustline") {
    return cmd.quote
      ? `Order taken. I am telling Prime, Flux, Vector, Vortex, Echo, and Ghost to add the ${cmd.quote} trustline on their wallets and keep it active. ack`
      : "Order taken. I am telling all agents to add the named trustline on their wallets at desk choice. ack";
  }
  if (cmd.verb === "trustline_check") {
    return cmd.quote
      ? `Checking the ${cmd.quote} trustline across agent wallets now. I will report what is missing. ack`
      : "Checking agent trustlines now. I will report what is missing. ack";
  }
  if (cmd.verb === "trustline_remove") {
    return cmd.quote
      ? `Order taken. Agents will remove the ${cmd.quote} trustline when the desk chooses. ack`
      : "Order taken. Agents will remove the named trustline when the desk chooses. ack";
  }
  if (cmd.verb === "analyse_markets") {
    return `Order taken. ${cmd.summary} I told Ghost and Vector to hunt, and Prime and Flux to take a fee-clear fill when they see one. ack`;
  }
  if (cmd.verb === "trade_buy" || cmd.verb === "trade_sell") {
    return `Order taken. ${cmd.summary} I passed it to the desk agents. ack`;
  }
  return `Order taken. ${cmd.summary} I told the agents and they will comply. ack`;
}

export function chartActionForCommand(cmd) {
  if (!cmd) return null;
  if (cmd.verb === "show_ledger_orders") return { type: "show_ledger_orders" };
  if (cmd.verb === "hide_ledger_orders") return { type: "hide_ledger_orders" };
  if (cmd.verb === "show_chart") return { type: "focus_chart", pair: cmd.pair || null };
  return null;
}

export function applyStandingOrders(rows = []) {
  const extra = [];
  const trustlines = [];
  const mandate = [];
  const objectives = [];
  const trades = [];
  let liveAllPhases = false;
  let increaseTrades = false;
  let observeMore = false;
  let exploreLedger = false;
  let analyseMarkets = false;
  let counterBots = false;
  let routeXdx = false;
  let vortexWeekly = null;

  for (const row of Array.isArray(rows) ? rows : []) {
    const verb = String(row.verb || row.content?.verb || "");
    const pair = normalizeDeskPair(row.pair || row.content?.pair || "");
    const quote = String(row.quote || row.content?.quote || "").toUpperCase();
    const summary = String(row.summary || row.content?.summary || row.lesson || "").trim();
    if (verb === "clear_order" || verb === "remove_objective") continue;
    if (verb === "watch_market" && pair && pair !== PRIMARY_DESK_PAIR && !extra.includes(pair)) extra.push(pair);
    if (verb === "trustline") {
      const asset = quote || quoteFromPair(pair);
      if (asset && !trustlines.includes(asset)) trustlines.push(asset);
    }
    if (verb === "activate_phases") liveAllPhases = true;
    if (verb === "increase_trades" || verb === "trade_buy" || verb === "trade_sell") increaseTrades = true;
    if (verb === "trade_buy" || verb === "trade_sell") {
      if (summary) trades.push(summary.slice(0, 160));
    }
    if (verb === "observe") observeMore = true;
    if (verb === "explore_ledger") exploreLedger = true;
    if (verb === "analyse_markets") analyseMarkets = true;
    if (verb === "counter_bots") counterBots = true;
    if (verb === "route_xdx") routeXdx = true;
    if (verb === "vortex_weekly") {
      vortexWeekly = { enabled: true, quote: quote || quoteFromPair(pair) || "" };
    }
    if (verb === "set_objective" && summary) objectives.push(summary.slice(0, 160));
    if (summary && verb === "remember") {
      // Drop chat questions that were wrongly stored as standing notes.
      if (looksLikeQuery(summary)) continue;
      mandate.push(summary.slice(0, 160));
    }
  }

  const watch_pairs = [PRIMARY_DESK_PAIR, ...CORE_DESK_PAIRS.filter((p) => p !== PRIMARY_DESK_PAIR), ...extra].filter(
    (p, i, all) => p && all.indexOf(p) === i
  );
  const lines = [];
  lines.push(`Primary book ${PRIMARY_DESK_PAIR}, constantly traded to accumulate XDX.`);
  if (extra.length) lines.push(`Also watching ${extra.join(", ")}.`);
  if (liveAllPhases) lines.push("All phases LIVE. Agents trade, do not sit in observe-only.");
  if (increaseTrades) lines.push("Increase fills across the watch list.");
  if (analyseMarkets) lines.push("Hunt markets and pairs for fee-clear profitable trades. Take the edge when it is there.");
  if (observeMore) lines.push("All agents observe and report more of the ledger.");
  if (exploreLedger) lines.push("Ghost and Vector hunt extra liquid XRPL pairs.");
  if (trustlines.length) lines.push(`Trustlines at choice: ${trustlines.join(", ")}.`);
  if (vortexWeekly) {
    lines.push(
      vortexWeekly.quote
        ? `Vortex opens a weekly XDX/${vortexWeekly.quote} pool.`
        : "Vortex opens a weekly XDX/??? pool after the desk picks a liquid quote."
    );
  }
  if (routeXdx) lines.push("Route volume through XDX pools.");
  if (counterBots) lines.push("Counter bots on XDX pairs.");
  lines.push(...trades.slice(0, 4));
  lines.push(...objectives.slice(0, 4));
  lines.push(...mandate.slice(0, 6));

  return {
    extra_markets: extra,
    watch_pairs,
    trustlines,
    objectives: objectives.slice(0, 8),
    trades: trades.slice(0, 6),
    live_all_phases: liveAllPhases,
    increase_trades: increaseTrades,
    observe_more: observeMore,
    explore_ledger: exploreLedger,
    analyse_markets: analyseMarkets,
    counter_bots: counterBots,
    route_xdx: routeXdx,
    vortex_weekly: vortexWeekly,
    mandate: lines,
  };
}

export function standingOrdersPublic(standing) {
  const src = standing && typeof standing === "object" ? standing : applyStandingOrders([]);
  return {
    extra_markets: Array.isArray(src.extra_markets) ? src.extra_markets.slice(0, 12) : [],
    watch_pairs: Array.isArray(src.watch_pairs) ? src.watch_pairs.slice(0, 16) : [PRIMARY_DESK_PAIR],
    trustlines: Array.isArray(src.trustlines) ? src.trustlines.slice(0, 12) : [],
    objectives: Array.isArray(src.objectives) ? src.objectives.slice(0, 8) : [],
    trades: Array.isArray(src.trades) ? src.trades.slice(0, 6) : [],
    live_all_phases: !!src.live_all_phases,
    increase_trades: !!src.increase_trades,
    observe_more: !!src.observe_more,
    explore_ledger: !!src.explore_ledger,
    analyse_markets: !!src.analyse_markets,
    counter_bots: !!src.counter_bots,
    route_xdx: !!src.route_xdx,
    vortex_weekly: src.vortex_weekly
      ? { enabled: true, quote: String(src.vortex_weekly.quote || "").toUpperCase() }
      : null,
    mandate: Array.isArray(src.mandate) ? src.mandate.slice(0, 10) : [],
    primary_pair: PRIMARY_DESK_PAIR,
  };
}

function scrub(value) {
  return String(value ?? "")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 31 || code === 9 || code === 10 || code === 13;
    })
    .join("")
    .replace(/\u2014/g, ". ")
    .replace(/\u2013/g, "-")
    .trim();
}

export async function persistAdminCommand(db, { wallet, command, lesson, chartContext, topic } = {}) {
  if (!db || !command) return null;
  const content = {
    type: "admin_command",
    verb: command.verb,
    topic: normalizeCommandTopic(command.topic || topic || "chat"),
    pair: command.pair || null,
    quote: command.quote || null,
    side: command.side || null,
    amount: command.amount || null,
    price: command.price || null,
    order: command.order || null,
    summary: scrub(command.summary || lesson || "").slice(0, 400),
    lesson: scrub(lesson || "").slice(0, 2000),
    wallet: wallet ? String(wallet).slice(0, 64) : null,
    chart_pair: scrub(chartContext?.pair || "").slice(0, 32) || null,
    ts: new Date().toISOString(),
    status: "active",
    comply: true,
  };
  await db.query(`INSERT INTO aim_agent_memory (agent_id, kind, content) VALUES ('commander', $1, $2::jsonb)`, [
    AIM_ADMIN_COMMAND_KIND,
    JSON.stringify(content),
  ]);
  return content;
}

export async function dispatchAdminDirective(db, { command, lesson, topic } = {}) {
  if (!db || !command) return { ok: false };
  const instruction = scrub(command.summary || lesson || "").slice(0, 400);
  const payload = {
    type: "admin_directive",
    topic: normalizeCommandTopic(command.topic || topic || "chat"),
    verb: command.verb,
    pair: command.pair || null,
    quote: command.quote || null,
    amount: command.amount || null,
    price: command.price || null,
    order: command.order || null,
    instruction,
    comply: true,
    autonomous: true,
    ts: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);
  try {
    for (const agent of DESK_AGENT_IDS) {
      await db.query(
        `INSERT INTO aim_agent_messages (from_agent, to_agent, topic, body) VALUES ('commander', $1, 'directive', $2::jsonb)`,
        [agent, body]
      );
    }
    await db.query(`INSERT INTO aim_agent_memory (agent_id, kind, content) VALUES ('commander', 'desk_coordination', $1::jsonb)`, [
      JSON.stringify({
        type: "admin_directive",
        topic: payload.topic,
        verb: command.verb,
        summary: instruction,
        comply: true,
        ts: payload.ts,
      }),
    ]);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function loadAdminCommands(db, { limit = 32 } = {}) {
  if (!db) return [];
  try {
    const rows = await db.query(
      `SELECT id, content, created_at
       FROM aim_agent_memory
       WHERE agent_id = 'commander' AND kind = $1
       ORDER BY id DESC
       LIMIT $2`,
      [AIM_ADMIN_COMMAND_KIND, limit]
    );
    return (rows.rows || [])
      .map((r) => {
        const c = r.content && typeof r.content === "object" ? r.content : {};
        return {
          id: r.id,
          verb: scrub(c.verb || "").slice(0, 32),
          topic: normalizeCommandTopic(c.topic || "chat"),
          pair: normalizeDeskPair(c.pair),
          quote: scrub(c.quote || "").slice(0, 16),
          side: c.side === "bear" || c.side === "bull" ? c.side : null,
          summary: scrub(c.summary || c.lesson || "").slice(0, 240),
          created_at: r.created_at,
        };
      })
      .filter((row) => row.verb && row.verb !== "clear_order" && row.verb !== "list_orders" && row.verb !== "remove_objective");
  } catch {
    return [];
  }
}

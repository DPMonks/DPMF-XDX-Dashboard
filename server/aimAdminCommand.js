/** Admin-wallet command box: parse, remember, and apply standing desk orders. */

export const AIM_ADMIN_COMMAND_KIND = "AIM_ADMIN_COMMAND";
export const PRIMARY_DESK_PAIR = "XRP/RLUSD";
export const CORE_DESK_PAIRS = ["XRP/RLUSD", "XDX/XRP", "XDX/RLUSD", "XDX/XIO", "XDX/XSQUAD"];

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

export function isExecutableAdminCommand(text, { chartPair = "" } = {}) {
  const cmd = parseAdminCommand(text, { chartPair });
  if (!cmd) return null;
  if (cmd.verb === "remember" && !CMD_PREFIX_RE.test(String(text || ""))) return null;
  return cmd;
}

export function looksLikeAdminCommand(text) {
  const q = String(text || "").trim();
  if (!q) return false;
  if (CMD_PREFIX_RE.test(q)) return true;
  if (/^\s*(watch|add|draw|predict|lay|explore|hunt|activate|go live|increase|observe|trustline|vortex|counter|route|list orders|standing)\b/i.test(q)) {
    return true;
  }
  return (
    /\b(watch|add|include|look at)\b.{0,40}\b(market|pair|book)\b/i.test(q) ||
    /\b(add|set|upload|open)\b.{0,24}\btrust\s*lines?\b/i.test(q) ||
    /\b(increase|more|step up)\b.{0,20}\b(trades?|fills?|observe)\b/i.test(q) ||
    /\b(activate|enable|go)\b.{0,20}\b(all )?phases?\b/i.test(q) ||
    /\bgo live\b/i.test(q) ||
    /\b(draw|lay|plot)\b.{0,28}\b(prediction|estimate|tools?|fib|trend)\b/i.test(q) ||
    /\bvortex\b.{0,40}\b(weekly|pool|amm)\b/i.test(q) ||
    /\b(explore|hunt|scan|free.?think)\b.{0,28}\b(ledger|xrpl|opportunit|markets?|pairs?)\b/i.test(q) ||
    /\bcounter\b.{0,20}\bbots?\b/i.test(q) ||
    /\b(route|direct)\b.{0,28}\bxdx\b/i.test(q) ||
    /\b(list|show)\b.{0,16}\b(standing )?orders?\b/i.test(q)
  );
}

function resolveSide(text) {
  const q = String(text || "");
  if (/\b(bear|bearish|short|sell|resist)\b/i.test(q)) return "bear";
  if (/\b(bull|bullish|long|buy|support)\b/i.test(q)) return "bull";
  return null;
}

function quoteFromPair(pair) {
  const name = normalizeDeskPair(pair);
  if (!name.includes("/")) return "";
  return name.split("/")[1] || "";
}

export function parseAdminCommand(text, { chartPair = "" } = {}) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const q = raw.replace(CMD_PREFIX_RE, "").trim();
  const pair = extractCommandPair(q, chartPair);
  const side = resolveSide(q);

  if (/\b(list|show)\b.{0,16}\b(standing )?orders?\b/i.test(q)) {
    return { verb: "list_orders", durable: false, summary: "List standing desk orders." };
  }
  if (/\b(clear|cancel|drop|forget)\b.{0,20}\b(order|standing|command|watch)\b/i.test(q)) {
    return {
      verb: "clear_order",
      durable: true,
      pair,
      summary: pair ? `Clear standing orders for ${pair}.` : "Clear the latest standing order.",
    };
  }
  if (/\b(draw|lay|plot)\b.{0,40}\b(prediction|estimate|tools?|fib|trend|chart)\b/i.test(q) || /\bpredict\b/i.test(q)) {
    return {
      verb: "draw_prediction",
      durable: false,
      pair: pair || normalizeDeskPair(chartPair) || PRIMARY_DESK_PAIR,
      side,
      summary: `Draw a ${side || "chosen"} prediction on ${pair || chartPair || PRIMARY_DESK_PAIR}.`,
    };
  }
  if (/\b(add|set|upload|open)\b.{0,28}\btrust\s*lines?\b/i.test(q) || /\btrustline\b/i.test(q)) {
    const asset = quoteFromPair(pair) || (q.match(/\b(?:for|on|to)\s+([A-Z0-9$]{2,12})\b/i) || [])[1] || "";
    return {
      verb: "trustline",
      durable: true,
      pair,
      quote: String(asset || "").toUpperCase(),
      summary: asset ? `Add a ${String(asset).toUpperCase()} trustline when the desk chooses.` : "Add named trustlines at desk choice.",
    };
  }
  if (/\b(watch|add|include|look at|cover)\b.{0,48}\b(market|pair|book)\b/i.test(q) || (/\b(watch|add)\b/i.test(q) && pair)) {
    if (!pair) return null;
    return {
      verb: "watch_market",
      durable: true,
      pair,
      summary: `Watch ${pair} on top of ${PRIMARY_DESK_PAIR}.`,
    };
  }
  if (/\bvortex\b/i.test(q) && /\b(weekly|pool|amm|create)\b/i.test(q)) {
    const quote = quoteFromPair(pair) || (/\bxdx\/([A-Z0-9$]{2,12})\b/i.exec(q) || [])[1] || "";
    return {
      verb: "vortex_weekly",
      durable: true,
      pair: quote ? `XDX/${String(quote).toUpperCase()}` : "",
      quote: String(quote || "").toUpperCase(),
      summary: quote
        ? `Vortex opens a weekly XDX/${String(quote).toUpperCase()} pool.`
        : "Vortex opens a weekly XDX/??? pool after agents pick the quote.",
    };
  }
  if (/\b(activate|enable|unlock)\b.{0,24}\b(all )?phases?\b/i.test(q) || /\bgo live\b/i.test(q) || /\ball phases?\b/i.test(q)) {
    return { verb: "activate_phases", durable: true, summary: "Activate all desk phases. Stay LIVE and trade." };
  }
  if (/\b(increase|more|step up|ramp)\b.{0,24}\b(trades?|fills?|size|observe)\b/i.test(q)) {
    const observe = /\bobserve\b/i.test(q) && !/\btrades?\b/i.test(q);
    return {
      verb: observe ? "observe" : "increase_trades",
      durable: true,
      summary: observe ? "Increase observe coverage with all agents." : "Increase live trades across watched markets.",
    };
  }
  if (/\b(explore|hunt|scan|free.?think|look on the ledger)\b/i.test(q)) {
    return {
      verb: "explore_ledger",
      durable: true,
      summary: "Hunt the XRPL for extra liquid pairs beyond the core book.",
    };
  }
  if (/\bcounter\b.{0,24}\bbots?\b/i.test(q)) {
    return { verb: "counter_bots", durable: true, summary: "Counter bots on XDX pairs." };
  }
  if (/\b(route|direct|push)\b.{0,36}\bxdx\b/i.test(q)) {
    return { verb: "route_xdx", durable: true, summary: "Direct traffic through XDX trading pools." };
  }
  if (looksLikeAdminCommand(raw)) {
    return {
      verb: "remember",
      durable: true,
      pair,
      summary: q.slice(0, 180),
    };
  }
  return null;
}

export function commandAckText(cmd, standing) {
  if (!cmd) return "Order received. ack";
  const watch = (standing?.watch_pairs || [PRIMARY_DESK_PAIR]).join(", ");
  if (cmd.verb === "list_orders") {
    const lines = standing?.mandate || [];
    return lines.length
      ? `Standing orders: ${lines.join(" ")} Primary book stays ${PRIMARY_DESK_PAIR}. ack`
      : `No extra standing orders yet. Primary book is ${PRIMARY_DESK_PAIR}. ack`;
  }
  if (cmd.verb === "draw_prediction") {
    return `Laying the ${cmd.side || "selected"} prediction on ${cmd.pair}. Tools go on every AIM chart. ack`;
  }
  return `${cmd.summary} Watched markets: ${watch}. XRP/RLUSD stays the most liquid book. ack`;
}

export function applyStandingOrders(rows = []) {
  const extra = [];
  const trustlines = [];
  const mandate = [];
  let liveAllPhases = false;
  let increaseTrades = false;
  let observeMore = false;
  let exploreLedger = false;
  let counterBots = false;
  let routeXdx = false;
  let vortexWeekly = null;

  for (const row of Array.isArray(rows) ? rows : []) {
    const verb = String(row.verb || row.content?.verb || "");
    const pair = normalizeDeskPair(row.pair || row.content?.pair || "");
    const quote = String(row.quote || row.content?.quote || "").toUpperCase();
    const summary = String(row.summary || row.content?.summary || row.lesson || "").trim();
    if (verb === "clear_order") continue;
    if (verb === "watch_market" && pair && pair !== PRIMARY_DESK_PAIR && !extra.includes(pair)) extra.push(pair);
    if (verb === "trustline") {
      const asset = quote || quoteFromPair(pair);
      if (asset && !trustlines.includes(asset)) trustlines.push(asset);
    }
    if (verb === "activate_phases") liveAllPhases = true;
    if (verb === "increase_trades") increaseTrades = true;
    if (verb === "observe") observeMore = true;
    if (verb === "explore_ledger") exploreLedger = true;
    if (verb === "counter_bots") counterBots = true;
    if (verb === "route_xdx") routeXdx = true;
    if (verb === "vortex_weekly") {
      vortexWeekly = { enabled: true, quote: quote || quoteFromPair(pair) || "" };
    }
    if (summary && verb === "remember") mandate.push(summary.slice(0, 160));
  }

  const watch_pairs = [PRIMARY_DESK_PAIR, ...CORE_DESK_PAIRS.filter((p) => p !== PRIMARY_DESK_PAIR), ...extra].filter(
    (p, i, all) => p && all.indexOf(p) === i
  );
  const lines = [];
  lines.push(`Primary book ${PRIMARY_DESK_PAIR}, constantly traded to accumulate XDX.`);
  if (extra.length) lines.push(`Also watching ${extra.join(", ")}.`);
  if (liveAllPhases) lines.push("All phases LIVE. Agents trade, do not sit in observe-only.");
  if (increaseTrades) lines.push("Increase fills across the watch list.");
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
  lines.push(...mandate.slice(0, 6));

  return {
    extra_markets: extra,
    watch_pairs,
    trustlines,
    live_all_phases: liveAllPhases,
    increase_trades: increaseTrades,
    observe_more: observeMore,
    explore_ledger: exploreLedger,
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
    live_all_phases: !!src.live_all_phases,
    increase_trades: !!src.increase_trades,
    observe_more: !!src.observe_more,
    explore_ledger: !!src.explore_ledger,
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

export async function persistAdminCommand(db, { wallet, command, lesson, chartContext } = {}) {
  if (!db || !command) return null;
  const content = {
    type: "admin_command",
    verb: command.verb,
    pair: command.pair || null,
    quote: command.quote || null,
    side: command.side || null,
    summary: scrub(command.summary || lesson || "").slice(0, 400),
    lesson: scrub(lesson || "").slice(0, 2000),
    wallet: wallet ? String(wallet).slice(0, 64) : null,
    chart_pair: scrub(chartContext?.pair || "").slice(0, 32) || null,
    ts: new Date().toISOString(),
    status: "active",
  };
  await db.query(`INSERT INTO aim_agent_memory (agent_id, kind, content) VALUES ('commander', $1, $2::jsonb)`, [
    AIM_ADMIN_COMMAND_KIND,
    JSON.stringify(content),
  ]);
  return content;
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
          pair: normalizeDeskPair(c.pair),
          quote: scrub(c.quote || "").slice(0, 16),
          side: c.side === "bear" || c.side === "bull" ? c.side : null,
          summary: scrub(c.summary || c.lesson || "").slice(0, 240),
          created_at: r.created_at,
        };
      })
      .filter((row) => row.verb && row.verb !== "clear_order" && row.verb !== "list_orders");
  } catch {
    return [];
  }
}

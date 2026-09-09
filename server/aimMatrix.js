import pg from "pg";

const XRPL_ADDR = /\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/g;
const ROLE_NOISE =
  /\b(Accumulator|Arbitrage|Momentum|Mean Reversion(?: \/ Fees)?|AMM(?: \/ LP)?|token_accumulation|amm_liquidity|cross_venue_arb|breakout_snipe|mean_reversion_fees|Commander)\b/gi;
const SECRET_KEYS = /seed|private|secret|password|mnemonic|wallet|address|amm_account|quote_issuer/i;

let pool;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function hasDatabase() {
  const raw = databaseUrl();
  return /^postgres(ql)?:\/\//i.test(raw);
}

function poolOptions(raw) {
  let url = String(raw || "");
  // Match dashboard convention: strip sslmode=require; use soft TLS for Railway proxy.
  try {
    const u = new URL(url);
    if (u.searchParams.get("sslmode") === "require") u.searchParams.delete("sslmode");
    url = u.toString();
  } catch {
    /* keep raw */
  }
  const password = process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || undefined;
  const opts = {
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 12_000,
  };
  if (password) opts.password = password;
  return opts;
}

function getAimPool() {
  if (!hasDatabase()) return null;
  if (!pool) pool = new pg.Pool(poolOptions(databaseUrl()));
  return pool;
}

function scrubText(value) {
  return String(value ?? "")
    .replace(XRPL_ADDR, "[redacted]")
    .replace(ROLE_NOISE, "[agent]");
}

function scrubValue(value, key = "") {
  if (SECRET_KEYS.test(key)) return undefined;
  if (value == null) return value;
  if (typeof value === "string") return scrubText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => scrubValue(v)).filter((v) => v !== undefined);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEYS.test(k)) continue;
      const next = scrubValue(v, k);
      if (next !== undefined) out[k] = next;
    }
    return out;
  }
  return undefined;
}

function agentLabel(agentId) {
  const id = String(agentId || "");
  if (id === "commander") return "Commander";
  if (id === "dashboard") return "You";
  const m = /^agent(\d+)$/i.exec(id);
  return m ? `Agent ${m[1]}` : "Agent";
}

function publicAgentId(agentId) {
  const id = String(agentId || "");
  if (id === "commander") return "commander";
  if (id === "dashboard") return "dashboard";
  const m = /^agent(\d+)$/i.exec(id);
  return m ? `agent${m[1]}` : "agent";
}

async function readJson(req) {
  if (req?.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function summarizeIntent(kind, content) {
  if (!content || typeof content !== "object") return scrubText(kind);
  if (kind === "pools" || content.pools) {
    const pools = content.pools || content;
    if (pools.ok) return `Pool scan ok · ${pools.pool_count ?? "?"} pools · top ${pools.top_pool || "n/a"}`;
    return `Pool scan issue · ${scrubText(pools.error || "unknown")}`;
  }
  if (content.indexer?.skipped) return "Observing via private data path";
  if (content.indexer?.status_code) return `Indexer probe · HTTP ${content.indexer.status_code}`;
  if (content.last_indexer?.status_code) return `Indexer probe · HTTP ${content.last_indexer.status_code}`;
  if (content.public?.results) return "Public market ping";
  if (content.type === "scan_directive") return "Observe-only directive";
  if (content.type === "ping") return "Peer ping";
  return scrubText(kind || "update");
}

export async function aimStatusPayload() {
  const db = getAimPool();
  if (!db) {
    return {
      status: 503,
      body: {
        ok: false,
        error: "AIM database unavailable",
        hint: "Set DATABASE_URL on the Vercel dashboard project to the indexer Postgres public URL.",
      },
    };
  }
  try {
    const heartbeats = await db.query(
      `SELECT agent_id, status, last_seen_at, meta
       FROM aim_agent_heartbeats
       WHERE agent_id IN ('commander','agent1','agent2','agent3','agent4','agent5')
       ORDER BY agent_id`
    );
    const intents = await db.query(
      `SELECT id, agent_id, kind, content, created_at
       FROM aim_agent_memory
       WHERE agent_id IN ('agent1','agent2','agent3','agent4','agent5','commander')
         AND kind IN ('observe','pools','inbox','indexer_probe')
       ORDER BY id DESC
       LIMIT 40`
    );
    const chat = await db.query(
      `SELECT id, from_agent, to_agent, topic, body, created_at
       FROM aim_agent_messages
       WHERE topic IN ('chat','directive','peer')
       ORDER BY id DESC
       LIMIT 40`
    );

    const agents = heartbeats.rows
      .filter((r) => r.agent_id !== "commander")
      .map((r) => ({
        id: publicAgentId(r.agent_id),
        label: agentLabel(r.agent_id),
        status: scrubText(r.status),
        last_seen_at: r.last_seen_at,
        meta: scrubValue(r.meta) || {},
      }));

    const commanderRow = heartbeats.rows.find((r) => r.agent_id === "commander");
    const commander = commanderRow
      ? {
          id: "commander",
          label: "Commander",
          status: scrubText(commanderRow.status),
          last_seen_at: commanderRow.last_seen_at,
          meta: scrubValue(commanderRow.meta) || {},
        }
      : null;

    const movements = intents.rows.map((r) => ({
      id: r.id,
      agent: publicAgentId(r.agent_id),
      label: agentLabel(r.agent_id),
      kind: scrubText(r.kind),
      summary: summarizeIntent(r.kind, scrubValue(r.content)),
      created_at: r.created_at,
    }));

    const messages = chat.rows
      .map((r) => ({
        id: r.id,
        from: publicAgentId(r.from_agent),
        to: publicAgentId(r.to_agent),
        from_label: agentLabel(r.from_agent),
        to_label: agentLabel(r.to_agent),
        topic: scrubText(r.topic),
        body: scrubValue(r.body) || {},
        created_at: r.created_at,
      }))
      .reverse();

    return {
      status: 200,
      body: {
        ok: true,
        commander,
        agents,
        movements,
        messages,
        read_only: true,
      },
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        ok: false,
        error: "Failed to load AIM status",
        detail: String(error?.message || error).slice(0, 240),
      },
    };
  }
}

function isoOf(value) {
  if (!value) return null;
  if (typeof value?.toISOString === "function") return value.toISOString();
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : String(value);
}

function agoPhrase(value) {
  const iso = isoOf(value);
  if (!iso) return "unknown";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "unknown";
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

const DPMF_ASSETS = ["XDX", "XIO", "XSQUAD"];

function pickLine(seed, options) {
  const list = options.filter(Boolean);
  if (!list.length) return "";
  const n = Math.abs(Number(seed) || Date.now());
  return list[n % list.length];
}

function classifyAimQuestion(raw) {
  const q = String(raw || "").toLowerCase();
  const agentMatch = q.match(/\bagent\s*([1-5])\b/) || q.match(/\ba([1-5])\b/);
  if (agentMatch) return { intent: "agent", agentNum: agentMatch[1] };
  if (/\b(help|what can you|commands|how (do|to) ask)\b/.test(q)) return { intent: "help" };
  if (/\b(xio|xsquad|xdx)\b/.test(q) || /\b(native|dpmf asset|our token)\b/.test(q)) {
    return { intent: "assets" };
  }
  if (/\b(tx|txs|transaction|ledger|payment|offercreate|on.?chain|scan)\b/.test(q)) {
    return { intent: "txs" };
  }
  if (/\b(pool|amm|liquidity|xdx\/xrp)\b/.test(q)) return { intent: "pools" };
  if (/\b(mov(e|ing|ement)|recent|what.*(doing|happening)|activity|observe)\b/.test(q)) {
    return { intent: "movement" };
  }
  if (/\b(indexer|429|rate.?limit|probe)\b/.test(q)) return { intent: "indexer" };
  if (/\b(status|health|online|offline|alive|heartbeat|how are you|who.?s up)\b/.test(q)) {
    return { intent: "status" };
  }
  if (/\b(xrpl|ripple|trust ?line|dex|amm)\b/.test(q)) return { intent: "xrpl" };
  return { intent: "snapshot" };
}

async function loadAimChatContext(db) {
  const heartbeats = await db.query(
    `SELECT agent_id, status, last_seen_at, meta
     FROM aim_agent_heartbeats
     WHERE agent_id IN ('commander','agent1','agent2','agent3','agent4','agent5')
     ORDER BY agent_id`
  );
  const intents = await db.query(
    `SELECT id, agent_id, kind, content, created_at
     FROM aim_agent_memory
     WHERE agent_id IN ('agent1','agent2','agent3','agent4','agent5','commander')
       AND kind IN ('observe','pools','inbox','indexer_probe')
     ORDER BY id DESC
     LIMIT 12`
  );

  let pools = null;
  try {
    const rows = await db.query(
      `SELECT pool_name, quote, reserve_xdx, updated_at
       FROM xdx_amm_pools
       ORDER BY COALESCE(reserve_xdx::numeric, 0) DESC NULLS LAST
       LIMIT 8`
    );
    const count = await db.query(`SELECT COUNT(*)::int AS n FROM xdx_amm_pools`);
    pools = {
      pool_count: count.rows[0]?.n ?? rows.rows.length,
      top: rows.rows.map((r) => ({
        name: scrubText(r.pool_name || r.quote || "pool"),
        reserve_xdx: r.reserve_xdx,
        updated_at: r.updated_at,
      })),
      source: "xdx_amm_pools",
    };
  } catch {
    pools = null;
  }

  return { heartbeats: heartbeats.rows, intents: intents.rows, pools, fetched_at: Date.now() };
}

function xrplRpcUrl() {
  return (
    process.env.XRPL_RPC_URL ||
    process.env.XRPL_HTTP_URL ||
    "https://s1.ripple.com:51234/"
  );
}

async function scanRecentXrplLedger() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(xrplRpcUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        method: "ledger",
        params: [{ ledger_index: "validated", transactions: true, expand: true }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: `XRPL HTTP ${res.status}` };
    const data = await res.json();
    const ledger = data?.result?.ledger || {};
    const txs = Array.isArray(ledger.transactions) ? ledger.transactions : [];
    const counts = {};
    let dpmfHint = 0;
    for (const raw of txs) {
      const tx = raw?.tx && typeof raw.tx === "object" ? raw.tx : raw;
      if (!tx || typeof tx === "string") {
        counts.hash_only = (counts.hash_only || 0) + 1;
        continue;
      }
      const type = String(tx.TransactionType || "Unknown");
      counts[type] = (counts[type] || 0) + 1;
      const blob = JSON.stringify(tx).toUpperCase();
      if (DPMF_ASSETS.some((a) => blob.includes(a))) dpmfHint += 1;
    }
    return {
      ok: true,
      ledger_index: data?.result?.ledger_index || ledger.ledger_index,
      tx_count: txs.length,
      counts,
      dpmf_hint_count: dpmfHint,
      close_time_human: ledger.close_time_human || null,
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

function opinionOnLedger(scan, { dpmfBias = false } = {}) {
  if (!scan?.ok) {
    return pickLine(Date.now(), [
      "Ledger scan soft-failed — leaning on agent heartbeats and pool tables instead.",
      "Couldn’t refresh the validated ledger this second; using Postgres observe data.",
    ]);
  }
  const payments = scan.counts.Payment || 0;
  const offers = (scan.counts.OfferCreate || 0) + (scan.counts.OfferCancel || 0);
  const amms = (scan.counts.AMMDeposit || 0) + (scan.counts.AMMWithdraw || 0) + (scan.counts.AMMBid || 0);
  if (dpmfBias && scan.dpmf_hint_count > 0) {
    return pickLine(scan.ledger_index, [
      `I see ${scan.dpmf_hint_count} tx touches looking DPMF-native (XDX/XIO/XSQUAD) — constructive for our stack.`,
      `Native-asset fingerprints in this ledger (${scan.dpmf_hint_count}) — I’d lean into deepening that flow.`,
    ]);
  }
  if (scan.dpmf_hint_count > 0 && !dpmfBias) {
    return `Also noted ${scan.dpmf_hint_count} txs mentioning XDX/XIO/XSQUAD strings in this ledger.`;
  }
  if (offers > payments) {
    return pickLine(scan.ledger_index, [
      "DEX book is busier than plain payments — price discovery is active.",
      "Offer flow dominates; book-driven tape this ledger.",
    ]);
  }
  if (amms > 0) {
    return "AMM tickets present — liquidity provisioning/withdrawal is in the mix.";
  }
  if (payments > 0) {
    return pickLine(scan.ledger_index, [
      "Payments-heavy ledger — settlement traffic is the main signal.",
      "Mostly value transfer this ledger; thinner DEX/AMM mix.",
    ]);
  }
  return "Quiet mix on the validated ledger.";
}

function summarizeLedger(scan) {
  if (!scan?.ok) return `Ledger scan: ${scrubText(scan?.error || "unavailable")}.`;
  const top = Object.entries(scan.counts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  return `Validated ledger ${scan.ledger_index}: ${scan.tx_count} txs (${top || "no expanded types"}).`;
}

async function maybeLlmAnswer(question, ctx, scan) {
  const key =
    process.env.AIM_LLM_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.GROK_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  if (!key) return null;
  const base = (process.env.AIM_LLM_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, "");
  const model = process.env.AIM_LLM_MODEL || process.env.XAI_MODEL || "grok-2-latest";
  const compact = {
    commander: scrubValue(ctx.heartbeats?.find((h) => h.agent_id === "commander") || null),
    agents: (ctx.heartbeats || [])
      .filter((h) => h.agent_id !== "commander")
      .map((h) => ({
        id: publicAgentId(h.agent_id),
        status: scrubText(h.status),
        last_seen_at: isoOf(h.last_seen_at),
        meta: scrubValue(h.meta),
      })),
    pools: scrubValue(ctx.pools),
    recent_memory: (ctx.intents || []).slice(0, 8).map((r) => ({
      agent: publicAgentId(r.agent_id),
      kind: scrubText(r.kind),
      summary: summarizeIntent(r.kind, scrubValue(r.content)),
      created_at: isoOf(r.created_at),
    })),
    ledger_scan: scrubValue(scan),
  };
  const system = `You are Commander on the XDX Exchange AI-Matrix dashboard.
Speak as Commander: concise, confident, dynamic — never reuse a canned one-liner.
Answer from the provided live context + general XRPL knowledge. Prefer concrete numbers from the context.
Default stance is neutral data analysis (ledger, pools, agents, indexer).
Only apply a DPMF success bias for native assets XDX, XIO, and XSQUAD when the user explicitly asks about DPMF, those assets, or "our"/"native" tokens — otherwise do not push DPMF marketing.
Observe-only: do not claim trades executed, do not request seeds/keys, do not reveal wallet addresses or agent role codenames.
If you scanned txs, give a brief summary and a clear opinion grounded in the counts/types you saw.
Keep replies under 120 words. Replies are ephemeral (no chat history).`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 18_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.9,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Question: ${question}\nDPMF bias requested: ${/\b(dpmf|xdx|xio|xsquad|our native|native asset|our token)\b/i.test(question) ? "yes" : "no"}\n\nLive context JSON:\n${JSON.stringify(compact).slice(0, 12000)}`,
          },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = scrubText(data?.choices?.[0]?.message?.content || "").trim();
    if (!text) return null;
    return text.slice(0, 1200);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function wantsDpmfBias(question, classified) {
  const q = String(question || "");
  if (classified?.intent === "assets") return true;
  return /\b(dpmf|xdx|xio|xsquad|our native|native asset|our token)\b/i.test(q);
}

function answerAimQuestion(question, ctx, scan) {
  const classified = classifyAimQuestion(question);
  const dpmfBias = wantsDpmfBias(question, classified);
  const byId = Object.fromEntries((ctx.heartbeats || []).map((r) => [r.agent_id, r]));
  const commander = byId.commander;
  const agents = ["agent1", "agent2", "agent3", "agent4", "agent5"].map((id) => byId[id]).filter(Boolean);
  const looping = agents.filter((a) => /loop|online|ok/i.test(String(a.status || ""))).length;
  const agent2 = byId.agent2;
  const agent2Pools = scrubValue(agent2?.meta)?.pools || null;
  const seed = (ctx.fetched_at || Date.now()) + question.length + (scan?.ledger_index || 0);

  const lines = [];
  const push = (s) => {
    if (s) lines.push(s);
  };

  push(
    pickLine(seed, [
      "Commander here — fresh read.",
      "Live observe context loaded.",
      "Pulling current signals.",
    ])
  );

  if (classified.intent === "help") {
    push("Ask about status, Agent 1–5, pools, XRPL txs/ledger, indexer, or — if you want the biased take — DPMF natives XDX/XIO/XSQUAD.");
    push("Replies are ephemeral — nothing is saved from this chat.");
    return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
  }

  if (dpmfBias) {
    const named = DPMF_ASSETS.filter((a) => new RegExp(`\\b${a}\\b`, "i").test(question));
    const focus = named.length ? named.join("/") : "XDX, XIO, and XSQUAD";
    push(`You asked about DPMF natives — bias on for ${focus}.`);
    if (agent2Pools?.ok) {
      push(`Live AMM read: ${agent2Pools.pool_count ?? "?"} pools · top ${agent2Pools.top_pool || "n/a"}.`);
    } else if (ctx.pools?.pool_count) {
      push(`Postgres shows ${ctx.pools.pool_count} XDX-related pools; top ${ctx.pools.top?.[0]?.name || "n/a"}.`);
    }
    if (scan?.ok) {
      push(summarizeLedger(scan));
      push(opinionOnLedger(scan, { dpmfBias: true }));
    }
    push(
      pickLine(seed, [
        "Opinion: prioritize liquidity and attention on those natives.",
        "I’ll treat tape as constructive when flow touches DPMF assets.",
      ])
    );
    return { type: "commander_answer", intent: "assets", text: lines.join(" ") };
  }

  if (classified.intent === "txs" || classified.intent === "xrpl") {
    push(summarizeLedger(scan));
    push(opinionOnLedger(scan, { dpmfBias: false }));
    if (classified.intent === "xrpl") {
      push("XRPL basics: payments move value, offers discover price, AMMs warehouse liquidity.");
    }
    return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
  }

  if (classified.intent === "agent") {
    const id = `agent${classified.agentNum}`;
    const row = byId[id];
    if (!row) push(`Agent ${classified.agentNum} has no heartbeat yet.`);
    else {
      const meta = scrubValue(row.meta) || {};
      push(`Agent ${classified.agentNum} is ${scrubText(row.status)} (last seen ${agoPhrase(row.last_seen_at)}).`);
      if (meta.pools?.ok) push(`Pool scan: ${meta.pools.pool_count ?? "?"} · top ${meta.pools.top_pool || "n/a"}.`);
      else if (meta.indexer?.status_code) push(`Indexer probe HTTP ${meta.indexer.status_code}.`);
      else if (meta.indexer?.skipped) push("Using private data path (indexer HTTP skipped).");
    }
    push("Observe-only.");
    return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
  }

  if (classified.intent === "pools") {
    if (agent2Pools?.ok) {
      push(`Agent 2: ${agent2Pools.pool_count ?? "?"} AMM pools · top ${agent2Pools.top_pool || "n/a"} (${agoPhrase(agent2.last_seen_at)}).`);
    } else if (ctx.pools?.pool_count != null) {
      const top = (ctx.pools.top || []).slice(0, 3).map((p) => p.name).join(", ");
      push(`Postgres ${ctx.pools.source}: ${ctx.pools.pool_count} pools${top ? ` · ${top}` : ""}.`);
    } else push("No pool snapshot yet.");
    push(
      pickLine(seed, [
        "Opinion: watch top-pool depth and fee vs TVL before calling strength.",
        "Data read only — say DPMF/XDX/XIO/XSQUAD if you want the biased take.",
      ])
    );
    return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
  }

  if (classified.intent === "movement") {
    const moves = (ctx.intents || []).slice(0, 5).map((r) => `${agentLabel(r.agent_id)} · ${summarizeIntent(r.kind, scrubValue(r.content))}`);
    push(moves.length ? `Recent ticks: ${moves.join("; ")}.` : "No recent movement rows yet.");
    if (scan?.ok) {
      push(summarizeLedger(scan));
      push(opinionOnLedger(scan, { dpmfBias: false }));
    }
    push("Fleet stays observe-only.");
    return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
  }

  if (classified.intent === "indexer") {
    const bits = [];
    if (commander?.meta?.last_indexer?.status_code) bits.push(`Commander HTTP ${commander.meta.last_indexer.status_code}`);
    for (const a of agents) {
      const code = a.meta?.indexer?.status_code;
      if (code) bits.push(`${agentLabel(a.agent_id)} HTTP ${code}`);
      else if (a.meta?.indexer?.skipped) bits.push(`${agentLabel(a.agent_id)} skipped HTTP`);
    }
    push(bits.length ? `Indexer path: ${bits.slice(0, 6).join("; ")}.` : "No indexer probe details yet.");
    push("429s are noise; Postgres + selective XRPL scans keep eyes open.");
    return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
  }

  if (commander) push(`I’m ${scrubText(commander.status)} (seen ${agoPhrase(commander.last_seen_at)}).`);
  else push("Commander heartbeat missing.");
  push(`${looping}/${agents.length || 5} agents active.`);
  if (agent2Pools?.ok) push(`Pools: ${agent2Pools.pool_count ?? "?"} · top ${agent2Pools.top_pool || "n/a"}.`);
  else if (ctx.pools?.pool_count) push(`Pools table: ${ctx.pools.pool_count}.`);
  if (classified.intent === "status" || classified.intent === "snapshot") {
    if (scan?.ok) {
      push(summarizeLedger(scan));
      push(opinionOnLedger(scan, { dpmfBias: false }));
    }
  }
  push(
    pickLine(seed + looping, [
      "Neutral data read — ask about DPMF natives if you want that bias.",
      "No chat history kept — ask again anytime for a fresh sample.",
      "Observe-only; analysis only.",
    ])
  );
  return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
}

export async function aimChatPayload(req) {
  const db = getAimPool();
  if (!db) {
    return { status: 503, body: { ok: false, error: "AIM database unavailable" } };
  }
  try {
    const body = await readJson(req);
    const text = scrubText(String(body.message || body.text || "").trim()).slice(0, 2000);
    if (!text) return { status: 400, body: { ok: false, error: "Message required" } };

    // Ephemeral: never insert chat into aim_agent_messages / never cache conversation.
    const classified = classifyAimQuestion(text);
    const ctx = await loadAimChatContext(db);
    const needsLedger =
      classified.intent === "txs" ||
      classified.intent === "xrpl" ||
      classified.intent === "movement" ||
      classified.intent === "snapshot" ||
      classified.intent === "status" ||
      /\b(tx|ledger|on.?chain|opinion|what.*(see|know|think))\b/i.test(text);

    const scan = needsLedger ? await scanRecentXrplLedger() : { ok: false, skipped: true };
    const llm = await maybeLlmAnswer(text, ctx, scan);
    const reply = llm
      ? { type: "commander_answer", intent: classified.intent, source: "llm", text: llm }
      : answerAimQuestion(text, ctx, scan);

    return {
      status: 200,
      body: {
        ok: true,
        ephemeral: true,
        reply: {
          from: "commander",
          from_label: "Commander",
          body: reply,
          created_at: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    return {
      status: 500,
      body: { ok: false, error: "Failed to post AIM chat", detail: String(error?.message || error).slice(0, 240) },
    };
  }
}

export async function handleAimRequest(req, res) {
  const url = req.url || "";
  const pathOnly = url.split("?")[0];
  const method = req.method || "GET";

  if (pathOnly === "/api/aim/status" && method === "GET") {
    const out = await aimStatusPayload();
    res.statusCode = out.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(out.body));
    return true;
  }
  if (pathOnly === "/api/aim/chat" && method === "POST") {
    const out = await aimChatPayload(req);
    res.statusCode = out.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(out.body));
    return true;
  }
  return false;
}

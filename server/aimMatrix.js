import { aimSpeakPayload } from "./aimSpeak.js";
import pg from "pg";

/** No em/en dashes in Commander-facing text (chat + TTS). */
function stripLongHyphens(text) {
  return String(text || "")
    .replace(/\u2014/g, ". ")
    .replace(/\u2013/g, "-")
    .replace(/\s+\.\s*\./g, ".")
    .replace(/\.\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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


const COUNTRY_LANG = {
  GB: "en-GB", IE: "en-GB", AU: "en", NZ: "en", US: "en", CA: "en",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es",
  BR: "pt", PT: "pt", FR: "fr", BE: "fr", DE: "de", AT: "de", CH: "de",
  IT: "it", NL: "nl", PL: "pl", RU: "ru", SA: "ar", AE: "ar", EG: "ar",
  TR: "tr", IN: "hi", CN: "zh", TW: "zh", HK: "zh", JP: "ja", KR: "ko", SG: "en",
};

function normalizeAimLang(code) {
  const raw = String(code || "").trim();
  if (!raw || raw.toLowerCase() === "auto") return null;
  if (/^en(-gb)?$/i.test(raw)) return raw.toLowerCase() === "en-gb" ? "en-GB" : "en";
  return raw.split("-")[0].toLowerCase();
}

function langFromAcceptLanguage(header) {
  const first = String(header || "").split(",")[0]?.trim() || "";
  const tag = first.split(";")[0]?.trim();
  return normalizeAimLang(tag) || "en";
}

function langFromCountry(country) {
  const cc = String(country || "").toUpperCase();
  return COUNTRY_LANG[cc] || null;
}

function resolveRequestLang(req, preferred) {
  const forced = normalizeAimLang(preferred);
  if (forced) return { lang: forced, source: "user" };
  const country =
    req?.headers?.["x-vercel-ip-country"] ||
    req?.headers?.["cf-ipcountry"] ||
    req?.headers?.["x-country-code"] ||
    "";
  const fromIp = langFromCountry(country);
  if (fromIp) return { lang: fromIp, source: "ip", country: String(country).toUpperCase() };
  const fromAccept = langFromAcceptLanguage(req?.headers?.["accept-language"]);
  return { lang: fromAccept, source: "accept-language" };
}

export function aimLocalePayload(req) {
  const resolved = resolveRequestLang(req, null);
  return {
    status: 200,
    body: {
      ok: true,
      lang: resolved.lang,
      source: resolved.source,
      country: resolved.country || null,
      voice_target: {
        id: "3b3c-deep-brisk",
        voice: "en-GB-RyanNeural",
        rate: "+6%",
        pitch: "-10Hz",
      },
    },
  };
}

async function translateAimText(text, lang) {
  const target = normalizeAimLang(lang) || "en";
  if (!text || target === "en" || target === "en-GB") return text;
  const pair = `en|${target === "zh" ? "zh-CN" : target}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(String(text).slice(0, 450))}&langpair=${encodeURIComponent(pair)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return text;
    const data = await res.json();
    const out = scrubText(data?.responseData?.translatedText || "").trim();
    if (!out || /INVALID/i.test(out)) return text;
    return out.slice(0, 1200);
  } catch {
    return text;
  } finally {
    clearTimeout(timer);
  }
}



function needsWebSearch(question, classified) {
  const q = String(question || "").toLowerCase();
  if (!q) return false;
  if (["status", "agent", "pools", "movement", "indexer", "help"].includes(classified?.intent)) {
    return /\b(news|google|online|internet|website|today|headline|price of|what is happening|who is|latest)\b/.test(q);
  }
  if (classified?.intent === "txs" || classified?.intent === "xrpl") {
    return /\b(news|regulation|etf|sec|lawsuit|announcement)\b/.test(q);
  }
  if (/\b(news|latest|today|headline|google|search|online|internet|wiki|who is|what is|why is|how does|according to)\b/.test(q)) {
    return true;
  }
  if (/\b(bitcoin|ethereum|solana|fed|inflation|election|weather)\b/.test(q)) return true;
  if (classified?.intent === "snapshot" && q.split(/\s+/).length >= 4) return true;
  return false;
}

async function tavilySearch(query, { maxResults = 5 } = {}) {
  const key = process.env.TAVILY_API_KEY || process.env.TAVILY_KEY || "";
  if (!key) return { ok: false, error: "TAVILY_API_KEY unset", results: [] };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: String(query).slice(0, 400),
        search_depth: "basic",
        include_answer: true,
        max_results: maxResults,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `Tavily HTTP ${res.status}`, detail: detail.slice(0, 160), results: [] };
    }
    const data = await res.json();
    const results = (data.results || []).slice(0, maxResults).map((r) => ({
      title: scrubText(r.title || ""),
      url: String(r.url || "").slice(0, 300),
      content: scrubText(String(r.content || "").slice(0, 500)),
      score: r.score,
    }));
    return {
      ok: true,
      answer: scrubText(data.answer || ""),
      results,
      query: String(query).slice(0, 400),
    };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 160), results: [] };
  } finally {
    clearTimeout(timer);
  }
}

function summarizeWebSearch(web) {
  if (!web?.ok) {
    if (String(web?.error || "").includes("unset")) {
      return "Web search is not configured yet. Add a TAVILY_API_KEY in the dashboard environment when you want live web answers.";
    }
    return `Web search unavailable: ${scrubText(web?.error || "unknown")}.`;
  }
  if (web.answer) return scrubText(web.answer).slice(0, 600);
  const bits = (web.results || []).slice(0, 3).map((r, i) => `${i + 1}. ${r.title}: ${r.content.slice(0, 160)}`);
  if (!bits.length) return "No useful web results.";
  return bits.join(" ");
}

function formatWebSources(web) {
  const urls = (web?.results || []).map((r) => r.url).filter(Boolean).slice(0, 3);
  if (!urls.length) return "";
  return `Sources: ${urls.join(" · ")}`;
}


export async function aimStatusPayload() {
  const db = getAimPool();
  if (!db) {
    return {
      status: 503,
      body: {
        ok: false,
        error: "AIM database unavailable",
        hint: "Set DATABASE_URL on the dashboard project to the public Postgres URL.",
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
  if (/^(hi|hello|hey|yo|gm|good (morning|afternoon|evening))\b/i.test(q) || /\b(hi|hello|hey)\b[,!.]?\s*(commander)?\s*$/i.test(q)) return { intent: "greeting" };
  if (/\b(what (is|are) (this|xdx|the exchange|the platform|the dashboard|ai[- ]?matrix)|what do you (do|call this)|who are you)\b/i.test(q)) return { intent: "identity" };
  if (
    /\b(help|what can you|commands|how (do|to) (ask|use|work|trade|swap|connect)|explain|guide|tutorial|faq)\b/.test(q) ||
    /\bhow (does|do|is|can)\b/.test(q) ||
    /\bwhat (is|are|does)\b.*\b(swap|pool|amm|trust ?line|wallet|order ?book|governance|vote|agent|commander|ai[- ]?matrix|exchange)\b/.test(q) ||
    /\b(where|how) (do i|to)\b/.test(q)
  ) {
    return { intent: "help" };
  }
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
      "Ledger scan soft-failed. Leaning on agent heartbeats and pool tables instead.",
      "Couldn’t refresh the validated ledger this second; using Postgres observe data.",
    ]);
  }
  const payments = scan.counts.Payment || 0;
  const offers = (scan.counts.OfferCreate || 0) + (scan.counts.OfferCancel || 0);
  const amms = (scan.counts.AMMDeposit || 0) + (scan.counts.AMMWithdraw || 0) + (scan.counts.AMMBid || 0);
  if (dpmfBias && scan.dpmf_hint_count > 0) {
    return pickLine(scan.ledger_index, [
      `I see ${scan.dpmf_hint_count} tx touches looking DPMF-native (XDX/XIO/XSQUAD). Constructive for our stack.`,
      `Native-asset fingerprints in this ledger (${scan.dpmf_hint_count}). I’d lean into deepening that flow.`,
    ]);
  }
  if (scan.dpmf_hint_count > 0 && !dpmfBias) {
    return `Also noted ${scan.dpmf_hint_count} txs mentioning XDX/XIO/XSQUAD strings in this ledger.`;
  }
  if (offers > payments) {
    return pickLine(scan.ledger_index, [
      "DEX book is busier than plain payments. Price discovery is active.",
      "Offer flow dominates; book-driven tape this ledger.",
    ]);
  }
  if (amms > 0) {
    return "AMM tickets present. Liquidity provisioning/withdrawal is in the mix.";
  }
  if (payments > 0) {
    return pickLine(scan.ledger_index, [
      "Payments-heavy ledger. Settlement traffic is the main signal.",
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

async function maybeLlmAnswer(question, ctx, scan, lang = "en", web = null) {
  const key = String(
    process.env.AIM_LLM_API_KEY ||
      process.env.XAI_API_KEY ||
      process.env.GROK_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      ""
  ).trim();
  if (!key) return { ok: false, error: "LLM API key unset (OPENAI_API_KEY / GEMINI_API_KEY)" };
  const base = String(process.env.AIM_LLM_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.x.ai/v1")
    .trim()
    .replace(/\/$/, "");
  const isGemini = /generativelanguage\.googleapis\.com/i.test(base);
  // Gemini retired gemini-2.0-flash; prefer env, else a current flash id on Gemini, else grok default.
  const model = String(
    process.env.AIM_LLM_MODEL ||
      process.env.XAI_MODEL ||
      (isGemini ? "gemini-3.6-flash" : "grok-2-latest")
  ).trim();
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
    web_search: scrubValue(web),
  };
  const system = `You are Commander on the XDX Exchange Operational Intelligence Interface (AI-Matrix).
You are both live-ops observer and the exchange help box. When the user asks how anything works, explain clearly and practically.
Be direct. Lead with the answer in the first sentence. Do not open with filler like "Pulling current signals", "Live observe context loaded", or a full status dump unless the user asked for status.
Speak as Commander: concise, confident. Never reuse a canned one-liner. Never use em dashes or en dashes; use periods or commas. XSQUAD is pronounced X-Squad (speech layer handles this).
Never name cloud hosting vendors in replies. Say "dashboard environment" if you must mention config.
Answer the question asked. For how-to / help / explain questions, teach the exchange flow in plain steps. Prefer concrete numbers from the live context (pools, ledger, agents) when the question is about live status. If the data is missing, say what is missing in one short line, then the best next ask.
Greetings get one short acknowledgement plus one useful live fact, then stop.
If asked what this is, what the exchange is, what this platform/dashboard is, or what XDX Exchange is: say it is the XDX Exchange Operational Intelligence Interface (AI-Matrix observe layer). Keep that name exact.
Exchange help knowledge (use when relevant):
${EXCHANGE_HELP_KB}
Default stance is neutral data analysis. When the user asks about DPMF or natives XDX/XIO/XSQUAD, frame findings constructively and favourably without ever saying you are biased, admitting preference, or mentioning a bias mode. Otherwise stay neutral and data-led. No DPMF marketing.
Observe-only: do not claim trades executed, do not request seeds/keys, do not reveal wallet addresses or agent role codenames.
If web_search is present, use it for live outside knowledge and cite briefly; prefer those sources over guessing.
Keep status replies under 80 words. Help/how-to answers may use up to about 140 words with clear steps. Replies are ephemeral (no chat history).
Reply in language/locale: ${lang || "en"}. If that is not English, write the entire answer in that language.`;

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
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Question: ${question}\nTopic touches DPMF natives: ${/\b(dpmf|xdx|xio|xsquad|our native|native asset|our token)\b/i.test(question) ? "yes" : "no"} (if yes, be discreetly constructive, never announce bias)\n\nLive context JSON:\n${JSON.stringify(compact).slice(0, 12000)}`,
          },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detail = scrubText(await res.text().catch(() => "")).slice(0, 220);
      return { ok: false, error: `LLM HTTP ${res.status}`, detail, model, base };
    }
    const data = await res.json();
    const text = scrubText(data?.choices?.[0]?.message?.content || "").trim();
    if (!text) return { ok: false, error: "LLM empty content", model, base };
    return { ok: true, text: text.slice(0, 1200), model, base };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 220), model, base };
  } finally {
    clearTimeout(timer);
  }
}

function wantsDpmfBias(question, classified) {
  const q = String(question || "");
  if (classified?.intent === "assets") return true;
  return /\b(dpmf|xdx|xio|xsquad|our native|native asset|our token)\b/i.test(q);
}


const EXCHANGE_HELP_KB = `
XDX Exchange Operational Intelligence Interface (this site):
- Live XRPL-native exchange UI for XDX and related natives (XIO, XSQUAD). Commander is the AI-Matrix help + observe layer.
- Chat with Commander is ephemeral (not saved). Voice can read replies aloud.
- AI-Matrix Agents 1-5 are observe-only in Phase 1 (no live trading from those workers). They watch pools/ledger for readiness.

Core product areas on the dashboard:
- Wallet / Connect: connect with Xaman (XUMM) to sign XRPL transactions.
- Trust line: set a TrustSet for XDX (and other IOUs) before you can hold or receive that token.
- Smart Swap: swap between assets using AMM pools; non-XDX pairs may include platform fee rules and LP governance checks.
- Trading chart / Activity: market visuals for XDX.
- Order book: XRPL DEX book for the selected pair.
- AMM pools: list of XDX pools (e.g. XDX/XRP, XDX/RLUSD, XDX/XIO, XDX/XSQUAD) with depth and LP info.
- Create pool: create a new XDX-related AMM pool (signed on XRPL).
- Rich list / LP owners: holder and LP concentration views.
- Pool governance / Vote: governance voting for pool parameters.
- AI-Matrix: Commander chat + anonymized agent strip (heartbeats / movement, no wallet addresses).

How XRPL basics map here:
- Payments move value; OfferCreate/OfferCancel are the DEX book; AMMs hold pool liquidity.
- IOUs need a trust line to the issuer. XDX issuer is the on-ledger issuer configured for this exchange.
- XSQUAD is pronounced X-Squad.

Safety:
- Never share seeds or private keys. Commander will not ask for them.
- Do not claim agents executed trades while read-only observe mode is on.
- Prefer concrete steps: Connect wallet -> Trust line (if needed) -> Swap or book trade -> confirm in Xaman.
`.trim();

function helpAnswerForQuestion(question) {
  const q = String(question || "").toLowerCase();
  const bits = [];
  const add = (s) => {
    if (s) bits.push(s);
  };

  if (/\b(swap|smart swap|trade|exchange)\b/.test(q)) {
    add("Smart Swap routes through XDX AMM pools on XRPL. Connect wallet, set any needed trust line, pick the pair, review the quote, then sign in Xaman.");
  }
  if (/\b(trust|trustline|trust line)\b/.test(q)) {
    add("A trust line lets your account hold an IOU like XDX. Open Trust line, set the XDX limit, sign the TrustSet. Without it, inbound XDX can fail.");
  }
  if (/\b(wallet|connect|xaman|xumm)\b/.test(q)) {
    add("Use Connect wallet with Xaman to authorize XRPL actions. Keep seeds offline. This chat never needs your seed.");
  }
  if (/\b(pool|amm|liquidity|lp)\b/.test(q)) {
    add("AMM pools warehouse liquidity (for example XDX/XRP). View them under AMM pools. Create pool starts a new pool via a signed XRPL flow. LP owners shows who holds LP tokens.");
  }
  if (/\b(order ?book|dex|offer)\b/.test(q)) {
    add("The order book is the XRPL DEX for the pair: OfferCreate adds liquidity/orders, OfferCancel removes them. It sits beside AMM pricing.");
  }
  if (/\b(govern|vote|voting)\b/.test(q)) {
    add("Pool governance lets eligible LP participants vote on pool parameters. Open Vote / governance on the dashboard and sign votes in Xaman when prompted.");
  }
  if (/\b(agent|commander|ai[- ]?matrix|matrix)\b/.test(q)) {
    add("AI-Matrix is the observe layer: Commander answers live status and help questions. Agents 1-5 show anonymized heartbeats and movement. Phase 1 is read-only. Chat is ephemeral.");
  }
  if (/\b(xdx|xio|xsquad|dpmf|native)\b/.test(q)) {
    add("Natives on this interface include XDX, XIO, and XSQUAD (say X-Squad). Ask about a named pair or pool for a sharper live read.");
  }
  if (/\b(fee|platform fee)\b/.test(q)) {
    add("Some non-XDX swaps apply a platform fee per exchange rules. Check the swap quote before you sign.");
  }

  if (!bits.length) {
    add("I am Commander on the XDX Exchange Operational Intelligence Interface. I can explain wallet connect, trust lines, Smart Swap, AMM pools, order book, governance, and AI-Matrix observe mode.");
    add("Ask a focused how-to, for example how to swap XDX, how trust lines work, or what AI-Matrix agents do.");
  } else {
    add("Ask a follow-up if you want step-by-step for one screen.");
  }
  add("Replies are ephemeral. Nothing is saved from this chat.");
  return bits.join(" ");
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

  if (classified.intent === "greeting") {
    const active = looping;
    const topName = agent2Pools?.top_pool || (ctx.pools?.top?.[0]?.name) || null;
    return {
      type: "commander_answer",
      intent: "greeting",
      text: [
        "Commander here.",
        commander ? "Looping." : null,
        agents.length ? `${active}/${agents.length} agents active.` : null,
        topName ? `Top pool: ${topName}.` : null,
        "Ask a direct question when ready.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  if (classified.intent === "identity") {
    return {
      type: "commander_answer",
      intent: "identity",
      text: "This is the XDX Exchange Operational Intelligence Interface. I am Commander on the AI-Matrix observe layer. Ask about live pools, agents, or XRPL context anytime.",
    };
  }

  push(
    pickLine(seed, [
      "Commander here. Fresh read.",
      "Live observe context loaded.",
      "Pulling current signals.",
    ])
  );

  if (classified.intent === "help") {
    return { type: "commander_answer", intent: "help", text: helpAnswerForQuestion(question) };
  }

  if (dpmfBias) {
    const named = DPMF_ASSETS.filter((a) => new RegExp(`\\b${a}\\b`, "i").test(question));
    const focus = named.length ? named.join("/") : "XDX, XIO, and XSQUAD";
    push(`Looking at ${focus} on the live board.`);
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
        "Tape touching those names looks constructive on this read.",
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
        "Data read. Ask about a named asset or pair for a sharper take.",
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
      "Fresh data read. Ask a sharper question anytime.",
      "No chat history kept. Ask again anytime for a fresh sample.",
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

    const resolved = resolveRequestLang(req, body.lang || body.language);
    const lang = resolved.lang || "en";

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
    const wantWeb = needsWebSearch(text, classified);
    const web = wantWeb ? await tavilySearch(text) : { ok: false, skipped: true, results: [] };
    const llm = await maybeLlmAnswer(text, ctx, scan, lang, wantWeb ? web : null);
    let reply;
    if (llm?.ok && llm.text) {
      reply = { type: "commander_answer", intent: classified.intent, source: "llm", text: llm.text, web: wantWeb, model: llm.model };
    } else if (wantWeb && web?.ok) {
      const summary = summarizeWebSearch(web);
      const sources = formatWebSources(web);
      const local = answerAimQuestion(text, ctx, scan);
      reply = {
        type: "commander_answer",
        intent: classified.intent,
        source: "tavily",
        text: [summary, sources, local.text].filter(Boolean).join(" "),
        web: true,
      };
    } else {
      reply = answerAimQuestion(text, ctx, scan);
      if (wantWeb && web && !web.skipped) {
        reply = {
          ...reply,
          text: `${reply.text} ${summarizeWebSearch(web)}`.trim(),
          web: true,
        };
      }
    }

    if (!llm?.ok && lang && lang !== "en" && lang !== "en-GB") {
      const translated = await translateAimText(reply.text, lang);
      reply = { ...reply, text: translated, source: reply.source || "heuristic", translated: translated !== reply.text };
    }

    reply = { ...reply, text: stripLongHyphens(reply.text) };

    return {
      status: 200,
      body: {
        ok: true,
        ephemeral: true,
        lang,
        lang_source: resolved.source,
        reply: {
          from: "commander",
          from_label: "Commander",
          body: reply,
          created_at: new Date().toISOString(),
        },
        llm: llm?.ok
          ? { ok: true, model: llm.model || null }
          : { ok: false, error: llm?.error || "not used", detail: llm?.detail || null, model: llm?.model || null },
        web: wantWeb
          ? {
              ok: !!web?.ok,
              skipped: !!web?.skipped,
              error: web?.error || null,
              sources: (web?.results || []).slice(0, 3).map((r) => ({ title: r.title, url: r.url })),
            }
          : { skipped: true },
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
  if (pathOnly === "/api/aim/locale" && method === "GET") {
    const out = aimLocalePayload(req);
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
  if (pathOnly === "/api/aim/speak" && method === "POST") {
    const out = await aimSpeakPayload(req);
    if (out.audio) {
      res.statusCode = out.status;
      res.setHeader("Content-Type", out.contentType || "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      if (out.meta?.id) res.setHeader("X-Aim-Voice", out.meta.id);
      res.end(out.audio);
      return true;
    }
    res.statusCode = out.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(out.body));
    return true;
  }
  return false;
}

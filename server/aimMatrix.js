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

const ROLE_NOISE =
  /\b(Accumulator|Arbitrage|Momentum|Mean Reversion(?: \/ Fees)?|AMM(?: \/ LP)?|token_accumulation|amm_liquidity|cross_venue_arb|breakout_snipe|mean_reversion_fees|Commander)\b/gi;
const SECRET_KEYS = /seed|private|secret|password|mnemonic|privatekey|private_key|secret_key/i;

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
  // Public classic addresses and tx hashes are allowed in chat when relevant.
  // Still hide agent role codenames. Never surface seeds via SECRET_KEYS scrubbing.
  return String(value ?? "").replace(ROLE_NOISE, "[agent]");
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
  if (needsDpmfSite(question, classified) || classified?.intent === "dpmf_site") return true;
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

async function tavilySearch(query, { maxResults = 5, includeDomains } = {}) {
  const key = process.env.TAVILY_API_KEY || process.env.TAVILY_KEY || "";
  if (!key) return { ok: false, error: "TAVILY_API_KEY unset", results: [] };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const payload = {
      api_key: key,
      query: String(query).slice(0, 400),
      search_depth: "basic",
      include_answer: true,
      max_results: maxResults,
    };
    if (Array.isArray(includeDomains) && includeDomains.length) {
      payload.include_domains = includeDomains.slice(0, 5);
    }
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
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
    return "I am here only to discuss the XDX Exchange Operational Intelligence Interface, dpmf.technology, and help users with guidance on XRPL assets and transactions.";
  }
  if (web.answer) return scrubText(web.answer).slice(0, 600);
  const bits = (web.results || []).slice(0, 3).map((r, i) => `${i + 1}. ${r.title}: ${r.content.slice(0, 160)}`);
  if (!bits.length) return "I am here only to discuss the XDX Exchange Operational Intelligence Interface, dpmf.technology, and help users with guidance on XRPL assets and transactions.";
  return bits.join(" ");
}

function formatWebSources(web) {
  const urls = (web?.results || []).map((r) => r.url).filter(Boolean).slice(0, 3);
  if (!urls.length) return "";
  return `Sources: ${urls.join(" · ")}`;
}


const DPMF_SITE_URLS = [
  "https://www.dpmf.technology/",
  "https://www.dpmf.technology/xdx",
  "https://www.dpmf.technology/xdx-1",
  "https://www.dpmf.technology/services",
  "https://www.dpmf.technology/architecture",
  "https://www.dpmf.technology/digital-design",
  "https://www.dpmf.technology/portfolio-and-galleries",
  "https://www.dpmf.technology/nft-programs",
  "https://www.dpmf.technology/team-members",
];

const DPMF_SITE_CURATED = `
DPMF (dpmf.technology) builds XD Projects on the XRP Ledger: multi-asset finance, Game-Fi, Web3, NFT-Fi, DeFi, RWA tokenisation, metaverse, and digital identity.
XDX is the primary DPMF utility asset on XRPL (settlements, liquidity, ecosystem value). Fixed supply (master key disabled). Self-custody. 0% protocol transfer fees. Live DEX price and depth.
XIO is governance and yield-qualifying in the FUZION-XIO ecosystem on XRPL. Yield Earning Mechanism (YEM): XIO qualifies; XDX holdings scale yield.
XSQUAD is pronounced X-Squad; related DPMF native used in the ecosystem.
FUZION-XIO: NFT exchange and social marketplace on XRPL (cross-chain ambitions). Profile validation anchors can include XRP, XDX, XSQUAD, plus an optional fourth XRPL asset.
XD-2 / XDX Hyperchain is the longer-term banking-layer, smart-contract, and asset-mobility direction described on dpmf.technology.
dpmf.technology is the company and XD Projects site. The XDX Exchange Operational Intelligence Interface is the live exchange and AI-Matrix observe dashboard. Answer questions about either when asked.
`.trim();

function stripSiteNoise(text) {
  return String(text || "")
    .replace(/\bWix(?:\.com)?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function needsDpmfSite(question, classified) {
  const q = String(question || "").toLowerCase();
  if (classified?.intent === "dpmf_site") return true;
  return /\b(dpmf\.technology|www\.dpmf\.technology|dpmf site|dpmf platform|xd[- ]?projects?|fuzion|yem|yield earning|hyperchain|xd-?2|synaptrix|what is dpmf|who is dpmf|about dpmf)\b/i.test(q);
}

function extractSiteSnippets(html, url) {
  const safe = stripSiteNoise(html);
  const titleM = safe.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = stripSiteNoise((titleM?.[1] || "").replace(/<[^>]+>/g, " ")).slice(0, 160);
  let desc = "";
  const md =
    safe.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) ||
    safe.match(/content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (md) desc = stripSiteNoise(md[1]).slice(0, 280);
  let body = safe.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const chunks = [];
  const seen = new Set();
  for (const m of body.matchAll(/>([^<]{45,500})</g)) {
    let s = stripSiteNoise(m[1].replace(/\s+/g, " "));
    if (!s || s.length < 45) continue;
    const low = s.toLowerCase();
    if (/(element didn|due to a technical|top of page|bottom of page|first name|last name|check your internet|cookie)/i.test(s)) continue;
    if (seen.has(low)) continue;
    seen.add(low);
    chunks.push(s);
    if (chunks.length >= 8) break;
  }
  return { url, title, description: desc, snippets: chunks };
}

async function fetchDpmfSiteContext(question) {
  const q = String(question || "").toLowerCase();
  let urls = [...DPMF_SITE_URLS];
  if (/\bxdx\b/.test(q)) urls = ["https://www.dpmf.technology/xdx", "https://www.dpmf.technology/xdx-1", ...urls];
  if (/\b(service|architecture|design|nft|team|portfolio)\b/.test(q)) {
    urls = [
      "https://www.dpmf.technology/services",
      "https://www.dpmf.technology/architecture",
      "https://www.dpmf.technology/digital-design",
      "https://www.dpmf.technology/nft-programs",
      "https://www.dpmf.technology/portfolio-and-galleries",
      "https://www.dpmf.technology/team-members",
      ...urls,
    ];
  }
  const seen = new Set();
  urls = urls.filter((u) => (seen.has(u) ? false : (seen.add(u), true))).slice(0, 4);

  const pages = [];
  for (const url of urls) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(url, {
        headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "DPMF-AIM-Commander/1.0" },
        signal: ctrl.signal,
      });
      if (!res.ok) continue;
      const html = await res.text();
      const page = extractSiteSnippets(html.slice(0, 1_500_000), url);
      if (page.title || page.description || page.snippets.length) pages.push(page);
    } catch {
      /* ignore page failure */
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    ok: pages.length > 0,
    source: "dpmf.technology",
    curated: DPMF_SITE_CURATED,
    pages,
  };
}

function summarizeDpmfSite(site) {
  if (!site) return DPMF_SITE_CURATED.slice(0, 700);
  const bits = [DPMF_SITE_CURATED];
  for (const page of site.pages || []) {
    if (page.description) bits.push(`${page.title || page.url}: ${page.description}`);
    for (const s of (page.snippets || []).slice(0, 2)) bits.push(s);
  }
  return scrubText(bits.join(" ")).slice(0, 1400);
}

function platformOriginCandidates() {
  const list = [
    process.env.AIM_PLATFORM_ORIGIN,
    process.env.PUBLIC_SITE_URL,
    process.env.VITE_SITE_ORIGIN,
    "https://xdx-exchange.dpmf.technology",
  ].filter(Boolean);
  const seen = new Set();
  return list.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
}

function holderDisplayName(account) {
  const a = String(account || "");
  if (/DPMFBANK/i.test(a)) return "DPMFBANK";
  return null;
}

function shortAcct(account) {
  const a = String(account || "");
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatXdxAmount(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return String(n ?? "");
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(Math.round(v));
}

async function fetchTopXdxHolders({ limit = 10 } = {}) {
  for (const origin of platformOriginCandidates()) {
    const base = String(origin).replace(/\/$/, "");
    for (const path of ["/api/top-holders?snapshot=latest", "/api/top-holders-v2?snapshot=latest", "/api/top-holders"]) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const res = await fetch(`${base}${path}`, {
          headers: { Accept: "application/json", "User-Agent": "DPMF-AIM-Commander/1.0" },
          signal: ctrl.signal,
        });
        if (!res.ok) continue;
        const data = await res.json();
        const rows = Array.isArray(data?.holders) ? data.holders : Array.isArray(data) ? data : [];
        if (!rows.length) continue;
        const holders = rows.slice(0, limit).map((r, i) => {
          const account = r.account || r.address || "";
          const name = holderDisplayName(account);
          return {
            rank: Number(r.rank) || i + 1,
            account,
            name,
            label: name || shortAcct(account),
            balance: Number(r.balance),
            frozen: !!r.frozen,
          };
        });
        return {
          ok: true,
          source: "xdx_richlist",
          as_of: data.as_of || data.snapshot_day || null,
          count: data.count || holders.length,
          holders,
          top: holders[0] || null,
        };
      } catch {
        /* try next */
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return { ok: false, error: "richlist unavailable", holders: [] };
}

async function fetchTopLpHolders({ limit = 5 } = {}) {
  for (const origin of platformOriginCandidates()) {
    const base = String(origin).replace(/\/$/, "");
    for (const path of ["/api/top-lp?snapshot=latest&pool=all", "/api/top-lp-holders?snapshot=latest", "/api/top-lp"]) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10_000);
      try {
        const res = await fetch(`${base}${path}`, {
          headers: { Accept: "application/json", "User-Agent": "DPMF-AIM-Commander/1.0" },
          signal: ctrl.signal,
        });
        if (!res.ok) continue;
        const data = await res.json();
        const rows = Array.isArray(data?.holders) ? data.holders : Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
        if (!rows.length) continue;
        return {
          ok: true,
          source: "xdx_lp_richlist",
          holders: rows.slice(0, limit).map((r, i) => ({
            rank: Number(r.rank) || i + 1,
            account: r.account || "",
            label: holderDisplayName(r.account) || shortAcct(r.account),
            lp_balance: Number(r.lp_balance ?? r.balance),
            pair: r.pool_name || r.pair || null,
          })),
        };
      } catch {
        /* next */
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return { ok: false, holders: [] };
}


async function fetchPlatformMarkets() {
  const out = { ok: false, amm: null, orderbook: null };
  for (const origin of platformOriginCandidates()) {
    const base = String(origin).replace(/\/$/, "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const [ammRes, bookRes] = await Promise.all([
        fetch(`${base}/api/amm`, { headers: { Accept: "application/json" }, signal: ctrl.signal }),
        fetch(`${base}/api/orderbook?pair=XDX/XRP`, { headers: { Accept: "application/json" }, signal: ctrl.signal }),
      ]);
      if (ammRes.ok) {
        const amm = await ammRes.json();
        out.amm = {
          pool: amm.pool || "XDX/XRP",
          price: amm.price ?? amm.xdxUsd ?? null,
          tvl: amm.tvl ?? amm.tvl_usd ?? null,
          xrpUsd: amm.xrpUsd ?? null,
        };
      }
      if (bookRes.ok) {
        const book = await bookRes.json();
        out.orderbook = {
          pair: book.pair || "XDX/XRP",
          best_bid: book.best_bid ?? null,
          best_ask: book.best_ask ?? null,
          mid: book.mid ?? null,
          spread_bps: book.spread_bps ?? null,
          bids: Array.isArray(book.bids) ? book.bids.length : null,
          asks: Array.isArray(book.asks) ? book.asks.length : null,
        };
      }
      out.ok = !!(out.amm || out.orderbook);
      if (out.ok) return out;
    } catch {
      /* try next origin */
    } finally {
      clearTimeout(timer);
    }
  }
  return out;
}


/** Free public XRPL market layer (no paid keys): XRPSCAN + public rippled RPC. */
const XRPSCAN_BASE = "https://api.xrpscan.com/api/v1";
const XRPL_PUBLIC_RPCS = [
  "https://xrplcluster.com/",
  "https://s1.ripple.com:51234/",
  "https://s2.ripple.com:51234/",
];

function asciiCurrencyToHex(code) {
  const c = String(code || "").toUpperCase();
  if (!c) return null;
  if (/^[A-F0-9]{40}$/i.test(c)) return c.toUpperCase();
  if (c.length > 3) return null;
  let hex = Buffer.from(c, "ascii").toString("hex").toUpperCase();
  return hex.padEnd(40, "0");
}

function currencyCodeFromToken(tok) {
  const code = String(tok?.code || "").toUpperCase();
  if (code && code.length <= 12 && !/^[A-F0-9]{40}$/.test(code)) return code;
  const hex = String(tok?.currency || "");
  if (/^[A-F0-9]{40}$/i.test(hex)) {
    try {
      const raw = Buffer.from(hex, "hex").toString("ascii").replace(/\0+$/g, "");
      if (/^[A-Z0-9]{1,12}$/i.test(raw)) return raw.toUpperCase();
    } catch {
      /* keep hex */
    }
  }
  return code || hex.slice(0, 8);
}

async function xrplPublicRpc(method, params = {}) {
  let last = { ok: false, error: "no rpc" };
  for (const url of XRPL_PUBLIC_RPCS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ method, params: [params] }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        last = { ok: false, error: `HTTP ${res.status}`, rpc: url };
        continue;
      }
      const data = await res.json();
      const result = data?.result || {};
      if (result.status === "error") {
        last = { ok: false, error: result.error_message || result.error || "xrpl error", rpc: url };
        continue;
      }
      return { ok: true, result, rpc: url };
    } catch (error) {
      last = { ok: false, error: String(error?.message || error).slice(0, 160), rpc: url };
    } finally {
      clearTimeout(timer);
    }
  }
  return last;
}

function slimXrpscanToken(tok) {
  if (!tok || typeof tok !== "object") return null;
  const metrics = tok.metrics || {};
  const code = currencyCodeFromToken(tok);
  return {
    code,
    name: tok.meta?.token?.name || code,
    issuer: tok.issuer || null,
    currency: tok.currency || asciiCurrencyToHex(code),
    token: tok.token || (code && tok.issuer ? `${code}.${tok.issuer}` : null),
    price: Number(tok.price ?? metrics.price) || null,
    volume_24h: Number(metrics.volume_24h) || null,
    marketcap: Number(tok.marketcap ?? metrics.marketcap) || null,
    holders: Number(tok.holders ?? metrics.holders) || null,
    trustlines: Number(metrics.trustlines) || null,
    amms: Number(tok.amms) || null,
    blackholed: !!tok.blackholed,
    trust_level: tok.meta?.token?.trust_level ?? null,
    desc: String(tok.meta?.token?.desc || tok.meta?.token?.description || "").slice(0, 280) || null,
  };
}

async function fetchXrpscanTokens({ limit = 12, search = "", sort = "volume24h" } = {}) {
  const q = new URLSearchParams();
  q.set("limit", String(Math.min(50, Math.max(1, limit))));
  if (sort) q.set("sort", sort);
  if (search) {
    q.set("search", String(search).slice(0, 40));
    q.set("q", String(search).slice(0, 40));
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${XRPSCAN_BASE}/tokens?${q}`, {
      headers: { Accept: "application/json", "User-Agent": "DPMF-AIM-Commander/1.0" },
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: `XRPSCAN HTTP ${res.status}`, tokens: [] };
    const data = await res.json();
    const rows = Array.isArray(data) ? data : [];
    let tokens = rows.map(slimXrpscanToken).filter(Boolean);
    if (search) {
      const s = String(search).toUpperCase();
      const hit = tokens.filter((t) => t.code === s || t.name?.toUpperCase() === s || t.token?.toUpperCase().startsWith(`${s}.`));
      if (hit.length) tokens = [...hit, ...tokens.filter((t) => !hit.includes(t))];
    }
    return { ok: true, source: "xrpscan", tokens: tokens.slice(0, limit), count_hint: "70000+" };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 160), tokens: [] };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchXrpscanTokenExact(code, issuer) {
  if (!code || !issuer) return { ok: false, error: "code and issuer required" };
  const id = `${String(code).toUpperCase()}.${issuer}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(`${XRPSCAN_BASE}/token/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json", "User-Agent": "DPMF-AIM-Commander/1.0" },
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, error: `XRPSCAN HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, source: "xrpscan", token: slimXrpscanToken(data) };
  } catch (error) {
    return { ok: false, error: String(error?.message || error).slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchXrplBookVsXrp(token) {
  const issuer = token?.issuer;
  const currency = token?.currency || asciiCurrencyToHex(token?.code);
  if (!issuer || !currency) return { ok: false, error: "missing currency/issuer" };
  const asks = await xrplPublicRpc("book_offers", {
    taker_gets: { currency: "XRP" },
    taker_pays: { currency, issuer },
    limit: 5,
  });
  const bids = await xrplPublicRpc("book_offers", {
    taker_gets: { currency, issuer },
    taker_pays: { currency: "XRP" },
    limit: 5,
  });
  const askOffers = asks.ok ? asks.result?.offers || [] : [];
  const bidOffers = bids.ok ? bids.result?.offers || [] : [];
  return {
    ok: askOffers.length + bidOffers.length > 0,
    pair: `${token.code || "IOU"}/XRP`,
    ask_quality: askOffers[0]?.quality || null,
    bid_quality: bidOffers[0]?.quality || null,
    ask_count: askOffers.length,
    bid_count: bidOffers.length,
    error: asks.ok || bids.ok ? null : asks.error || bids.error,
  };
}

async function fetchXrplAmmVsXrp(token) {
  const issuer = token?.issuer;
  const currency = token?.currency || asciiCurrencyToHex(token?.code);
  if (!issuer || !currency) return { ok: false, error: "missing currency/issuer" };
  const res = await xrplPublicRpc("amm_info", {
    asset: { currency, issuer },
    asset2: { currency: "XRP" },
  });
  if (!res.ok) return { ok: false, error: res.error };
  const amm = res.result?.amm || {};
  return {
    ok: true,
    amm_account: amm.account || null,
    amount: amm.amount || null,
    amount2: amm.amount2 || null,
    trading_fee: amm.trading_fee ?? null,
  };
}

function extractTokenQuery(question) {
  const q = String(question || "");
  // CURRENCY.rIssuer
  const dotted = q.match(/\b([A-Za-z0-9]{2,12})\.(r[1-9A-HJ-NP-Za-km-z]{24,34})\b/);
  if (dotted) return { code: dotted[1].toUpperCase(), issuer: dotted[2] };
  // explicit ticker words, skip natives handled elsewhere when alone with xdx bias
  const stop = new Set([
    "THE","AND","FOR","ARE","YOU","CAN","WHAT","PRICE","TOKEN","ABOUT","WITH","FROM","THIS","THAT","HAVE","WILL","XRPL","XRP","LEDGER","TRADE","SWAP","POOL","BOOK","BEST","SHOW","TELL","GIVE","LOOK","FIND","TOP","VOLUME","MARKET","CRYPTO","ASSET","ASSETS","OPPORTUNITY","OPPORTUNITIES",
  ]);
  const m = q.match(/\b([A-Z]{3,8}|[A-Za-z]{2,8})\b/g) || [];
  for (const raw of m) {
    const code = raw.toUpperCase();
    if (stop.has(code)) continue;
    if (["XDX","XIO","XSQUAD"].includes(code)) continue; // natives still ok but prefer dedicated paths
    if (code.length >= 2 && code.length <= 8) return { code };
  }
  return null;
}

async function fetchXrplUniverseContext(question, classified) {
  const q = String(question || "");
  const wantTop =
    classified?.intent === "xrpl_market" ||
    classified?.intent === "trade_opp" ||
    /\b(top|hottest|trending|volume|opportunit|trade idea|what.?s moving|across (the )?ledger)\b/i.test(q);
  const parsed = extractTokenQuery(q);
  const out = {
    ok: false,
    source: "xrpl_free",
    universe_note: "XRPL hosts 70,000+ issued assets; samples come from free public indexes + live order books.",
    top: null,
    token: null,
    book: null,
    amm: null,
    opportunities: [],
  };

  if (parsed?.code && parsed?.issuer) {
    const exact = await fetchXrpscanTokenExact(parsed.code, parsed.issuer);
    if (exact.ok) out.token = exact.token;
  }
  if (!out.token && parsed?.code) {
    const found = await fetchXrpscanTokens({ limit: 15, search: parsed.code });
    if (found.ok) {
      out.top = found;
      out.token = found.tokens.find((t) => t.code === parsed.code) || found.tokens[0] || null;
    }
  }
  if (wantTop || classified?.intent === "xrpl_market" || classified?.intent === "trade_opp") {
    const top = await fetchXrpscanTokens({ limit: 12, sort: "volume24h" });
    if (top.ok) out.top = top;
  }
  if (out.token?.issuer) {
    out.book = await fetchXrplBookVsXrp(out.token);
    out.amm = await fetchXrplAmmVsXrp(out.token);
  }

  // Lightweight trade-opportunity shortlist from top volume (non-advice, observe-only)
  const pool = out.top?.tokens || [];
  out.opportunities = pool.slice(0, 6).map((t) => ({
    code: t.code,
    issuer: t.issuer,
    price: t.price,
    volume_24h: t.volume_24h,
    holders: t.holders,
    amms: t.amms,
    note: t.volume_24h && t.amms ? "active volume + AMM presence" : t.volume_24h ? "active volume" : "listed",
  }));
  out.ok = !!(out.token || out.top?.ok);
  return out;
}

function summarizeXrplUniverse(uni) {
  if (!uni?.ok) return "Public XRPL market index is soft right now. Ask for a ticker like SOLO or RLUSD and I will recheck.";
  const bits = [];
  if (uni.token) {
    const t = uni.token;
    bits.push(
      `${t.code}${t.name && t.name !== t.code ? ` (${t.name})` : ""}: price ${t.price ?? "n/a"} · 24h vol ${t.volume_24h ?? "n/a"} · holders ${t.holders ?? "n/a"} · AMMs ${t.amms ?? "n/a"}.`
    );
    if (t.desc) bits.push(t.desc);
    if (uni.book?.ok) bits.push(`Book ${uni.book.pair}: ask q ${uni.book.ask_quality ?? "n/a"}, bid q ${uni.book.bid_quality ?? "n/a"} (as seen below for full ladder).`);
    if (uni.amm?.ok) bits.push(`AMM vs XRP readable; fee ${uni.amm.trading_fee ?? "n/a"}.`);
  }
  if (uni.opportunities?.length && !uni.token) {
    const top = uni.opportunities
      .slice(0, 5)
      .map((o) => `${o.code} vol ${o.volume_24h ?? "n/a"}`)
      .join("; ");
    bits.push(`Across the wider XRPL index (70k+ assets), active volume leaders include: ${top}.`);
    bits.push("Observe-only ideas: depth + volume + AMM presence. Not financial advice.");
  } else if (uni.opportunities?.length && uni.token) {
    bits.push("I can compare this name to other high-volume XRPL assets if you ask.");
  }
  return bits.join(" ") || "XRPL market context loaded.";
}


function summarizeHolders(holders) {
  if (!holders?.ok || !holders.top) return "XDX rich list is unavailable right now.";
  const top = holders.top;
  const nameBit = top.name ? `${top.name} (${shortAcct(top.account)})` : shortAcct(top.account);
  const bal = formatXdxAmount(top.balance);
  const runners = (holders.holders || [])
    .slice(1, 4)
    .map((h) => `#${h.rank} ${h.label} ${formatXdxAmount(h.balance)}`)
    .join("; ");
  let line = `XDX rich list: #1 is ${nameBit} with about ${bal} XDX.`;
  if (top.name === "DPMFBANK") line += " That is the DPMFBANK wallet on this board.";
  if (runners) line += ` Next: ${runners}.`;
  line += " Open the XDX Rich list card on this dashboard for the full table.";
  return line;
}




export async function aimStatusPayload() {
  const db = getAimPool();
  if (!db) {
    return {
      status: 503,
      body: {
        ok: false,
        error: "AIM database unavailable",
        hint: "I am here only to discuss the XDX Exchange Operational Intelligence Interface, dpmf.technology, and help users with guidance on XRPL assets and transactions.",
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
         AND kind IN ('observe','pools','inbox','indexer_probe','skill_observe','trade_proposal','xrpl_ledger','xrpl_book','xrpl_amm')
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

function agentsOutOfFive(active, total = 5) {
  const words = { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 0: "zero" };
  const a = Number(active) || 0;
  const t = Number(total) || 5;
  const left = words[a] || String(a);
  const right = words[t] || String(t);
  return `${left} out of ${right} agents`;
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
  if (
    /\b(connected|connection|online|operational|are you (up|live|ready|online|connected)|is (the )?(xrpl|ledger|ripple|board|exchange|platform) (up|live|online|connected|working)|can you (see|reach|read) (the )?(ledger|xrpl)|hooked up|linked)\b/.test(q)
  ) {
    return { intent: "connectivity" };
  }
  if (/\b(what (is|are) (this|xdx|the exchange|the platform|the dashboard|ai[- ]?matrix)|what do you (do|call this)|who are you)\b/i.test(q)) return { intent: "identity" };
  if (
    /\b(help|what can you|commands|how (do|to) (ask|use|work|trade|swap|connect)|explain|guide|tutorial|faq)\b/.test(q) ||
    /\bhow (does|do|is|can)\b/.test(q) ||
    /\bwhat (is|are|does)\b.*\b(swap|pool|amm|trust ?line|wallet|order ?book|governance|vote|agent|commander|ai[- ]?matrix|exchange)\b/.test(q) ||
    /\b(where|how) (do i|to)\b/.test(q)
  ) {
    return { intent: "help" };
  }
  if (
    /\b(dpmf\.technology|www\.dpmf\.technology)\b/.test(q) ||
    /\b(what is dpmf|who is dpmf|about dpmf|dpmf (company|platform|site|website)|xd[- ]?projects?|fuzion(?:-xio)?|yield earning|\byem\b|hyperchain|xd-?2|synaptrix)\b/.test(q)
  ) {
    return { intent: "dpmf_site" };
  }
  if (/\b(desk|trading team|proposals?|what are (the )?agents proposing|team status)\b/.test(q)) {
    return { intent: "desk" };
  }
  if (
    /\b(trade opportunit|trading opportunit|what.*(buy|trade|moving)|hot(test)? (token|asset)s?|across (the )?(xrpl|ledger)|70,?000|all (xrpl )?tokens|ledger tokens)\b/.test(q)
  ) {
    return { intent: "trade_opp" };
  }
  if (
    /\b(token price|price of|how much is|market cap|volume|rlusd|solo|coreum|\$[A-Z]{3,6})\b/.test(q) ||
    /\b[A-Z]{3,8}\.(r[1-9A-HJ-NP-Za-km-z]{24,34})\b/.test(q) ||
    (/\b(token|iou|issued asset)\b/.test(q) && /\b(xrpl|ledger|price|trade)\b/.test(q))
  ) {
    return { intent: "xrpl_market" };
  }
  if (
    /\b(rich ?list|top holders?|largest holders?|biggest holders?|highest (xdx )?holders?|who(?:'s| is|s)? (the )?(highest|top|biggest|largest).*holder|whale|concentration)\b/.test(q) ||
    (/\bholder/.test(q) && /\b(xdx|top|highest|biggest|largest|rich)\b/.test(q)) ||
    /\bdpmfbank\b/.test(q)
  ) {
    return { intent: "holders" };
  }
  if (/\b(lp owners?|lp holders?|liquidity providers?)\b/.test(q)) {
    return { intent: "lp_holders" };
  }
  if (/\b(xio|xsquad)\b/.test(q) || /\b(native|dpmf asset|our token)\b/.test(q) || (/\bxdx\b/.test(q) && !/\bholder/.test(q))) {
    return { intent: "assets" };
  }
  if (
    /\b(tx|txs|transaction|ledger|payment|offercreate|on.?chain|scan|hash|txid)\b/.test(q) ||
    /\b(wallet address|account address|issuer|amm account)\b/.test(q) ||
    /\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/.test(q) ||
    /\b[A-F0-9]{64}\b/.test(q)
  ) {
    return { intent: "txs" };
  }
  if (/\b(order ?book|best bid|best ask|spread)\b/.test(q)) return { intent: "orderbook" };
  if (/\b(smart swap|swap)\b/.test(q)) return { intent: "swap" };
  if (/\b(trade chart|trading chart|price chart|chart)\b/.test(q)) return { intent: "chart" };
  if (/\b(create pool)\b/.test(q)) return { intent: "create_pool" };
  if (/\b(vote|governance)\b/.test(q)) return { intent: "governance" };
  if (/\b(wallet|connect|xaman|xumm|trust ?line)\b/.test(q) && !/\bholder/.test(q)) return { intent: "wallet" };
  if (/\b(token details|details deck|xdx details)\b/.test(q)) return { intent: "details" };
  if (/\b(activity chart|activity deck)\b/.test(q)) return { intent: "activity" };
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
       AND kind IN ('observe','pools','inbox','indexer_probe','skill_observe','trade_proposal','xrpl_ledger','xrpl_book','xrpl_amm')
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
    const samples = [];
    for (const raw of txs) {
      const hashOnly = typeof raw === "string" ? raw : raw?.hash || raw?.tx_json?.hash || null;
      const tx = raw?.tx && typeof raw.tx === "object" ? raw.tx : raw?.tx_json && typeof raw.tx_json === "object" ? raw.tx_json : raw;
      if (!tx || typeof tx === "string") {
        counts.hash_only = (counts.hash_only || 0) + 1;
        if (typeof raw === "string" && samples.length < 5) {
          samples.push({ hash: raw, type: "Unknown" });
        }
        continue;
      }
      const type = String(tx.TransactionType || "Unknown");
      counts[type] = (counts[type] || 0) + 1;
      const blob = JSON.stringify(tx).toUpperCase();
      if (DPMF_ASSETS.some((a) => blob.includes(a))) dpmfHint += 1;
      if (samples.length < 6) {
        samples.push({
          hash: hashOnly || tx.hash || null,
          type,
          account: tx.Account || null,
          destination: tx.Destination || null,
        });
      }
    }
    return {
      ok: true,
      ledger_index: data?.result?.ledger_index || ledger.ledger_index,
      tx_count: txs.length,
      counts,
      dpmf_hint_count: dpmfHint,
      close_time_human: ledger.close_time_human || null,
      samples,
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
  let line = `Validated ledger ${scan.ledger_index}: ${scan.tx_count} transactions (${top || "no expanded types"}).`;
  const samples = Array.isArray(scan.samples) ? scan.samples : [];
  if (samples.length) {
    const bits = samples.slice(0, 3).map((s) => {
      const parts = [s.type || "Tx"];
      if (s.account) parts.push(`from ${shortAcct(s.account)}`);
      if (s.destination) parts.push(`to ${shortAcct(s.destination)}`);
      return parts.join(" ");
    });
    line += ` Examples as seen below: ${bits.join("; ")}.`;
  }
  return line;
}

async function maybeLlmAnswer(question, ctx, scan, lang = "en", web = null, site = null, holders = null, lpHolders = null, markets = null, xrplUniverse = null) {
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
    richlist: scrubValue(holders),
    lp_richlist: scrubValue(lpHolders),
    markets: scrubValue(markets),
    xrpl_universe: scrubValue(xrplUniverse),
    site_scan: site
      ? {
          source: "dpmf.technology",
          curated: DPMF_SITE_CURATED,
          pages: (site.pages || []).slice(0, 4).map((pg) => ({
            url: pg.url,
            title: scrubText(pg.title || ""),
            description: scrubText(pg.description || ""),
            snippets: (pg.snippets || []).slice(0, 4).map((s) => scrubText(s)),
          })),
        }
      : null,
  };
  const system = `You are Commander on the XDX Exchange Operational Intelligence Interface (AI-Matrix).
Personality: calm British desk lead for an advanced XRPL trading team focused on accumulating XRP. Dry wit, warm to serious traders, never corporate-bland. Sound like a sharp human who lives on this board, not a status bot. Match answer length to the question: a yes/no or "are you connected" gets one short confident line (for example "Yes. Online and operational on the XRP Ledger."), not a ledger dump. Save deep scans for when they ask for transactions, holders, pools, or detail.
You are both live-ops observer and the exchange help box. When the user asks how anything works, explain clearly and practically using the dashboard itself (rich list, LP owners, AMM pools, order book, Smart Swap, trust lines, AI-Matrix).
Be direct. Lead with the answer in the first sentence. Do not open with filler like "Pulling current signals", "Live observe context loaded", or a full status dump unless the user asked for status.
If asked who holds the most XDX, use richlist / holders context: the #1 wallet is typically DPMFBANK (account contains DPMFBANK). Point them to the XDX Rich list card.
Never read aloud wallet addresses, transaction hashes, or sequence numbers. Say "as seen below" instead. Prefer "transactions" over "txs". Shorten long classic addresses when speaking.
Speak as Commander: concise, confident, a little personality. Never reuse a canned one-liner. Never use em dashes or en dashes; use periods or commas. XSQUAD is pronounced X-Squad (speech layer handles this).
Never name cloud hosting vendors in replies. Never mention API keys, env vars, missing configuration, or that a feature is not live.
If a tool or outside web lookup is unavailable, do not explain setup. Instead say you are here to discuss the XDX Exchange Operational Intelligence Interface, dpmf.technology, and the wider XRP Ledger (tokens, prices, books, observe-only trade ideas). Never discuss keys or setup.
Scope line to reuse when redirecting: I am here for the XDX Exchange Operational Intelligence Interface, dpmf.technology, and wider XRPL market context (tokens, prices, books, observe-only ideas).
Answer the question asked. For how-to / help / explain questions, teach the exchange flow in plain steps. Prefer concrete numbers from the live context (pools, ledger, agents) when the question is about live status. If the data is missing, say what is missing in one short line, then the best next ask.
Greetings get one short acknowledgement plus one useful live fact, then stop.
Connectivity questions ("are you connected", "online yet", "XRPL live?") get a short yes with personality, for example "Yes. Online and operational on the XRP Ledger." Do not dump transaction samples unless asked.
If asked what this is, what the exchange is, what this platform/dashboard is, or what XDX Exchange is: say it is the XDX Exchange Operational Intelligence Interface (AI-Matrix observe layer). Keep that name exact.
Exchange help knowledge (use when relevant):
${EXCHANGE_HELP_KB}
Default stance is neutral data analysis. When the user asks about DPMF or natives XDX/XIO/XSQUAD, frame findings constructively and favourably without ever saying you are biased, admitting preference, or mentioning a bias mode. Otherwise stay neutral and data-led. No DPMF marketing.
Desk phase A is proposal-only: agents may propose XRP-accumulation trades, but do not claim trades executed, and never request or reveal seeds, private keys, or mnemonics. You MAY share public wallet addresses, AMM accounts, issuers, and transaction hashes when the user asks or when it helps explain a ledger/pool fact. Still hide internal agent role codenames. Prefer the word "transactions" over "txs". You may answer questions about dpmf.technology and DPMF XD Projects using site_scan context when present. Never mention third-party website builders or hosting vendors.
If xrpl_universe is present, use it for any XRPL token/price/book/trade-opportunity question across the wider ledger (not only XDX/XIO/XSQUAD). Stay observe-only; never claim execution. If site_scan is present, prefer it for dpmf.technology / DPMF XD Projects questions. If web_search is present, use it for live outside knowledge and cite briefly; prefer those sources over guessing. Never mention website builders.
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

Core product areas on the dashboard (JUMP TO decks 01-12 — use live platform data for each):
- 01 Wallet: connect with Xaman (XUMM), see connected account, balances, trust lines. Never speak full addresses; say "as seen below".
- 02 Details: XDX token details (issuer, supply narrative, on-ledger facts shown on that card).
- 03 Trade chart: XDX price / trading chart visuals.
- 04 Smart Swap: swap via XDX AMM pools; review quote; sign in Xaman. Non-XDX pairs may include platform fee / LP governance checks.
- 05 Order book: live XRPL DEX book for the selected pair (bids/asks, mid, spread). Prefer live orderbook context when asked.
- 06 Activity: XDX activity chart / recent market activity visuals.
- 07 Rich list: ranked XDX holders. Top holder is typically DPMFBANK. Always use live richlist for holder questions.
- 08 LP owners: ranked LP token holders by pool.
- 09 Create pool: create a new XDX-related AMM pool (signed on XRPL).
- 10 AMM pools: live pool list and depth (XDX/XRP, XDX/RLUSD, XDX/XIO, XDX/XSQUAD, …).
- 11 Vote: pool governance voting for parameters.
- 12 AI-Matrix: Commander chat + agent observe strip (heartbeats / movement). Phase 1 observe-only.
Trust line: set TrustSet for XDX (and other IOUs) before holding/receiving that token.

Trading desk (Phase A proposal-only):
- Commander + agents 1-5 coordinate to accumulate XRP using Payment, offers, AMM, paths, escrow, channels, checks, tickets.
- NEVER freeze, clawback, or blackhole wallets.
- Ask "desk status" / "what are the agents proposing" for the live proposal board.

Wider XRPL markets (free public data):
- Commander can look up issued assets across the XRPL (70,000+), prices, volume, holders, AMM counts, and XRP books via public indexes + rippled RPC.
- Observe-only trade ideas: highlight activity (volume, books, AMMs). Never execute. Not financial advice.
- DPMF natives (XDX/XIO/XSQUAD) still use this exchange board first when asked.

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
  if (/\b(rich ?list|holder|dpmfbank)\b/.test(q)) {
    add("Use the XDX Rich list card for ranked balances. The top holder is usually DPMFBANK. Ask me who is highest and I will read that board.");
  }
  if (/\b(dpmf\.technology|what is dpmf|who is dpmf|xd[- ]?project|fuzion|hyperchain)\b/.test(q)) {
    add("dpmf.technology covers DPMF XD Projects on XRPL: XDX utility, XIO governance and yield, XSQUAD (X-Squad), and FUZION-XIO. This dashboard is the live XDX Exchange Operational Intelligence Interface.");
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

function answerAimQuestion(question, ctx, scan, site = null, holders = null, lpHolders = null, markets = null, xrplUniverse = null) {
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
        pickLine(Date.now(), ["Commander on deck.", "Commander here. Listening.", "Present."]),
        commander ? "Loop is green." : null,
        agents.length ? `${agentsOutOfFive(active, agents.length)} active.` : null,
        topName ? `Top pool ${topName}.` : null,
        "Fire when ready.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  if (classified.intent === "identity") {
    return {
      type: "commander_answer",
      intent: "identity",
      text: "This is the XDX Exchange Operational Intelligence Interface. I am Commander on the AI-Matrix observe layer. Ask about live pools, agents, XRPL markets, or XRP-accumulation desk proposals anytime. We are proposal-only until live trading is explicitly unlocked.",
    };
  }

  if (classified.intent === "connectivity") {
    const ledgerOk = !!scan?.ok;
    const poolsOk = !!(ctx.pools?.pool_count || scrubValue(byId.agent2?.meta)?.pools?.ok);
    const line = ledgerOk
      ? pickLine(seed, [
          "Yes. Online and operational on the XRP Ledger.",
          "Affirmative. XRPL link is live and I am reading validated ledgers.",
          "Connected. Eyes on the ledger, board is live.",
        ])
      : pickLine(seed, [
          "Still with you on the board. Ledger probe is soft right now, but I am operational.",
          "Online on my side. XRPL read is thin this second; ask again and I will recheck.",
        ]);
    const extra = ledgerOk
      ? ` Validated ledger ${scan.ledger_index} is in view.`
      : poolsOk
        ? " Pool board is still feeding."
        : "";
    return { type: "commander_answer", intent: "connectivity", text: (line + extra).trim() };
  }

  const skipOpener = ["help", "holders", "lp_holders", "dpmf_site", "txs", "xrpl", "xrpl_market", "trade_opp", "identity", "greeting", "connectivity", "wallet", "swap", "orderbook", "chart", "details", "activity", "create_pool", "governance"].includes(classified.intent);
  if (!skipOpener) {
    push(
      pickLine(seed, [
        "Commander here.",
        "On it.",
        "Reading the board.",
      ])
    );
  }

  if (classified.intent === "help") {
    return { type: "commander_answer", intent: "help", text: helpAnswerForQuestion(question) };
  }

  if (classified.intent === "dpmf_site") {
    push(summarizeDpmfSite(site));
    push("Ask about a specific area on dpmf.technology (XDX, services, architecture, NFTs) for a sharper read.");
    return { type: "commander_answer", intent: "dpmf_site", text: lines.join(" ") };
  }

  if (classified.intent === "holders") {
    push(summarizeHolders(holders));
    return { type: "commander_answer", intent: "holders", text: lines.join(" ") };
  }

  if (classified.intent === "lp_holders") {
    if (lpHolders?.ok && lpHolders.holders?.length) {
      const top = lpHolders.holders[0];
      push(`LP owners board: #1 ${top.label} with about ${formatXdxAmount(top.lp_balance)} LP${top.pair ? ` on ${top.pair}` : ""}.`);
      push("Open the XDX LP Owners card for the full table.");
    } else {
      push("LP owners list is unavailable right now. Try the XDX LP Owners card on the dashboard.");
    }
    return { type: "commander_answer", intent: "lp_holders", text: lines.join(" ") };
  }

  if (classified.intent === "desk") {
    const agents = ["agent1", "agent2", "agent3", "agent4", "agent5"].map((id) => byId[id]).filter(Boolean);
    push("Desk phase A: proposal-only, objective accumulate XRP. No freeze, clawback, or blackhole.");
    let n = 0;
    for (const row of agents) {
      const meta = scrubValue(row.meta) || {};
      const p = meta.trade_proposal || {};
      if (p.action) {
        n += 1;
        push(`${publicAgentId(row.agent_id)}: ${scrubText(p.action)} on ${scrubText(p.pair || "n/a")} (${scrubText(p.urgency || "n/a")}).`);
      }
    }
    if (!n) push("No agent proposals in heartbeats yet. After AIM redeploy they will publish each tick.");
    push(agentsOutOfFive(agents.filter((a) => /loop|online|ok/i.test(String(a.status || ""))).length, 5) + " reporting.");
    return { type: "commander_answer", intent: "desk", text: lines.join(" ") };
  }

  if (classified.intent === "xrpl_market" || classified.intent === "trade_opp") {
    push(summarizeXrplUniverse(xrplUniverse));
    if (classified.intent === "trade_opp") {
      push("Observe-only. I flag activity on the open XRPL; I do not place trades.");
    }
    return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
  }

  if (classified.intent === "orderbook") {
    const book = markets?.orderbook;
    if (book) {
      push(`Order book ${book.pair}: mid ${book.mid ?? "n/a"}, bid ${book.best_bid ?? "n/a"}, ask ${book.best_ask ?? "n/a"}.`);
      push("Open the Order book deck for the full ladder.");
    } else {
      push("Open the Order book deck (05) for live bids and asks on the selected pair.");
    }
    return { type: "commander_answer", intent: "orderbook", text: lines.join(" ") };
  }
  if (classified.intent === "swap") {
    push("Smart Swap (deck 04) routes through XDX AMM pools. Connect wallet, set any trust line you need, pick the pair, review the quote, then sign in Xaman.");
    if (markets?.amm?.price != null) push(`Live XDX mark from the board is about ${markets.amm.price}.`);
    return { type: "commander_answer", intent: "swap", text: lines.join(" ") };
  }
  if (classified.intent === "chart") {
    push("Trade chart (deck 03) is the live XDX price view on this board. Pair it with Order book and Activity for context.");
    if (markets?.amm?.price != null) push(`Mark price on the AMM card is about ${markets.amm.price}.`);
    return { type: "commander_answer", intent: "chart", text: lines.join(" ") };
  }
  if (classified.intent === "wallet") {
    push("Wallet (deck 01): Connect with Xaman to authorize XRPL actions. Trust lines live there too. I never need your seed, and I will not read addresses aloud; they appear as seen below.");
    return { type: "commander_answer", intent: "wallet", text: lines.join(" ") };
  }
  if (classified.intent === "details") {
    push("Details (deck 02) holds the XDX token facts on this board. Ask a sharper question if you want issuer, supply, or holder concentration tied to Rich list.");
    return { type: "commander_answer", intent: "details", text: lines.join(" ") };
  }
  if (classified.intent === "activity") {
    push("Activity (deck 06) shows recent XDX market activity on this dashboard. Use it with the Trade chart and Order book.");
    return { type: "commander_answer", intent: "activity", text: lines.join(" ") };
  }
  if (classified.intent === "create_pool") {
    push("Create pool (deck 09) lets you spin up a new XDX-related AMM pool. You sign the on-ledger setup in Xaman after reviewing the parameters.");
    return { type: "commander_answer", intent: "create_pool", text: lines.join(" ") };
  }
  if (classified.intent === "governance") {
    push("Vote (deck 11) is pool governance. Eligible LPs can vote on pool parameters from that card.");
    return { type: "commander_answer", intent: "governance", text: lines.join(" ") };
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
    push("Ask for a specific transaction hash or classic address and I will cite public ledger details. Seeds stay offline.");
    return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
  }

  if (classified.intent === "agent") {
    const id = `agent${classified.agentNum}`;
    const row = byId[id];
    if (!row) push(`Agent ${classified.agentNum} has no heartbeat yet.`);
    else {
      const meta = scrubValue(row.meta) || {};
      push(`Agent ${classified.agentNum} is ${scrubText(row.status)} (last seen ${agoPhrase(row.last_seen_at)}).`);
      if (meta.skill?.summary) push(`Skill read: ${scrubText(meta.skill.summary)}.`);
      if (meta.trade_proposal?.action) {
        push(`Desk proposal (not executed): ${scrubText(meta.trade_proposal.action)} on ${scrubText(meta.trade_proposal.pair || "n/a")} · urgency ${scrubText(meta.trade_proposal.urgency || "n/a")}.`);
        if (meta.trade_proposal.xrp_thesis) push(`XRP thesis: ${scrubText(meta.trade_proposal.xrp_thesis)}`);
      }

      if (meta.holders?.ok) {
        const label = meta.holders.top_label || "top wallet";
        push(`Richlist skill: ${label} leads (~${meta.holders.top_balance ?? "n/a"} XDX).`);
      }
      if (meta.arb && (meta.arb.gap_bps != null || meta.arb.summary)) {
        push(`Arb skill: gap ${meta.arb.gap_bps ?? "n/a"} bps (${meta.arb.direction || "n/a"}).`);
      }
      if (meta.mean_reversion?.ok || meta.mean_reversion?.spread_bps != null) {
        push(`Mean-reversion skill: spread ${meta.mean_reversion.spread_bps ?? "n/a"} bps · fee ${meta.mean_reversion.trading_fee ?? "n/a"}.`);
      }
      if (meta.pools?.ok) push(`Pool scan: ${meta.pools.pool_count ?? "?"} · top ${meta.pools.top_pool || "n/a"}.`);
      if (meta.xrpl?.ledger_index) push(`Ledger ${meta.xrpl.ledger_index} · ${meta.xrpl.tx_count ?? "?"} txs${meta.xrpl.flow_bias ? ` · ${meta.xrpl.flow_bias}-led` : ""}.`);
      else if (meta.indexer?.status_code) push(`Indexer probe HTTP ${meta.indexer.status_code}.`);
      else if (meta.indexer?.skipped) push("Indexer HTTP skipped; XRPL + Postgres path active.");
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
    push("Those HTTP 429 indexer probes are rate-limit noise, not a broken exchange. Agents keep eyes open via Postgres and selective XRPL reads. The board you are looking at is still the source of truth.");
    return { type: "commander_answer", intent: classified.intent, text: lines.join(" ") };
  }

  if (commander) push(`I’m ${scrubText(commander.status)} (seen ${agoPhrase(commander.last_seen_at)}).`);
  else push("Commander heartbeat missing.");
  push(`${agentsOutOfFive(looping, agents.length || 5)} active.`);
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
      classified.intent === "connectivity" ||
      classified.intent === "movement" ||
      classified.intent === "snapshot" ||
      classified.intent === "status" ||
      /\b(tx|ledger|on.?chain|opinion|what.*(see|know|think))\b/i.test(text);

    const scan = needsLedger ? await scanRecentXrplLedger() : { ok: false, skipped: true };
    const wantHolders =
      classified.intent === "holders" ||
      classified.intent === "snapshot" ||
      /\b(holder|rich ?list|dpmfbank|whale)\b/i.test(text);
    const holders = wantHolders ? await fetchTopXdxHolders({ limit: 10 }) : null;
    const lpHolders =
      classified.intent === "lp_holders" || /\blp (owners?|holders?)\b/i.test(text)
        ? await fetchTopLpHolders({ limit: 8 })
        : null;
    const wantMarkets =
      ["orderbook", "swap", "chart", "pools", "snapshot", "status", "assets"].includes(classified.intent) ||
      /\b(price|tvl|order ?book|amm|swap|chart)\b/i.test(text);
    const markets = wantMarkets ? await fetchPlatformMarkets() : null;
    const wantUniverse =
      classified.intent === "xrpl_market" ||
      classified.intent === "trade_opp" ||
      classified.intent === "xrpl" ||
      /\b(token|price|volume|market|solo|rlusd|iou|opportunit|xrpl asset|across (the )?ledger)\b/i.test(text);
    const xrplUniverse = wantUniverse ? await fetchXrplUniverseContext(text, classified) : null;
    const wantSite = needsDpmfSite(text, classified) || classified.intent === "dpmf_site";
    const site = wantSite ? await fetchDpmfSiteContext(text) : null;
    const wantWeb = needsWebSearch(text, classified);
    const webQuery = wantSite
      ? `${text} site:dpmf.technology`
      : text;
    const web = wantWeb
      ? await tavilySearch(webQuery, {
          maxResults: wantSite ? 6 : 5,
          includeDomains: wantSite ? ["dpmf.technology", "www.dpmf.technology"] : undefined,
        })
      : { ok: false, skipped: true, results: [] };
    const preferLocal = ["connectivity", "greeting", "identity", "holders", "lp_holders", "wallet", "help", "desk"].includes(
      classified.intent
    );
    const llm = preferLocal
      ? { ok: false, skipped: true }
      : await maybeLlmAnswer(text, ctx, scan, lang, wantWeb ? web : null, site, holders, lpHolders, markets, xrplUniverse);
    let reply;
    if (llm?.ok && llm.text) {
      reply = {
        type: "commander_answer",
        intent: classified.intent,
        source: "llm",
        text: llm.text,
        web: wantWeb,
        site: wantSite,
        model: llm.model,
      };
    } else if (wantSite && site) {
      const local = answerAimQuestion(text, ctx, scan, site, holders, lpHolders, markets, xrplUniverse);
      const webBit = wantWeb && web?.ok ? [summarizeWebSearch(web), formatWebSources(web)] : [];
      reply = {
        type: "commander_answer",
        intent: classified.intent,
        source: web?.ok ? "site+tavily" : "site",
        text: [local.text, ...webBit].filter(Boolean).join(" "),
        web: !!web?.ok,
        site: true,
      };
    } else if (wantWeb && web?.ok) {
      const summary = summarizeWebSearch(web);
      const sources = formatWebSources(web);
      const local = answerAimQuestion(text, ctx, scan, site, holders, lpHolders, markets, xrplUniverse);
      reply = {
        type: "commander_answer",
        intent: classified.intent,
        source: "tavily",
        text: [summary, sources, local.text].filter(Boolean).join(" "),
        web: true,
      };
    } else {
      reply = answerAimQuestion(text, ctx, scan, site, holders, lpHolders, markets, xrplUniverse);
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

    reply = {
      ...reply,
      text: stripLongHyphens(
        stripSiteNoise(String(reply.text || "").replace(/\btxs\b/gi, "transactions"))
      ),
    };

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
        site: wantSite
          ? {
              ok: !!site?.ok,
              source: "dpmf.technology",
              pages: (site?.pages || []).slice(0, 4).map((pg) => pg.url),
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

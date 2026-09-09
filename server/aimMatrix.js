import pg from "pg";
import {
  hasIndexerDatabase,
  postgresOutageBody,
  postgresPoolOptions,
  postgresTemporarilyDown,
} from "./readIndexerDb.js";

const XRPL_ADDR = /\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/g;
const ROLE_NOISE =
  /\b(Accumulator|Arbitrage|Momentum|Mean Reversion(?: \/ Fees)?|AMM(?: \/ LP)?|token_accumulation|amm_liquidity|cross_venue_arb|breakout_snipe|mean_reversion_fees|Commander)\b/gi;
const SECRET_KEYS = /seed|private|secret|password|mnemonic|wallet|address|amm_account|quote_issuer/i;

let pool;

function getAimPool() {
  if (!hasIndexerDatabase()) return null;
  if (!pool) pool = new pg.Pool(postgresPoolOptions(process.env.DATABASE_URL || process.env.POSTGRES_URL || ""));
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
  const m = /^agent(\d+)$/i.exec(id);
  return m ? `agent${m[1]}` : "agent";
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function aimStatusPayload() {
  const db = getAimPool();
  if (!db) {
    return {
      status: 503,
      body: {
        ok: false,
        error: "AIM database unavailable",
        hint: "Set DATABASE_URL on the dashboard deploy to the indexer Postgres public URL.",
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
        from: publicAgentId(r.from_agent) === "agent" ? scrubText(r.from_agent) : publicAgentId(r.from_agent),
        to: publicAgentId(r.to_agent) === "agent" ? scrubText(r.to_agent) : publicAgentId(r.to_agent),
        from_label: agentLabel(r.from_agent === "dashboard" ? "dashboard" : r.from_agent),
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
    if (postgresTemporarilyDown(error)) {
      return { status: 503, body: postgresOutageBody() };
    }
    return { status: 500, body: { ok: false, error: "Failed to load AIM status" } };
  }
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

export async function aimChatPayload(req) {
  const db = getAimPool();
  if (!db) {
    return {
      status: 503,
      body: { ok: false, error: "AIM database unavailable" },
    };
  }
  try {
    const body = await readJson(req);
    const text = scrubText(String(body.message || body.text || "").trim()).slice(0, 2000);
    if (!text) return { status: 400, body: { ok: false, error: "Message required" } };

    await db.query(
      `INSERT INTO aim_agent_messages (from_agent, to_agent, topic, body)
       VALUES ('dashboard', 'commander', 'chat', $1::jsonb)`,
      [JSON.stringify({ type: "user_chat", text })]
    );

    const hb = await db.query(
      `SELECT status, last_seen_at, meta FROM aim_agent_heartbeats WHERE agent_id = 'commander'`
    );
    const row = hb.rows[0];
    const statusLine = row
      ? `Commander is ${scrubText(row.status)} (last seen ${row.last_seen_at?.toISOString?.() || row.last_seen_at}).`
      : "Commander heartbeat not found yet.";
    const indexer = row?.meta?.last_indexer;
    const extra = indexer?.status_code
      ? ` Latest indexer probe: HTTP ${indexer.status_code}.`
      : " Agents remain in observe-only mode.";

    const reply = {
      type: "commander_status",
      text: `${statusLine}${extra} Your note was queued on the command bus (no trading).`,
    };

    await db.query(
      `INSERT INTO aim_agent_messages (from_agent, to_agent, topic, body)
       VALUES ('commander', 'dashboard', 'chat', $1::jsonb)`,
      [JSON.stringify(reply)]
    );

    return {
      status: 200,
      body: {
        ok: true,
        reply: {
          from: "commander",
          from_label: "Commander",
          body: reply,
          created_at: new Date().toISOString(),
        },
      },
    };
  } catch (error) {
    if (postgresTemporarilyDown(error)) {
      return { status: 503, body: postgresOutageBody() };
    }
    return { status: 500, body: { ok: false, error: "Failed to post AIM chat" } };
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

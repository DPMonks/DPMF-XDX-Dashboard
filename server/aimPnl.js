import { isAimAdminWallet } from "../src/constants/ledger.js";
import {
  AIM_PNL_RECENT_HOURS,
  AIM_PNL_TOTAL_HOURS,
  clampPnlLimit,
  normalizePnlSummary,
  normalizeRecentTrades,
} from "../src/aimPnlFormat.js";

/**
 * Admin-only proxy to aim-commander realized PnL (DPMonks/AI-Matrix).
 * The browser calls this dashboard. The desk token stays in server env:
 *   AIM_DESK_BASE_URL or AIM_BASE_URL  aim-commander origin only
 *   AIM_ADMIN_TOKEN                    sent as X-AIM-Admin-Token, never to the client
 * Upstream:
 *   GET /aim/realized-pnl/recent?limit=50&since=<ISO-8601>
 *   GET /aim/realized-pnl/totals?hours=24
 * No Vercel database. Empty/unconfigured responses stay JSON and cache-private.
 */

export const AIM_PNL_RECENT_PATH = "/api/aim/admin/pnl/recent";
export const AIM_PNL_SUMMARY_PATH = "/api/aim/admin/pnl/summary-24h";
export const DESK_PNL_RECENT_PATH = "/aim/realized-pnl/recent";
export const DESK_PNL_TOTALS_PATH = "/aim/realized-pnl/totals";

const DESK_TIMEOUT_MS = 12_000;

export function aimPnlRoute(pathname) {
  const path = String(pathname || "").split("?")[0];
  if (path === AIM_PNL_RECENT_PATH) return "recent";
  if (path === AIM_PNL_SUMMARY_PATH) return "summary";
  return null;
}

export function aimDeskBaseUrl(env = process.env) {
  const raw = String(
    env.AIM_DESK_BASE_URL || env.AIM_COMMANDER_URL || env.AIM_BASE_URL || ""
  ).trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function aimAdminToken(env = process.env) {
  const raw = String(env.AIM_ADMIN_TOKEN || env.AIM_DESK_ADMIN_TOKEN || "").trim();
  if (!raw || /[\r\n]/.test(raw)) return "";
  return raw;
}

function headerValue(req, name) {
  const headers = req?.headers || {};
  const lower = name.toLowerCase();
  let value;
  if (typeof headers.get === "function") value = headers.get(lower) || headers.get(name);
  else value = headers[lower] ?? headers[name];
  if (Array.isArray(value)) value = value[0];
  return String(value || "");
}

export function walletFromAimRequest(req) {
  const header = headerValue(req, "x-aim-wallet");
  let queryWallet = req?.query?.wallet;
  if (queryWallet == null || queryWallet === "") {
    try {
      queryWallet = new URL(req?.url || "/", "http://localhost").searchParams.get("wallet");
    } catch {
      queryWallet = "";
    }
  }
  return header || String(queryWallet || "");
}

export function readPnlLimit(req) {
  try {
    const fromUrl = new URL(req?.url || "/", "http://localhost").searchParams.get("limit");
    return clampPnlLimit(req?.query?.limit ?? fromUrl ?? 50);
  } catch {
    return clampPnlLimit(req?.query?.limit ?? 50);
  }
}

export function pnlSinceIso(now, hours = AIM_PNL_RECENT_HOURS) {
  const end = now instanceof Date ? now : new Date(now || Date.now());
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  return start.toISOString();
}

function deskHeaders(env) {
  const headers = { Accept: "application/json" };
  const token = aimAdminToken(env);
  if (token) headers["X-AIM-Admin-Token"] = token;
  return headers;
}

function unconfiguredBody(kind) {
  const base = {
    ok: false,
    configured: false,
    available: false,
    code: "AIM_PNL_UNCONFIGURED",
  };
  if (kind === "summary") {
    return { ...base, total_earned_usd: null, trade_count: 0, by_agent: [], window_start: null, window_end: null };
  }
  return { ...base, trades: [] };
}

function unavailableBody(kind) {
  const base = {
    ok: false,
    configured: true,
    available: false,
    code: "AIM_PNL_UNAVAILABLE",
  };
  if (kind === "summary") {
    return { ...base, total_earned_usd: null, trade_count: 0, by_agent: [], window_start: null, window_end: null };
  }
  return { ...base, trades: [] };
}

async function readResponseJson(res) {
  if (typeof res?.text === "function") {
    const text = await res.text();
    if (!text) return {};
    return JSON.parse(text);
  }
  if (typeof res?.json === "function") return res.json();
  return {};
}

async function fetchDesk(kind, req, deps) {
  const env = deps.env || process.env;
  const base = aimDeskBaseUrl(env);
  const token = aimAdminToken(env);
  if (!base || !token) return { status: 200, body: unconfiguredBody(kind) };
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const now = deps.now ? deps.now() : new Date();
  const limit = kind === "recent" ? readPnlLimit(req) : null;
  const since = pnlSinceIso(now, AIM_PNL_RECENT_HOURS);
  const path =
    kind === "recent"
      ? `${DESK_PNL_RECENT_PATH}?${new URLSearchParams({ limit: String(limit), since })}`
      : `${DESK_PNL_TOTALS_PATH}?${new URLSearchParams({ hours: String(AIM_PNL_TOTAL_HOURS) })}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DESK_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${base}${path}`, {
      method: "GET",
      headers: deskHeaders(env),
      redirect: "error",
      signal: ctrl.signal,
    });
    if (res.status === 404) return { status: 200, body: unavailableBody(kind) };
    if (res.status === 401 || res.status === 403) {
      return {
        status: 502,
        body: { ok: false, code: "AIM_PNL_DESK_FORBIDDEN", error: "Desk refused the profit feed" },
      };
    }
    let payload = null;
    try {
      payload = await readResponseJson(res);
    } catch {
      payload = null;
    }
    if (!res.ok || !payload || typeof payload !== "object") {
      return { status: 502, body: { ok: false, code: "AIM_PNL_UPSTREAM", error: "Could not load team profit" } };
    }
    const generated_at = now.toISOString();
    if (kind === "recent") {
      return {
        status: 200,
        body: {
          ok: true,
          configured: true,
          available: true,
          trades: normalizeRecentTrades(payload, limit),
          since,
          generated_at,
        },
      };
    }
    const summary = normalizePnlSummary(payload);
    if (!summary.window_start) summary.window_start = pnlSinceIso(now, AIM_PNL_TOTAL_HOURS);
    if (!summary.window_end) summary.window_end = generated_at;
    return {
      status: 200,
      body: {
        ok: true,
        configured: true,
        available: true,
        ...summary,
        generated_at,
      },
    };
  } catch {
    return { status: 502, body: { ok: false, code: "AIM_PNL_UPSTREAM", error: "Could not load team profit" } };
  } finally {
    clearTimeout(timer);
  }
}

function adminGate(req) {
  if (req?.method && req.method !== "GET") {
    return { status: 405, body: { ok: false, error: "GET only", code: "AIM_PNL_METHOD" } };
  }
  if (!isAimAdminWallet(walletFromAimRequest(req))) {
    return { status: 403, body: { ok: false, error: "Admin only", code: "AIM_PNL_FORBIDDEN" } };
  }
  return null;
}

export async function aimPnlRecentPayload(req, deps = {}) {
  const denied = adminGate(req);
  if (denied) return denied;
  return fetchDesk("recent", req, deps);
}

export async function aimPnlSummaryPayload(req, deps = {}) {
  const denied = adminGate(req);
  if (denied) return denied;
  return fetchDesk("summary", req, deps);
}

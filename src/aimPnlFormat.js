/** Shared AIM admin PnL shapes, London labels, and empty-state copy. */

export const AIM_PNL_POLL_MS = 30_000;
export const AIM_PNL_EMPTY = "No profitable fills recorded yet";
export const AIM_PNL_DEFAULT_LIMIT = 50;
export const AIM_PNL_MAX_LIMIT = 50;

const LONDON = {
  timeZone: "Europe/London",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
};

export function clampPnlLimit(value, fallback = AIM_PNL_DEFAULT_LIMIT) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(AIM_PNL_MAX_LIMIT, Math.max(1, Math.floor(n)));
}

export function asMoney(value) {
  if (typeof value === "string") value = value.replace(/[$,\s]/g, "").trim();
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function asCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function asText(value, max = 80) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.slice(0, max);
}

function asIso(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString();
}

function asTxHash(value) {
  const text = String(value ?? "").trim();
  return /^[A-Fa-f0-9]{64}$/.test(text) ? text : "";
}

export function formatLondonStamp(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", LONDON).format(d);
}

export function formatLondonWindow(start, end) {
  const a = formatLondonStamp(start);
  const b = formatLondonStamp(end);
  if (a && b) return `${a} to ${b}`;
  return a || b || "";
}

export function formatUsd(value) {
  const n = asMoney(value);
  if (n == null) return "n/a";
  const body = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  if (n > 0) return `+$${body}`;
  if (n < 0) return `-$${body}`;
  return `$${body}`;
}

export function fillCountLabel(count) {
  const n = asCount(count);
  if (n == null) return "";
  return `${n} profitable ${n === 1 ? "fill" : "fills"}`;
}

export function aimPnlStatusMessage({
  configured = true,
  available = true,
  code = "",
  error = false,
} = {}) {
  if (configured === false || code === "AIM_PNL_UNCONFIGURED") {
    return "Desk profit feed is not connected yet.";
  }
  if (available === false || code === "AIM_PNL_UNAVAILABLE") {
    return "Profit feed is not available yet.";
  }
  if (code === "AIM_PNL_DESK_FORBIDDEN") return "Desk refused the profit feed.";
  if (code === "AIM_PNL_FORBIDDEN") return "Admin only.";
  if (error || code) return "Could not load team profit just now.";
  return "";
}

function tradeTime(row) {
  const t = new Date(row?.created_at || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function normalizeRecentTrades(payload, limit = AIM_PNL_DEFAULT_LIMIT) {
  const cap = clampPnlLimit(limit);
  const rows = Array.isArray(payload?.trades) ? payload.trades : [];
  const cleaned = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const realized = asMoney(row.realized_pnl_usd);
    if (realized == null || realized <= 0) continue;
    const created_at = asIso(row.created_at);
    cleaned.push({
      id: asText(row.id, 80) || `${created_at || "fill"}-${cleaned.length}`,
      created_at,
      agent: asText(row.agent, 40),
      pair: asText(row.pair, 40),
      realized_pnl_usd: realized,
      tx_hash: asTxHash(row.tx_hash),
    });
  }
  cleaned.sort((a, b) => tradeTime(b) - tradeTime(a));
  return cleaned.slice(0, cap);
}

export function normalizeByAgent(raw) {
  const rows = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const realized = asMoney(row.realized_pnl_usd ?? row.total_earned_usd ?? row.usd);
      if (realized == null) continue;
      rows.push({
        agent: asText(row.agent || row.id, 40),
        realized_pnl_usd: realized,
        trade_count: asCount(row.trade_count),
      });
    }
  } else if (raw && typeof raw === "object") {
    for (const [agent, value] of Object.entries(raw)) {
      if (value && typeof value === "object") {
        const realized = asMoney(value.realized_pnl_usd ?? value.total_earned_usd ?? value.usd);
        if (realized == null) continue;
        rows.push({
          agent: asText(agent, 40),
          realized_pnl_usd: realized,
          trade_count: asCount(value.trade_count),
        });
      } else {
        const realized = asMoney(value);
        if (realized == null) continue;
        rows.push({ agent: asText(agent, 40), realized_pnl_usd: realized, trade_count: null });
      }
    }
  }
  rows.sort((a, b) => b.realized_pnl_usd - a.realized_pnl_usd);
  return rows;
}

export function normalizePnlSummary(payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  return {
    total_earned_usd: asMoney(body.total_earned_usd),
    trade_count: asCount(body.trade_count),
    by_agent: normalizeByAgent(body.by_agent),
    window_start: asIso(body.window_start),
    window_end: asIso(body.window_end),
  };
}

export function profitableTrades(rows) {
  return normalizeRecentTrades({ trades: rows }, AIM_PNL_MAX_LIMIT);
}

export function interpretPnlRecent(data) {
  if (!data || data.configured === false || data.code === "AIM_PNL_UNCONFIGURED") {
    return { phase: "unconfigured", trades: [], note: aimPnlStatusMessage({ configured: false }) };
  }
  if (data.available === false || data.code === "AIM_PNL_UNAVAILABLE") {
    return { phase: "unavailable", trades: [], note: aimPnlStatusMessage({ available: false }) };
  }
  const trades = profitableTrades(data.trades);
  return {
    phase: "ready",
    trades,
    note: trades.length ? "" : AIM_PNL_EMPTY,
    updatedAt: data.generated_at || null,
  };
}

export function interpretPnlSummary(data) {
  if (!data || data.configured === false || data.code === "AIM_PNL_UNCONFIGURED") {
    return { phase: "unconfigured", summary: null, note: aimPnlStatusMessage({ configured: false }) };
  }
  if (data.available === false || data.code === "AIM_PNL_UNAVAILABLE") {
    return { phase: "unavailable", summary: null, note: aimPnlStatusMessage({ available: false }) };
  }
  const summary = normalizePnlSummary(data);
  const count = summary.trade_count ?? 0;
  return {
    phase: "ready",
    summary,
    note: count > 0 ? "" : AIM_PNL_EMPTY,
    updatedAt: data.generated_at || null,
  };
}

export function keepPnlOnError(prev, err) {
  const note = aimPnlStatusMessage({ code: err?.code, error: true });
  if (prev?.phase === "ready") return { ...prev, staleNote: note };
  if (prev?.trades) return { phase: "error", trades: [], summary: null, note };
  return { phase: "error", trades: [], summary: prev?.summary || null, note };
}

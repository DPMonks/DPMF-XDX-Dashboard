import { extractClassicAddress } from "../constants/ledger.js";

export async function getAimStatus() {
  const res = await fetch("/api/aim/status", { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AIM status failed (${res.status})`);
  return data;
}

export async function getAimLocale() {
  const res = await fetch("/api/aim/locale", { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AIM locale failed (${res.status})`);
  return data;
}

/**
 * Ephemeral Commander chat. Pass classic `r…` address only (never seeds).
 * Server prefers an explicit r… in the message, else wallet/account/address.
 * Optional chart_context: live HybridChart snapshot (pair/TF/tools/MA/overlays).
 */

/** Normalize a connected classic r… for AIM chat body (never seeds). */
export function classicAimWallet(...candidates) {
  for (const raw of candidates) {
    const classic = extractClassicAddress(raw);
    if (classic) return classic;
  }
  return null;
}

export async function postAimChat(
  message,
  {
    lang = "auto",
    wallet = null,
    account = null,
    address = null,
    chart_context = null,
    chartContext = null,
    pending_chart_action = null,
    command_topic = null,
  } = {}
) {
  const classic = classicAimWallet(wallet, account, address);
  const payload = { message, lang };
  // Always include wallet fields when a classic address is available (required for admin Teach).
  if (classic) {
    payload.wallet = classic;
    payload.account = classic;
    payload.address = classic;
    payload.walletAddress = classic;
  }
  const snap = chart_context || chartContext;
  if (snap && typeof snap === "object") {
    payload.chart_context = snap;
  }
  if (pending_chart_action && typeof pending_chart_action === "object") {
    payload.pending_chart_action = pending_chart_action;
  }
  if (command_topic) payload.command_topic = String(command_topic);
  const res = await fetch("/api/aim/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AIM chat failed (${res.status})`);
  return data;
}

async function getAimAdminPnl(path, wallet) {
  const res = await fetch(path, {
    headers: {
      Accept: "application/json",
      "X-Aim-Wallet": wallet || "",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `AIM profit failed (${res.status})`);
    err.code = data.code || (res.status === 403 ? "AIM_PNL_FORBIDDEN" : "AIM_PNL_UPSTREAM");
    throw err;
  }
  return data;
}

/** Admin-only. Same-origin proxy; the desk bearer never leaves the server. */
export function getAimAdminPnlRecent(wallet, { limit = 50 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  return getAimAdminPnl(`/api/aim/admin/pnl/recent?${params}`, wallet);
}

/** Admin-only team total for the rolling 24h window. */
export function getAimAdminPnlSummary(wallet) {
  return getAimAdminPnl("/api/aim/admin/pnl/summary-24h", wallet);
}

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
const CLASSIC_ADDR_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

/** Normalize a connected classic r… for AIM chat body (never seeds). */
export function classicAimWallet(...candidates) {
  for (const raw of candidates) {
    const classic = String(raw || "").trim();
    if (classic && CLASSIC_ADDR_RE.test(classic)) return classic;
  }
  return null;
}

export async function postAimChat(
  message,
  { lang = "auto", wallet = null, account = null, address = null, chart_context = null, chartContext = null } = {}
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
  const res = await fetch("/api/aim/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AIM chat failed (${res.status})`);
  return data;
}

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
 */
export async function postAimChat(message, { lang = "auto", wallet = null, account = null, address = null } = {}) {
  const classic =
    String(wallet || account || address || "").trim() || null;
  const payload = { message, lang };
  if (classic && /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(classic)) {
    payload.wallet = classic;
    payload.account = classic;
    payload.address = classic;
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

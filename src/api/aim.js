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

export async function postAimChat(message, { lang = "auto" } = {}) {
  const res = await fetch("/api/aim/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ message, lang }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AIM chat failed (${res.status})`);
  return data;
}

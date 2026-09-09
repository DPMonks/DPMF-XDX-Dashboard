export async function getAimStatus() {
  const res = await fetch("/api/aim/status", { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AIM status failed (${res.status})`);
  return data;
}

export async function postAimChat(message) {
  const res = await fetch("/api/aim/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AIM chat failed (${res.status})`);
  return data;
}

const PENDING_KEY = "dpmf-xaman-pending";
const RETURN_PARAMS = ["xaman", "payload", "payload_uuid"];

export function isPayloadUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

export function xamanReturnUrl(origin) {
  const web = String(origin || "https://xdx-exchange.dpmf.technology").replace(/\/$/, "");
  return `${web}/?xaman={id}`;
}

export function xamanWebsocketUrl(uuid) {
  const id = String(uuid || "").trim();
  return id ? `wss://xumm.app/sign/${encodeURIComponent(id)}` : "";
}

export function rememberPendingPayload(uuid, extra = {}) {
  const id = String(uuid || "").trim();
  if (!isPayloadUuid(id) || typeof sessionStorage === "undefined") return null;
  const record = { uuid: id, at: Date.now(), ...extra };
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(record));
  } catch {
    // private mode
  }
  return record;
}

export function peekPendingPayload() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!isPayloadUuid(record?.uuid)) return null;
    return record;
  } catch {
    return null;
  }
}

export function clearPendingPayload() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

export function readXamanReturnUuid(search = "") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  for (const key of RETURN_PARAMS) {
    const value = String(params.get(key) || "").trim();
    if (isPayloadUuid(value)) return value;
  }
  return null;
}

function stripXamanSearchParams() {
  if (typeof window === "undefined" || !window.location || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of RETURN_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }
}

export function takeXamanReturnUuid(
  search = typeof window !== "undefined" ? window.location.search : ""
) {
  const fromUrl = readXamanReturnUuid(search);
  if (fromUrl) {
    rememberPendingPayload(fromUrl);
    stripXamanSearchParams();
    return fromUrl;
  }
  return peekPendingPayload()?.uuid || null;
}

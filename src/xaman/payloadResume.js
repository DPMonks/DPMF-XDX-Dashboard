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

function storeOf(name) {
  try {
    const store = globalThis[name];
    if (store && typeof store.getItem === "function") return store;
  } catch {
    // private mode / blocked storage
  }
  return null;
}

function readPendingFrom(store) {
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_KEY);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (!isPayloadUuid(record?.uuid)) return null;
    return record;
  } catch {
    return null;
  }
}

function writePendingTo(store, record) {
  if (!store) return;
  try {
    if (record) store.setItem(PENDING_KEY, JSON.stringify(record));
    else store.removeItem(PENDING_KEY);
  } catch {
    // ignore storage failures
  }
}

export function rememberPendingPayload(uuid, extra = {}) {
  const id = String(uuid || "").trim();
  if (!isPayloadUuid(id)) return null;
  const record = { uuid: id, at: Date.now(), ...extra };
  writePendingTo(storeOf("sessionStorage"), record);
  writePendingTo(storeOf("localStorage"), record);
  return record;
}

export function peekPendingPayload() {
  return readPendingFrom(storeOf("sessionStorage")) || readPendingFrom(storeOf("localStorage"));
}

export function clearPendingPayload() {
  writePendingTo(storeOf("sessionStorage"), null);
  writePendingTo(storeOf("localStorage"), null);
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

export function writeXamanSearchParam(uuid) {
  const id = String(uuid || "").trim();
  if (!isPayloadUuid(id) || typeof window === "undefined" || !window.location || !window.history?.replaceState) {
    return;
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("xaman") === id) return;
    for (const key of RETURN_PARAMS) url.searchParams.delete(key);
    url.searchParams.set("xaman", id);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore history failures
  }
}

export function markXamanReturn(uuid, extra = {}) {
  const record = rememberPendingPayload(uuid, extra);
  if (record) writeXamanSearchParam(record.uuid);
  return record;
}

export function peekXamanUuid(
  search = typeof window !== "undefined" ? window.location.search : ""
) {
  return readXamanReturnUuid(search) || peekPendingPayload()?.uuid || null;
}

export function takeXamanReturnUuid(
  search = typeof window !== "undefined" ? window.location.search : ""
) {
  const id = peekXamanUuid(search);
  if (id) rememberPendingPayload(id);
  return id;
}

export function clearXamanReturn() {
  clearPendingPayload();
  stripXamanSearchParams();
}

const PENDING_KEY = "fuzion-xaman-pending";
const RETURN_PARAMS = ["xaman", "payload", "payload_uuid"];

export function isPayloadUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function storeOf(name) {
  try {
    const store = globalThis[name];
    if (store && typeof store.getItem === "function") return store;
  } catch {
    return null;
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

export function peekXamanUuid(
  search = typeof window !== "undefined" ? window.location.search : ""
) {
  return readXamanReturnUuid(search) || peekPendingPayload()?.uuid || null;
}

export function shouldFinishXamanPoll(resp) {
  const http = Number(resp?.status || 0);
  const status = String(resp?.data?.status || "");
  if (status === "completed" && resp?.data?.executed !== false) return "done";
  if (status === "pending" || status === "confirming") return "wait";
  if (["cancelled", "expired", "failed", "rejected"].includes(status)) return "fail";
  if (http === 202) return "wait";
  if (http === 200 && status === "completed") return "done";
  if (http === 409 || http === 400) return "fail";
  if (http >= 500 || http === 429 || http === 0) return "wait";
  return "wait";
}

export function isXamanStillOpen(resp) {
  return shouldFinishXamanPoll(resp) === "wait";
}

export function onXamanWake(callback) {
  if (typeof window === "undefined" || typeof callback !== "function") {
    return () => {};
  }
  const wake = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    callback();
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("pageshow", wake);
  window.addEventListener("focus", wake);
  return () => {
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("pageshow", wake);
    window.removeEventListener("focus", wake);
  };
}

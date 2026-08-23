const PENDING_KEY = "dpmf-xaman-pending";
const CONSUMED_KEY = "dpmf-xaman-consumed";
const CONSUMED_MAX = 40;
const RETURN_PARAMS = ["xaman", "payload", "payload_uuid"];
export const TRADE_CLAIM_TX = new Set([
  "Payment",
  "OfferCreate",
  "AMMDeposit",
  "AMMWithdraw",
  "AMMVote",
  "AMMCreate",
]);

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
  const current = peekPendingPayload();
  const record =
    current?.uuid === id
      ? { ...current, ...extra, uuid: id, at: Date.now() }
      : { uuid: id, at: Date.now(), ...extra };
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
  const fromUrl = readXamanReturnUuid(search);
  const fromStore = peekPendingPayload()?.uuid || null;
  if (fromUrl && fromStore && fromUrl !== fromStore) return fromStore;
  return fromUrl || fromStore || null;
}

function readConsumedFrom(store) {
  if (!store) return [];
  try {
    const raw = store.getItem(CONSUMED_KEY);
    if (!raw) return [];
    const rows = JSON.parse(raw);
    return (Array.isArray(rows) ? rows : [])
      .map((value) => String(value || "").trim().toLowerCase())
      .filter((value) => isPayloadUuid(value));
  } catch {
    return [];
  }
}

function writeConsumedTo(store, rows) {
  if (!store) return;
  try {
    if (!rows?.length) store.removeItem(CONSUMED_KEY);
    else store.setItem(CONSUMED_KEY, JSON.stringify(rows));
  } catch {
    // ignore storage failures
  }
}

function readConsumed() {
  const fromSession = readConsumedFrom(storeOf("sessionStorage"));
  const fromLocal = readConsumedFrom(storeOf("localStorage"));
  const seen = new Set();
  const merged = [];
  for (const id of [...fromSession, ...fromLocal]) {
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}

export function rememberConsumedUuid(uuid) {
  const id = String(uuid || "").trim().toLowerCase();
  if (!isPayloadUuid(id)) return [];
  const next = [id, ...readConsumed().filter((value) => value !== id)].slice(0, CONSUMED_MAX);
  writeConsumedTo(storeOf("sessionStorage"), next);
  writeConsumedTo(storeOf("localStorage"), next);
  return next;
}

export function isConsumedUuid(uuid) {
  const id = String(uuid || "").trim().toLowerCase();
  return isPayloadUuid(id) && readConsumed().includes(id);
}

export function clearConsumedUuids() {
  writeConsumedTo(storeOf("sessionStorage"), []);
  writeConsumedTo(storeOf("localStorage"), []);
}

export function payloadTxType(payload) {
  if (!payload || typeof payload !== "object") return "";
  return String(
    payload.payload?.tx_type ||
      payload.payload?.request_json?.TransactionType ||
      payload.tx_type ||
      payload.txjson?.TransactionType ||
      ""
  ).trim();
}

export function payloadResolvedAtMs(payload) {
  const raw =
    payload?.meta?.resolved_at ||
    payload?.resolved_at ||
    payload?.meta?.signed_at ||
    payload?.signed_at ||
    "";
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function payloadMatchesPendingTrade(record, payload) {
  if (!record?.watchTrade || !payload) return false;
  const txType = payloadTxType(payload);
  if (txType === "SignIn" || txType === "TrustSet") return false;
  if (txType && !TRADE_CLAIM_TX.has(txType)) return false;
  const expected = String(record.txjson?.TransactionType || "").trim();
  if (expected && txType && expected !== txType) return false;
  const resolvedMs = payloadResolvedAtMs(payload);
  if (resolvedMs != null && Number(record.at) > 0 && resolvedMs + 5000 < Number(record.at)) {
    return false;
  }
  return true;
}

export function canClaimExecutedTrade(uuid, record = peekPendingPayload(), payload = null) {
  const id = String(uuid || "").trim();
  if (!isPayloadUuid(id) || !record?.watchTrade) return false;
  if (record.uuid !== id) return false;
  if (isConsumedUuid(id)) return false;
  if (payload && !payloadMatchesPendingTrade(record, payload)) return false;
  return true;
}

export function shouldAutoClaimPendingTrade(
  search = typeof window !== "undefined" ? window.location.search : ""
) {
  const record = peekPendingPayload();
  const urlUuid = readXamanReturnUuid(search);
  if (!record?.watchTrade || !urlUuid || record.uuid !== urlUuid) return false;
  return !isConsumedUuid(record.uuid);
}

export function discardStalePendingTrade({ force = false, search } = {}) {
  const record = peekPendingPayload();
  if (!force && shouldAutoClaimPendingTrade(search)) return false;
  if (!record?.watchTrade && !force) return false;
  clearXamanReturn();
  return true;
}

export function takeXamanReturnUuid(
  search = typeof window !== "undefined" ? window.location.search : ""
) {
  const pending = peekPendingPayload();
  const id = peekXamanUuid(search);
  if (!id) return null;
  if (pending?.uuid === id) return id;
  rememberPendingPayload(id, pending || {});
  return id;
}

export function clearXamanReturn() {
  clearPendingPayload();
  stripXamanSearchParams();
}

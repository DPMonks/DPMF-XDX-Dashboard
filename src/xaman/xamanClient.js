import { firstOk, indexerGet, indexerPost } from "../api/indexer";

function pick(object, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, part) => acc?.[part], object);
    if (value) return value;
  }
  return null;
}

export function normalizePayload(raw) {
  if (!raw || typeof raw !== "object") return null;

  const uuid = pick(raw, ["uuid", "payload.uuid"]);
  const qr = pick(raw, ["refs.qr_png", "qr", "refs.qr"]);
  const mobileUrl = pick(raw, [
    "next.always",
    "refs.deeplink_web",
    "mobileUrl",
    "deeplink",
  ]);
  const websocket = pick(raw, [
    "refs.websocket_status",
    "websocket",
    "refs.websocket",
  ]);

  if (!uuid || !qr) return null;

  return {
    uuid,
    qr,
    mobileUrl,
    websocket,
    raw,
  };
}

export async function createPayload() {
  const raw = await firstOk([
    () => indexerPost("/api/xaman/create-payload"),
    () => indexerPost("/xaman/create-payload"),
    () => indexerPost("/api/create-xumm-payload"),
  ]);

  const payload = normalizePayload(raw);
  if (!payload) {
    throw new Error("Indexer returned an incomplete Xaman payload");
  }
  return payload;
}

export async function getPayloadResult(uuid) {
  try {
    return await firstOk([
      () => indexerGet(`/api/xaman/payload-result?uuid=${encodeURIComponent(uuid)}`),
      () => indexerGet(`/xaman/payload-result?uuid=${encodeURIComponent(uuid)}`),
    ]);
  } catch {
    return null;
  }
}

export function extractSignedAccount(result) {
  return (
    result?.response?.account ||
    result?.account ||
    result?.payload?.response?.account ||
    null
  );
}

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
  const response = await fetch("/api/xaman/create-payload", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof raw.error === "string"
        ? raw.error
        : typeof raw.detail === "string"
          ? raw.detail
          : typeof raw.message === "string"
            ? raw.message
            : Number.isFinite(Number(raw.code))
              ? `Xaman sign-in failed (${raw.code})`
              : "Failed to start Xaman sign-in";
    throw new Error(message);
  }

  const payload = normalizePayload(raw);
  if (!payload) {
    throw new Error("Xaman returned an incomplete payload");
  }
  return payload;
}

export async function getPayloadResult(uuid) {
  try {
    const response = await fetch(
      `/api/xaman/payload-result?uuid=${encodeURIComponent(uuid)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return null;
    return await response.json();
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

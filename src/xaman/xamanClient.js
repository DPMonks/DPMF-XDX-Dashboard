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
    mobileUrl: uuid ? xamanSignUrl(uuid) : mobileUrl,
    websocket,
    raw,
  };
}

export function xamanSignUrl(uuid) {
  const id = String(uuid || "").trim();
  return id ? `https://xumm.app/sign/${encodeURIComponent(id)}` : "";
}

export function xamanAppUrl(uuid) {
  const id = String(uuid || "").trim();
  return id ? `xumm://xumm.app/sign/${encodeURIComponent(id)}` : "";
}

export function launchXamanSign(
  uuid,
  {
    openWindow = typeof window !== "undefined" ? window.open.bind(window) : null,
    createFrame = typeof document !== "undefined" ? () => document.createElement("iframe") : null,
    appendNode = typeof document !== "undefined" ? (node) => document.body.appendChild(node) : null,
    removeNode = (node) => node?.remove?.(),
  } = {}
) {
  const id = String(uuid || "").trim();
  const web = xamanSignUrl(id);
  const app = xamanAppUrl(id);
  if (!id) return { opened: false, web, app };
  if (appendNode && createFrame && app) {
    const iframe = createFrame();
    iframe.src = app;
    iframe.setAttribute("hidden", "true");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;width:0;height:0;border:0;overflow:hidden";
    appendNode(iframe);
    if (typeof window !== "undefined") {
      window.setTimeout(() => removeNode(iframe), 2000);
    }
  }
  let opened = false;
  if (openWindow && web) {
    try {
      opened = Boolean(openWindow(web, "_blank", "noopener,noreferrer"));
    } catch {
      opened = false;
    }
  }
  return { opened, web, app };
}

export function isPhoneDevice(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
  extras = typeof navigator !== "undefined" ? navigator : {}
) {
  const ua = String(userAgent || "");
  if (/Android|iPhone|iPod|iPad|Mobile|Tablet/i.test(ua)) return true;
  return extras.platform === "MacIntel" && Number(extras.maxTouchPoints) > 1;
}

export async function createPayload(body = {}) {
  const response = await fetch("/api/xaman/create-payload", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body && typeof body === "object" ? body : {}),
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
  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  if (meta.resolved === true || meta.signed === true || meta.cancelled === true) {
    throw new Error("Xaman returned a payload that was already signed. Start a new sign.");
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

export function isClassicAddress(value) {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(value || "").trim());
}

export function extractSignedAccount(result) {
  const seen = new Set();
  const queue = [result];
  for (let depth = 0; queue.length && depth < 40; depth += 1) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    for (const key of ["account", "signer", "signer_account", "address"]) {
      const text = String(node[key] || "").trim();
      if (isClassicAddress(text)) return text;
    }
    for (const child of [node.response, node.payload, node.meta, node.data]) {
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return null;
}

export function payloadLooksSigned(result) {
  if (!result || typeof result !== "object") return false;
  if (extractSignedAccount(result)) return true;
  if (result.meta?.signed === true || result.signed === true) return true;
  if (result.meta?.resolved === true && result.meta?.cancelled !== true) {
    return Boolean(result.response?.hex || result.response?.account);
  }
  return false;
}

export async function getLedgerTx(hash) {
  const id = String(hash || "").trim();
  if (!/^[A-Fa-f0-9]{64}$/.test(id)) return null;
  try {
    const response = await fetch(`/api/xaman/tx-status?hash=${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

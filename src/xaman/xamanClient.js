import { isXappHost, openXappSignRequest } from "./xappHost.js";

function pick(object, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, part) => acc?.[part], object);
    if (value) return value;
  }
  return null;
}

export function payloadQrUrl(uuid, fallback = "") {
  const fromApi = String(fallback || "").trim();
  if (fromApi) return fromApi;
  const id = String(uuid || "").trim();
  return id ? `https://xumm.app/sign/${encodeURIComponent(id)}_q.png` : "";
}

export function normalizePayload(raw) {
  if (!raw || typeof raw !== "object") return null;

  const uuid = pick(raw, ["uuid", "payload.uuid"]);
  const qr = payloadQrUrl(uuid, pick(raw, ["refs.qr_png", "qr", "refs.qr"]));
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
    mobileUrl: xamanAppUrl(uuid) || mobileUrl,
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
    createFrame = typeof document !== "undefined" ? () => document.createElement("iframe") : null,
    appendNode = typeof document !== "undefined" ? (node) => document.body.appendChild(node) : null,
    removeNode = (node) => node?.remove?.(),
    userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
    assignLocation = null,
  } = {}
) {
  const id = String(uuid || "").trim();
  const web = xamanSignUrl(id);
  const app = xamanAppUrl(id);
  if (!id) return { opened: false, web, app };
  if (isXappHost()) {
    return { opened: openXappSignRequest(id), web, app, xapp: true };
  }
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
  if (isInAppBrowser(userAgent) && app) {
    const navigateApp =
      assignLocation ||
      (typeof window !== "undefined" ? (href) => window.location.assign(href) : null);
    if (navigateApp) {
      try {
        navigateApp(app);
        opened = true;
      } catch {
        opened = false;
      }
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

export function isInAppBrowser(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : ""
) {
  return /Twitter|TwitterAndroid|\bX\/|FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Snapchat|TikTok|Bytedance|Pinterest|LinkedInApp|GSA\//i.test(
    String(userAgent || "")
  );
}

export async function createPayload(body = {}) {
  const request = body && typeof body === "object" ? body : {};
  const response = await fetch("/api/xaman/create-payload", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...request,
      options: {
        ...request.options,
        ...(isXappHost() ? { xapp: true } : {}),
      },
    }),
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
  const account = String(
    result?.response?.account ||
      result?.response?.signer ||
      result?.payload?.response?.account ||
      result?.payload?.response?.signer ||
      ""
  ).trim();
  return isClassicAddress(account) ? account : null;
}

export function payloadResolvedAtMs(result) {
  const raw = result?.response?.resolved_at || result?.meta?.resolved_at || result?.meta?.signed_at || "";
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function isReusableUnsignedPayload(result) {
  if (!result || typeof result !== "object") return false;
  const meta = result.meta && typeof result.meta === "object" ? result.meta : {};
  if (meta.signed === true || meta.resolved === true || meta.cancelled === true || meta.expired === true) {
    return false;
  }
  return !payloadLooksSigned(result);
}

export function payloadLooksSigned(result) {
  if (!result || typeof result !== "object") return false;
  const meta = result.meta && typeof result.meta === "object" ? result.meta : {};
  if (meta.cancelled === true || meta.expired === true) return false;
  if (meta.signed === true || result.signed === true) return true;
  const signed = extractSignedAccount(result);
  return Boolean(signed && (result.response?.hex || result.response?.txid || result.response?.dispatched_result));
}

export function payloadSignedThisSession(result, startedAt) {
  if (!payloadLooksSigned(result)) return false;
  const resolved = payloadResolvedAtMs(result);
  if (resolved != null && Number(startedAt) > 0 && resolved + 2500 < Number(startedAt)) return false;
  return true;
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

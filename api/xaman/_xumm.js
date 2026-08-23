const AUTH_CODES = new Set([810, 811, 812, 813]);

export function cleanCredential(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export function xummCredential(...names) {
  for (const name of names) {
    const value = cleanCredential(process.env[name]);
    if (value) return value;
  }
  return "";
}

export function xummKey() {
  return xummCredential("XUMM_API_KEY", "XUMM_APIKEY", "VITE_XUMM_API_KEY", "VITE_XUMM_APIKEY");
}

export function xummSecret() {
  return xummCredential(
    "XUMM_API_SECRET",
    "XUMM_APISECRET",
    "VITE_XUMM_API_SECRET",
    "VITE_XUMM_APISECRET"
  );
}

export function xummConfigured() {
  return {
    key: Boolean(xummKey()),
    secret: Boolean(xummSecret()),
  };
}

export function requestOrigin(req) {
  const headers = req?.headers || {};
  const proto = String(headers["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();
  const host = String(headers["x-forwarded-host"] || headers.host || "")
    .split(",")[0]
    .trim();
  if (!host) return "https://xdx-exchange.dpmf.technology";
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function shouldSubmitTxjson(txjson) {
  const type = txjson?.TransactionType;
  return Boolean(type && type !== "SignIn");
}

export function buildXamanPayload(origin, txjson, options = {}) {
  const web = String(origin || "https://xdx-exchange.dpmf.technology").replace(
    /\/$/,
    ""
  );
  const tx = txjson && typeof txjson === "object" ? txjson : { TransactionType: "SignIn" };
  return {
    txjson: tx,
    options: {
      submit: options.submit ?? shouldSubmitTxjson(tx),
      expire: options.expire ?? 5,
      return_url: {
        // App-only: identical web+app URLs make Xaman steal the current
        // browser tab and show their hosted sign-in page.
        app: web,
      },
    },
  };
}

export function buildSignInPayload(origin, txjson) {
  return buildXamanPayload(origin, txjson || { TransactionType: "SignIn" }, { submit: false });
}

export function buildTrustSetPayload(origin, txjson) {
  return buildXamanPayload(origin, txjson, { submit: true });
}

export function xamanErrorMessage(raw, fallback = "Failed to start Xaman sign-in") {
  if (typeof raw === "string" && raw && raw !== "[object Object]") return raw;
  if (typeof raw?.error === "string" && raw.error) return raw.error;
  if (typeof raw?.detail === "string" && raw.detail) return raw.detail;
  if (typeof raw?.message === "string" && raw.message) return raw.message;
  if (typeof raw?.error?.message === "string" && raw.error.message) {
    const nested = raw.error.message;
    if (nested && nested !== "[object Object]") return nested;
  }
  const code = Number(raw?.error?.code ?? raw?.code);
  if (code === 603) {
    return "Xaman could not build this transaction (603). The amounts must be valid XRPL values — try again with a smaller, rounded size.";
  }
  if (AUTH_CODES.has(code)) {
    const configured = xummConfigured();
    if (!configured.key || !configured.secret) {
      return "Xaman API keys are missing on this host. Set XUMM_API_KEY and XUMM_API_SECRET on Vercel Production (no VITE_ prefix on the secret).";
    }
    return "Xaman rejected the app keys. Check XUMM_API_KEY and XUMM_API_SECRET on Vercel Production, and add https://xdx-exchange.dpmf.technology plus the Vercel host as Xaman return URLs.";
  }
  if (Number.isFinite(code)) return `Xaman sign-in failed (${code})`;
  return fallback;
}

export function xummHeaders(origin) {
  const key = xummKey();
  const secret = xummSecret();
  if (!key || !secret) {
    throw new Error("XUMM_API_KEY and XUMM_API_SECRET are not configured on the dashboard");
  }
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "DPMF-XDX-Dashboard/1.0",
    "x-api-key": key,
    "x-api-secret": secret,
  };
  if (origin) {
    headers.Origin = origin;
    headers.Referer = `${origin}/`;
  }
  return headers;
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

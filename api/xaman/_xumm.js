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

export function buildSignInPayload(origin, txjson) {
  const web = String(origin || "https://xdx-exchange.dpmf.technology").replace(
    /\/$/,
    ""
  );
  return {
    txjson: txjson && typeof txjson === "object" ? txjson : { TransactionType: "SignIn" },
    options: {
      submit: false,
      expire: 5,
      return_url: {
        web,
        app: web,
      },
    },
  };
}

export function xamanErrorMessage(raw, fallback = "Failed to start Xaman sign-in") {
  if (typeof raw === "string" && raw && raw !== "[object Object]") return raw;
  if (typeof raw?.error === "string" && raw.error) return raw.error;
  if (typeof raw?.detail === "string" && raw.detail) return raw.detail;
  if (typeof raw?.message === "string" && raw.message) return raw.message;
  const code = Number(raw?.error?.code ?? raw?.code);
  if (AUTH_CODES.has(code)) {
    return "Xaman rejected the app keys. Check XUMM_API_KEY and XUMM_API_SECRET on Vercel Production, and add this site as a Xaman return URL.";
  }
  if (Number.isFinite(code)) return `Xaman sign-in failed (${code})`;
  return fallback;
}

export function xummHeaders(origin) {
  const key = xummCredential("XUMM_API_KEY", "VITE_XUMM_API_KEY");
  const secret = xummCredential("XUMM_API_SECRET", "VITE_XUMM_API_SECRET");
  if (!key || !secret) {
    throw new Error("XUMM_API_KEY and XUMM_API_SECRET are not configured on the dashboard");
  }
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
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

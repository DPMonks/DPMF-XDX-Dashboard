export function xummHeaders() {
  const key = process.env.XUMM_API_KEY || process.env.VITE_XUMM_API_KEY;
  const secret = process.env.XUMM_API_SECRET || process.env.VITE_XUMM_API_SECRET;
  if (!key || !secret) {
    throw new Error("XUMM_API_KEY and XUMM_API_SECRET are not configured on the dashboard");
  }
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-Key": key,
    "X-API-Secret": secret,
  };
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

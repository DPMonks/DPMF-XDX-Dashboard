export const FUZION_ORIGIN = "https://fuzion-xio.dpmf.technology";
export const FUZION_ASSET_LISTINGS_URL = `${FUZION_ORIGIN}/api/asset-listings`;
export const FUZION_GENERIC_LOGO = `${FUZION_ORIGIN}/default-token-logo.png`;
export const FUZION_XRP_LOGO = `${FUZION_ORIGIN}/xrp-logo.png`;

const LIST_MS = 10 * 60_000;
let cache = { at: 0, body: null };

export function resetFuzionAssetCache() {
  cache = { at: 0, body: null };
}

export function fuzionLogoUrl(logoUrl) {
  const text = String(logoUrl || "").trim();
  if (!text || text === "/logo.png") return "";
  if (text.startsWith("data:") || /^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return `${FUZION_ORIGIN}${text}`;
  return "";
}

export function indexFuzionListings(payload) {
  const map = new Map();
  const rows = Array.isArray(payload?.listings) ? payload.listings : Array.isArray(payload) ? payload : [];
  for (const row of rows) {
    const currency = String(row?.currency || "").trim().toUpperCase();
    const issuer = String(row?.issuer || "").trim();
    const ticker = String(row?.ticker || "").trim().toUpperCase();
    const name = String(row?.name || row?.ticker || "").trim();
    const icon = fuzionLogoUrl(row?.logoUrl);
    if (!currency || !issuer) continue;
    const entry = { name, ticker, icon, currency, issuer };
    map.set(`${currency}:${issuer}`, entry);
    if (ticker) map.set(`${ticker}:${issuer}`, entry);
  }
  return map;
}

function isXrpQuote(quote) {
  const text = String(quote || "").trim().toUpperCase();
  return text === "XRP" || text.startsWith("XRP ");
}

export function applyFuzionAssets(pools = [], payload = null) {
  const index = payload instanceof Map ? payload : indexFuzionListings(payload);
  return (Array.isArray(pools) ? pools : []).map((pool) => {
    const quote = String(pool?.quote || "").trim();
    const issuer = String(pool?.quote_issuer || "").trim();
    const hex = String(pool?.quote_hex || "").trim().toUpperCase();
    let hit = null;
    if (issuer && !isXrpQuote(quote)) {
      hit =
        (hex && index.get(`${hex}:${issuer}`)) ||
        index.get(`${quote.toUpperCase()}:${issuer}`) ||
        null;
    }
    const listedIcon = hit?.icon || "";
    const icon = listedIcon || (isXrpQuote(quote) ? FUZION_XRP_LOGO : FUZION_GENERIC_LOGO);
    const quoteName = hit?.name || "";
    return {
      ...pool,
      icon,
      icon_source: listedIcon ? "fuzion" : "generic",
      quote_name: quoteName && quoteName !== quote ? quoteName : null,
    };
  });
}

export async function loadFuzionAssetListings(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && cache.body && now - cache.at < LIST_MS) return cache.body;
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = Number(options.timeoutMs) || 5_000;
  try {
    const response = await fetchImpl(FUZION_ASSET_LISTINGS_URL, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`fuzion ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body?.listings)) throw new Error("fuzion listings missing");
    cache = { at: now, body };
    return body;
  } catch {
    return cache.body;
  }
}

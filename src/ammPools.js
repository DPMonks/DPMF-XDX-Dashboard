import { normalizeOrderbookPair } from "./orderbook.js";

export function ammPoolName(row) {
  return String(row?.pool || row?.pool_name || row?.pair || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function filterAmmPools(pools = [], query = "") {
  const q = String(query || "")
    .trim()
    .replace(/^XDX\s*\/\s*/i, "")
    .toUpperCase();
  const rows = Array.isArray(pools) ? pools : [];
  if (!q) return rows;
  return rows.filter((row) => {
    const hay = [
      row?.pool,
      row?.pool_name,
      row?.pair,
      row?.quote,
      row?.amm_account,
      row?.quote_issuer,
    ]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();
    return hay.includes(q);
  });
}

export function mergeAmmPoolLists(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      const key = String(row?.amm_account || ammPoolName(row));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

export function searchAmmAccount(query) {
  const raw = String(query || "").trim();
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(raw) ? raw : "";
}

export function searchPairHint(query) {
  const raw = String(query || "").trim();
  if (!raw || searchAmmAccount(raw)) return "";
  return normalizeOrderbookPair(raw).toUpperCase();
}

export function poolQuoteTicker(pool) {
  const name = ammPoolName(pool);
  const fromName = name.includes("/") ? name.split("/")[1] : "";
  return (
    String(pool?.quote || fromName || "XRP")
      .replace(/^XDX\//i, "")
      .toUpperCase() || "XRP"
  );
}

export function poolAssetTrustlineId(pool) {
  const quote = poolQuoteTicker(pool);
  return quote === "XRP" ? "XDX" : quote;
}

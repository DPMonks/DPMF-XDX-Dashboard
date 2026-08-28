import { INDEXER_ORIGIN, XDX_CURRENCY, XDX_ISSUER, XIO_CURRENCY, XIO_ISSUER, XSQUAD_CURRENCY, XSQUAD_ISSUER } from "./constants.js";

const cache = new Map();
const TTL_MS = 60_000;

const STATIC_TOKENS = [
  {
    currency: XIO_CURRENCY,
    issuer: XIO_ISSUER,
    role: "governance",
    name: "XIO",
    note: "FUZION-XIO governance asset"
  },
  {
    currency: XDX_CURRENCY,
    issuer: XDX_ISSUER,
    role: "utility",
    name: "XDX",
    note: "DPMF ecosystem utility"
  },
  {
    currency: XSQUAD_CURRENCY,
    issuer: XSQUAD_ISSUER,
    role: "community",
    name: "XSQUAD",
    note: "Game-Fi / avatar upgrades"
  }
];

async function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function indexerGet(path) {
  return cached(`idx:${path}`, async () => {
    const res = await fetch(`${INDEXER_ORIGIN}${path}`, {
      headers: { accept: "application/json" }
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        source: "indexer",
        error: res.status === 429 ? "rate limited" : await res.text()
      };
    }
    return { ok: true, source: "indexer", data: await res.json() };
  });
}

export async function tokenCatalog() {
  const overview = await indexerGet("/api/overview").catch(() => ({ ok: false }));
  const prices = await indexerGet("/api/prices").catch(() => ({ ok: false }));
  return {
    ok: true,
    source: overview.ok ? "indexer" : "static",
    tokens: STATIC_TOKENS,
    overview: overview.ok ? overview.data : null,
    prices: prices.ok ? prices.data : null,
    indexerStatus: overview.ok ? "live" : overview.error || "unavailable"
  };
}

export async function walletTokenData(address) {
  if (!address) return { ok: false, error: "address required" };
  return indexerGet(`/api/wallet/balances/${encodeURIComponent(address)}`);
}

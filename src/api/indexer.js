const DEFAULT_INDEXER_URL = "https://dpmf-xdx-indexer-production.up.railway.app";

export const INDEXER_URL = (
  import.meta.env.VITE_INDEXER_URL || DEFAULT_INDEXER_URL
).replace(/\/$/, "");

export class IndexerError extends Error {
  constructor(message, { status, path, body } = {}) {
    super(message);
    this.name = "IndexerError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function indexerFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${INDEXER_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const body = await parseBody(response);

  if (!response.ok) {
    const detail =
      (body && typeof body === "object" && (body.error || body.message)) ||
      (typeof body === "string" ? body : response.statusText);
    throw new IndexerError(
      `Indexer ${response.status} on ${path}: ${detail}`,
      { status: response.status, path, body }
    );
  }

  return body;
}

export async function indexerGet(path) {
  return indexerFetch(path, { method: "GET" });
}

export async function indexerPost(path, body) {
  return indexerFetch(path, {
    method: "POST",
    body: body == null ? undefined : JSON.stringify(body),
  });
}

export async function firstOk(requests) {
  let lastError;
  for (const request of requests) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new IndexerError("No indexer request succeeded");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (value && typeof value === "object" && !value.error) return [value];
  return [];
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export async function getOverview() {
  return asObject(await indexerGet("/api/overview"));
}

export async function getPools() {
  return asObject(await indexerGet("/api/pools"));
}

export async function getAmm() {
  const data = await indexerGet("/api/amm");
  return asArray(data)
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      pool: row.pool || row.pool_name || "XDX/XRP",
      tvl: numberOrNull(row.tvl),
      price: numberOrNull(row.price),
      apr: numberOrNull(row.apr),
      volume24h: numberOrNull(row.volume24h),
      reserve_asset: numberOrNull(row.reserve_asset),
      reserve_currency: numberOrNull(row.reserve_currency),
      lp_supply: numberOrNull(row.lp_supply),
      updated: row.updated || row.timestamp || null,
    }));
}

export async function getTopHolders({ limit = 50, offset = 0 } = {}) {
  const data = await indexerGet(`/api/top-holders?limit=${limit}&offset=${offset}`);
  return asArray(data).map((row, index) => ({
    rank: numberOrNull(row.rank) ?? offset + index + 1,
    account: row.account,
    balance: numberOrNull(row.balance) ?? row.balance,
    frozen: Boolean(row.frozen),
  }));
}

export async function getTopLp({ limit = 50, offset = 0 } = {}) {
  const data = await indexerGet(`/api/top-lp?limit=${limit}&offset=${offset}`);
  return asArray(data).map((row, index) => ({
    rank: numberOrNull(row.rank) ?? offset + index + 1,
    account: row.account,
    lp_balance: numberOrNull(row.lp_balance) ?? row.lp_balance,
  }));
}

export async function getTokenDetailsStatic() {
  return firstOk([
    () => indexerGet("/api/token-details-static"),
    () => indexerGet("/api/token-details"),
  ]);
}

export async function getTokenDetailsLive() {
  return firstOk([
    () => indexerGet("/api/token-details-live"),
    () => indexerGet("/api/token-details"),
  ]);
}

export async function getActivityChart(range = "1M") {
  return asArray(
    await indexerGet(`/api/activity-chart?range=${encodeURIComponent(range)}`)
  );
}

export async function getChartHistory(kind) {
  const path =
    kind === "holders"
      ? "/api/charts/holders"
      : kind === "lp"
        ? "/api/charts/lp-holders"
        : "/api/charts/tvl";
  return asArray(await indexerGet(path)).map((row) => ({
    timestamp: row.timestamp || row.day,
    tvl: numberOrNull(row.tvl),
    holders: numberOrNull(row.holder_count),
    lpHolders: numberOrNull(row.lp_holder_count),
  }));
}

export async function getWalletBalances(address) {
  return asObject(await indexerGet(`/api/wallet/balances/${encodeURIComponent(address)}`));
}

export async function getWalletNetworth(address) {
  return asObject(await indexerGet(`/api/wallet/networth/${encodeURIComponent(address)}`));
}

export async function getPrices() {
  return asObject(await indexerGet("/api/prices"));
}

export async function getHealth() {
  return firstOk([
    () => indexerGet("/health"),
    () => indexerGet("/"),
  ]);
}

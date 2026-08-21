import { formatPair } from "../utils/currency.js";

const DEFAULT_INDEXER_URL = "https://dpmf-xdx-indexer-production.up.railway.app";
const PAGE_SIZE = 200;
const MAX_ROWS = 5000;

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
    throw new IndexerError(`Indexer ${response.status} on ${path}: ${detail}`, {
      status: response.status,
      path,
      body,
    });
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

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.holders)) return value.holders;
  if (Array.isArray(value?.pools)) return value.pools;
  if (value && typeof value === "object" && !value.error) return [value];
  return [];
}

function asObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    return numberOrNull(value.value ?? value.amount ?? value.balance);
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pick(row, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((acc, part) => acc?.[part], row);
    if (value != null && value !== "") return value;
  }
  return null;
}

async function fetchAllPages(path) {
  const first = asArray(await indexerGet(path));
  if (first.length === 0) return [];
  if (first.length !== 50 && first.length !== 100) return first;

  const all = [...first];
  let offset = first.length;

  while (offset < MAX_ROWS) {
    const page = asArray(
      await indexerGet(`${path}${path.includes("?") ? "&" : "?"}limit=${PAGE_SIZE}&offset=${offset}`)
    );
    if (!page.length) break;
    const seen = new Set(all.map((row) => row.account || JSON.stringify(row)));
    const fresh = page.filter((row) => !seen.has(row.account || JSON.stringify(row)));
    if (!fresh.length) break;
    all.push(...fresh);
    if (page.length < PAGE_SIZE) break;
    offset += page.length;
  }

  return all;
}

function mapHolder(row, index, offset = 0) {
  const account = pick(row, ["account", "address", "wallet"]);
  return {
    rank: numberOrNull(row.rank) ?? offset + index + 1,
    account,
    balance: numberOrNull(pick(row, ["balance", "xdx", "amount"])) ?? 0,
    frozen: Boolean(row.frozen),
  };
}

function mapLp(row, index, offset = 0) {
  const account = pick(row, ["account", "address", "wallet"]);
  return {
    rank: numberOrNull(row.rank) ?? offset + index + 1,
    account,
    lp_balance: numberOrNull(pick(row, ["lp_balance", "balance", "lp", "amount"])) ?? 0,
    pair: formatPair(row),
    frozen: Boolean(row.frozen),
  };
}

function mapPool(row) {
  if (!row || typeof row !== "object") return null;
  const pair = formatPair(row);
  const { asset, quote } = (() => {
    const [left, right] = pair.split("/");
    return { asset: left, quote: right };
  })();

  return {
    pool: pair,
    asset,
    quote,
    tvl: numberOrNull(pick(row, ["tvl", "total_value_locked"])),
    price: numberOrNull(pick(row, ["price", "price_usd"])),
    apr: numberOrNull(pick(row, ["apr", "apy"])),
    volume24h: numberOrNull(pick(row, ["volume24h", "volume_24h", "volume"])),
    reserve_asset: numberOrNull(
      pick(row, ["reserve_asset", "amount", "asset_reserve", "xdx_reserve"])
    ),
    reserve_currency: numberOrNull(
      pick(row, ["reserve_currency", "amount2", "quote_reserve", "xrp_reserve"])
    ),
    lp_supply: numberOrNull(pick(row, ["lp_supply", "lp_token.value", "lpToken"])),
    trading_fee: numberOrNull(pick(row, ["trading_fee", "tradingFee", "fee"])),
    holder_count: numberOrNull(pick(row, ["holder_count", "lp_holder_count"])),
    updated: pick(row, ["updated", "timestamp", "updated_at"]),
  };
}

export async function getOverview() {
  return asObject(await indexerGet("/api/overview"));
}

export async function getPools() {
  return await indexerGet("/api/pools");
}

export async function getAmm() {
  const [ammResult, poolsResult] = await Promise.allSettled([
    indexerGet("/api/amm"),
    indexerGet("/api/pools"),
  ]);

  const merged = new Map();

  if (ammResult.status === "fulfilled") {
    for (const row of asArray(ammResult.value)) {
      const pool = mapPool(row);
      if (pool) merged.set(pool.pool, pool);
    }
  }

  if (poolsResult.status === "fulfilled") {
    const value = poolsResult.value;
    const rows = Array.isArray(value?.pools) ? value.pools : asArray(value);
    for (const row of rows) {
      const pool = mapPool(row);
      if (!pool) continue;
      merged.set(pool.pool, { ...(merged.get(pool.pool) || {}), ...pool });
    }
  }

  return [...merged.values()].filter((row) => row.pool);
}

export async function getTopHolders() {
  const rows = await firstOk([
    () => fetchAllPages("/api/top-holders"),
    () => fetchAllPages("/api/top-holders-v2"),
    () => fetchAllPages("/api/holders"),
  ]);

  return rows
    .map((row, index) => mapHolder(row, index))
    .filter((row) => row.account)
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getTopLp() {
  const rows = await firstOk([
    () => fetchAllPages("/api/top-lp"),
    () => fetchAllPages("/api/lp-holders"),
  ]);

  return rows
    .map((row, index) => mapLp(row, index))
    .filter((row) => row.account)
    .sort((a, b) => Number(b.lp_balance) - Number(a.lp_balance))
    .map((row, index) => ({ ...row, rank: index + 1 }));
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

function mapActivityRow(row) {
  return {
    timestamp: row.timestamp || row.day || row.date || row.time,
    price: numberOrNull(row.price),
    volume: numberOrNull(row.volume ?? row.volume24h),
    marketcap: numberOrNull(row.marketcap ?? row.marketCap ?? row.xrplMarketCap),
    rank: numberOrNull(row.rank),
    traders: numberOrNull(row.traders),
    holders: numberOrNull(row.holders ?? row.holder_count),
    tvl: numberOrNull(row.tvl),
    lpHolders: numberOrNull(row.lpHolders ?? row.lp_holder_count),
  };
}

export async function getActivityChart(range = "1M") {
  const rows = asArray(
    await indexerGet(`/api/activity-chart?range=${encodeURIComponent(range)}`)
  );
  return rows.map(mapActivityRow).filter((row) => row.timestamp);
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
    holders: numberOrNull(row.holder_count ?? row.holders),
    lpHolders: numberOrNull(row.lp_holder_count ?? row.lpHolders),
  }));
}

export async function getWalletBalances(address) {
  return asObject(
    await indexerGet(`/api/wallet/balances/${encodeURIComponent(address)}`)
  );
}

export async function getWalletNetworth(address) {
  return asObject(
    await indexerGet(`/api/wallet/networth/${encodeURIComponent(address)}`)
  );
}

export async function getPrices() {
  return asObject(await indexerGet("/api/prices"));
}

export async function getHealth() {
  return firstOk([() => indexerGet("/health"), () => indexerGet("/")]);
}

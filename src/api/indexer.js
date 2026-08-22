import { api, INDEXER_ORIGIN } from "../api";
import { pairFromRow } from "../constants/ledger";
import { composeTokenDetails } from "../tokenDetails";
import { poolAssetSplit, quoteUsdFromMap } from "../utils/poolSplit";
import {
  asOrderbookPayload,
  emptyOrderbook,
  sortOrderbookPairs,
  FEATURED_ORDERBOOK_PAIRS,
} from "../orderbook";

export { INDEXER_ORIGIN };
export const INDEXER_URL = INDEXER_ORIGIN;

const FIRST_HOLDERS = 100;
const FIRST_LP = 100;
const PAGE_SIZE = 100;
const MAX_ROWS = 2500;
const SESSION_TTL_MS = 5 * 60_000;

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.holders)) return value.holders;
  if (Array.isArray(value?.pools)) return value.pools;
  if (value && typeof value === "object" && !value.error) return [value];
  return [];
}

function chartArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of [
    "rows",
    "data",
    "history",
    "points",
    "series",
    "values",
    "items",
    "result",
    "tvl",
    "holders",
    "lpHolders",
    "lp_holders",
  ]) {
    if (Array.isArray(value[key])) return value[key];
  }
  if (rowTimestamp(value)) return [value];
  return [];
}

function rowTimestamp(row) {
  if (row == null || typeof row !== "object") return null;
  const raw =
    row.timestamp ??
    row.day ??
    row.date ??
    row.time ??
    row.ts ??
    row.created_at ??
    row.updated_at ??
    row.updated;
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const date = new Date(ms);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(raw);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sessionRead(key) {
  try {
    const raw = sessionStorage.getItem(`dpmf:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || Date.now() - parsed.at > SESSION_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function sessionWrite(key, data) {
  try {
    sessionStorage.setItem(`dpmf:${key}`, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // private mode / quota
  }
}

async function paginate(fetchPage, pageSize = PAGE_SIZE, onPage, maxRows = MAX_ROWS) {
  const all = [];
  let offset = 0;

  while (offset < maxRows) {
    const page = asArray(await fetchPage(pageSize, offset));
    if (!page.length) break;
    all.push(...page);
    onPage?.(all);
    if (page.length < pageSize) break;
    offset += page.length;
    await sleep(600);
  }

  return all;
}

function mapHolder(row, index) {
  return {
    rank: numberOrNull(row.rank) ?? index + 1,
    account: pick(row, ["account", "address", "wallet"]),
    balance: numberOrNull(pick(row, ["balance", "xdx", "amount"])) ?? 0,
    frozen: Boolean(row.frozen),
    updated: pick(row, ["updated", "timestamp", "as_of"]),
  };
}

function mapLp(row, index) {
  const pair = pick(row, ["pool_name", "pool", "pair"]) || pairFromRow(row);
  const lp = numberOrNull(pick(row, ["lp_balance", "balance", "lp"])) ?? 0;
  return {
    rank: numberOrNull(row.rank) ?? index + 1,
    account: pick(row, ["account", "address", "wallet"]),
    lp_balance: lp,
    balance: lp,
    pair,
    pool_name: pair,
    frozen: Boolean(row.frozen),
    updated: pick(row, ["updated", "timestamp", "as_of"]),
  };
}

function mapPool(row) {
  if (!row || typeof row !== "object") return null;
  const pair = pick(row, ["pool_name", "pool", "pair"]) || pairFromRow(row);
  const [asset, quoteFromName] = String(pair || "XDX/XRP").split("/");
  const ammAccount = pick(row, ["amm_account", "amm", "account"]);
  return {
    pool: pair,
    pool_name: pair,
    asset: asset || "XDX",
    quote: pick(row, ["quote"]) || quoteFromName || "XRP",
    quote_issuer: pick(row, ["quote_issuer"]) || null,
    amm_account: ammAccount || null,
    lp_currency: pick(row, ["lp_currency", "lp_currency_hex"]) || null,
    tvl: numberOrNull(pick(row, ["tvl_usd", "tvl", "total_value_locked", "liquidity"])),
    price: numberOrNull(pick(row, ["price", "price_usd"])),
    apr: numberOrNull(pick(row, ["apr", "apy"])),
    volume24h: numberOrNull(pick(row, ["volume24h", "volume_24h", "volume"])),
    reserve_asset: numberOrNull(
      pick(row, [
        "reserve_asset",
        "reserveAsset",
        "reserve_xdx",
        "amount",
        "asset_reserve",
        "xdx_reserve",
      ])
    ),
    reserve_currency: numberOrNull(
      pick(row, [
        "reserve_currency",
        "reserveCurrency",
        "amount2",
        "quote_reserve",
        "xrp_reserve",
      ])
    ),
    lp_supply: numberOrNull(pick(row, ["lp_supply", "lpSupply", "lp_token.value", "lpToken"])),
    trading_fee: numberOrNull(pick(row, ["trading_fee", "tradingFee", "fee"])),
    holder_count: numberOrNull(pick(row, ["holder_count", "lp_holder_count"])),
    xdxUsd: numberOrNull(pick(row, ["xdxUsd", "xdx_usd"])),
    quote_usd: numberOrNull(pick(row, ["quote_usd"])),
    xdx_pct: numberOrNull(pick(row, ["xdx_pct"])),
    quote_pct: numberOrNull(pick(row, ["quote_pct"])),
    lead: pick(row, ["lead"]) || null,
    updated: pick(row, ["updated", "timestamp", "updated_at"]),
  };
}

function withPoolSplit(row, fallbackXdxUsd, fallbackXrpUsd) {
  if (!row) return row;
  const quoteUsd =
    row.quote_usd ||
    quoteUsdFromMap(row.quote, { XRP: fallbackXrpUsd });
  const split = poolAssetSplit({
    reserveXdx: row.reserve_asset,
    reserveQuote: row.reserve_currency,
    xdxUsd: row.xdxUsd || fallbackXdxUsd,
    quoteUsd,
  });
  return {
    ...row,
    xdx_pct: row.xdx_pct ?? split?.xdxPct ?? null,
    quote_pct: row.quote_pct ?? split?.quotePct ?? null,
    lead: row.lead || split?.lead || null,
  };
}

function uniquePools(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = String(
      row.amm_account ||
        `${row.pool}|${row.reserve_asset}|${row.reserve_currency}|${row.lp_supply}`
    );
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function finishHolders(rows) {
  return rows
    .map(mapHolder)
    .filter((row) => row.account)
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function pickFreshness(payload, rows = []) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      as_of: payload.as_of || payload.updated || null,
      snapshot_day: payload.snapshot_day || null,
      source: payload.source || null,
      present: Boolean(payload.present),
      catching_up: Boolean(payload.catching_up || payload.present === false),
      age_seconds: numberOrNull(payload.age_seconds),
      count: numberOrNull(payload.count),
    };
  }
  const updated = rows.find((row) => row.updated)?.updated || null;
  return {
    as_of: updated,
    snapshot_day: null,
    source: rows.length ? "token_holders_latest" : null,
    present: rows.length > 0,
    catching_up: false,
    age_seconds: null,
    count: rows.length || null,
  };
}

function finishLp(rows) {
  return rows
    .map(mapLp)
    .filter((row) => row.account)
    .sort((a, b) => Number(b.lp_balance) - Number(a.lp_balance))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getOverview() {
  return api.overview();
}

export async function getAmm() {
  const body = await api.lpPools();
  const catchingUp = Boolean(
    body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      (body.catching_up || !asArray(body.pools || body).length)
  );
  if (catchingUp) return [];
  return uniquePools(
    asArray(body)
      .map(mapPool)
      .filter(Boolean)
      .map((row) => withPoolSplit(row, row.xdxUsd, row.quote === "XRP" ? row.quote_usd : 0))
  );
}

export async function getOrderbooks() {
  try {
    const body = await api.orderbooks();
    const names = sortOrderbookPairs([
      ...FEATURED_ORDERBOOK_PAIRS,
      ...(Array.isArray(body?.pairs) ? body.pairs : []),
      ...Object.keys(body?.books || {}),
    ]);
    const books = {};
    for (const pair of names) {
      books[pair] = asOrderbookPayload(body?.books?.[pair] || body?.[pair], pair);
    }
    return {
      quotes: names.map((pair) => pair.split("/")[1]).filter(Boolean),
      featured: FEATURED_ORDERBOOK_PAIRS,
      pairs: names,
      default_pair: body?.default_pair || "XDX/XRP",
      books,
    };
  } catch {
    const names = [...FEATURED_ORDERBOOK_PAIRS];
    return {
      quotes: names.map((pair) => pair.split("/")[1]),
      featured: names,
      pairs: names,
      default_pair: "XDX/XRP",
      books: Object.fromEntries(names.map((pair) => [pair, emptyOrderbook(pair)])),
    };
  }
}

export async function getTopHolders(onPage) {
  const cached = sessionRead("holders");
  if (cached?.rows?.length) onPage?.(cached.rows, cached.freshness || null);
  else if (Array.isArray(cached) && cached.length) onPage?.(cached, null);

  const payload = await api.topHolders(FIRST_HOLDERS, 0, { snapshot: "today" });
  const first = asArray(payload);
  const firstMapped = finishHolders(first);
  const freshness = pickFreshness(payload, firstMapped);
  const catchingUp = Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (payload.catching_up || payload.present === false)
  );
  onPage?.(firstMapped, freshness);
  sessionWrite("holders", { rows: firstMapped, freshness });

  if (catchingUp || first.length < FIRST_HOLDERS) return firstMapped;

  const rest = await paginate(
    (limit, offset) =>
      api.topHolders(limit, FIRST_HOLDERS + offset, { snapshot: "today" }),
    PAGE_SIZE,
    (all) => {
      const mapped = finishHolders([...first, ...all]);
      onPage?.(mapped, freshness);
      sessionWrite("holders", { rows: mapped, freshness });
    },
    MAX_ROWS - FIRST_HOLDERS
  );
  return finishHolders([...first, ...rest]);
}

export async function getTopLp(onPage) {
  const cached = sessionRead("lpHolders");
  if (cached?.rows?.length) onPage?.(cached.rows, cached.freshness || null);
  else if (Array.isArray(cached) && cached.length) onPage?.(cached, null);

  const payload = await api.topLp(FIRST_LP, 0, { snapshot: "today", pool: "all" });
  const first = asArray(payload);
  const firstMapped = finishLp(first);
  const freshness = pickFreshness(payload, firstMapped);
  const catchingUp = Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (payload.catching_up || payload.present === false)
  );
  onPage?.(firstMapped, freshness);
  sessionWrite("lpHolders", { rows: firstMapped, freshness });

  if (catchingUp || first.length < FIRST_LP) return firstMapped;

  const rest = await paginate(
    (limit, offset) =>
      api.topLp(limit, FIRST_LP + offset, { snapshot: "today", pool: "all" }),
    50,
    (all) => {
      const mapped = finishLp([...first, ...all]);
      onPage?.(mapped, freshness);
      sessionWrite("lpHolders", { rows: mapped, freshness });
    },
    MAX_ROWS - FIRST_LP
  );
  return finishLp([...first, ...rest]);
}

export async function getTokenDetails(onPartial) {
  const [overview, prices, change] = await Promise.all([
    api.overview().catch(() => ({})),
    api.prices().catch(() => ({})),
    api.change24h().catch(() => ({})),
  ]);
  const core = composeTokenDetails({ overview, prices, change });
  onPartial?.(core);

  const [holders, trustlines, lpHolders, lpTrustlines] = await Promise.all([
    api.holdersCount({ snapshot: "today" }).catch(() => ({})),
    api.trustlinesCount().catch(() => ({})),
    api.lpHoldersCount({ pool: "all" }).catch(() => ({})),
    api.lpTrustlinesCount({ pool: "all" }).catch(() => ({})),
  ]);
  return composeTokenDetails({
    overview,
    prices,
    change,
    holders,
    trustlines,
    lpHolders,
    lpTrustlines,
  });
}

function mergeChartRow(target, row) {
  const timestamp = rowTimestamp(row);
  if (!timestamp) return;
  const current = target.get(timestamp) || { timestamp };
  const next = {
    ...current,
    tvl: numberOrNull(row.tvl ?? row.total_value_locked) ?? current.tvl,
    holders:
      numberOrNull(row.holders ?? row.holder_count ?? row.xdxHolders) ??
      current.holders,
    lpHolders:
      numberOrNull(row.lpHolders ?? row.lp_holders ?? row.lp_holder_count) ??
      current.lpHolders,
    trustlines:
      numberOrNull(row.trustlines ?? row.trustline_count) ?? current.trustlines,
    traders: numberOrNull(row.traders ?? row.trader_count) ?? current.traders,
    trades: numberOrNull(row.trades ?? row.trade_count) ?? current.trades,
    price: numberOrNull(row.price ?? row.xdxUsd ?? row.xdx_usd) ?? current.price,
    volume:
      numberOrNull(row.volume ?? row.volume24h ?? row.volume_24h) ?? current.volume,
    marketcap:
      numberOrNull(row.marketcap ?? row.market_cap ?? row.xrplMarketCap) ??
      current.marketcap,
  };
  target.set(timestamp, next);
}

function sparklineRows(payload, key) {
  const list = chartArray(payload);
  const now = Date.now();
  return list
    .map((item, index) => {
      if (item != null && typeof item !== "object") {
        return {
          timestamp: new Date(now - (list.length - 1 - index) * 86400000).toISOString(),
          [key]: numberOrNull(item),
        };
      }
      const timestamp =
        rowTimestamp(item) ||
        new Date(now - (list.length - 1 - index) * 86400000).toISOString();
      return {
        timestamp,
        [key]: numberOrNull(
          item?.price_usd ?? item?.value ?? item?.price ?? item?.[key] ?? item?.close ?? item?.y
        ),
      };
    })
    .filter((row) => row[key] != null);
}

export async function getChartHistory() {
  const merged = new Map();
  const errors = [];

  async function absorb(loaders) {
    let added = 0;
    for (const load of loaders) {
      try {
        const rows = chartArray(await load());
        for (const row of rows) mergeChartRow(merged, row);
        added += rows.length;
      } catch (error) {
        errors.push(error);
      }
    }
    return added;
  }

  await Promise.all([
    absorb([() => api.holdersHistory()]),
    absorb([() => api.trustlinesHistory()]),
  ]);

  await Promise.race([
    Promise.all([
      absorb([() => api.activityHistory()]),
      absorb([() => api.tradersHistory()]),
    ]),
    sleep(4000),
  ]);

  if (!merged.size) {
    for (const asset of ["XDX", "XRP", "LP"]) {
      try {
        const rows = sparklineRows(await api.sparkline(asset), "price");
        for (const row of rows) mergeChartRow(merged, row);
        if (merged.size) break;
      } catch (error) {
        errors.push(error);
      }
    }
  }

  const live = await api.overview().catch(() => null);
  if (live && (live.tvl != null || live.holder_count != null || live.xdxUsd != null)) {
    mergeChartRow(merged, {
      timestamp: new Date().toISOString(),
      tvl: live.tvl_usd ?? live.tvl,
      holders: live.holder_count ?? live.holders,
      trustlines: live.trustline_count ?? live.trustlines,
      price: live.xdxUsd ?? live.price,
      volume: live.volume24h,
      marketcap: live.xrplMarketCap,
    });
  }

  const rows = [...merged.values()].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  if (!rows.length && errors.length) {
    throw errors[0];
  }
  return rows;
}

export async function getXdxFlows() {
  let payload;
  try {
    payload = await api.xdxFlows();
  } catch {
    payload = await api.trades().catch(() => []);
  }
  const rows = asArray(payload);
  return rows
    .map((row) => ({
      timestamp: rowTimestamp(row),
      account: row.account || row.address || row.wallet || null,
      pool: row.pool || row.pool_name || null,
      side: String(row.side || "").toLowerCase() === "sell" ? "sell" : "buy",
      xdx: numberOrNull(row.xdx ?? row.amount) ?? 0,
      quote: numberOrNull(row.quote) ?? 0,
      price: numberOrNull(row.price),
    }))
    .filter((row) => row.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export async function getTradeHistory() {
  return getXdxFlows();
}

function amountFromBalances(payload, names) {
  if (payload == null) return null;
  if (typeof payload === "number" || typeof payload === "string") {
    return numberOrNull(payload);
  }

  const list = asArray(payload.balances || payload.lines || payload);
  for (const row of list) {
    const currency = String(row.currency || row.code || row.symbol || "").toUpperCase();
    if (names.some((name) => currency === name.toUpperCase() || currency.includes(name.toUpperCase()))) {
      return numberOrNull(row.value ?? row.balance ?? row.amount);
    }
  }

  for (const name of names) {
    const direct = numberOrNull(payload[name] ?? payload[name.toLowerCase()]);
    if (direct != null) return direct;
  }
  return null;
}

export async function getWalletBalances(address) {
  let payload;
  try {
    payload = await api.balances(address);
  } catch {
    payload = await getJsonAlias(address);
  }

  return {
    raw: payload,
    xrp: numberOrNull(payload?.xrp) ?? amountFromBalances(payload, ["XRP"]),
    xdx:
      numberOrNull(payload?.xdx) ??
      amountFromBalances(payload, ["XDX", "5844580000000000000000000000000000000000"]),
    lp:
      numberOrNull(payload?.lp) ??
      amountFromBalances(payload, [
        "LP",
        "03970105D80AE3C54085F6E97EE16CEDE6CE8200",
        "03BCD44104644B711C58CD14CD13CBA65757CFBE",
      ]),
  };
}

async function getJsonAlias(address) {
  const res = await fetch(`/api/balances/${encodeURIComponent(address)}`, {
    headers: { accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || `${res.status} ${res.statusText}`);
  }
  return data;
}

export async function getWalletNetworth(address) {
  return api.networth(address);
}

export async function getPrices() {
  return api.prices();
}

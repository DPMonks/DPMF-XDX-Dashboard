import { api, INDEXER_ORIGIN } from "../api";
import { pairFromRow } from "../constants/ledger";
import { keepLastGoodOwners } from "../todayOwners";
import {
  carryActivityMetrics,
  issuedActivitySeries,
  mergeActivityRows,
  rowsFromXrplToGraph,
  xrplToHolderGraphUrl,
} from "../activityHistory";
import { composeTokenDetails } from "../tokenDetails";
import { detectQuoteUsd, preferUsdPoolSplit } from "../utils/poolSplit";
import { LIST_PAGE_SIZE, shouldFetchMoreRows } from "../utils/pagination";
import {
  composeAmmBook,
  emptyOrderbook,
  mergeOrderbookPayloads,
  normalizeOrderbookPair,
  sortOrderbookPairs,
  FEATURED_ORDERBOOK_PAIRS,
} from "../orderbook";
import { composeWalletSnapshot, emptyWalletSnapshot } from "../wallet/composeWallet";

export { INDEXER_ORIGIN };
export const INDEXER_URL = INDEXER_ORIGIN;

const FIRST_HOLDERS = LIST_PAGE_SIZE;
const FIRST_LP = LIST_PAGE_SIZE;
const PAGE_SIZE = LIST_PAGE_SIZE;
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
    quote_hex: pick(row, ["quote_hex"]) || null,
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
    trading_fee:
      numberOrNull(pick(row, ["trading_fee", "tradingFee", "TradingFee", "fee", "fee_bps", "trading_fee_bps"])) ?? 0,
    holder_count: numberOrNull(pick(row, ["holder_count", "lp_holder_count"])),
    xdxUsd: numberOrNull(pick(row, ["xdxUsd", "xdx_usd"])),
    quote_usd: numberOrNull(pick(row, ["quote_usd"])),
    xdx_pct: numberOrNull(pick(row, ["xdx_pct"])),
    quote_pct: numberOrNull(pick(row, ["quote_pct"])),
    lead: pick(row, ["lead"]) || null,
    updated: pick(row, ["updated", "timestamp", "updated_at"]),
  };
}

function withPoolSplit(row, fallbackXdxUsd, fallbackXrpUsd, prices = {}) {
  if (!row) return row;
  const xdxUsd = row.xdxUsd || fallbackXdxUsd;
  const priceBook = { ...prices, xrpUsd: fallbackXrpUsd, XRP: fallbackXrpUsd || prices.xrpUsd };
  const marketQuoteUsd = detectQuoteUsd({
    quoteId: row.quote,
    pool: { ...row, xdxUsd },
    prices: priceBook,
    allowImplied: false,
  });
  const split = preferUsdPoolSplit({
    reserveXdx: row.reserve_asset,
    reserveQuote: row.reserve_currency,
    lpSupply: row.lp_supply,
    price: row.price,
    xdxUsd,
    quoteUsd: marketQuoteUsd,
  });
  return {
    ...row,
    reserve_currency: row.reserve_currency || split?.reserveQuote || null,
    xdxUsd: xdxUsd || null,
    quote_usd: marketQuoteUsd || null,
    xdx_pct: split?.xdxPct ?? null,
    quote_pct: split?.quotePct ?? null,
    lead: split?.lead || null,
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
  const [body, prices] = await Promise.all([
    api.lpPools(),
    api.prices().catch(() => ({})),
  ]);
  const catchingUp = Boolean(
    body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      (body.catching_up || !asArray(body.pools || body).length)
  );
  if (catchingUp) return [];
  const xdxUsd = numberOrNull(prices?.xdxUsd ?? prices?.recorded_price);
  const xrpUsd = numberOrNull(prices?.xrpUsd);
  return uniquePools(
    asArray(body)
      .map(mapPool)
      .filter(Boolean)
      .map((row) => withPoolSplit(row, row.xdxUsd || xdxUsd, xrpUsd, prices))
  );
}

let lastOrderbooks = null;

function emptyCatalog() {
  const names = [...FEATURED_ORDERBOOK_PAIRS];
  return {
    quotes: names.map((pair) => pair.split("/")[1]),
    featured: names,
    pairs: names,
    default_pair: "XDX/XRP",
    books: {},
  };
}

function composeCatalogBook(raw, pair, xrpBook) {
  const name = normalizeOrderbookPair(pair);
  const reserves = raw?.amm || {};
  if (name === "XDX/XRP") {
    return composeAmmBook(raw, reserves, name);
  }
  return composeAmmBook(raw, reserves, name, {
    xrpBook: xrpBook || lastOrderbooks?.books?.["XDX/XRP"] || null,
  });
}

function ingestOrderbooks(body, pairHint = "XDX/XRP") {
  if (!body || typeof body !== "object") return lastOrderbooks;
  if (body.books && typeof body.books === "object") {
    const names = sortOrderbookPairs([
      ...FEATURED_ORDERBOOK_PAIRS,
      ...(Array.isArray(body.pairs) ? body.pairs : []),
      ...Object.keys(body.books),
    ]);
    const xrpRaw = body.books["XDX/XRP"] || emptyOrderbook("XDX/XRP");
    const xrpBook = composeAmmBook(xrpRaw, xrpRaw.amm || {}, "XDX/XRP");
    const books = {};
    for (const pair of names) {
      if (pair === "XDX/XRP") {
        books[pair] = xrpBook;
        continue;
      }
      const raw = body.books[pair] || body[pair] || emptyOrderbook(pair);
      books[pair] = composeCatalogBook(raw, pair, xrpBook);
    }
    lastOrderbooks = mergeOrderbookPayloads(lastOrderbooks, {
      quotes: names.map((pair) => pair.split("/")[1]).filter(Boolean),
      featured: FEATURED_ORDERBOOK_PAIRS,
      pairs: names,
      default_pair: body.default_pair || "XDX/XRP",
      books,
    });
    return lastOrderbooks;
  }

  const name = normalizeOrderbookPair(pairHint || body.pair || "XDX/XRP");
  const raw = body.book || body;
  const book = composeCatalogBook(raw, name, lastOrderbooks?.books?.["XDX/XRP"]);
  lastOrderbooks = mergeOrderbookPayloads(lastOrderbooks || emptyCatalog(), {
    books: { [name]: book },
  });
  return lastOrderbooks;
}

export async function getOrderbook(pair = "XDX/XRP") {
  const name = normalizeOrderbookPair(pair);
  try {
    return ingestOrderbooks(await api.orderbook(name), name);
  } catch {
    if (lastOrderbooks) return lastOrderbooks;
    throw new Error("Waiting for XRPL book_offers on this pair.");
  }
}

export async function getOrderbooks() {
  try {
    return ingestOrderbooks(await api.orderbooks());
  } catch {
    if (lastOrderbooks) return lastOrderbooks;
    throw new Error("Waiting for XRPL book_offers on this pair.");
  }
}

const lastOwnerLists = new Map();

async function loadPagedOwners({
  cacheKey,
  requestFirst,
  requestRest,
  requestLast,
  requestLastRest,
  finish,
  onPage,
  firstSize,
  restPageSize,
}) {
  const cached = sessionRead(cacheKey) || lastOwnerLists.get(cacheKey);
  const lastGood = cached?.rows?.length
    ? cached
    : Array.isArray(cached) && cached.length
      ? { rows: cached, freshness: null }
      : lastOwnerLists.get(cacheKey) || null;
  if (lastGood?.rows?.length) onPage?.(lastGood.rows, lastGood.freshness || null);

  let payload = await requestFirst();
  let first = asArray(payload);
  let freshness = pickFreshness(payload, finish(first));
  let restFetch = requestRest;

  if (!first.length && freshness.catching_up && requestLast) {
    try {
      const lastPayload = await requestLast();
      const lastRows = asArray(lastPayload);
      if (lastRows.length) {
        payload = lastPayload;
        first = lastRows;
        freshness = {
          ...pickFreshness(lastPayload, finish(lastRows)),
          catching_up: true,
          present: false,
        };
        restFetch = requestLastRest || requestRest;
      }
    } catch {
      // keep the empty today envelope and fall back to the last painted list
    }
  }

  const firstMapped = finish(first);
  const kept = keepLastGoodOwners(lastGood, { rows: firstMapped, freshness });
  lastOwnerLists.set(cacheKey, kept);
  onPage?.(kept.rows, kept.freshness);
  sessionWrite(cacheKey, kept);

  if (!firstMapped.length || !shouldFetchMoreRows(first.length, firstSize, freshness.count)) {
    return kept.rows;
  }

  const rest = await paginate(
    restFetch,
    restPageSize,
    (all) => {
      const mapped = finish([...first, ...all]);
      const next = keepLastGoodOwners(kept, { rows: mapped, freshness });
      lastOwnerLists.set(cacheKey, next);
      onPage?.(next.rows, next.freshness);
      sessionWrite(cacheKey, next);
    },
    MAX_ROWS - firstSize
  );
  const mapped = finish([...first, ...rest]);
  const next = keepLastGoodOwners(kept, { rows: mapped, freshness });
  lastOwnerLists.set(cacheKey, next);
  sessionWrite(cacheKey, next);
  return next.rows;
}

export async function getTopHolders(onPage) {
  return loadPagedOwners({
    cacheKey: "holders",
    requestFirst: () => api.topHolders(FIRST_HOLDERS, 0, { snapshot: "today" }),
    requestRest: (limit, offset) =>
      api.topHolders(limit, FIRST_HOLDERS + offset, { snapshot: "today" }),
    requestLast: () => api.topHolders(FIRST_HOLDERS, 0, { snapshot: "latest" }),
    requestLastRest: (limit, offset) =>
      api.topHolders(limit, FIRST_HOLDERS + offset, { snapshot: "latest" }),
    finish: finishHolders,
    onPage,
    firstSize: FIRST_HOLDERS,
    restPageSize: PAGE_SIZE,
  });
}

export async function getTopLp(onPage) {
  return loadPagedOwners({
    cacheKey: "lpHolders",
    requestFirst: () => api.topLp(FIRST_LP, 0, { snapshot: "today", pool: "all" }),
    requestRest: (limit, offset) =>
      api.topLp(limit, FIRST_LP + offset, { snapshot: "today", pool: "all" }),
    requestLast: () => api.topLp(FIRST_LP, 0, { snapshot: "latest", pool: "all" }),
    requestLastRest: (limit, offset) =>
      api.topLp(limit, FIRST_LP + offset, { snapshot: "latest", pool: "all" }),
    finish: finishLp,
    onPage,
    firstSize: FIRST_LP,
    restPageSize: 50,
  });
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

async function fetchXrplToIssued() {
  const graphs = await Promise.all(
    ["ALL", "24H", "5Y"].map(async (range) => {
      try {
        const response = await fetch(xrplToHolderGraphUrl(range), {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) return [];
        return rowsFromXrplToGraph(await response.json());
      } catch {
        return [];
      }
    })
  );
  return mergeActivityRows(...graphs);
}

export async function getChartHistory() {
  const errors = [];
  const take = (promise) =>
    promise.then(chartArray).catch((error) => {
      errors.push(error);
      return [];
    });
  const [apiIssued, apiActivity, apiTraders, remote] = await Promise.all([
    take(api.holdersHistory({ queue: false, retries: 1 })),
    take(api.activityHistory()),
    take(api.tradersHistory()),
    fetchXrplToIssued(),
  ]);
  const issued = mergeActivityRows(apiIssued, apiActivity, apiTraders, remote);

  const live = await api.overview().catch(() => null);
  const lastTraders = [...issued]
    .reverse()
    .find((row) => numberOrNull(row.traders ?? row.trader_count) != null);
  const rows = carryActivityMetrics(
    issuedActivitySeries(
      issued,
      live && (live.holder_count != null || live.trustline_count != null)
        ? {
            timestamp: new Date().toISOString(),
            holders: live.holder_count ?? live.holders,
            trustlines: live.trustline_count ?? live.trustlines,
            traders: lastTraders?.traders ?? lastTraders?.trader_count,
          }
        : null
    )
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

export async function getWalletAccount(address) {
  return api.walletAccount(address);
}

export async function getWalletLp(address) {
  const body = await api.walletLp(address);
  return asArray(body?.positions || body);
}

export async function getWalletRank(address) {
  const body = await api.walletRank(address);
  return numberOrNull(body?.rank);
}

export async function getPrices() {
  return api.prices();
}

export async function getConnectedWallet(address) {
  const name = String(address || "").trim();
  if (!name) return emptyWalletSnapshot(null);

  const [balances, networth, account, lpRows, rank, prices, token, pools, books, flows] =
    await Promise.all([
      getWalletBalances(name).catch(() => ({})),
      getWalletNetworth(name).catch(() => ({})),
      getWalletAccount(name).catch(() => ({})),
      getWalletLp(name).catch(() => []),
      getWalletRank(name).catch(() => null),
      getPrices().catch(() => ({})),
      getTokenDetails().catch(() => ({})),
      getAmm().catch(() => []),
      getOrderbooks().catch(() => null),
      getXdxFlows().catch(() => []),
    ]);

  return composeWalletSnapshot({
    address: name,
    balances,
    account,
    networth,
    prices,
    token,
    pools,
    lpRows,
    rank,
    books,
    flows,
  });
}

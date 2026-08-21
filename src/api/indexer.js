import { api, getHandshakeState, handshake, INDEXER_ORIGIN } from "../api";
import { pairFromRow } from "../constants/ledger";

export { INDEXER_ORIGIN };
export const INDEXER_URL = INDEXER_ORIGIN;

const FIRST_HOLDERS = 50;
const FIRST_LP = 25;
const PAGE_SIZE = 100;
const MAX_ROWS = 1000;
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

async function snapshotField(name) {
  const state = await Promise.race([
    handshake(),
    sleep(1200).then(() => getHandshakeState()),
  ]);
  return state.snapshot?.[name];
}

function mapHolder(row, index) {
  return {
    rank: numberOrNull(row.rank) ?? index + 1,
    account: pick(row, ["account", "address", "wallet"]),
    balance: numberOrNull(pick(row, ["balance", "xdx", "amount"])) ?? 0,
    frozen: Boolean(row.frozen),
  };
}

function mapLp(row, index) {
  return {
    rank: numberOrNull(row.rank) ?? index + 1,
    account: pick(row, ["account", "address", "wallet"]),
    lp_balance: numberOrNull(pick(row, ["lp_balance", "balance", "lp"])) ?? 0,
    pair: pairFromRow(row),
    frozen: Boolean(row.frozen),
  };
}

function mapPool(row) {
  if (!row || typeof row !== "object") return null;
  const pair = pairFromRow(row);
  const [asset, quote] = pair.split("/");
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

function finishHolders(rows) {
  return rows
    .map(mapHolder)
    .filter((row) => row.account)
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function finishLp(rows) {
  return rows
    .map(mapLp)
    .filter((row) => row.account)
    .sort((a, b) => Number(b.lp_balance) - Number(a.lp_balance))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getOverview() {
  const snapshot = await snapshotField("overview");
  if (snapshot && typeof snapshot === "object") return snapshot;
  return api.overview();
}

export async function getAmm() {
  const snapshotPools = asArray(await snapshotField("pools")).map(mapPool).filter(Boolean);
  if (snapshotPools.length) return snapshotPools;

  try {
    const pools = await api.pools();
    const mapped = asArray(pools).map(mapPool).filter(Boolean);
    if (mapped.length) return mapped;
  } catch {
    // fall through to /amm
  }

  const amm = await api.amm();
  return asArray(amm).map(mapPool).filter(Boolean);
}

export async function getTopHolders(onPage) {
  const snap = asArray(await snapshotField("holders"));
  if (snap.length) {
    const mapped = finishHolders(snap);
    onPage?.(mapped);
    sessionWrite("holders", mapped);
    return mapped;
  }

  const cached = sessionRead("holders");
  if (cached?.length) onPage?.(cached);

  const first = asArray(await api.topHolders(FIRST_HOLDERS, 0));
  const firstMapped = finishHolders(first);
  if (firstMapped.length) {
    onPage?.(firstMapped);
    sessionWrite("holders", firstMapped);
  }

  if (first.length < FIRST_HOLDERS) return firstMapped;

  const rest = await paginate(
    (limit, offset) => api.topHolders(limit, FIRST_HOLDERS + offset),
    PAGE_SIZE,
    (all) => {
      const mapped = finishHolders([...first, ...all]);
      onPage?.(mapped);
      sessionWrite("holders", mapped);
    },
    MAX_ROWS - FIRST_HOLDERS
  );
  return finishHolders([...first, ...rest]);
}

export async function getTopLp(onPage) {
  const snap = asArray(await snapshotField("lpHolders"));
  if (snap.length) {
    const mapped = finishLp(snap);
    onPage?.(mapped);
    sessionWrite("lpHolders", mapped);
    return mapped;
  }

  const cached = sessionRead("lpHolders");
  if (cached?.length) onPage?.(cached);

  const first = asArray(await api.topLp(FIRST_LP, 0));
  const firstMapped = finishLp(first);
  if (firstMapped.length) {
    onPage?.(firstMapped);
    sessionWrite("lpHolders", firstMapped);
  }

  if (first.length < FIRST_LP) return firstMapped;

  const rest = await paginate(
    (limit, offset) => api.topLp(limit, FIRST_LP + offset),
    50,
    (all) => {
      const mapped = finishLp([...first, ...all]);
      onPage?.(mapped);
      sessionWrite("lpHolders", mapped);
    },
    MAX_ROWS - FIRST_LP
  );
  return finishLp([...first, ...rest]);
}

export async function getTokenDetails() {
  const state = await Promise.race([
    handshake(),
    sleep(1200).then(() => getHandshakeState()),
  ]);
  const overview =
    state.snapshot?.overview || (await api.overview().catch(() => ({})));
  const prices =
    state.snapshot?.prices || (await api.prices().catch(() => ({})));
  const change =
    state.snapshot?.change24h || (await api.change24h().catch(() => ({})));
  const holders =
    state.snapshot?.holdersCount || (await api.holdersCount().catch(() => ({})));
  const ammRows = await getAmm().catch(() => []);
  const primary = ammRows[0] || {};

  const circulating = numberOrNull(
    overview.circulating || overview.circulating_supply || overview.xdx_supply
  );
  const price = numberOrNull(prices.xdxUsd || prices.xdx_usd || primary.price);

  return {
    tokenType: "XDX",
    xrplMarketCap: circulating != null && price != null ? circulating * price : overview.market_cap,
    ammMarketCap: primary.tvl,
    circulatingMarketCap:
      circulating != null && price != null ? circulating * price : null,
    circulating,
    totalSupply: overview.total_supply,
    burnedSupply: overview.burned_supply,
    holders:
      (typeof holders === "number" ? holders : holders.count) ??
      overview.holder_count,
    trustlines: overview.trustline_count ?? overview.trustlines,
    issuerFee: overview.issuer_fee,
    blackholed: overview.blackholed,
    created: overview.created,
    price,
    change24h: change.XDX ?? change.xdx,
    ...overview,
    ...primary,
  };
}

async function firstChartSeries(loaders) {
  const errors = [];
  for (const load of loaders) {
    try {
      const rows = chartArray(await load());
      if (rows.length) return { rows, error: null };
    } catch (error) {
      errors.push(error);
    }
  }
  return { rows: [], error: errors.at(-1) || null };
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
          item?.value ?? item?.price ?? item?.[key] ?? item?.close ?? item?.y
        ),
      };
    })
    .filter((row) => row[key] != null);
}

export async function getChartHistory(range = "Max") {
  const state = await Promise.race([
    handshake(),
    sleep(1200).then(() => getHandshakeState()),
  ]);
  const charts = state.snapshot?.charts || {};
  const merged = new Map();
  const errors = [];

  const activity = await firstChartSeries([
    () => charts.activity,
    () => api.activityChart(range),
    () => getJsonAliasPath(`/api/activity-chart?range=${encodeURIComponent(range)}`),
  ]);
  if (activity.error) errors.push(activity.error);
  for (const row of activity.rows) mergeChartRow(merged, row);

  const tvl = await firstChartSeries([
    () => charts.tvl,
    () => api.tvlHistory(),
  ]);
  if (tvl.error) errors.push(tvl.error);
  for (const row of tvl.rows) mergeChartRow(merged, row);

  const holders = await firstChartSeries([
    () => charts.holders,
    () => api.holdersHistory(),
  ]);
  if (holders.error) errors.push(holders.error);
  for (const row of holders.rows) mergeChartRow(merged, row);

  const lp = await firstChartSeries([
    () => charts.lpHolders || charts.lp_holders,
    () => api.lpHoldersHistory(),
  ]);
  if (lp.error) errors.push(lp.error);
  for (const row of lp.rows) mergeChartRow(merged, row);

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

  if (!merged.size) {
    const live = await getTokenDetails().catch(() => null);
    if (live && (live.tvl != null || live.holders != null || live.price != null)) {
      mergeChartRow(merged, {
        timestamp: new Date().toISOString(),
        tvl: live.tvl,
        holders: live.holders,
        lpHolders: live.lp_holder_count,
        price: live.price,
        volume: live.volume24h,
        marketcap: live.xrplMarketCap,
      });
    }
  }

  const rows = [...merged.values()].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  if (!rows.length && errors.length) {
    throw errors[0];
  }
  return rows;
}

async function getJsonAliasPath(path) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || `${res.status} ${res.statusText}`);
  }
  return data;
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
    xrp: amountFromBalances(payload, ["XRP"]),
    xdx: amountFromBalances(payload, ["XDX", "5844580000000000000000000000000000000000"]),
    lp: amountFromBalances(payload, [
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

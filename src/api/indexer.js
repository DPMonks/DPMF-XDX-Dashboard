import { api, handshake, INDEXER_ORIGIN } from "../api";
import { pairFromRow } from "../constants/ledger";

export { INDEXER_ORIGIN };
export const INDEXER_URL = INDEXER_ORIGIN;

const PAGE_SIZE = 200;
const MAX_ROWS = 5000;

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.holders)) return value.holders;
  if (Array.isArray(value?.pools)) return value.pools;
  if (value && typeof value === "object" && !value.error) return [value];
  return [];
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

async function paginate(fetchPage, pageSize = PAGE_SIZE, onPage) {
  const all = [];
  let offset = 0;

  while (offset < MAX_ROWS) {
    const page = asArray(await fetchPage(pageSize, offset));
    if (!page.length) break;
    all.push(...page);
    onPage?.(all);
    if (page.length < pageSize) break;
    offset += page.length;
    await sleep(400);
  }

  return all;
}

async function snapshotField(name) {
  const state = await handshake();
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
    return mapped;
  }

  const rows = await paginate(
    (limit, offset) => api.topHolders(limit, offset),
    PAGE_SIZE,
    (all) => onPage?.(finishHolders(all))
  );
  return finishHolders(rows);
}

export async function getTopLp(onPage) {
  const snap = asArray(await snapshotField("lpHolders"));
  if (snap.length) {
    const mapped = finishLp(snap);
    onPage?.(mapped);
    return mapped;
  }

  const rows = await paginate(
    (limit, offset) => api.topLp(limit, offset),
    50,
    (all) => onPage?.(finishLp(all))
  );
  return finishLp(rows);
}

export async function getTokenDetails() {
  const state = await handshake();
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

export async function getChartHistory() {
  const state = await handshake();
  const charts = state.snapshot?.charts || {};
  const tvl = asArray(charts.tvl || (await api.tvlHistory().catch(() => [])));
  const holders = asArray(
    charts.holders || (await api.holdersHistory().catch(() => []))
  );
  const lp = asArray(
    charts.lpHolders || charts.lp_holders || (await api.lpHoldersHistory().catch(() => []))
  );

  const merged = new Map();
  for (const row of tvl) {
    const timestamp = row.timestamp || row.day;
    merged.set(String(timestamp), {
      timestamp,
      tvl: numberOrNull(row.tvl),
    });
  }
  for (const row of holders) {
    const timestamp = row.timestamp || row.day;
    const key = String(timestamp);
    merged.set(key, {
      ...(merged.get(key) || { timestamp }),
      holders: numberOrNull(row.holder_count ?? row.holders),
    });
  }
  for (const row of lp) {
    const timestamp = row.timestamp || row.day;
    const key = String(timestamp);
    merged.set(key, {
      ...(merged.get(key) || { timestamp }),
      lpHolders: numberOrNull(row.lp_holder_count ?? row.lpHolders),
    });
  }

  return [...merged.values()].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
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

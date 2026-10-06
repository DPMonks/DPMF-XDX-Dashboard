import { XDX_HEX, XDX_ISSUER } from "../src/constants/ledger.js";
import { poolReservesFromAmmInfo } from "../src/utils/ammInfo.js";
import { currencyLabelFromCode, LOW_LIQUIDITY_XRP } from "../src/utils/xrplToAmm.js";
import { mapLimit, withXrplRetry } from "./liveAmmReserves.js";
import { xrplRpc } from "./xrplBookOffers.js";

const POOLS_MS = 3 * 60_000;
const PAGE_LIMIT = 400;
const MAX_PAGES = 80;

let state = emptyState();
let inflight = null;

function emptyState() {
  return {
    marker: undefined,
    pages: 0,
    candidates: [],
    linesDone: false,
    verdicts: new Map(),
    pools: null,
    poolsAt: 0,
    error: "",
  };
}

export function resetLedgerAmmDiscoveryCache() {
  state = emptyState();
  inflight = null;
}

export function ledgerAmmDiscoveryStatus() {
  return {
    count: Array.isArray(state.pools) ? state.pools.length : 0,
    error: state.error || null,
    complete: Boolean(state.linesDone && state.pools),
    source: "xrpl-lines",
  };
}

function isXdxCurrency(code) {
  const currency = String(code || "").trim().toUpperCase();
  return currency === "XDX" || currency === XDX_HEX;
}

export function xdxAmmCandidateLines(lines = [], issuer = XDX_ISSUER) {
  const owner = String(issuer || XDX_ISSUER).trim();
  const out = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    const account = String(line?.account || "").trim();
    if (!account || account === owner) continue;
    if (!isXdxCurrency(line?.currency)) continue;
    if (Number(line?.limit_peer) !== 0) continue;
    const balance = Number(line?.balance);
    if (!Number.isFinite(balance) || balance === 0) continue;
    out.push({ account, balance });
  }
  return out;
}

function quoteLabelFromAmounts(amount, amount2) {
  const first = amount && typeof amount === "object" ? amount : null;
  const second = amount2 && typeof amount2 === "object" ? amount2 : null;
  const firstXdx = first && isXdxCurrency(first.currency);
  const secondXdx = second && isXdxCurrency(second.currency);
  if (!first && !second) return "XRP";
  if (firstXdx && !second) return "XRP";
  if (secondXdx && !first) return "XRP";
  const quote = firstXdx ? amount2 : secondXdx ? amount : amount2;
  if (quote == null || typeof quote !== "object") return "XRP";
  return currencyLabelFromCode(quote.currency) || "IOU";
}

function rowFromAmmInfo(result) {
  const parsed = poolReservesFromAmmInfo(result);
  if (!parsed?.amm_account) return null;
  const amm = result?.amm || result;
  const quote = quoteLabelFromAmounts(amm?.amount, amm?.amount2);
  const pair = quote ? `XDX/${quote}` : parsed.pair || "XDX/XRP";
  return {
    pool: pair,
    pool_name: pair,
    quote,
    quote_issuer: parsed.quote_issuer || null,
    quote_hex: parsed.quote_hex || null,
    amm_account: parsed.amm_account,
    lp_currency: parsed.lp_currency || null,
    reserve_xdx: parsed.reserve_xdx,
    reserve_asset: parsed.reserve_asset,
    reserve_currency: parsed.reserve_currency,
    reserve_quote: parsed.reserve_quote,
    lp_supply: parsed.lp_supply,
    trading_fee: parsed.trading_fee,
    price:
      Number(parsed.reserve_xdx) > 0 && Number(parsed.reserve_currency) > 0
        ? Number(parsed.reserve_currency) / Number(parsed.reserve_xdx)
        : null,
    reserve_source: "amm_info",
    source: "xrpl-ledger",
    volume24h: null,
    volume24hXdx: null,
    volumeSource: null,
  };
}

function disambiguatePairs(pools) {
  const counts = new Map();
  for (const pool of pools) {
    const key = String(pool.pool || "").toUpperCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return pools.map((pool) => {
    const key = String(pool.pool || "").toUpperCase();
    if ((counts.get(key) || 0) < 2) return pool;
    const issuer = String(pool.quote_issuer || pool.amm_account || "");
    if (issuer.length < 8) return pool;
    const suffix = `${issuer.slice(0, 4)}...${issuer.slice(-4)}`;
    const quote = `${pool.quote} ${suffix}`;
    return { ...pool, quote, pool: `XDX/${quote}`, pool_name: `XDX/${quote}` };
  });
}

export function withLedgerLiquidity(pools = [], { xrpPerXdx = 0 } = {}) {
  const rate = Number(xrpPerXdx) || 0;
  return (Array.isArray(pools) ? pools : []).map((pool) => {
    const quote = String(pool.quote || "").trim().toUpperCase();
    const reserveQuote = Number(pool.reserve_currency ?? pool.reserve_quote) || 0;
    const reserveXdx = Number(pool.reserve_xdx ?? pool.reserve_asset) || 0;
    let liquidity = null;
    if (quote === "XRP" || quote.startsWith("XRP ")) liquidity = reserveQuote;
    else if (rate > 0 && reserveXdx > 0) liquidity = reserveXdx * rate;
    return {
      ...pool,
      liquidity_xrp: liquidity,
      low_liquidity: liquidity != null && liquidity < LOW_LIQUIDITY_XRP,
    };
  });
}

export function applyXrplToNames(pools = [], payload = null) {
  const rows = Array.isArray(payload?.pools) ? payload.pools : [];
  const names = new Map();
  for (const row of rows) {
    const amm = String(row?.ammAccount || row?.amm_account || row?.account || "").trim().toLowerCase();
    if (!amm) continue;
    const icon = row.icon || row.logo || row.image || row.tokenIcon || null;
    if (icon) names.set(amm, icon);
  }
  if (!names.size) return pools;
  return pools.map((pool) => {
    const icon = names.get(String(pool.amm_account || "").trim().toLowerCase());
    return icon ? { ...pool, icon } : pool;
  });
}

function rpcOptions(options) {
  return { fetchImpl: options.fetchImpl, rpcUrl: options.rpcUrl, timeoutMs: 8_000 };
}

function accountIsAmm(result) {
  if (result?.account_data?.AMMID) return true;
  if (result?.account_data) return false;
  const error = String(result?.error || "");
  const message = String(result?.error_message || "");
  if (error === "actNotFound" || /account not found/i.test(message)) return false;
  return null;
}

async function readPage(options, marker) {
  const params = {
    account: XDX_ISSUER,
    ledger_index: "validated",
    limit: PAGE_LIMIT,
  };
  if (marker) params.marker = marker;
  return withXrplRetry(() => xrplRpc("account_lines", params, rpcOptions(options)), {
    retries: 1,
    waitMs: 200,
  });
}

async function walkLines(options, budgetMs) {
  const started = Date.now();
  while (!state.linesDone && state.pages < MAX_PAGES && Date.now() - started < budgetMs) {
    let page;
    try {
      page = await readPage(options, state.marker);
    } catch (err) {
      state.error = String(err?.message || err || "account_lines failed");
      return false;
    }
    if (!page || page.error || !Array.isArray(page.lines)) {
      state.error = page?.error || "account_lines incomplete";
      return false;
    }
    const found = xdxAmmCandidateLines(page.lines);
    const seen = new Set(state.candidates.map((row) => row.account));
    for (const row of found) {
      if (seen.has(row.account)) continue;
      seen.add(row.account);
      state.candidates.push(row);
    }
    state.pages += 1;
    state.marker = page.marker || null;
    if (!page.marker) {
      state.linesDone = true;
      state.error = "";
    }
  }
  return state.linesDone;
}

async function confirmCandidates(options, budgetMs) {
  const started = Date.now();
  const pending = state.candidates.filter((row) => !state.verdicts.has(row.account));
  let unknown = false;
  await mapLimit(pending, 8, async (row) => {
    if (Date.now() - started >= budgetMs) {
      unknown = true;
      return;
    }
    try {
      const info = await xrplRpc(
        "account_info",
        { account: row.account, ledger_index: "validated" },
        rpcOptions(options)
      );
      const verdict = accountIsAmm(info);
      if (verdict == null) {
        unknown = true;
        return;
      }
      if (!verdict) {
        state.verdicts.set(row.account, { amm: false });
        return;
      }
      const amm = await xrplRpc(
        "amm_info",
        { amm_account: row.account, ledger_index: "validated" },
        rpcOptions(options)
      );
      const built = rowFromAmmInfo(amm);
      if (!built) {
        state.verdicts.set(row.account, { amm: false });
        return;
      }
      state.verdicts.set(row.account, { amm: true, row: built });
    } catch {
      unknown = true;
    }
  });
  const pools = [];
  for (const row of state.candidates) {
    const verdict = state.verdicts.get(row.account);
    if (verdict?.amm && verdict.row) pools.push(verdict.row);
    else if (!verdict) unknown = true;
  }
  return { pools: disambiguatePairs(pools), unknown };
}

async function discoverUncached(options = {}) {
  const now = Number(options.now) || Date.now();
  if (options.fresh) {
    state = emptyState();
  }
  if (!options.fresh && state.pools && now - state.poolsAt < POOLS_MS) {
    return {
      pools: state.pools,
      complete: true,
      error: state.error || null,
      source: "xrpl-lines",
    };
  }
  const lineBudget = Number(options.lineBudgetMs) || 32_000;
  const confirmBudget = Number(options.confirmBudgetMs) || 16_000;
  const linesDone = await walkLines(options, lineBudget);
  const confirmed = await confirmCandidates(options, confirmBudget);
  const complete = Boolean(linesDone && !confirmed.unknown);
  if (complete) {
    state.pools = confirmed.pools;
    state.poolsAt = now;
    state.error = "";
  } else if (!confirmed.pools.length && state.pools) {
    return {
      pools: state.pools,
      complete: true,
      stale: true,
      error: state.error || "ledger amm scan incomplete",
      source: "xrpl-lines",
    };
  }
  return {
    pools: confirmed.pools,
    complete,
    error: state.error || null,
    source: "xrpl-lines",
  };
}

export function discoverLedgerXdxPools(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && state.pools && now - state.poolsAt < POOLS_MS) {
    return Promise.resolve({
      pools: state.pools,
      complete: true,
      error: state.error || null,
      source: "xrpl-lines",
    });
  }
  if (inflight && !options.fresh) return inflight;
  inflight = discoverUncached(options).finally(() => {
    inflight = null;
  });
  return inflight;
}

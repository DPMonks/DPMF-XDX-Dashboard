import { XDX_HEX, XDX_ISSUER } from "../src/constants/ledger.js";
import { poolReservesFromAmmInfo } from "../src/utils/ammInfo.js";
import { currencyLabelFromCode, LOW_LIQUIDITY_XRP } from "../src/utils/xrplToAmm.js";
import { mapLimit } from "./liveAmmReserves.js";
import { xrplRpc } from "./xrplBookOffers.js";

const POOLS_MS = 10 * 60_000;
const PAGE_LIMIT = 400;
const MAX_PAGES = 160;
const PUBLIC_RPCS = [
  "https://xrplcluster.com",
  "https://s2.ripple.com:51234",
  "https://s1.ripple.com:51234",
  "https://xrpl.ws",
];

function rpcUrls(rpcUrl) {
  const first = String(rpcUrl || "").trim();
  return [...new Set([first, ...PUBLIC_RPCS].filter(Boolean))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  stickyRpc = "";
}

export function ledgerAmmDiscoveryStatus() {
  return {
    count: Array.isArray(state.pools) ? state.pools.length : 0,
    error: state.error || null,
    complete: Boolean(state.linesDone && state.pools),
    pages: state.pages,
    candidates: state.candidates.length,
    lines_done: Boolean(state.linesDone),
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
    // AMM lines leave no_ripple_peer unset. Ordinary zero limit wallets set it.
    if (line?.no_ripple_peer) continue;
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

function rpcOptions(options) {
  return {
    fetchImpl: options.fetchImpl,
    rpcUrl: options.rpcUrl,
    timeoutMs: Number(options.timeoutMs) || 8_000,
  };
}

function retryableRpc(result) {
  const error = String(result?.error || "");
  if (!error) return false;
  if (error === "actNotFound" || error === "actMalformed") return false;
  return /tooBusy|slowDown|noNetwork|noPermission|timeout|serverBusy|abort|ECONNRESET|fetch failed/i.test(error);
}

let stickyRpc = "";

async function rpcRotate(method, params, options) {
  const urls = options.rotate === false
    ? [stickyRpc || options.rpcUrl || PUBLIC_RPCS[0]]
    : rpcUrls(stickyRpc || options.rpcUrl);
  let last = null;
  for (const rpcUrl of urls) {
    const attempts = options.rotate === false ? 1 : 2;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const result = await xrplRpc(method, params, { ...rpcOptions(options), rpcUrl });
        if (result && !retryableRpc(result) && !result.error) {
          if (method === "account_lines") stickyRpc = rpcUrl;
          return result;
        }
        last = result;
        if (result && !retryableRpc(result)) return result;
      } catch (err) {
        last = { error: String(err?.message || err) };
      }
      if (attempt === 0 && attempts > 1) await sleep(400);
    }
  }
  return last;
}

function confirmUrls() {
  const hot = stickyRpc;
  const cool = PUBLIC_RPCS.filter((url) => url !== hot);
  return cool.length ? cool : PUBLIC_RPCS;
}

async function rpcConfirm(method, params, options, deadline, salt) {
  const remaining = deadline - Date.now();
  if (remaining < 250) return { error: "timeout" };
  const urls = confirmUrls();
  const rpcUrl = urls[Math.abs(Number(salt) || 0) % urls.length];
  const timeoutMs = Math.min(4_000, remaining);
  try {
    return await xrplRpc(method, params, { ...rpcOptions(options), rpcUrl, timeoutMs });
  } catch (err) {
    return { error: String(err?.message || err) };
  }
}

async function readPage(options, marker) {
  const params = {
    account: XDX_ISSUER,
    ledger_index: "validated",
    limit: PAGE_LIMIT,
  };
  if (marker) params.marker = marker;
  return rpcRotate("account_lines", params, options);
}

async function walkLines(options, budgetMs) {
  const started = Date.now();
  while (!state.linesDone && state.pages < MAX_PAGES && Date.now() - started < budgetMs) {
    let page;
    try {
      page = await readPage(options, state.marker);
    } catch (err) {
      page = { error: String(err?.message || err || "account_lines failed") };
    }
    if (!page || page.error || !Array.isArray(page.lines)) {
      state.error = page?.error || "account_lines incomplete";
      if (!retryableRpc(page) || Date.now() - started > budgetMs - 800) return false;
      await sleep(350);
      continue;
    }
    const found = xdxAmmCandidateLines(page.lines);
    const seen = new Set(state.candidates.map((row) => row.account));
    for (const row of found) {
      if (seen.has(row.account)) continue;
      seen.add(row.account);
      state.candidates.push(row);
    }
    if (!page.lines.length && state.pages === 0) {
      state.error = "account_lines empty";
      if (Date.now() - started > budgetMs - 800) return false;
      await sleep(400);
      continue;
    }
    state.pages += 1;
    state.marker = page.marker || null;
    if (!page.marker) {
      state.linesDone = true;
      state.error = "";
    }
  }
  if (!state.linesDone) {
    state.error = state.error || `account_lines stopped after ${state.pages} pages`;
  }
  return state.linesDone;
}

function poolsFromVerdicts() {
  const pools = [];
  let unknown = false;
  for (const row of state.candidates) {
    const verdict = state.verdicts.get(row.account);
    if (verdict?.amm && verdict.row) pools.push(verdict.row);
    else if (!verdict) unknown = true;
  }
  return { pools: disambiguatePairs(pools), unknown };
}

async function confirmCandidates(options, budgetMs) {
  const deadline = Date.now() + budgetMs;
  // AMM trust lines sit at the end of the issuer list. Check those first.
  // The line walk leaves its node busy, so confirmation uses the other public nodes.
  // amm_info is one call: a pool comes back, and a normal wallet is actMalformed.
  const pending = state.candidates.filter((row) => !state.verdicts.has(row.account)).reverse();
  await mapLimit(pending, 4, async (row, index) => {
    if (Date.now() >= deadline) return;
    let amm = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (Date.now() >= deadline) return;
      try {
        amm = await rpcConfirm(
          "amm_info",
          { amm_account: row.account, ledger_index: "validated" },
          options,
          deadline,
          index + attempt
        );
      } catch (err) {
        amm = { error: String(err?.message || err) };
      }
      if (amm && !retryableRpc(amm)) break;
      if (attempt < 2 && deadline - Date.now() > 300) await sleep(300);
    }
    const built = rowFromAmmInfo(amm);
    if (built) {
      state.verdicts.set(row.account, { amm: true, row: built });
      return;
    }
    if (amm && !retryableRpc(amm) && amm.error) {
      state.verdicts.set(row.account, { amm: false });
    }
  });
  return poolsFromVerdicts();
}

function discoveryBody(extra = {}) {
  return {
    source: "xrpl-lines",
    pages: state.pages,
    candidates: state.candidates.length,
    lines_done: Boolean(state.linesDone),
    ...extra,
  };
}

async function discoverUncached(options = {}) {
  const now = Number(options.now) || Date.now();
  if (options.fresh) {
    state = emptyState();
    stickyRpc = "";
  }
  if (!options.fresh && state.pools && now - state.poolsAt < POOLS_MS) {
    return discoveryBody({
      pools: state.pools,
      complete: true,
      error: null,
    });
  }
  const lineBudget = Number(options.lineBudgetMs) || 40_000;
  const confirmBudget = Number(options.confirmBudgetMs) || 16_000;
  const linesDone = await walkLines(options, lineBudget);
  // Confirming before the last page only classifies ordinary wallets.
  // A short pause lets the line-walk node cool down before amm_info.
  if (linesDone && confirmBudget >= 2_000) await sleep(300);
  const confirmed = linesDone
    ? await confirmCandidates(options, Math.max(0, confirmBudget - (confirmBudget >= 2_000 ? 300 : 0)))
    : poolsFromVerdicts();
  const complete = Boolean(linesDone && !confirmed.unknown);
  if (complete) {
    state.pools = confirmed.pools;
    state.poolsAt = now;
    state.error = "";
  } else if (!confirmed.pools.length && state.pools) {
    return discoveryBody({
      pools: state.pools,
      complete: true,
      stale: true,
      error: state.error || "ledger amm scan incomplete",
    });
  } else if (!complete) {
    const pending = state.candidates.filter((row) => !state.verdicts.has(row.account)).length;
    state.error = linesDone
      ? `confirm left ${pending} of ${state.candidates.length} after ${state.pages} pages`
      : state.error || `account_lines stopped after ${state.pages} pages`;
  }
  return discoveryBody({
    pools: confirmed.pools,
    complete,
    error: state.error || null,
  });
}

export function discoverLedgerXdxPools(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && state.pools && now - state.poolsAt < POOLS_MS) {
    return Promise.resolve(discoveryBody({
      pools: state.pools,
      complete: true,
      error: null,
    }));
  }
  if (inflight && !options.fresh) return inflight;
  inflight = discoverUncached(options).finally(() => {
    inflight = null;
  });
  return inflight;
}

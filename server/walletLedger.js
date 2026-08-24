import { xrplRpc } from "./xrplBookOffers.js";
import { hexCurrencyLabel } from "../src/wallet/ammCreate.js";
import { activityFromAccountTx, ordersFromAccountOffers } from "../src/wallet/ledgerOrders.js";
import { POOLS, RLUSD_ISSUER, XDX_ISSUER } from "../src/constants/ledger.js";
import { lpPositionFromPool } from "../src/wallet/composeWallet.js";
import { loadLiveAmmReserves } from "./liveAmmReserves.js";
import { loadLiveMarket } from "./liveCatalog.js";

const CACHE_MS = 8_000;
const LINE_PAGE_LIMIT = 8;
const LP_CURRENCY_RE = /^03[A-F0-9]{38}$/i;
const XDX_CURRENCY_RE = /^(XDX|5844580000000000000000000000000000000000)$/i;
const RLUSD_CURRENCY_RE = /^(RLUSD|524C555344000000000000000000000000000000)$/i;
const cache = new Map();

function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  return loader().then((body) => {
    cache.set(key, { at: Date.now(), body });
    return body;
  });
}

export function invalidateWalletLedger(address) {
  const name = String(address || "").trim();
  if (!name) return;
  cache.delete(`offers:${name}`);
  cache.delete(`activity:${name}`);
  cache.delete(`lines:${name}`);
  cache.delete(`raw-lines:${name}`);
  cache.delete(`balances:${name}`);
  cache.delete(`lp:${name}`);
}

function iouBalanceFromLines(rows = [], issuer, currencyRe) {
  let total = 0;
  let found = false;
  for (const row of Array.isArray(rows) ? rows : []) {
    const currency = String(row?.currency || "").toUpperCase();
    const account = String(row?.account || row?.issuer || "").trim();
    if (!currencyRe.test(currency)) continue;
    if (issuer && account && account !== issuer) continue;
    const n = Number(row?.balance);
    if (!Number.isFinite(n)) continue;
    total += n;
    found = true;
  }
  return found ? total : null;
}

export function xdxBalanceFromLines(rows = [], issuer = XDX_ISSUER) {
  return iouBalanceFromLines(rows, issuer, XDX_CURRENCY_RE);
}

export function rlusdBalanceFromLines(rows = [], issuer = RLUSD_ISSUER) {
  return iouBalanceFromLines(rows, issuer, RLUSD_CURRENCY_RE);
}

export function iouFromGatewayBalances(result, issuer, currencyRe) {
  let total = 0;
  let found = false;
  for (const bag of [result?.balances, result?.assets]) {
    if (!bag || typeof bag !== "object") continue;
    for (const [account, rows] of Object.entries(bag)) {
      if (issuer && account && account !== issuer) continue;
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!currencyRe.test(String(row?.currency || ""))) continue;
        const n = Number(row?.value ?? row?.balance);
        if (!Number.isFinite(n)) continue;
        total += n;
        found = true;
      }
    }
  }
  return found ? total : null;
}

export function lpHoldingsFromLines(rows = []) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const currency = String(row?.currency || "").toUpperCase();
    if (!LP_CURRENCY_RE.test(currency)) continue;
    const n = Number(row?.balance);
    if (!(n > 0)) continue;
    out.push({
      lp_currency: currency,
      amm_account: String(row?.account || row?.issuer || "").trim(),
      lp_balance: n,
    });
  }
  return out;
}

function knownPoolForLp(holding) {
  const hex = String(holding?.lp_currency || "").toUpperCase();
  const amm = String(holding?.amm_account || "");
  return (
    POOLS.find(
      (pool) =>
        String(pool.lpHex || "").toUpperCase() === hex ||
        (amm && pool.amm === amm)
    ) || null
  );
}

export async function loadWalletOffers(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) return { account: null, orders: [], source: "empty" };
  if (options.fresh) cache.delete(`offers:${name}`);
  return cached(`offers:${name}`, async () => {
    try {
      const result = await xrplRpc("account_offers", {
        account: name,
        ledger_index: "validated",
        limit: 50,
      });
      return {
        account: name,
        orders: ordersFromAccountOffers(result.offers || [], name),
        source: "xrpl",
      };
    } catch {
      return { account: name, orders: [], source: "empty" };
    }
  });
}

function decodeLineCurrency(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.length <= 3) return value.toUpperCase();
  return String(hexCurrencyLabel(value) || value.slice(0, 12)).toUpperCase();
}

export function mapAccountLine(line) {
  const issuer = String(line?.account || line?.issuer || "").trim();
  const currency = String(line?.currency || "").trim();
  if (!issuer || !currency) return null;
  if (XDX_CURRENCY_RE.test(currency)) return null;
  const lp = LP_CURRENCY_RE.test(currency);
  return {
    currency,
    ticker: lp ? "LP" : decodeLineCurrency(currency),
    issuer,
    balance: String(line?.balance ?? "0"),
    limit: String(line?.limit ?? ""),
    noRipple: Boolean(line?.no_ripple),
    lp,
  };
}

export function linesFromAccountLines(rows = []) {
  const lines = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const mapped = mapAccountLine(row);
    if (mapped) lines.push(mapped);
  }
  return lines;
}

async function fetchRawAccountLines(name, options = {}) {
  const lines = [];
  let marker;
  for (let page = 0; page < LINE_PAGE_LIMIT; page += 1) {
    const params = {
      account: name,
      ledger_index: "validated",
      limit: 400,
    };
    if (marker) params.marker = marker;
    const result = await xrplRpc("account_lines", params, options);
    lines.push(...(result?.lines || []));
    marker = result?.marker;
    if (!marker) break;
  }
  return lines;
}

export async function loadRawAccountLines(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) return { account: null, lines: [], source: "empty" };
  if (options.fresh) cache.delete(`raw-lines:${name}`);
  return cached(`raw-lines:${name}`, async () => {
    try {
      const lines = await fetchRawAccountLines(name, options);
      return { account: name, lines, source: "xrpl" };
    } catch {
      return { account: name, lines: [], source: "empty" };
    }
  });
}

export async function loadWalletLines(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) return { account: null, lines: [], source: "empty" };
  if (options.fresh) cache.delete(`lines:${name}`);
  return cached(`lines:${name}`, async () => {
    const raw = await loadRawAccountLines(name, options);
    return {
      account: name,
      lines: linesFromAccountLines(raw.lines),
      source: raw.source,
    };
  });
}

export async function loadWalletBalancesFromLedger(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) {
    return { account: null, xrp: null, xdx: null, rlusd: null, lp: 0, source: "empty", balance_drops: null };
  }
  if (options.fresh) cache.delete(`balances:${name}`);
  return cached(`balances:${name}`, async () => {
    const [infoResult, raw] = await Promise.all([
      xrplRpc("account_info", { account: name, ledger_index: "validated" }, options).catch(() => null),
      loadRawAccountLines(name, options),
    ]);
    let xdx = xdxBalanceFromLines(raw.lines);
    let rlusd = rlusdBalanceFromLines(raw.lines);
    if (xdx == null || rlusd == null) {
      try {
        const gateway = await xrplRpc(
          "gateway_balances",
          { account: name, ledger_index: "validated", hotwallet: [] },
          options
        );
        if (xdx == null) xdx = iouFromGatewayBalances(gateway, XDX_ISSUER, XDX_CURRENCY_RE);
        if (rlusd == null) rlusd = iouFromGatewayBalances(gateway, RLUSD_ISSUER, RLUSD_CURRENCY_RE);
      } catch {
        // keep line totals
      }
    }
    const lpRows = lpHoldingsFromLines(raw.lines);
    const drops = Number(infoResult?.account_data?.Balance);
    const xrp = Number.isFinite(drops) ? drops / 1_000_000 : null;
    const source = infoResult || raw.source === "xrpl" ? "xrpl" : "empty";
    return {
      account: name,
      xrp,
      xdx,
      rlusd,
      lp: lpRows.reduce((sum, row) => sum + Number(row.lp_balance || 0), 0),
      source,
      balance_drops: Number.isFinite(drops) ? drops : null,
    };
  });
}

export async function loadWalletNetworthFromLedger(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) return { account: null, totalUsd: 0, totalGbp: 0, source: "empty" };
  const [snap, market] = await Promise.all([
    loadWalletBalancesFromLedger(name, options),
    loadLiveMarket(options).catch(() => null),
  ]);
  const xdxUsd = Number(market?.prices?.xdxUsd || 0);
  const xrpUsd = Number(market?.prices?.xrpUsd || 0);
  const xrpGbp = Number(market?.prices?.xrpGbp || 0);
  const xdx = Number(snap.xdx) || 0;
  const xrp = Number(snap.xrp) || 0;
  const rlusd = Number(snap.rlusd) || 0;
  const totalUsd = xdx * xdxUsd + xrp * xrpUsd + rlusd;
  const gbpPerUsd = xrpUsd > 0 && xrpGbp > 0 ? xrpGbp / xrpUsd : 0;
  return {
    account: name,
    totalUsd,
    totalGbp: gbpPerUsd ? totalUsd * gbpPerUsd : 0,
    xdx,
    xrp,
    rlusd,
    source: snap.source || "xrpl",
  };
}

export async function loadWalletLpFromLedger(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) return { account: null, positions: [], source: "empty" };
  if (options.fresh) cache.delete(`lp:${name}`);
  return cached(`lp:${name}`, async () => {
    const raw = await loadRawAccountLines(name, options);
    const held = lpHoldingsFromLines(raw.lines);
    const positions = [];
    for (const holding of held) {
      const known = knownPoolForLp(holding);
      const live = await loadLiveAmmReserves(
        {
          ammAccount: known?.amm || holding.amm_account,
          pair: known?.pair,
          quote: known?.quote,
          issuer: known?.quoteIssuer,
          hex: known?.quoteHex,
        },
        options
      );
      const position = lpPositionFromPool(
        holding.lp_balance,
        {
          pool: known?.pair || live?.pair,
          pool_name: known?.pair || live?.pair,
          quote: known?.quote || live?.quote,
          amm_account: live?.amm_account || known?.amm || holding.amm_account,
          lp_currency: live?.lp_currency || holding.lp_currency,
          reserve_asset: live?.reserve_xdx ?? live?.reserve_asset,
          reserve_currency: live?.reserve_currency ?? live?.reserve_quote,
          lp_supply: live?.lp_supply,
          trading_fee: live?.trading_fee,
        },
        known?.pair || live?.pair
      );
      if (position) positions.push(position);
    }
    return { account: name, positions, source: raw.source || "xrpl" };
  });
}

export async function loadWalletActivity(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) return { account: null, activity: [], source: "empty" };
  if (options.fresh) cache.delete(`activity:${name}`);
  return cached(`activity:${name}`, async () => {
    try {
      const result = await xrplRpc("account_tx", {
        account: name,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 30,
        binary: false,
        forward: false,
      });
      return {
        account: name,
        activity: activityFromAccountTx(result.transactions || [], name),
        source: "xrpl",
      };
    } catch {
      return { account: name, activity: [], source: "empty" };
    }
  });
}

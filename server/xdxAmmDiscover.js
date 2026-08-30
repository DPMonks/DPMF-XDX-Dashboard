import { XDX_HEX, XDX_ISSUER, XDX_XRPL_TO_MD5 } from "../src/constants/ledger.js";
import { quoteTickerFromCurrency } from "../src/wallet/ammVote.js";
import { isXdxAmmPair } from "../src/wallet/lpIncome.js";
import { mapLimit } from "./liveAmmReserves.js";
import { xrplRpc } from "./xrplBookOffers.js";
import { FREE_API_HEADERS } from "./xrplToCatalog.js";

export const XRPL_TO_XDX_AMM_URL = `https://api.xrpl.to/v1/amm?token=${XDX_XRPL_TO_MD5}`;

const CACHE_MS = 60_000;
const PAGE_LIMIT = 100;
const PAGE_CAP = 500;
const LEDGER_SCAN_MAX = 48;
let cache = { at: 0, specs: null };
let ledgerCursor = { lastIndex: 0, specs: [] };

export function resetXdxAmmDiscoverCache() {
  cache = { at: 0, specs: null };
  ledgerCursor = { lastIndex: 0, specs: [] };
}

function sameIssuer(value, want) {
  return String(value || "").trim().toUpperCase() === String(want || "").trim().toUpperCase();
}

function isNativeXrp(asset = {}) {
  const currency = String(asset.currency || "").trim().toUpperCase();
  const issuer = String(asset.issuer || "").trim().toUpperCase();
  return currency === "XRP" || issuer === "XRPL" || issuer === "";
}

export function isXdxAsset(asset = {}) {
  if (!asset || typeof asset !== "object") return false;
  if (isNativeXrp(asset)) return false;
  const currency = String(asset.currency || "").trim().toUpperCase().replace(/^0X/, "");
  const ticker = quoteTickerFromCurrency(asset.currency, asset.issuer);
  return (
    ticker === "XDX" ||
    currency === "XDX" ||
    currency.startsWith("584458") ||
    currency === XDX_HEX ||
    sameIssuer(asset.issuer, XDX_ISSUER)
  );
}

function quoteAssetFromPair(asset1, asset2) {
  if (isXdxAsset(asset1) && !isXdxAsset(asset2)) return asset2;
  if (isXdxAsset(asset2) && !isXdxAsset(asset1)) return asset1;
  return null;
}

function quoteHex(asset = {}) {
  const raw = String(asset.currency || "")
    .trim()
    .replace(/^0x/i, "")
    .toUpperCase();
  return /^[A-F0-9]{40}$/.test(raw) ? raw : null;
}

export function specsFromXrplToPool(pool = {}) {
  if (!pool || typeof pool !== "object") return null;
  const status = String(pool.status || "active").toLowerCase();
  if (status && status !== "active") return null;
  const quoteAsset = quoteAssetFromPair(pool.asset1, pool.asset2);
  if (!quoteAsset) return null;
  const native = isNativeXrp(quoteAsset);
  const ticker = native ? "XRP" : quoteTickerFromCurrency(quoteAsset.currency, quoteAsset.issuer);
  if (!ticker) return null;
  const pair = `XDX/${ticker}`;
  if (!isXdxAmmPair(pair)) return null;
  const hex = native ? null : quoteHex(quoteAsset);
  return {
    pair,
    quote: ticker,
    ammAccount: pool.ammAccount || pool.amm_account || pool.account || null,
    amm: pool.ammAccount || pool.amm_account || pool.account || null,
    issuer: native ? null : quoteAsset.issuer || null,
    quote_issuer: native ? null : quoteAsset.issuer || null,
    hex,
    quote_hex: hex,
    lpHex: pool.lpTokenCurrency || pool.lp_currency || pool.lp_currency_hex || null,
    pool_name: pair,
    pool: pair,
  };
}

function amountAsDiscoverAsset(amount) {
  if (amount == null) return null;
  if (typeof amount !== "object") return { currency: "XRP", issuer: "XRPL" };
  return { currency: amount.currency, issuer: amount.issuer };
}

export function unwrapLedgerTx(row) {
  if (!row || typeof row === "string") return { tx: null, meta: {} };
  if (row.TransactionType) {
    return { tx: row, meta: row.meta || row.metaData || {} };
  }
  return {
    tx: row.tx_json || row.tx || row.transaction || null,
    meta: row.meta || row.metaData || {},
  };
}

export function ammAccountFromCreateMeta(meta = {}, tx = {}) {
  const nodes = Array.isArray(meta.AffectedNodes) ? meta.AffectedNodes : [];
  for (const wrap of nodes) {
    const created = wrap?.CreatedNode;
    if (created?.LedgerEntryType === "AMM" && created.NewFields?.Account) {
      return created.NewFields.Account;
    }
  }
  for (const wrap of nodes) {
    const created = wrap?.CreatedNode;
    if (created?.LedgerEntryType === "AccountRoot") {
      const account = created.NewFields?.Account;
      if (account && account !== tx.Account) return account;
    }
  }
  return null;
}

function lpHexFromCreateMeta(meta = {}) {
  const nodes = Array.isArray(meta.AffectedNodes) ? meta.AffectedNodes : [];
  for (const wrap of nodes) {
    const fields =
      wrap?.CreatedNode?.NewFields || wrap?.CreatedNode?.FinalFields || wrap?.ModifiedNode?.FinalFields || {};
    const currency = fields.LPTokenBalance?.currency || fields.Balance?.currency;
    if (/^03[A-Fa-f0-9]{38}$/.test(String(currency || ""))) return currency;
  }
  return null;
}

export function specFromAmmCreateTx(tx = {}, meta = {}) {
  if (String(tx.TransactionType || "") !== "AMMCreate") return null;
  const result = meta.TransactionResult || meta.transactionResult || "";
  if (result && result !== "tesSUCCESS") return null;
  return specsFromXrplToPool({
    status: "active",
    ammAccount: ammAccountFromCreateMeta(meta, tx),
    asset1: amountAsDiscoverAsset(tx.Amount),
    asset2: amountAsDiscoverAsset(tx.Amount2),
    lpTokenCurrency: lpHexFromCreateMeta(meta),
  });
}

export function specsFromLedgerTransactions(transactions = []) {
  const specs = [];
  const seen = new Set();
  for (const row of Array.isArray(transactions) ? transactions : []) {
    const { tx, meta } = unwrapLedgerTx(row);
    const spec = specFromAmmCreateTx(tx, meta);
    if (!spec) continue;
    const key = String(spec.ammAccount || spec.pair);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    specs.push(spec);
  }
  return specs;
}

export function mergeDiscoveredSpecs(...lists) {
  const specs = [];
  const seen = new Set();
  for (const list of lists) {
    for (const spec of Array.isArray(list) ? list : []) {
      const key = String(spec?.ammAccount || spec?.amm || spec?.pair || "");
      if (!key || seen.has(key)) continue;
      seen.add(key);
      specs.push(spec);
    }
  }
  return specs;
}

export function parseXrplToAmmPools(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.pools)
      ? payload.pools
      : [];
  const specs = [];
  const seen = new Set();
  for (const row of rows) {
    const spec = specsFromXrplToPool(row);
    if (!spec) continue;
    const key = String(spec.ammAccount || spec.pair);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    specs.push(spec);
  }
  return specs;
}

export function mergeDiscoveredAmmRows(stored = [], specs = []) {
  const rows = Array.isArray(stored) ? [...stored] : [];
  const seenAmm = new Set(rows.map((row) => String(row.amm_account || "").trim()).filter(Boolean));
  const seenPair = new Set(
    rows
      .map((row) =>
        String(row.pool_name || row.pool || row.pair || "")
          .replace(/\s+/g, "")
          .toUpperCase()
      )
      .filter(Boolean)
  );
  for (const spec of Array.isArray(specs) ? specs : []) {
    const amm = String(spec.ammAccount || spec.amm || spec.amm_account || "").trim();
    const pair = String(spec.pair || spec.pool_name || spec.pool || "")
      .replace(/\s+/g, "")
      .toUpperCase();
    if ((amm && seenAmm.has(amm)) || (pair && seenPair.has(pair))) continue;
    if (amm) seenAmm.add(amm);
    if (pair) seenPair.add(pair);
    rows.push({
      amm_account: amm || null,
      pool_name: pair,
      pool: pair,
      quote: spec.quote || (pair.includes("/") ? pair.split("/")[1] : null),
      quote_issuer: spec.quote_issuer || spec.issuer || null,
      quote_hex: spec.quote_hex || spec.hex || null,
      lp_currency_hex: spec.lpHex || spec.lp_currency || spec.lp_currency_hex || null,
      reserve_xdx: spec.reserve_xdx ?? null,
    });
  }
  return rows;
}

async function fetchAmmPage(url, options = {}) {
  const res = await (options.fetchImpl || fetch)(url, {
    headers: FREE_API_HEADERS,
    signal: AbortSignal.timeout(Number(options.timeoutMs) || 8000),
  });
  if (!res.ok) throw new Error(`xrpl.to amm ${res.status}`);
  return res.json();
}

export async function loadXrplToXdxAmmPools(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const pageSize = Number(options.limit) || PAGE_LIMIT;
  let offset = 0;
  let total = Infinity;
  const pools = [];
  while (offset < total && offset < PAGE_CAP) {
    const url = new URL(XRPL_TO_XDX_AMM_URL);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("limit", String(pageSize));
    const body = await fetchAmmPage(url.toString(), { ...options, fetchImpl });
    const page = Array.isArray(body?.pools) ? body.pools : [];
    total = Number(body?.total);
    if (!Number.isFinite(total)) total = offset + page.length;
    pools.push(...page);
    if (!page.length || page.length < pageSize) break;
    offset += page.length;
  }
  return pools;
}

function rememberLedgerSpecs(found) {
  ledgerCursor.specs = mergeDiscoveredSpecs(ledgerCursor.specs, found);
  return ledgerCursor.specs;
}

export async function scanRecentXdxAmmCreates(options = {}) {
  const rpc = {
    fetchImpl: options.fetchImpl,
    rpcUrl: options.rpcUrl,
  };
  const closed = await xrplRpc("ledger_closed", {}, rpc);
  const tip = Number(closed.ledger_index);
  if (!Number.isFinite(tip) || tip <= 0) return ledgerCursor.specs;
  const max = Number(options.ledgerLimit) || LEDGER_SCAN_MAX;
  const start = ledgerCursor.lastIndex > 0 ? ledgerCursor.lastIndex + 1 : tip - max + 1;
  const from = Math.max(1, Math.min(start, tip));
  const indexes = [];
  for (let index = from; index <= tip && indexes.length < max; index += 1) indexes.push(index);
  if (!indexes.length) return ledgerCursor.specs;
  const pages = await mapLimit(indexes, Number(options.concurrency) || 3, async (index) => {
    try {
      const result = await xrplRpc(
        "ledger",
        { ledger_index: index, transactions: true, expand: true },
        rpc
      );
      return result?.ledger?.transactions || result?.ledger?.txs || [];
    } catch {
      return [];
    }
  });
  const found = specsFromLedgerTransactions(pages.flat());
  ledgerCursor.lastIndex = tip;
  return rememberLedgerSpecs(found);
}

export async function discoverXdxAmmSpecs(options = {}) {
  const now = Number(options.now) || Date.now();
  const cached = !options.fresh && cache.specs && now - cache.at < CACHE_MS;
  let fromIndex = cached ? cache.specs : null;
  if (!fromIndex) {
    try {
      const pools = await loadXrplToXdxAmmPools(options);
      const specs = parseXrplToAmmPools(pools);
      if (specs.length) cache = { at: now, specs };
      fromIndex = specs;
    } catch {
      fromIndex = cache.specs || [];
    }
  }
  if (options.skipLedgerScan) return mergeDiscoveredSpecs(fromIndex, ledgerCursor.specs);
  await scanRecentXdxAmmCreates(options).catch(() => ledgerCursor.specs);
  return mergeDiscoveredSpecs(fromIndex, ledgerCursor.specs);
}

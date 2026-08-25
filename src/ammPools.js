import { issuedAmountValue, isXdxAmount, overlayLiveAmmReserves } from "./utils/ammInfo.js";
import { preferUsdPoolSplit } from "./utils/poolSplit.js";
import { normalizeOrderbookPair } from "./orderbook.js";

export function ammPoolName(row) {
  return String(row?.pool || row?.pool_name || row?.pair || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function filterAmmPools(pools = [], query = "") {
  const q = String(query || "")
    .trim()
    .replace(/^XDX\s*\/\s*/i, "")
    .toUpperCase();
  const rows = Array.isArray(pools) ? pools : [];
  if (!q) return rows;
  return rows.filter((row) => {
    const hay = [
      row?.pool,
      row?.pool_name,
      row?.pair,
      row?.quote,
      row?.amm_account,
      row?.quote_issuer,
    ]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();
    return hay.includes(q);
  });
}

export function mergeAmmPoolLists(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      const key = String(row?.amm_account || ammPoolName(row));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

export function searchAmmAccount(query) {
  const raw = String(query || "").trim();
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(raw) ? raw : "";
}

export function searchPairHint(query) {
  const raw = String(query || "").trim();
  if (!raw || searchAmmAccount(raw)) return "";
  return normalizeOrderbookPair(raw).toUpperCase();
}

export function poolQuoteTicker(pool) {
  const name = ammPoolName(pool);
  const fromName = name.includes("/") ? name.split("/")[1] : "";
  return (
    String(pool?.quote || fromName || "XRP")
      .replace(/^XDX\//i, "")
      .toUpperCase() || "XRP"
  );
}

export function poolAssetTrustlineId(pool) {
  const quote = poolQuoteTicker(pool);
  return quote === "XRP" ? "XDX" : quote;
}

export function poolKey(pool) {
  return String(pool?.amm_account || ammPoolName(pool));
}

export function compactPoolAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const signed = n < 0 ? "-" : "";
  const format = (qty, suffix) => {
    const digits = qty >= 100 ? 1 : 2;
    return `${signed}${qty.toFixed(digits).replace(/\.0$/, "").replace(/(\.\d)0$/, "$1")}${suffix}`;
  };
  if (abs >= 1e9) return format(abs / 1e9, "B");
  if (abs >= 1e6) return format(abs / 1e6, "M");
  if (abs >= 10_000) return format(abs / 1e3, "K");
  if (abs >= 1) return `${signed}${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (abs > 0) return `${signed}${abs.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return "0";
}

export function looksLikeLpAsQuote({ reserveXdx, reserveQuote, lpSupply, quote } = {}) {
  const xdx = Number(reserveXdx);
  const amount = Number(reserveQuote);
  const lp = Number(lpSupply);
  if (!(amount > 0) || !(lp > 0)) return false;
  if (Math.abs(amount - lp) / Math.max(amount, lp) > 0.03) return false;
  const quoteId = String(quote || "").replace(/^XDX\//i, "").toUpperCase();
  if (quoteId === "XRP" && amount > 50_000) return true;
  return xdx > 0 && xdx / amount > 8;
}

export function sanePoolQuoteReserve(pool = {}) {
  const quote = Number(pool?.reserve_currency ?? pool?.reserve_quote);
  if (!(quote > 0)) return null;
  if (
    looksLikeLpAsQuote({
      reserveXdx: pool?.reserve_asset ?? pool?.reserve_xdx,
      reserveQuote: quote,
      lpSupply: pool?.lp_supply,
      quote: pool?.quote || pool?.pool || pool?.pool_name,
    })
  ) {
    return null;
  }
  return quote;
}

export function poolSplitMeta(pool) {
  const xdx = Number(pool?.reserve_asset ?? pool?.reserve_xdx);
  const quote = sanePoolQuoteReserve(pool);
  const lp = Number(pool?.lp_supply);
  const hasXdx = Number.isFinite(xdx) && xdx > 0;
  const hasQuote = quote != null;
  const hasLp = Number.isFinite(lp) && lp > 0;
  return {
    reserveXdx: Number.isFinite(xdx) ? xdx : null,
    reserveQuote: hasQuote ? quote : null,
    lpSupply: Number.isFinite(lp) ? lp : null,
    xdxPerLp: hasLp && hasXdx ? xdx / lp : null,
    quotePerLp: hasLp && hasQuote ? quote / lp : null,
  };
}

function withPoolSplitPercents(pool) {
  const reserveQuote = sanePoolQuoteReserve(pool);
  const split = preferUsdPoolSplit({
    reserveXdx: pool.reserve_asset ?? pool.reserve_xdx,
    reserveQuote,
    lpSupply: reserveQuote != null ? pool.lp_supply : 0,
    price: pool.price,
    xdxUsd: pool.xdxUsd,
    quoteUsd: pool.quote_usd,
  });
  return {
    ...pool,
    reserve_currency: reserveQuote,
    reserve_quote: reserveQuote,
    xdx_pct: split?.xdxPct ?? (reserveQuote != null ? pool.xdx_pct : null),
    quote_pct: split?.quotePct ?? (reserveQuote != null ? pool.quote_pct : null),
    lead: split?.lead || (reserveQuote != null ? pool.lead : null),
  };
}

export function applyLivePoolReserves(pool, live) {
  if (!pool) return pool;
  const leakedLive = looksLikeLpAsQuote({
    reserveXdx: live?.reserve_xdx ?? live?.reserve_asset,
    reserveQuote: live?.reserve_currency ?? live?.reserve_quote,
    lpSupply: live?.lp_supply,
    quote: live?.quote || live?.pair || pool?.quote || pool?.pool,
  });
  const overlaid = live && !leakedLive ? overlayLiveAmmReserves(pool, live) : pool;
  const next = withPoolSplitPercents(overlaid);
  return {
    ...next,
    updated:
      overlaid.reserve_source === "amm_info" || overlaid.reserve_source === "trade"
        ? new Date().toISOString()
        : overlaid.updated,
  };
}

function tradeDeltaFromDetail(detail = {}) {
  const trade = detail.trade || {};
  const tx = detail.txjson || {};
  const action = String(trade.action || detail.action || "").toLowerCase();
  const txType = String(tx.TransactionType || "").toLowerCase();
  const remove = action === "removelp" || txType === "ammwithdraw";
  const first = issuedAmountValue(tx.Amount);
  const second = issuedAmountValue(tx.Amount2);
  const xdxFromTx = isXdxAmount(tx.Amount) ? first : isXdxAmount(tx.Amount2) ? second : first;
  const quoteFromTx = isXdxAmount(tx.Amount) ? second : isXdxAmount(tx.Amount2) ? first : second;
  const xdx =
    Number(trade.withdraw?.base ?? trade.xdx) ||
    Number(remove ? 0 : trade.amount) ||
    Number(xdxFromTx) ||
    0;
  const quote =
    Number(trade.withdraw?.quote ?? (remove ? 0 : trade.quoteQty ?? trade.quote)) ||
    Number(quoteFromTx) ||
    0;
  const lp =
    Number(
      remove
        ? trade.lpAmount ?? issuedAmountValue(tx.LPTokenIn)
        : detail.lpReceived ?? trade.lpOut ?? issuedAmountValue(tx.LPTokenOut)
    ) || 0;
  return { remove, xdx, quote, lp };
}

export function applyTradePoolReserves(pool, detail = {}) {
  if (!pool || !isLpPoolTrade(detail)) return pool;
  const { remove, xdx, quote, lp } = tradeDeltaFromDetail(detail);
  if (!(xdx > 0) && !(quote > 0) && !(lp > 0)) return pool;
  const sign = remove ? -1 : 1;
  const reserveXdx = Math.max(0, (Number(pool.reserve_asset ?? pool.reserve_xdx) || 0) + sign * xdx);
  const currentQuote = sanePoolQuoteReserve(pool) || 0;
  const reserveQuote = quote > 0 ? Math.max(0, currentQuote + sign * quote) : currentQuote || null;
  const lpSupply = Math.max(0, (Number(pool.lp_supply) || 0) + sign * lp);
  return withPoolSplitPercents({
    ...pool,
    reserve_asset: reserveXdx,
    reserve_xdx: reserveXdx,
    reserve_currency: reserveQuote,
    reserve_quote: reserveQuote,
    lp_supply: lpSupply,
    reserve_source: "trade",
    updated: new Date().toISOString(),
  });
}

export function isLpPoolTrade(detail = {}) {
  const action = String(detail?.trade?.action || detail?.action || "").toLowerCase();
  const tx = String(
    detail?.txjson?.TransactionType || detail?.txType || detail?.type || ""
  ).toLowerCase();
  return (
    action === "addlp" ||
    action === "removelp" ||
    action === "createpool" ||
    tx === "ammdeposit" ||
    tx === "ammwithdraw" ||
    tx === "ammcreate"
  );
}

export function tradePoolHint(detail = {}) {
  const trade = detail.trade || {};
  const raw = String(trade.pair || trade.pool || detail.pair || trade.quote || "").replace(/\s+/g, "").toUpperCase();
  if (raw.startsWith("XDX/")) return raw;
  if (raw && !raw.includes("/")) return `XDX/${raw}`;
  return "";
}

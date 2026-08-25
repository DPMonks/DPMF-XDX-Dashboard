import { overlayLiveAmmReserves } from "./utils/ammInfo.js";
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

export function poolSplitMeta(pool) {
  const xdx = Number(pool?.reserve_asset ?? pool?.reserve_xdx);
  const quote = Number(pool?.reserve_currency ?? pool?.reserve_quote);
  const lp = Number(pool?.lp_supply);
  const hasXdx = Number.isFinite(xdx) && xdx > 0;
  const hasQuote = Number.isFinite(quote) && quote > 0;
  const hasLp = Number.isFinite(lp) && lp > 0;
  return {
    reserveXdx: Number.isFinite(xdx) ? xdx : null,
    reserveQuote: Number.isFinite(quote) ? quote : null,
    lpSupply: Number.isFinite(lp) ? lp : null,
    xdxPerLp: hasLp && hasXdx ? xdx / lp : null,
    quotePerLp: hasLp && hasQuote ? quote / lp : null,
  };
}

export function applyLivePoolReserves(pool, live) {
  if (!pool) return pool;
  const overlaid = overlayLiveAmmReserves(pool, live);
  if (overlaid === pool) return pool;
  const split = preferUsdPoolSplit({
    reserveXdx: overlaid.reserve_asset ?? overlaid.reserve_xdx,
    reserveQuote: overlaid.reserve_currency ?? overlaid.reserve_quote,
    lpSupply: overlaid.lp_supply,
    price: overlaid.price,
    xdxUsd: overlaid.xdxUsd,
    quoteUsd: overlaid.quote_usd,
  });
  return {
    ...overlaid,
    xdx_pct: split?.xdxPct ?? overlaid.xdx_pct ?? null,
    quote_pct: split?.quotePct ?? overlaid.quote_pct ?? null,
    lead: split?.lead || overlaid.lead || null,
    updated: overlaid.reserve_source === "amm_info" ? new Date().toISOString() : overlaid.updated,
  };
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

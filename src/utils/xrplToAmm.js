import { XDX_HEX, XDX_ISSUER } from "../constants/ledger.js";

// xrpl.to marks pools under this XRP liquidity as low. Keep them visible.
export const LOW_LIQUIDITY_XRP = 100;

const XDX_ISSUER_KEY = XDX_ISSUER.toLowerCase();

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function positive(value) {
  const n = finite(value);
  return n != null && n > 0 ? n : 0;
}

export function currencyLabelFromCode(code) {
  const raw = String(code || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (upper === "XRP" || upper === "XRPL") return "XRP";
  if (raw.length <= 3 && /^[A-Za-z0-9]{2,3}$/.test(raw)) return upper;
  if (/^[A-Fa-f0-9]{40}$/.test(raw)) {
    const bytes = [];
    for (let i = 0; i < 40; i += 2) bytes.push(Number.parseInt(raw.slice(i, i + 2), 16));
    let end = bytes.length;
    while (end > 0 && bytes[end - 1] === 0) end -= 1;
    if (!end) return upper;
    const chars = [];
    for (let i = 0; i < end; i += 1) {
      const byte = bytes[i];
      if (byte < 32 || byte > 126) return upper;
      chars.push(String.fromCharCode(byte));
    }
    const text = chars.join("").trim();
    if (!text) return upper;
    if (/^[A-Za-z0-9]{2,20}$/.test(text)) {
      const mixed = /[a-z]/.test(text) && /[A-Z]/.test(text);
      return mixed ? text : text.toUpperCase();
    }
    return text;
  }
  return raw.length <= 24 ? raw : upper.slice(0, 12);
}

export function isXdxAmmAsset(asset = {}) {
  const currency = String(asset.currency || "").trim().toUpperCase();
  const issuer = String(asset.issuer || "").trim().toLowerCase();
  return issuer === XDX_ISSUER_KEY || currency === "XDX" || currency === XDX_HEX;
}

function issuerAddress(asset = {}) {
  const issuer = String(asset.issuer || "").trim();
  if (!issuer || issuer.toUpperCase() === "XRPL" || !issuer.startsWith("r")) return null;
  return issuer;
}

function quoteHex(asset = {}) {
  const currency = String(asset.currency || "").trim();
  return /^[A-Fa-f0-9]{40}$/.test(currency) ? currency.toUpperCase() : null;
}

function tagList(row = {}) {
  return Array.isArray(row.tags) ? row.tags.map((tag) => String(tag || "")) : [];
}

export function poolIsLowLiquidity({ tags = [], liquidityXrp = null } = {}) {
  if (tags.some((tag) => /low liquidity/i.test(tag))) return true;
  const liq = finite(liquidityXrp);
  return liq != null && liq < LOW_LIQUIDITY_XRP;
}

function xdxVolumeFromXrp(volumeXrp, xrpPerXdx) {
  const vol = positive(volumeXrp);
  const rate = positive(xrpPerXdx);
  if (!vol || !rate) return null;
  return vol / rate;
}

export function xrpPerXdxOption(options = {}) {
  // The price book field xdxPerXrp stores XRP per 1 XDX. Same number, not an inverse.
  const named = positive(options.xrpPerXdx);
  if (named) return named;
  return positive(options.xdxPerXrp ?? options.xdx_per_xrp);
}

function shortIssuer(address) {
  const text = String(address || "");
  if (text.length <= 11) return text;
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

function pairName(quote, issuer, collided) {
  const label = collided && issuer ? `${quote} ${shortIssuer(issuer)}` : quote;
  return { quote: label, pair: `XDX/${label}` };
}

export function xrplToXdxAmmListUrl({ offset = 0, limit = 100 } = {}) {
  const params = new URLSearchParams({
    issuer: XDX_ISSUER,
    currency: "XDX",
    status: "all",
    limit: String(Math.min(Math.max(Number(limit) || 100, 1), 100)),
    offset: String(Math.max(Number(offset) || 0, 0)),
  });
  return `https://api.xrpl.to/v1/amm?${params}`;
}

export function poolsFromXrplToAmm(payload = {}, options = {}) {
  const rows = Array.isArray(payload?.pools) ? payload.pools : [];
  const xrpPerXdx = xrpPerXdxOption(options);
  const xdxUsd = positive(options.xdxUsd);
  const xrpUsd = positive(options.xrpUsd);
  const parsed = [];
  for (const row of rows) {
    const asset1 = row?.asset1 || row?.asset || {};
    const asset2 = row?.asset2 || {};
    const firstIsXdx = isXdxAmmAsset(asset1);
    const secondIsXdx = isXdxAmmAsset(asset2);
    if (firstIsXdx === secondIsXdx) continue;
    const quoteAsset = firstIsXdx ? asset2 : asset1;
    const liq = row?.currentLiquidity || {};
    const reserveXdx = positive(firstIsXdx ? liq.asset1Amount : liq.asset2Amount);
    const reserveQuote = positive(firstIsXdx ? liq.asset2Amount : liq.asset1Amount);
    const quote = currencyLabelFromCode(quoteAsset.currency) || "IOU";
    if (!quote || quote.toUpperCase() === "XDX") continue;
    const issuer = quote === "XRP" ? null : issuerAddress(quoteAsset);
    const hex = quote === "XRP" ? null : quoteHex(quoteAsset);
    const tags = tagList(row);
    const liquidityXrp = finite(row?.apy24h?.liquidity ?? row?.liquidity);
    const volume24hXrp = positive(row?.apy24h?.volume);
    const volume7dXrp = positive(row?.apy7d?.volume);
    const volume24hXdx = xdxVolumeFromXrp(volume24hXrp, xrpPerXdx);
    const volume7dXdx = xdxVolumeFromXrp(volume7dXrp, xrpPerXdx);
    const price = reserveXdx > 0 && reserveQuote > 0 ? reserveQuote / reserveXdx : null;
    const amm = String(row?.ammAccount || row?.amm_account || row?.account || "").trim();
    if (!amm) continue;
    parsed.push({
      quote,
      issuer,
      hex,
      amm,
      reserveXdx: reserveXdx || null,
      reserveQuote: reserveQuote || null,
      lpSupply: positive(liq.lpTokenBalance) || null,
      lpCurrency: row?.lpTokenCurrency || null,
      tradingFee: finite(row?.tradingFee),
      liquidityXrp,
      tags,
      lowLiquidity: poolIsLowLiquidity({ tags, liquidityXrp }),
      price,
      volume24hXrp: volume24hXrp || null,
      volume24hXdx,
      volume7dXdx,
      holderCount: finite(row?.lpHolderCount),
    });
  }

  const counts = new Map();
  for (const row of parsed) {
    const key = row.quote.toUpperCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return parsed.map((row) => {
    const collided = (counts.get(row.quote.toUpperCase()) || 0) > 1;
    const named = pairName(row.quote, row.issuer || row.amm, collided);
    return {
      pool: named.pair,
      pool_name: named.pair,
      quote: named.quote,
      quote_issuer: row.issuer,
      quote_hex: row.hex,
      amm_account: row.amm,
      lp_currency: row.lpCurrency,
      reserve_xdx: row.reserveXdx,
      reserve_asset: row.reserveXdx,
      reserve_currency: row.reserveQuote,
      reserve_quote: row.reserveQuote,
      lp_supply: row.lpSupply,
      trading_fee: row.tradingFee,
      price: row.price,
      liquidity_xrp: row.liquidityXrp,
      low_liquidity: row.lowLiquidity,
      holder_count: row.holderCount,
      lp_holder_count: row.holderCount,
      volume24h: row.volume24hXdx,
      volume24hXdx: row.volume24hXdx,
      volume24hXrp: row.volume24hXrp,
      volume7d: row.volume7dXdx,
      volume7dXdx: row.volume7dXdx,
      volumeUnit: "xdx",
      volumeSource: row.volume24hXdx ? "xrpl.to" : null,
      xdxUsd: xdxUsd || null,
      xrpUsd: xrpUsd || null,
      source: "xrpl.to",
    };
  });
}

export function sortPoolsByXdxReserve(pools = []) {
  return [...(Array.isArray(pools) ? pools : [])].sort((left, right) => {
    const a = Number(left?.reserve_xdx ?? left?.reserve_asset) || 0;
    const b = Number(right?.reserve_xdx ?? right?.reserve_asset) || 0;
    return b - a;
  });
}

function ammKey(row) {
  return String(row?.amm_account || row?.amm || "").trim().toLowerCase();
}

export function mergeDiscoveredXdxPools(existing = [], discovered = []) {
  const out = (Array.isArray(existing) ? existing : []).map((row) => ({ ...row }));
  const byAmm = new Map();
  for (const row of out) {
    const key = ammKey(row);
    if (key) byAmm.set(key, row);
  }
  for (const row of Array.isArray(discovered) ? discovered : []) {
    const key = ammKey(row);
    if (!key) continue;
    const prior = byAmm.get(key);
    if (prior) {
      if (prior.low_liquidity == null) prior.low_liquidity = Boolean(row.low_liquidity);
      if (!prior.quote_hex && row.quote_hex) prior.quote_hex = row.quote_hex;
      if (!prior.quote_issuer && row.quote_issuer) prior.quote_issuer = row.quote_issuer;
      if (!(Number(prior.trading_fee) > 0) && Number(row.trading_fee) > 0) {
        prior.trading_fee = row.trading_fee;
      }
      if (!(Number(prior.price) > 0) && Number(row.price) > 0) prior.price = row.price;
      continue;
    }
    byAmm.set(key, row);
    out.push(row);
  }
  return out;
}

export function poolNameKey(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function findDiscoveredPool(rows = [], pair = "") {
  const want = poolNameKey(pair);
  if (!want) return null;
  const name = want.includes("/") ? want : `XDX/${want}`;
  return (
    (Array.isArray(rows) ? rows : []).find((row) => {
      const pool = poolNameKey(row?.pool || row?.pool_name);
      const quote = poolNameKey(row?.quote);
      return pool === name || quote === want || `XDX/${quote}` === name;
    }) || null
  );
}

export function needsDiscoveredAmmLookup(pair, { ammAccount = "", issuer = "" } = {}) {
  if (String(ammAccount || "").trim() || String(issuer || "").trim()) return false;
  const quote = poolNameKey(pair).split("/").pop();
  return !["XRP", "RLUSD", "XIO", "XSQUAD", ""].includes(quote);
}

export function liveQueryFromPool(query = {}, pool = null) {
  if (!pool) return query;
  return {
    ...query,
    ammAccount: query.ammAccount || pool.amm_account || "",
    issuer: query.issuer || pool.quote_issuer || "",
    hex: query.hex || pool.quote_hex || "",
    quote: query.quote || pool.quote || "",
  };
}

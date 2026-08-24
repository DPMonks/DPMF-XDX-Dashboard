import {
  POOLS,
  XDX_HEX,
  XDX_ISSUER,
  XDX_TOTAL_SUPPLY,
  XDX_XRP_AMM,
  XDX_XRPL_TO_MD5,
  issuerLockedFromIssued,
} from "../src/constants/ledger.js";
import { looksLikeXrpUsd, xrpPerXdx } from "../src/utils/recordedPrice.js";
import { attachQuoteXrpPrices, loadQuoteXrpRates } from "./quoteXrpMarket.js";
import { loadLiveAmmReservesMany } from "./liveAmmReserves.js";
import { fillNativeBookFromXrpl, xrplRpc } from "./xrplBookOffers.js";
import { composeAmmBook, emptyOrderbook, FEATURED_ORDERBOOK_PAIRS } from "../src/orderbook.js";

let xrpFx = { at: 0, usd: 0, gbp: 0, eur: 0, jpy: 0 };
let marketCache = { at: 0, prices: null, pools: null, overview: null };
let tokenCache = { at: 0, body: null };
let issuerLockedCache = { at: 0, body: null };
const MARKET_MS = 15_000;
const TOKEN_MS = 60_000;
const ISSUER_MS = 60_000;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function loadLiveXrpQuote(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && now - xrpFx.at < 300_000 && xrpFx.usd) return xrpFx;
  try {
    const res = await (options.fetchImpl || fetch)(
      "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd,gbp,eur,jpy",
      { signal: AbortSignal.timeout(2500) }
    );
    const body = await res.json();
    xrpFx = {
      at: now,
      usd: Number(body?.ripple?.usd || xrpFx.usd || 0),
      gbp: Number(body?.ripple?.gbp || xrpFx.gbp || 0),
      eur: Number(body?.ripple?.eur || xrpFx.eur || 0),
      jpy: Number(body?.ripple?.jpy || xrpFx.jpy || 0),
    };
  } catch {
    xrpFx = { ...xrpFx, at: now };
  }
  return xrpFx;
}

function xdxUsdFromXrpPool(live, xrpUsd) {
  const xdx = num(live?.reserve_xdx ?? live?.reserve_asset);
  const xrp = num(live?.reserve_currency ?? live?.reserve_quote);
  if (!(xdx > 0) || !(xrp > 0) || !(xrpUsd > 0)) return 0;
  return (xrp / xdx) * xrpUsd;
}

function poolRowFromLive(spec, live, prices) {
  const reserveXdx = num(live?.reserve_xdx ?? live?.reserve_asset);
  const reserveQuote = num(live?.reserve_currency ?? live?.reserve_quote);
  return {
    pool: spec.pair,
    pool_name: spec.pair,
    quote: spec.quote,
    amm_account: live?.amm_account || spec.amm,
    lp_currency: live?.lp_currency || spec.lpHex,
    reserve_xdx: reserveXdx || null,
    reserve_asset: reserveXdx || null,
    reserve_currency: reserveQuote || null,
    reserve_quote: reserveQuote || null,
    lp_supply: num(live?.lp_supply) || null,
    trading_fee: live?.trading_fee ?? null,
    xdxUsd: prices?.xdxUsd || null,
    xrpUsd: prices?.xrpUsd || null,
    source: "xrpl",
  };
}

export async function loadXrplToToken(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && tokenCache.body && now - tokenCache.at < TOKEN_MS) {
    return tokenCache.body;
  }
  try {
    const res = await (options.fetchImpl || fetch)(
      `https://api.xrpl.to/v1/token/${XDX_XRPL_TO_MD5}`,
      { signal: AbortSignal.timeout(3500) }
    );
    const payload = await res.json();
    const token = payload?.token || {};
    const exchXrp = Number(token.exch);
    const usd = Number(token.usd);
    const body = {
      holders: Number(token.holders) || 0,
      trustlines: Number(token.trustlines || token.lines) || 0,
      lpHolders: Number(token.lpHolderCount) || 0,
      exchXrp: Number.isFinite(exchXrp) && exchXrp > 0 && exchXrp < 1 ? exchXrp : 0,
      vol24hXrp: Number(token.vol24hxrp || token.vol24h) || 0,
      change24h: Number(token.pro24h),
      usd: Number.isFinite(usd) && usd > 0 && !looksLikeXrpUsd(usd) ? usd : 0,
      source: "xrpl.to",
    };
    tokenCache = { at: now, body };
    return body;
  } catch {
    return tokenCache.body || {
      holders: 0,
      trustlines: 0,
      lpHolders: 0,
      exchXrp: 0,
      vol24hXrp: 0,
      change24h: 0,
      usd: 0,
      source: "empty",
    };
  }
}

export async function loadIssuerLockedLive(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && issuerLockedCache.body && now - issuerLockedCache.at < ISSUER_MS) {
    return issuerLockedCache.body;
  }
  try {
    const result = await xrplRpc(
      "gateway_balances",
      { account: XDX_ISSUER, ledger_index: "validated", hotwallet: [] },
      options
    );
    const obligations = result?.obligations || {};
    const issued = Number(obligations.XDX || obligations[XDX_HEX] || 0);
    const locked = issuerLockedFromIssued(issued);
    const body = {
      issuer: XDX_ISSUER,
      issuer_locked: locked,
      burned_supply: locked,
      issued,
      circulating: Math.max(XDX_TOTAL_SUPPLY - locked, 0),
      as_of: new Date().toISOString(),
      source: "xrpl",
    };
    issuerLockedCache = { at: now, body };
    return body;
  } catch {
    return (
      issuerLockedCache.body || {
        issuer: XDX_ISSUER,
        issuer_locked: 0,
        burned_supply: 0,
        issued: 0,
        circulating: XDX_TOTAL_SUPPLY,
        source: "empty",
      }
    );
  }
}

export async function loadLiveMarket(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && marketCache.overview && now - marketCache.at < MARKET_MS) {
    return marketCache;
  }
  const [quote, token, issuerLocked] = await Promise.all([
    loadLiveXrpQuote(options),
    loadXrplToToken(options),
    loadIssuerLockedLive(options),
  ]);
  const lives = await loadLiveAmmReservesMany(
    POOLS.map((pool) => ({
      ammAccount: pool.amm,
      pair: pool.pair,
      quote: pool.quote,
      issuer: pool.quoteIssuer,
      hex: pool.quoteHex,
    })),
    options
  );
  const xrpPool = lives[0] || {};
  const xrpUsd = num(quote.usd);
  const ammUsd = xdxUsdFromXrpPool(xrpPool, xrpUsd);
  const listedUsd = num(token.usd);
  const exchUsd = num(token.exchXrp) && xrpUsd ? token.exchXrp * xrpUsd : 0;
  const xdxUsd = ammUsd || listedUsd || exchUsd;
  const liveRates = await loadQuoteXrpRates(options).catch(() => ({}));
  const prices = attachQuoteXrpPrices(
    {
      xrpUsd,
      xrpGbp: num(quote.gbp),
      xrpEur: num(quote.eur),
      xrpJpy: num(quote.jpy),
      xdxUsd,
      recorded_price: xdxUsd,
      xdxGbp: xdxUsd > 0 && xrpUsd > 0 && quote.gbp ? xdxUsd * (quote.gbp / xrpUsd) : 0,
      xdxEur: xdxUsd > 0 && xrpUsd > 0 && quote.eur ? xdxUsd * (quote.eur / xrpUsd) : 0,
      xdxJpy: xdxUsd > 0 && xrpUsd > 0 && quote.jpy ? xdxUsd * (quote.jpy / xrpUsd) : 0,
      RLUSD: 1,
      quotes: { XRP: xrpUsd, RLUSD: 1 },
      source: "xrpl",
    },
    liveRates,
    xrpUsd
  );
  const pools = POOLS.map((spec, index) => poolRowFromLive(spec, lives[index], prices));
  const reserveXdx = num(xrpPool.reserve_xdx ?? xrpPool.reserve_asset);
  const reserveXrp = num(xrpPool.reserve_currency ?? xrpPool.reserve_quote);
  const tvlUsd = reserveXrp > 0 && xrpUsd > 0 ? reserveXrp * 2 * xrpUsd : 0;
  const burned = Number(issuerLocked.issuer_locked || 0);
  const circulating = Number(issuerLocked.circulating || XDX_TOTAL_SUPPLY);
  const volume24h = num(token.vol24hXrp) && xrpUsd ? token.vol24hXrp * xrpUsd : num(token.vol24hXrp);
  const overview = {
    pool: "XDX/XRP",
    tvl: tvlUsd || reserveXrp || 0,
    tvl_usd: tvlUsd,
    price: xdxUsd,
    xdxUsd,
    recorded_price: xdxUsd,
    xdxGbp: prices.xdxGbp,
    xdxEur: prices.xdxEur,
    xdxJpy: prices.xdxJpy,
    xrpUsd,
    xrpGbp: prices.xrpGbp,
    xrpEur: prices.xrpEur,
    xrpJpy: prices.xrpJpy,
    xdx_per_xrp: xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
    xdxPerXrp: xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
    reserve_asset: reserveXdx,
    reserve_currency: reserveXrp,
    lp_supply: num(xrpPool.lp_supply) || null,
    trading_fee: xrpPool.trading_fee ?? null,
    volume24h,
    holder_count: num(token.holders) || null,
    holders: num(token.holders) || null,
    lp_holder_count: num(token.lpHolders) || null,
    circulating,
    circulating_supply: circulating,
    total_supply: XDX_TOTAL_SUPPLY,
    burned_supply: burned,
    issuer_locked: burned,
    issued_xdx: Number(issuerLocked.issued || 0),
    issuer_source: issuerLocked.source,
    amm_xdx: reserveXdx,
    trustlines: num(token.trustlines) || null,
    trustline_count: num(token.trustlines) || null,
    ammMarketCap: tvlUsd,
    xrplMarketCap: XDX_TOTAL_SUPPLY * xdxUsd,
    circulatingMarketCap: circulating * xdxUsd,
    issuer: XDX_ISSUER,
    amm_account: xrpPool.amm_account || XDX_XRP_AMM,
    source: "xrpl",
    catching_up: !num(token.holders),
  };
  marketCache = { at: now, prices, pools, overview, token, change: { xdx: Number(token.change24h) || 0, xrp: 0 } };
  return marketCache;
}

export async function liveCatalogPayload(suffix, options = {}) {
  const path = String(suffix || "").split("?")[0];
  if (path === "overview" || path === "token-details") {
    return (await loadLiveMarket(options)).overview;
  }
  if (path === "prices") {
    return (await loadLiveMarket(options)).prices;
  }
  if (path === "lp-pools" || path === "amm" || path === "pools") {
    const market = await loadLiveMarket(options);
    return {
      ...market.overview,
      pools: market.pools,
      source: "xrpl",
      catching_up: true,
    };
  }
  if (path === "prices/change24h" || path === "change24h") {
    const market = await loadLiveMarket(options);
    return { xdx: Number(market.change?.xdx) || 0, xrp: 0, source: "xrpl" };
  }
  if (path === "issuer-locked") {
    return loadIssuerLockedLive(options);
  }
  if (path === "holders/count") {
    const token = await loadXrplToToken(options);
    return { count: token.holders || null, source: token.source, catching_up: !token.holders };
  }
  if (path === "trustlines/count") {
    const token = await loadXrplToToken(options);
    return { count: token.trustlines || null, source: token.source, catching_up: !token.trustlines };
  }
  if (path === "lp-holders/count") {
    const token = await loadXrplToToken(options);
    return { count: token.lpHolders || null, pool: "all", source: token.source, catching_up: !token.lpHolders };
  }
  if (path === "lp-trustlines/count") {
    const token = await loadXrplToToken(options);
    return { count: token.lpHolders || null, pool: "all", source: token.source, catching_up: true };
  }
  if (path === "orderbook") {
    const market = await loadLiveMarket(options);
    const pool = market.pools?.[0] || {};
    const live = await fillNativeBookFromXrpl("XDX/XRP", pool, options);
    return composeAmmBook(
      live || emptyOrderbook("XDX/XRP"),
      {
        reserve_asset: market.overview.reserve_asset,
        reserve_currency: market.overview.reserve_currency,
        trading_fee: market.overview.trading_fee,
        price: market.overview.xdxPerXrp,
      },
      "XDX/XRP"
    );
  }
  if (path === "orderbooks") {
    const market = await loadLiveMarket(options);
    const books = {};
    for (const pair of FEATURED_ORDERBOOK_PAIRS) {
      const pool = market.pools.find((row) => row.pool_name === pair) || market.pools[0] || {};
      const live = await fillNativeBookFromXrpl(pair, pool, options);
      books[pair] = composeAmmBook(
        live || emptyOrderbook(pair),
        {
          reserve_asset: pool.reserve_asset ?? market.overview.reserve_asset,
          reserve_currency: pool.reserve_currency ?? market.overview.reserve_currency,
          trading_fee: pool.trading_fee ?? market.overview.trading_fee,
          price: pair === "XDX/XRP" ? market.overview.xdxPerXrp : null,
        },
        pair
      );
    }
    return {
      quotes: FEATURED_ORDERBOOK_PAIRS.map((pair) => pair.split("/")[1]).filter(Boolean),
      featured: FEATURED_ORDERBOOK_PAIRS,
      pairs: FEATURED_ORDERBOOK_PAIRS,
      default_pair: "XDX/XRP",
      books,
      source: "xrpl",
    };
  }
  if (path === "xdx-flows" || path === "trades" || path === "charts/trades") {
    return [];
  }
  if (/^charts\//.test(path) || path === "chart/candles" || path === "charts/candles" || /^top-/.test(path) || path.startsWith("sparkline/")) {
    return { rows: [], count: null, source: "xrpl", catching_up: true };
  }
  return null;
}

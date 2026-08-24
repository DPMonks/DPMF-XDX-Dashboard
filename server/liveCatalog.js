import {
  POOLS,
  XDX_ISSUER,
  XDX_TOTAL_SUPPLY,
  XDX_XRP_AMM,
} from "../src/constants/ledger.js";
import { xrpPerXdx } from "../src/utils/recordedPrice.js";
import { attachQuoteXrpPrices, loadQuoteXrpRates } from "./quoteXrpMarket.js";
import { loadLiveAmmReservesMany } from "./liveAmmReserves.js";

let xrpFx = { at: 0, usd: 0, gbp: 0, eur: 0, jpy: 0 };
let marketCache = { at: 0, prices: null, pools: null, overview: null };
const MARKET_MS = 15_000;

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

export async function loadLiveMarket(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && marketCache.overview && now - marketCache.at < MARKET_MS) {
    return marketCache;
  }
  const quote = await loadLiveXrpQuote(options);
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
  const xdxUsd = xdxUsdFromXrpPool(xrpPool, xrpUsd);
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
  const circulating = XDX_TOTAL_SUPPLY;
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
    xdx_per_xrp: xrpPerXdx(xdxUsd, xrpUsd),
    xdxPerXrp: xrpPerXdx(xdxUsd, xrpUsd),
    reserve_asset: reserveXdx,
    reserve_currency: reserveXrp,
    lp_supply: num(xrpPool.lp_supply) || null,
    trading_fee: xrpPool.trading_fee ?? null,
    holder_count: null,
    circulating,
    circulating_supply: circulating,
    total_supply: XDX_TOTAL_SUPPLY,
    burned_supply: 0,
    issuer_locked: 0,
    amm_xdx: reserveXdx,
    trustlines: null,
    trustline_count: null,
    ammMarketCap: tvlUsd,
    xrplMarketCap: XDX_TOTAL_SUPPLY * xdxUsd,
    circulatingMarketCap: circulating * xdxUsd,
    issuer: XDX_ISSUER,
    amm_account: xrpPool.amm_account || XDX_XRP_AMM,
    source: "xrpl",
    catching_up: true,
  };
  marketCache = { at: now, prices, pools, overview };
  return marketCache;
}

export async function liveCatalogPayload(suffix) {
  const path = String(suffix || "").split("?")[0];
  if (path === "overview" || path === "token-details") {
    return (await loadLiveMarket()).overview;
  }
  if (path === "prices") {
    return (await loadLiveMarket()).prices;
  }
  if (path === "lp-pools" || path === "amm" || path === "pools") {
    const market = await loadLiveMarket();
    return { pools: market.pools, source: "xrpl", catching_up: true };
  }
  if (path === "prices/change24h" || path === "change24h") {
    return { xdx: 0, xrp: 0, source: "xrpl" };
  }
  if (path === "xdx-flows" || path === "trades") {
    return [];
  }
  if (/^charts\//.test(path) || /\/count$/.test(path) || path.endsWith("/count") || /^top-/.test(path)) {
    return { rows: [], count: null, source: "xrpl", catching_up: true };
  }
  return null;
}

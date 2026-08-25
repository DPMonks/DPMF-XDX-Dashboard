import {
  POOLS,
  XDX_HEX,
  XDX_ISSUED_AT,
  XDX_ISSUER,
  XDX_TOTAL_SUPPLY,
  XDX_XRP_AMM,
  issuerLockedFromIssued,
} from "../src/constants/ledger.js";
import { issuerBlackholeFromAccount, XDX_BLACKHOLED_AT } from "../src/utils/blackhole.js";
import { pickXdxUsd, xdxUsdFromRlusdPool, xdxUsdFromXrpPool } from "../src/utils/fiatFx.js";
import { xrpPerXdx } from "../src/utils/recordedPrice.js";
import { parseXrplToToken, tvlUsdFromXrplTo, XRPL_TO_TOKEN_URL, xdxUsdFromXrplTo } from "../src/utils/xrplToToken.js";
import { attachQuoteXrpPrices, loadQuoteXrpRates } from "./quoteXrpMarket.js";
import { attachXdxFiat, loadFiatQuote } from "./fiatQuotes.js";
import { loadLiveAmmReservesMany } from "./liveAmmReserves.js";
import { fillNativeBookFromXrpl, xrplRpc } from "./xrplBookOffers.js";
import { composeAmmBook, emptyOrderbook, FEATURED_ORDERBOOK_PAIRS } from "../src/orderbook.js";
import {
  FREE_API_HEADERS,
  loadXrplToCandles,
  loadXrplToFlows,
  loadXrplToHolderGraph,
  loadXrplToHolders,
  loadXrplToLpChart,
  loadXrplToLpCounts,
  loadXrplToLpOwners,
  loadXrplToRank,
  loadXrpSparkline,
} from "./xrplToCatalog.js";
import { applyPoolVolumes, loadPoolXdxVolumes } from "./freeVolume.js";
import { QUOTE_ASSETS } from "../src/xaman/tradeTx.js";

export function knownLivePoolSpecs(extra = []) {
  const specs = [];
  const seen = new Set();
  function add(spec) {
    const pair = String(spec.pair || "")
      .replace(/\s+/g, "")
      .toUpperCase();
    if (!/^XDX\/[A-Z0-9]{2,12}$/.test(pair) || seen.has(pair)) return;
    seen.add(pair);
    specs.push({
      ...spec,
      pair,
      quote: spec.quote || pair.split("/")[1],
    });
  }
  for (const pool of POOLS) {
    add({
      pair: pool.pair,
      quote: pool.quote,
      amm: pool.amm,
      ammAccount: pool.amm,
      issuer: pool.quoteIssuer,
      hex: pool.quoteHex,
      lpHex: pool.lpHex,
    });
  }
  for (const asset of QUOTE_ASSETS) {
    add({
      pair: `XDX/${asset.id}`,
      quote: asset.id,
      issuer: asset.issuer,
      hex: asset.hex,
    });
  }
  for (const pair of FEATURED_ORDERBOOK_PAIRS) {
    add({ pair, quote: String(pair).split("/")[1] });
  }
  for (const row of Array.isArray(extra) ? extra : []) {
    add({
      pair: row.pool_name || row.pool || row.pair,
      quote: row.quote,
      amm: row.amm_account || row.amm,
      ammAccount: row.amm_account || row.amm,
      issuer: row.quote_issuer,
      hex: row.quote_hex,
    });
  }
  return specs;
}

let marketCache = { at: 0, prices: null, pools: null, overview: null };
let tokenCache = { at: 0, body: null };
let issuerLockedCache = { at: 0, body: null };
let issuerBlackholeCache = { at: 0, body: null };
const MARKET_MS = 15_000;
const TOKEN_MS = 60_000;
const ISSUER_MS = 60_000;
const BLACKHOLE_MS = 6 * 60 * 60 * 1000;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function loadLiveXrpQuote(options = {}) {
  return loadFiatQuote(options);
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
    xdxPerXrp: prices?.xdxPerXrp || prices?.xdx_per_xrp || null,
    volume24h: null,
    source: "xrpl",
  };
}

export async function loadXrplToToken(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && tokenCache.body && now - tokenCache.at < TOKEN_MS) {
    return tokenCache.body;
  }
  try {
    const res = await (options.fetchImpl || fetch)(XRPL_TO_TOKEN_URL, {
      headers: FREE_API_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`xrpl.to ${res.status}`);
    const body = parseXrplToToken(await res.json());
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

export async function loadIssuerBlackholeLive(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && issuerBlackholeCache.body && now - issuerBlackholeCache.at < BLACKHOLE_MS) {
    return issuerBlackholeCache.body;
  }
  try {
    const info = await xrplRpc(
      "account_info",
      { account: XDX_ISSUER, ledger_index: "validated" },
      options
    );
    const detected = issuerBlackholeFromAccount(info);
    const body = {
      blackholed: detected.blackholed,
      blackholed_fixed: detected.fixed,
      blackholed_at: detected.blackholed ? issuerBlackholeCache.body?.blackholed_at || XDX_BLACKHOLED_AT : null,
      source: "xrpl",
    };
    issuerBlackholeCache = { at: now, body };
    return body;
  } catch {
    return (
      issuerBlackholeCache.body || {
        blackholed: true,
        blackholed_fixed: true,
        blackholed_at: XDX_BLACKHOLED_AT,
        source: "ledger",
      }
    );
  }
}

export async function loadLiveMarket(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && marketCache.overview && now - marketCache.at < MARKET_MS) {
    return marketCache;
  }
  const [quote, token, issuerLocked, blackhole, lpCounts] = await Promise.all([
    loadLiveXrpQuote(options),
    loadXrplToToken(options),
    loadIssuerLockedLive(options),
    loadIssuerBlackholeLive(options),
    loadXrplToLpCounts({ ...options, pool: "all" }).catch(() => null),
  ]);
  const liveSpecs = knownLivePoolSpecs();
  const lives = await loadLiveAmmReservesMany(
    liveSpecs.map((spec) => ({
      ammAccount: spec.ammAccount || spec.amm,
      pair: spec.pair,
      quote: spec.quote,
      issuer: spec.issuer,
      hex: spec.hex,
    })),
    options
  );
  const xrpPool = lives[liveSpecs.findIndex((spec) => spec.pair === "XDX/XRP")] || lives[0] || {};
  const rlusdPool = lives.find((row) => String(row?.pair || "").includes("RLUSD")) || lives[1] || {};
  const xrpUsd = num(quote.usd);
  const xdxUsd = pickXdxUsd({
    ammXrp: xdxUsdFromXrpPool(xrpPool, xrpUsd),
    ammRlusd: xdxUsdFromRlusdPool(rlusdPool, 1),
    xrplTo: xdxUsdFromXrplTo(token, xrpUsd),
  });
  const liveRates = await loadQuoteXrpRates(options).catch(() => ({}));
  const prices = attachXdxFiat(
    attachQuoteXrpPrices(
      {
        xrpUsd,
        xrpGbp: num(quote.gbp),
        xrpEur: num(quote.eur),
        xrpJpy: num(quote.jpy),
        usdGbp: num(quote.usdGbp),
        usdEur: num(quote.usdEur),
        usdJpy: num(quote.usdJpy),
        xdxUsd,
        recorded_price: xdxUsd,
        xdx_per_xrp: xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
        xdxPerXrp: xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
        RLUSD: 1,
        quotes: { XRP: xrpUsd, RLUSD: 1 },
        source: "xrpl",
      },
      liveRates,
      xrpUsd
    ),
    quote
  );
  const reserveXdx = num(xrpPool.reserve_xdx ?? xrpPool.reserve_asset);
  const reserveXrp = num(xrpPool.reserve_currency ?? xrpPool.reserve_quote);
  const tvlUsd = reserveXrp > 0 && xrpUsd > 0 ? reserveXrp * 2 * xrpUsd : 0;
  const burned = Number(issuerLocked.issuer_locked || 0);
  const circulating = Number(issuerLocked.circulating || XDX_TOTAL_SUPPLY);
  const volumes = await loadPoolXdxVolumes({
    token,
    reserveXdx,
    reserveXrp,
    xdxUsd,
    xrpUsd,
    now,
    fresh: options.fresh,
    fetchImpl: options.fetchImpl,
    pairs: liveSpecs.map((spec) => spec.pair),
  }).catch(() => ({}));
  const pools = applyPoolVolumes(
    liveSpecs
      .map((spec, index) => poolRowFromLive(spec, lives[index], prices))
      .filter((row) => row.amm_account || row.reserve_asset || row.lp_supply),
    volumes
  );
  const volume24h = num(volumes["XDX/XRP"]?.volume24hXdx) || num(pools[0]?.volume24h);
  const volume24hUsd = num(volumes["XDX/XRP"]?.volume24hUsd);
  const volume24hXrp = num(volumes["XDX/XRP"]?.volume24hXrp) || num(token.vol24hXrp);
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
    volume24hXdx: volume24h,
    volume24hUsd,
    volume24hXrp,
    volume7d: num(volumes["XDX/XRP"]?.volume7dXdx) || null,
    volume7dXdx: num(volumes["XDX/XRP"]?.volume7dXdx) || null,
    volumeUnit: "xdx",
    volumeSource: volumes["XDX/XRP"]?.source || null,
    holder_count: num(token.holders) || null,
    holders: num(token.holders) || null,
    lp_holder_count: num(token.lpHolders) || num(lpCounts?.holders) || null,
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
    lp_trustline_count: num(lpCounts?.trustlines) || null,
    ammMarketCap: tvlUsd,
    xrplMarketCap: XDX_TOTAL_SUPPLY * xdxUsd,
    circulatingMarketCap: circulating * xdxUsd,
    issuer: XDX_ISSUER,
    tokenType: "XDX",
    created: XDX_ISSUED_AT,
    blackholed: blackhole.blackholed,
    blackholed_fixed: blackhole.blackholed_fixed,
    blackholed_at: blackhole.blackholed_at,
    usdGbp: prices.usdGbp,
    usdEur: prices.usdEur,
    usdJpy: prices.usdJpy,
    amm_account: xrpPool.amm_account || XDX_XRP_AMM,
    source: "xrpl",
    catching_up: !num(token.holders),
  };
  marketCache = {
    at: num(token.holders) ? now : 0,
    prices,
    pools,
    overview,
    token,
    change: { xdx: Number(token.change24h) || 0, xrp: Number(quote.change24h) || 0 },
  };
  return marketCache;
}

export async function loadXrplToMarket(options = {}) {
  const [quote, token] = await Promise.all([
    loadLiveXrpQuote(options),
    loadXrplToToken(options),
  ]);
  const xrpUsd = num(quote.usd);
  const xdxUsd = xdxUsdFromXrplTo(token, xrpUsd);
  const prices = attachXdxFiat(
    {
      xrpUsd,
      xrpGbp: num(quote.gbp),
      xrpEur: num(quote.eur),
      xrpJpy: num(quote.jpy),
      usdGbp: num(quote.usdGbp),
      usdEur: num(quote.usdEur),
      usdJpy: num(quote.usdJpy),
      xdxUsd,
      recorded_price: xdxUsd,
      price: xdxUsd,
      xdx_per_xrp: xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
      xdxPerXrp: xrpPerXdx(xdxUsd, xrpUsd) || num(token.exchXrp),
      RLUSD: 1,
      quotes: { XRP: xrpUsd, RLUSD: 1 },
      source: "xrpl.to",
    },
    quote
  );
  const markXrp = num(token.exchXrp) || xrpPerXdx(xdxUsd, xrpUsd);
  const volumes = await loadPoolXdxVolumes({
    token,
    xdxUsd,
    xrpUsd,
    now: options.now,
    fresh: options.fresh,
    fetchImpl: options.fetchImpl,
  }).catch(() => ({}));
  const volume24h = num(volumes["XDX/XRP"]?.volume24hXdx) || (markXrp ? token.vol24hXrp / markXrp : 0);
  const tvlUsd = tvlUsdFromXrplTo(token, xrpUsd);
  const overview = {
    pool: "XDX/XRP",
    tvl: tvlUsd,
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
    xdx_per_xrp: prices.xdx_per_xrp,
    xdxPerXrp: prices.xdxPerXrp,
    volume24h,
    volume24hXdx: volume24h,
    volume24hUsd: num(volumes["XDX/XRP"]?.volume24hUsd),
    volume24hXrp: num(volumes["XDX/XRP"]?.volume24hXrp) || num(token.vol24hXrp),
    volume7d: num(volumes["XDX/XRP"]?.volume7dXdx) || null,
    volume7dXdx: num(volumes["XDX/XRP"]?.volume7dXdx) || null,
    volumeUnit: "xdx",
    volumeSource: volumes["XDX/XRP"]?.source || "xrpl.to",
    holder_count: num(token.holders) || null,
    holders: num(token.holders) || null,
    lp_holder_count: num(token.lpHolders) || null,
    circulating: XDX_TOTAL_SUPPLY,
    circulating_supply: XDX_TOTAL_SUPPLY,
    total_supply: XDX_TOTAL_SUPPLY,
    issuer: XDX_ISSUER,
    tokenType: "XDX",
    created: XDX_ISSUED_AT,
    blackholed: true,
    blackholed_fixed: true,
    blackholed_at: XDX_BLACKHOLED_AT,
    usdGbp: prices.usdGbp,
    usdEur: prices.usdEur,
    usdJpy: prices.usdJpy,
    trustlines: num(token.trustlines) || null,
    trustline_count: num(token.trustlines) || null,
    ammMarketCap: tvlUsd || null,
    xrplMarketCap: num(token.marketcap) || XDX_TOTAL_SUPPLY * xdxUsd,
    circulatingMarketCap: num(token.marketcap) || XDX_TOTAL_SUPPLY * xdxUsd,
    amm_account: XDX_XRP_AMM,
    source: "xrpl.to",
    catching_up: !num(token.holders),
  };
  return { prices, overview, token, change: { xdx: Number(token.change24h) || 0, xrp: 0, source: "xrpl.to" } };
}

async function liveMarketOrXrplTo(options = {}) {
  try {
    const market = await loadLiveMarket(options);
    if (market?.overview && (num(market.overview.xdxUsd) || num(market.overview.holder_count))) {
      return market;
    }
  } catch {
    // xrpl.to still has the token card if amm_info or CoinGecko miss
  }
  return loadXrplToMarket(options);
}

export async function liveCatalogPayload(suffix, options = {}) {
  const path = String(suffix || "").split("?")[0];
  if (path === "overview" || path === "token-details") {
    return (await liveMarketOrXrplTo(options)).overview;
  }
  if (path === "prices") {
    return (await liveMarketOrXrplTo(options)).prices;
  }
  if (path === "lp-pools" || path === "amm" || path === "pools") {
    const market = await loadLiveMarket(options);
    return {
      ...market.overview,
      pools: market.pools,
      source: "xrpl",
      catching_up: !market.pools?.length,
    };
  }
  if (path === "prices/change24h" || path === "change24h") {
    const [market, quote] = await Promise.all([loadXrplToMarket(options), loadLiveXrpQuote(options)]);
    return {
      xdx: Number(market.change?.xdx) || 0,
      xrp: Number(quote.change24h) || 0,
      source: "xrpl.to",
    };
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
    const params = new URLSearchParams(String(options.search || "").replace(/^\?/, ""));
    const counts = await loadXrplToLpCounts({
      ...options,
      pool: params.get("pool") || params.get("pair") || "all",
    }).catch(() => null);
    if (counts && !counts.catching_up) {
      return { count: counts.holders, pool: counts.pool, source: "xrpl.to", catching_up: false };
    }
    const token = await loadXrplToToken(options);
    return { count: token.lpHolders || null, pool: "all", source: token.source, catching_up: !token.lpHolders };
  }
  if (path === "lp-trustlines/count") {
    const params = new URLSearchParams(String(options.search || "").replace(/^\?/, ""));
    const counts = await loadXrplToLpCounts({
      ...options,
      pool: params.get("pool") || params.get("pair") || "all",
    }).catch(() => null);
    if (counts && !counts.catching_up) {
      return { count: counts.trustlines, pool: counts.pool, source: "xrpl.to", catching_up: false };
    }
    const token = await loadXrplToToken(options);
    return { count: token.lpHolders || null, pool: "all", source: token.source, catching_up: !token.trustlines };
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
    return loadXrplToFlows(options).catch(() => []);
  }
  if (path === "top-holders" || path === "top-holders-v2") {
    const params = new URLSearchParams(String(options.search || "").replace(/^\?/, ""));
    return loadXrplToHolders({
      ...options,
      limit: params.get("limit"),
      offset: params.get("offset"),
    }).catch(() => ({ holders: [], rows: [], count: null, source: "xrpl.to", catching_up: true }));
  }
  if (path === "wallet/rank" || /^wallet\/rank\//.test(path)) {
    const account = decodeURIComponent(path.split("/")[2] || options.account || "");
    if (!account) return { account: null, rank: null, source: "xrpl.to" };
    return loadXrplToRank(account, options).catch(() => ({ account, rank: null, source: "xrpl.to" }));
  }
  if (
    path === "charts/holders" ||
    path === "charts/trustlines" ||
    path === "charts/activity" ||
    path === "charts/traders"
  ) {
    const rows = await loadXrplToHolderGraph(options).catch(() => []);
    return rows.length ? rows : { rows: [], source: "xrpl.to", catching_up: true };
  }
  if (path.startsWith("sparkline/")) {
    const asset = decodeURIComponent(path.split("/")[1] || "XDX").toUpperCase();
    if (asset === "XRP") return loadXrpSparkline(options).catch(() => []);
    return loadXrplToCandles(options).catch(() => []);
  }
  if (path === "chart/candles" || path === "charts/candles") {
    const candles = await loadXrplToCandles(options).catch(() => []);
    return {
      source: "xrpl.to",
      locked: false,
      price_history: candles,
      amm_pool_history: [],
      rows: candles,
    };
  }
  if (path === "top-lp") {
    const params = new URLSearchParams(String(options.search || "").replace(/^\?/, ""));
    return loadXrplToLpOwners({
      ...options,
      pool: params.get("pool") || params.get("pair") || "all",
      limit: params.get("limit"),
      offset: params.get("offset"),
    }).catch(() => ({ holders: [], rows: [], count: null, source: "xrpl.to", catching_up: true }));
  }
  if (path === "charts/lp-holders" || path === "charts/lp-trustlines") {
    const params = new URLSearchParams(String(options.search || "").replace(/^\?/, ""));
    const rows = await loadXrplToLpChart({
      ...options,
      pool: params.get("pool") || params.get("pair") || "XDX/XRP",
    }).catch(() => []);
    return rows.length ? rows : { rows: [], source: "xrpl.to", catching_up: true };
  }
  if (path === "charts/tvl") {
    try {
      const market = await loadLiveMarket(options);
      const tvl = num(market.overview?.tvl_usd) || num(market.overview?.tvl) || num(market.token?.tvl);
      if (tvl > 0) {
        return [
          {
            timestamp: new Date().toISOString(),
            tvl,
            tvl_usd: tvl,
            source: "xrpl",
          },
        ];
      }
    } catch {
      // last-good catalog memory covers a blip
    }
    return { rows: [], source: "xrpl.to", catching_up: true };
  }
  return null;
}

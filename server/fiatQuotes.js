import { XRP_XRPL_TO_MD5 } from "../src/constants/ledger.js";
import { applyUsdFx, fillMissingXdxFiat, positive, usdFxFromSources } from "../src/utils/fiatFx.js";
import { FREE_API_HEADERS } from "./xrplToCatalog.js";
import { RLUSD_SPEC, loadOneQuoteXrpRate, xrpPerQuoteFromAmm } from "./quoteXrpMarket.js";
import { xrplRpc } from "./xrplBookOffers.js";

const COINGECKO_XRP =
  "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd,gbp,eur,jpy&include_24hr_change=true";
const FRANKFURTER = "https://api.frankfurter.app/latest?from=USD&to=GBP,EUR,JPY";
const OPEN_ER_API = "https://open.er-api.com/v6/latest/USD";
const CURRENCY_API = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const XRPL_TO_XRP = `https://api.xrpl.to/v1/token/${XRP_XRPL_TO_MD5}`;

const emptyQuote = {
  at: 0,
  usd: 0,
  gbp: 0,
  eur: 0,
  jpy: 0,
  usdGbp: 0,
  usdEur: 0,
  usdJpy: 0,
  change24h: 0,
  source: "empty",
};

let lastGood = { ...emptyQuote };

async function fetchJson(url, options = {}, timeoutMs = 4000) {
  const res = await (options.fetchImpl || fetch)(url, {
    headers: { ...FREE_API_HEADERS, ...(options.headers || {}) },
    signal: AbortSignal.timeout(Number(options.timeoutMs) || timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

export function usdFxFromFrankfurter(body = {}) {
  const rates = body.rates || {};
  return {
    usdGbp: positive(rates.GBP),
    usdEur: positive(rates.EUR),
    usdJpy: positive(rates.JPY),
    source: "frankfurter",
  };
}

export function usdFxFromOpenEr(body = {}) {
  const rates = body.rates || {};
  return {
    usdGbp: positive(rates.GBP),
    usdEur: positive(rates.EUR),
    usdJpy: positive(rates.JPY),
    source: "open.er-api.com",
  };
}

export function usdFxFromCurrencyApi(body = {}) {
  const usd = body.usd && typeof body.usd === "object" ? body.usd : body;
  return {
    usdGbp: positive(usd.gbp ?? usd.GBP),
    usdEur: positive(usd.eur ?? usd.EUR),
    usdJpy: positive(usd.jpy ?? usd.JPY),
    source: "currency-api",
  };
}

export function xrpQuoteFromCoinGecko(body = {}) {
  const row = body.ripple || {};
  return {
    usd: positive(row.usd),
    gbp: positive(row.gbp),
    eur: positive(row.eur),
    jpy: positive(row.jpy),
    change24h: Number(row.usd_24h_change) || 0,
    source: "coingecko",
  };
}

export function xrpUsdFromXrplTo(body = {}) {
  const token = body.token && typeof body.token === "object" ? body.token : body;
  return { usd: positive(token.usd), source: "xrpl.to" };
}

export function composeFiatQuote(xrp = {}, fx = {}, previous = emptyQuote) {
  const usd = positive(xrp.usd) || positive(previous.usd);
  const fromXrp = usdFxFromSources({
    usd,
    gbp: xrp.gbp,
    eur: xrp.eur,
    jpy: xrp.jpy,
  });
  const usdGbp = positive(fx.usdGbp) || fromXrp.usdGbp || positive(previous.usdGbp);
  const usdEur = positive(fx.usdEur) || fromXrp.usdEur || positive(previous.usdEur);
  const usdJpy = positive(fx.usdJpy) || fromXrp.usdJpy || positive(previous.usdJpy);
  const gbp = positive(xrp.gbp) || (usd && usdGbp ? usd * usdGbp : 0) || positive(previous.gbp);
  const eur = positive(xrp.eur) || (usd && usdEur ? usd * usdEur : 0) || positive(previous.eur);
  const jpy = positive(xrp.jpy) || (usd && usdJpy ? usd * usdJpy : 0) || positive(previous.jpy);
  const sources = [xrp.source, fx.source].filter((name) => name && name !== "empty");
  return {
    at: Number(xrp.at) || Date.now(),
    usd,
    gbp,
    eur,
    jpy,
    usdGbp,
    usdEur,
    usdJpy,
    change24h: Number.isFinite(Number(xrp.change24h)) ? Number(xrp.change24h) : previous.change24h || 0,
    source: sources[0] || previous.source || "empty",
  };
}

export function attachXdxFiat(prices = {}, quote = {}) {
  const next = fillMissingXdxFiat({
    ...prices,
    xrpUsd: positive(prices.xrpUsd) || positive(quote.usd) || 0,
    xrpGbp: positive(prices.xrpGbp) || positive(quote.gbp) || 0,
    xrpEur: positive(prices.xrpEur) || positive(quote.eur) || 0,
    xrpJpy: positive(prices.xrpJpy) || positive(quote.jpy) || 0,
    usdGbp: positive(prices.usdGbp) || positive(quote.usdGbp) || 0,
    usdEur: positive(prices.usdEur) || positive(quote.usdEur) || 0,
    usdJpy: positive(prices.usdJpy) || positive(quote.usdJpy) || 0,
  });
  const xdxUsd = positive(next.xdxUsd ?? next.recorded_price);
  const attached = applyUsdFx(xdxUsd, next);
  if (!positive(next.xdxGbp)) next.xdxGbp = attached.xdxGbp;
  if (!positive(next.xdxEur)) next.xdxEur = attached.xdxEur;
  if (!positive(next.xdxJpy)) next.xdxJpy = attached.xdxJpy;
  return next;
}

export async function loadUsdFx(options = {}) {
  const fetchers = [
    async () => usdFxFromFrankfurter(await fetchJson(FRANKFURTER, options)),
    async () => usdFxFromOpenEr(await fetchJson(OPEN_ER_API, options)),
    async () => usdFxFromCurrencyApi(await fetchJson(CURRENCY_API, options)),
  ];
  for (const load of fetchers) {
    try {
      const fx = await load();
      if (positive(fx.usdGbp) || positive(fx.usdEur)) return fx;
    } catch {
      // next free FX host
    }
  }
  return {
    usdGbp: lastGood.usdGbp,
    usdEur: lastGood.usdEur,
    usdJpy: lastGood.usdJpy,
    source: lastGood.usdGbp ? "last-good" : "empty",
  };
}

const LEDGERS_PER_DAY = 21_600; // about 4 s per ledger
let lastFallbackLog = 0;

function saneUsd(usd) {
  return usd > 0.05 && usd < 100 ? usd : 0;
}

/**
 * USD per XRP from the ledger's XRP/RLUSD AMM pool and order book (RLUSD = USD).
 * The 24h change compares the pool spot with the pool a day of ledgers back.
 */
let ledgerCache = { at: 0, quote: null };

export async function loadLedgerXrpUsd(options = {}) {
  const injected = Boolean(options.rpc || options.ledgerRate || options.fetchImpl);
  if (!injected && ledgerCache.quote && Date.now() - ledgerCache.at < 60_000) return ledgerCache.quote;
  const quote = await readLedgerXrpUsd(options);
  if (!injected && quote) ledgerCache = { at: Date.now(), quote };
  return quote;
}

async function readLedgerXrpUsd(options = {}) {
  const rpc = options.rpc || ((method, params) => xrplRpc(method, params, options));
  const xrpPerRlusd = options.ledgerRate
    ? await options.ledgerRate()
    : await loadOneQuoteXrpRate(RLUSD_SPEC, options);
  const usd = saneUsd(xrpPerRlusd > 0 ? 1 / xrpPerRlusd : 0);
  if (!usd) return null;
  const quote = { usd, source: "xrpl_rlusd" };
  try {
    const rlusd = { currency: RLUSD_SPEC.hex, issuer: RLUSD_SPEC.issuer };
    const now = await rpc("amm_info", { asset: rlusd, asset2: { currency: "XRP" }, ledger_index: "validated" });
    const index = Number(now?.ledger_index || now?.ledger_current_index || 0);
    if (index > LEDGERS_PER_DAY) {
      const then = await rpc("amm_info", { asset: rlusd, asset2: { currency: "XRP" }, ledger_index: index - LEDGERS_PER_DAY });
      const thenXrp = xrpPerQuoteFromAmm(then?.amm || then, RLUSD_SPEC);
      const thenUsd = saneUsd(thenXrp > 0 ? 1 / thenXrp : 0);
      if (thenUsd) quote.change24h = (usd / thenUsd - 1) * 100;
    }
  } catch {
    // spot stands without a 24h change
  }
  return quote;
}

function logExternalFallback(name, value) {
  const now = Date.now();
  if (now - lastFallbackLog < 600_000) return;
  lastFallbackLog = now;
  console.warn(`[fiat] xrp_usd source=external_fallback reason=ledger_read_failed external=${name} value=${value}`);
}

export async function loadXrpSpot(options = {}) {
  try {
    const ledger = await loadLedgerXrpUsd(options);
    if (ledger && positive(ledger.usd)) return ledger;
  } catch {
    // outside quotes below, logged
  }
  if (options.ledgerOnly) {
    return { usd: lastGood.usd, change24h: lastGood.change24h, source: lastGood.usd ? "last-good" : "empty" };
  }
  try {
    const quote = xrpQuoteFromCoinGecko(await fetchJson(COINGECKO_XRP, options));
    if (positive(quote.usd)) {
      logExternalFallback("coingecko", quote.usd);
      return quote;
    }
  } catch {
    // xrpl.to still has an XRP USD mark
  }
  try {
    const quote = xrpUsdFromXrplTo(await fetchJson(XRPL_TO_XRP, options));
    if (positive(quote.usd)) logExternalFallback("xrpl.to", quote.usd);
    return quote;
  } catch {
    return {
      usd: lastGood.usd,
      gbp: lastGood.gbp,
      eur: lastGood.eur,
      jpy: lastGood.jpy,
      change24h: lastGood.change24h,
      source: lastGood.usd ? "last-good" : "empty",
    };
  }
}

export async function loadFiatQuote(options = {}) {
  const now = Number(options.now) || Date.now();
  if (!options.fresh && now - lastGood.at < 300_000 && positive(lastGood.usd) && positive(lastGood.usdGbp)) {
    return lastGood;
  }
  const [xrp, fx] = await Promise.all([loadXrpSpot(options), loadUsdFx(options)]);
  const quote = composeFiatQuote({ ...xrp, at: now }, fx, lastGood);
  if (positive(quote.usd) || positive(quote.usdGbp)) lastGood = quote;
  return quote;
}

export function resetFiatQuoteMemory() {
  lastGood = { ...emptyQuote };
}

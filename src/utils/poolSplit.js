// XDX share of the LP vs the rest. Do not infer an equal-value quote —
// that forces every bar to 50/50. Prefer XDX compared to LP token supply
// (the LP total); if that is missing, compare XDX to the opposing reserve.

export function poolAssetSplit({
  reserveXdx,
  reserveQuote,
  xdxUsd,
  quoteUsd,
} = {}) {
  const xdx = Number(reserveXdx);
  const quote = Number(reserveQuote);
  const xdxPrice = Number(xdxUsd);
  const quotePrice = Number(quoteUsd);
  if (!(xdx > 0) || !(quote > 0) || !(xdxPrice > 0) || !(quotePrice > 0)) {
    return null;
  }

  const xdxValue = xdx * xdxPrice;
  const quoteValue = quote * quotePrice;
  const total = xdxValue + quoteValue;
  if (!(total > 0)) return null;

  const xdxPct = roundPoolPct((xdxValue / total) * 100);
  const quotePct = roundPoolPct(100 - xdxPct);
  return {
    xdxPct,
    quotePct,
    lead: xdxPct >= quotePct ? "xdx" : "quote",
  };
}

export function roundPoolPct(value) {
  return Math.round(Number(value) * 10) / 10;
}

export function formatPoolPct(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toFixed(1);
}

export function displayPoolSplit(xdxPct, quotePct) {
  if (xdxPct != null && quotePct != null && Number.isFinite(Number(xdxPct)) && Number.isFinite(Number(quotePct))) {
    return { xdxPct: Number(xdxPct), quotePct: Number(quotePct), measured: true };
  }
  return { xdxPct: 50, quotePct: 50, measured: false };
}

export function inferQuoteReserve(reserveXdx, xdxUsd, quoteUsd) {
  const xdx = Number(reserveXdx);
  const xdxPrice = Number(xdxUsd);
  const quotePrice = Number(quoteUsd);
  if (!(xdx > 0) || !(xdxPrice > 0) || !(quotePrice > 0)) return 0;
  return (xdx * xdxPrice) / quotePrice;
}

export function opposingPoolAsset({
  reserveXdx,
  reserveQuote,
  lpSupply,
  price,
  xdxUsd,
  quoteUsd,
} = {}) {
  const lp = Number(lpSupply);
  if (lp > 0) return lp;
  const quote = Number(reserveQuote);
  if (quote > 0) return quote;
  const xdx = Number(reserveXdx);
  const px = Number(price);
  if (xdx > 0 && px > 0 && px < 10) return xdx * px;
  return inferQuoteReserve(xdx, xdxUsd, quoteUsd);
}

export function resolvePoolSplit({
  reserveXdx,
  reserveQuote,
  lpSupply,
  price,
  xdxUsd,
  quoteUsd,
} = {}) {
  const xdx = Number(reserveXdx);
  if (!(xdx > 0)) return null;

  const quote = Number(reserveQuote);
  const other = opposingPoolAsset({
    reserveXdx: xdx,
    reserveQuote: quote,
    lpSupply,
    price,
    xdxUsd,
    quoteUsd,
  });
  if (!(other > 0)) return null;

  const xdxPct = roundPoolPct((xdx / (xdx + other)) * 100);
  const quotePct = roundPoolPct(100 - xdxPct);
  return {
    xdxPct,
    quotePct,
    lead: xdxPct >= quotePct ? "xdx" : "quote",
    reserveQuote: quote > 0 ? quote : other,
    inferred: !(Number(lpSupply) > 0) && !(quote > 0),
  };
}

export const STABLE_QUOTES = new Set(["RLUSD", "USD", "USDC", "USDT", "USDB", "USDX"]);

export function impliedQuoteUsd({ reserveXdx, reserveQuote, xdxUsd } = {}) {
  const base = Number(reserveXdx);
  const quote = Number(reserveQuote);
  const usd = Number(xdxUsd);
  if (!(base > 0) || !(quote > 0) || !(usd > 0)) return 0;
  return (base * usd) / quote;
}

export function quoteUsdFromPrices(quoteId, prices = {}) {
  const id = String(quoteId || "").toUpperCase();
  if (!id || !prices || typeof prices !== "object") return 0;
  if (STABLE_QUOTES.has(id)) return 1;
  const nested = prices.quotes && typeof prices.quotes === "object" ? prices.quotes : null;
  const aliases =
    id === "XRP"
      ? ["xrpUsd", "xrp_usd", "XRP", "XRPUSD"]
      : [id, `${id}Usd`, `${id}_usd`, `${id}USD`];
  for (const key of aliases) {
    const n = Number(prices[key] ?? nested?.[key] ?? nested?.[id]);
    if (n > 0 && Number.isFinite(n)) return n;
  }
  return 0;
}

export function quoteUsdFromMap(quote, prices = {}) {
  return quoteUsdFromPrices(quote, prices);
}

export function detectQuoteUsd({ quoteId, pool, prices } = {}) {
  const id = String(quoteId || pool?.quoteName || pool?.quote || "").toUpperCase();
  const xdxUsd = Number(pool?.xdxUsd || prices?.xdxUsd || prices?.recorded_price || 0);
  const implied = impliedQuoteUsd({
    reserveXdx: pool?.reserve_xdx ?? pool?.reserve_asset ?? pool?.base,
    reserveQuote: pool?.reserve_currency ?? pool?.quoteReserve,
    xdxUsd,
  });
  const market = quoteUsdFromPrices(id, prices);
  if (market > 0) return market;
  if (implied > 0) return implied;
  const listed = Number(pool?.quote_usd ?? pool?.quoteUsd);
  if (listed > 0 && listed !== xdxUsd) return listed;
  return 0;
}

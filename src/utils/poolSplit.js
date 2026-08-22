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

export function quoteUsdFromMap(quote, prices = {}) {
  const key = String(quote || "").toUpperCase();
  if (!key) return 0;
  const direct = Number(prices[key]);
  if (direct > 0) return direct;
  if (key === "RLUSD" || key === "USD") return 1;
  return 0;
}

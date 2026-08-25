export function positive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function xdxUsdFromXrpPool(live = {}, xrpUsd) {
  const xdx = positive(live.reserve_xdx ?? live.reserve_asset);
  const xrp = positive(live.reserve_currency ?? live.reserve_quote);
  const fx = positive(xrpUsd);
  if (!(xdx > 0) || !(xrp > 0) || !(fx > 0)) return 0;
  return (xrp / xdx) * fx;
}

export function xdxUsdFromRlusdPool(live = {}, rlusdUsd = 1) {
  const xdx = positive(live.reserve_xdx ?? live.reserve_asset);
  const rlusd = positive(live.reserve_currency ?? live.reserve_quote);
  const fx = positive(rlusdUsd) || 1;
  if (!(xdx > 0) || !(rlusd > 0)) return 0;
  return (rlusd / xdx) * fx;
}

export function pickXdxUsd(marks = {}) {
  return (
    positive(marks.ammXrp) ||
    positive(marks.ammRlusd) ||
    positive(marks.xrplTo) ||
    positive(marks.dex) ||
    0
  );
}

export function usdFxFromSources(sources = {}) {
  const usd = positive(sources.usd ?? sources.xrpUsd);
  return {
    usdGbp:
      positive(sources.usdGbp) ||
      (usd && positive(sources.gbp ?? sources.xrpGbp) ? Number(sources.gbp ?? sources.xrpGbp) / usd : 0),
    usdEur:
      positive(sources.usdEur) ||
      (usd && positive(sources.eur ?? sources.xrpEur) ? Number(sources.eur ?? sources.xrpEur) / usd : 0),
    usdJpy:
      positive(sources.usdJpy) ||
      (usd && positive(sources.jpy ?? sources.xrpJpy) ? Number(sources.jpy ?? sources.xrpJpy) / usd : 0),
  };
}

export function applyUsdFx(xdxUsd, fx = {}) {
  const usd = positive(xdxUsd);
  if (!usd) return { xdxGbp: 0, xdxEur: 0, xdxJpy: 0 };
  return {
    xdxGbp: positive(fx.usdGbp) ? usd * fx.usdGbp : 0,
    xdxEur: positive(fx.usdEur) ? usd * fx.usdEur : 0,
    xdxJpy: positive(fx.usdJpy) ? usd * fx.usdJpy : 0,
  };
}

export function fillMissingXdxFiat(prices = {}) {
  const next = { ...prices };
  const xdxUsd = positive(next.xdxUsd ?? next.recorded_price ?? next.price);
  const fx = usdFxFromSources(next);
  if (!positive(next.usdGbp) && fx.usdGbp) next.usdGbp = fx.usdGbp;
  if (!positive(next.usdEur) && fx.usdEur) next.usdEur = fx.usdEur;
  if (!positive(next.usdJpy) && fx.usdJpy) next.usdJpy = fx.usdJpy;
  if (xdxUsd && !positive(next.xdxUsd)) {
    next.xdxUsd = xdxUsd;
    next.recorded_price = next.recorded_price || xdxUsd;
    next.price = next.price || xdxUsd;
  }
  const attached = applyUsdFx(xdxUsd, next);
  if (!positive(next.xdxGbp)) next.xdxGbp = attached.xdxGbp;
  if (!positive(next.xdxEur)) next.xdxEur = attached.xdxEur;
  if (!positive(next.xdxJpy)) next.xdxJpy = attached.xdxJpy;
  if (xdxUsd && positive(next.usdGbp) && !positive(next.xrpGbp) && positive(next.xrpUsd)) {
    next.xrpGbp = next.xrpUsd * next.usdGbp;
  }
  if (xdxUsd && positive(next.usdEur) && !positive(next.xrpEur) && positive(next.xrpUsd)) {
    next.xrpEur = next.xrpUsd * next.usdEur;
  }
  if (xdxUsd && positive(next.usdJpy) && !positive(next.xrpJpy) && positive(next.xrpUsd)) {
    next.xrpJpy = next.xrpUsd * next.usdJpy;
  }
  return next;
}

export function pricesNeedFiat(prices = {}) {
  if (!positive(prices.xdxUsd ?? prices.recorded_price ?? prices.price)) return true;
  return !(positive(prices.xdxGbp) && positive(prices.xdxEur));
}

/**
 * Preview quote against the composed XDX book + AMM curve.
 * Execution still goes through rippled (self Payment) — this is not path_find.
 */

export const IMPACT_WARN_PCT = 1.5;
export const IMPACT_HIGH_PCT = 5;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function feeRate(tradingFee) {
  const raw = Number(tradingFee);
  return raw > 0 ? raw / 100_000 : 0;
}

export function ammSwapOut({ reserveIn, reserveOut, amountIn, tradingFee = 1000 } = {}) {
  const x = num(reserveIn);
  const y = num(reserveOut);
  const dx = num(amountIn);
  const fee = feeRate(tradingFee);
  if (!(x > 0) || !(y > 0) || !(dx > 0)) return 0;
  const nextX = x + dx * (1 - fee);
  if (!(nextX > 0)) return 0;
  const out = y - (x * y) / nextX;
  return out > 0 ? out : 0;
}

export function copyLevels(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      price: num(row?.price),
      base_size: num(row?.base_size),
      quote_size: num(row?.quote_size) || num(row?.price) * num(row?.base_size),
      source: row?.source || "dex",
    }))
    .filter((row) => row.price > 0 && row.base_size > 0);
}

export function walkBook({ levels, amountIn, inIsBase } = {}) {
  let left = num(amountIn);
  let out = 0;
  const used = [];
  for (const row of copyLevels(levels)) {
    if (!(left > 0)) break;
    if (inIsBase) {
      const take = Math.min(left, row.base_size);
      out += take * row.price;
      left -= take;
      used.push({ ...row, take, out: take * row.price });
    } else {
      const quote = row.quote_size > 0 ? row.quote_size : row.base_size * row.price;
      const take = Math.min(left, quote);
      const got = row.price > 0 ? take / row.price : 0;
      out += got;
      left -= take;
      used.push({ ...row, take, out: got });
    }
  }
  return { out, leftover: left > 0 ? left : 0, used };
}

function applyAmmIn(state, amountIn, tradingFee, inIsBase) {
  if (inIsBase) {
    const got = ammSwapOut({
      reserveIn: state.base,
      reserveOut: state.quote,
      amountIn,
      tradingFee,
    });
    const fee = feeRate(tradingFee);
    state.base += amountIn * (1 - fee);
    state.quote -= got;
    return got;
  }
  const got = ammSwapOut({
    reserveIn: state.quote,
    reserveOut: state.base,
    amountIn,
    tradingFee,
  });
  const fee = feeRate(tradingFee);
  state.quote += amountIn * (1 - fee);
  state.base -= got;
  return got;
}

export function walkHybrid({
  levels,
  amountIn,
  inIsBase,
  reserveBase,
  reserveQuote,
  tradingFee = 1000,
} = {}) {
  const queue = copyLevels(levels).sort((a, b) => (inIsBase ? b.price - a.price : a.price - b.price));
  const state = { base: num(reserveBase), quote: num(reserveQuote) };
  let left = num(amountIn);
  let out = 0;
  let usedAmm = false;
  let usedDex = false;

  while (left > 1e-12) {
    const level = queue[0];
    const slice = level
      ? Math.min(left, inIsBase ? level.base_size : level.quote_size || level.base_size * level.price)
      : left;
    if (!(slice > 0)) break;

    const ammOut = applyAmmIn(
      { base: state.base, quote: state.quote },
      slice,
      tradingFee,
      inIsBase
    );
    const bookOut = level ? (inIsBase ? slice * level.price : slice / level.price) : 0;
    const takeBook = level && bookOut >= ammOut && bookOut > 0;

    if (takeBook) {
      out += bookOut;
      left -= slice;
      usedDex = true;
      if (inIsBase) {
        level.base_size -= slice;
        level.quote_size -= bookOut;
      } else {
        level.quote_size -= slice;
        level.base_size -= bookOut;
      }
      if (level.base_size <= 1e-12 || level.quote_size <= 1e-12) queue.shift();
    } else if (ammOut > 0) {
      const got = applyAmmIn(state, slice, tradingFee, inIsBase);
      out += got;
      left -= slice;
      usedAmm = true;
    } else {
      break;
    }
  }

  const route = usedAmm && usedDex ? "hybrid" : usedAmm ? "amm" : usedDex ? "book" : "none";
  return { out, leftover: left > 0 ? left : 0, route, usedAmm, usedDex };
}

export function expectedFromMid(amountIn, mid, sellingXdx) {
  const qty = num(amountIn);
  const px = num(mid);
  if (!(qty > 0) || !(px > 0)) return 0;
  return sellingXdx ? qty * px : qty / px;
}

export function quoteSwap({
  amountIn,
  sellingXdx,
  mid,
  bids = [],
  asks = [],
  reserveBase,
  reserveQuote,
  tradingFee = 1000,
  routingMode = "smart",
} = {}) {
  const input = num(amountIn);
  const expected = expectedFromMid(input, mid, sellingXdx);
  const levels = sellingXdx ? bids : asks;
  const inIsBase = Boolean(sellingXdx);
  const mode = String(routingMode || "smart").toLowerCase();

  let walk;
  if (mode === "amm") {
    const out = sellingXdx
      ? ammSwapOut({ reserveIn: reserveBase, reserveOut: reserveQuote, amountIn: input, tradingFee })
      : ammSwapOut({ reserveIn: reserveQuote, reserveOut: reserveBase, amountIn: input, tradingFee });
    walk = { out, leftover: out > 0 ? 0 : input, route: out > 0 ? "amm" : "none", usedAmm: out > 0, usedDex: false };
  } else if (mode === "book") {
    const book = walkBook({ levels, amountIn: input, inIsBase });
    walk = { ...book, route: book.out > 0 ? "book" : "none", usedAmm: false, usedDex: book.out > 0 };
  } else {
    walk = walkHybrid({
      levels,
      amountIn: input,
      inIsBase,
      reserveBase,
      reserveQuote,
      tradingFee,
    });
  }

  const actual = walk.out;
  const slippagePercent = expected > 0 ? ((actual - expected) / expected) * 100 : 0;
  const isNegativeSlippage = actual < expected;
  const lossAmount = isNegativeSlippage ? expected - actual : 0;
  const execPrice = sellingXdx
    ? input > 0 && actual > 0
      ? actual / input
      : 0
    : actual > 0
      ? input / actual
      : 0;
  const priceImpactPercent = num(mid) > 0 && execPrice > 0 ? ((execPrice - num(mid)) / num(mid)) * 100 : 0;

  return {
    expectedOutput: expected,
    actualOutput: actual,
    leftover: walk.leftover,
    routeUsed: walk.route,
    slippagePercent,
    priceImpactPercent,
    isNegativeSlippage,
    lossAmount,
    execPrice,
    mid: num(mid) || 0,
  };
}

export function saferSwapAlternatives(input, quote, extras = {}) {
  const rows = [];
  if (!(num(input) > 0) || !quote) return rows;
  const halfIn = num(input) / 2;
  const half = quoteSwap({ ...extras, amountIn: halfIn, routingMode: extras.routingMode || "smart" });
  const amm = quoteSwap({ ...extras, amountIn: input, routingMode: "amm" });
  const book = quoteSwap({ ...extras, amountIn: input, routingMode: "book" });

  const impactHigh = Math.abs(num(quote.priceImpactPercent)) >= IMPACT_WARN_PCT || quote.isNegativeSlippage;
  if (impactHigh && half.actualOutput > 0 && Math.abs(half.priceImpactPercent) < Math.abs(quote.priceImpactPercent)) {
    rows.push({ id: "half", amountIn: halfIn, quote: half });
  }
  if (amm.actualOutput > quote.actualOutput + 1e-9) rows.push({ id: "amm", amountIn: input, quote: amm });
  if (book.actualOutput > quote.actualOutput + 1e-9) rows.push({ id: "book", amountIn: input, quote: book });
  return rows;
}

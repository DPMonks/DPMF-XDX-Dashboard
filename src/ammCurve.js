export const AMM_LEVEL_BUMP = 0.0025;
export const AMM_CURVE_LEVELS = 20;

export function ammCurveLevels({
  reserveBase,
  reserveQuote,
  tradingFee = 1000,
  steps = AMM_CURVE_LEVELS,
  bump = AMM_LEVEL_BUMP,
} = {}) {
  const x0 = Number(reserveBase);
  const y0 = Number(reserveQuote);
  if (!(x0 > 0) || !(y0 > 0)) {
    return { bids: [], asks: [], price: null };
  }

  const k = x0 * y0;
  const fee = Number(tradingFee) > 0 ? Number(tradingFee) / 100_000 : 0;
  const spot = y0 / x0;

  function walk(side) {
    const rows = [];
    let x = x0;
    let y = y0;
    let cumulativeBase = 0;
    let cumulativeQuote = 0;

    for (let i = 0; i < steps; i += 1) {
      const dx = x0 * bump;
      let dy;
      if (side === "ask") {
        if (dx >= x * 0.4) break;
        const nextX = x - dx;
        const nextY = k / nextX;
        dy = (nextY - y) * (1 + fee);
        x = nextX;
        y = nextY;
      } else {
        const nextX = x + dx;
        const nextY = k / nextX;
        dy = (y - nextY) * (1 - fee);
        x = nextX;
        y = nextY;
      }
      if (!(dy > 0) || !(dx > 0)) break;
      cumulativeBase += dx;
      cumulativeQuote += dy;
      rows.push({
        level: i + 1,
        bump,
        side,
        price: dy / dx,
        source: "amm",
        base_size: dx,
        quote_size: dy,
        cumulative_base: cumulativeBase,
        cumulative_quote: cumulativeQuote,
      });
    }
    return rows;
  }

  return {
    bids: walk("bid"),
    asks: walk("ask"),
    price: spot,
  };
}

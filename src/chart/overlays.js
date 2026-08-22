import { ammSpot } from "../ammCurve.js";

export function median(values = []) {
  const nums = values.map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export function liquidityWalls(book = {}, { multiple = 2 } = {}) {
  const rows = [...(book.bids || []), ...(book.asks || [])].filter(
    (row) => Number(row?.price) > 0 && Number(row?.base_size) > 0 && !row.placeholder
  );
  const midSize = median(rows.map((row) => Number(row.base_size)));
  if (!(midSize > 0)) return [];
  return rows
    .filter((row) => Number(row.base_size) >= midSize * multiple)
    .map((row) => ({
      price: Number(row.price),
      size: Number(row.base_size),
      side: row.side || (book.asks?.includes(row) ? "ask" : "bid"),
      source: row.source || "dex",
      dominance: Number(row.base_size) / midSize,
    }))
    .sort((left, right) => right.size - left.size);
}

export function bookBands(book = {}) {
  const bid = Number(book.best_bid ?? book.bids?.find((row) => Number(row.price) > 0)?.price);
  const ask = Number(book.best_ask ?? book.asks?.find((row) => Number(row.price) > 0)?.price);
  const mid =
    Number(book.mid) > 0
      ? Number(book.mid)
      : bid > 0 && ask > 0
        ? (bid + ask) / 2
        : bid || ask || null;
  const spread = bid > 0 && ask > 0 ? ask - bid : null;
  return {
    bid: bid > 0 ? bid : null,
    ask: ask > 0 ? ask : null,
    mid: mid > 0 ? mid : null,
    spread: spread > 0 ? spread : null,
  };
}

export function liquidityPressure({
  xdxPct,
  quotePct,
  lpSupply,
  lpSupplyAvg,
} = {}) {
  const xdx = Number(xdxPct);
  const quote = Number(quotePct);
  const lp = Number(lpSupply);
  const avg = Number(lpSupplyAvg);
  const bias =
    xdx > quote ? "down" : quote > xdx ? "up" : "neutral";
  return {
    bias,
    strength: Number.isFinite(xdx) ? Math.min(1, Math.abs(xdx - 50) / 50) : 0,
    volatility: avg > 0 && lp > 0 ? Math.max(0, (lp - avg) / avg) : 0,
  };
}

export function arbitrageWindow(ammPrice, mid) {
  const amm = Number(ammPrice);
  const book = Number(mid);
  if (!(amm > 0) || !(book > 0)) return null;
  const pct = ((book - amm) / amm) * 100;
  return {
    ammPrice: amm,
    mid: book,
    pct,
    highlight: Math.abs(pct) >= 2,
  };
}

export function heatmapDots(trades = [], { now = Date.now(), maxAgeMs = 24 * 3_600_000 } = {}) {
  return (Array.isArray(trades) ? trades : [])
    .map((row) => {
      const t = Date.parse(row.timestamp || row.t || row.time);
      const size = Number(row.xdx ?? row.base_size ?? row.v ?? 0);
      const price = Number(row.price);
      if (!Number.isFinite(t) || !(size > 0)) return null;
      const age = now - t;
      if (age > maxAgeMs) return null;
      return {
        t,
        price: price > 0 ? price : null,
        size,
        side: String(row.side || "").toLowerCase() === "sell" ? "sell" : "buy",
        opacity: Math.max(0.18, 1 - age / maxAgeMs),
        account: row.account || null,
        pool: row.pool || row.pool_name || null,
      };
    })
    .filter(Boolean);
}

export function ammRebalanceTrail(snapshots = []) {
  return (Array.isArray(snapshots) ? snapshots : [])
    .map((row) => {
      const t = Date.parse(row.timestamp || row.t);
      const base = Number(row.reserve_asset ?? row.reserve_xdx ?? row.reserveBase);
      const quote = Number(row.reserve_currency ?? row.reserve_quote ?? row.reserveQuote);
      const price = Number(row.price) > 0 ? Number(row.price) : ammSpot(base, quote);
      if (!Number.isFinite(t) || !(price > 0)) return null;
      return { t, price, reserveBase: base, reserveQuote: quote };
    })
    .filter(Boolean)
    .sort((left, right) => left.t - right.t);
}

export function ammImpact({ reserveBase, reserveQuote, amount, side } = {}) {
  const x = Number(reserveBase);
  const y = Number(reserveQuote);
  const dx = Number(amount);
  const spot = ammSpot(x, y);
  if (!(spot > 0) || !(dx > 0)) return null;

  if (side === "addLp" || side === "removeLp") {
    const nextBase = side === "addLp" ? x + dx : Math.max(0, x - dx);
    const nextQuote = side === "addLp" ? y + dx * spot : Math.max(0, y - dx * spot);
    return {
      spot,
      next: spot,
      impactPct: 0,
      nextBase,
      nextQuote,
      kind: side,
    };
  }

  const k = x * y;
  let nextX;
  if (side === "buy") {
    if (dx >= x * 0.95) return null;
    nextX = x - dx;
  } else {
    nextX = x + dx;
  }
  if (!(nextX > 0)) return null;
  const nextY = k / nextX;
  const next = nextY / nextX;
  return {
    spot,
    next,
    impactPct: ((next - spot) / spot) * 100,
    nextBase: nextX,
    nextQuote: nextY,
    kind: side === "buy" ? "buy" : "sell",
  };
}

export function depthIntensity(volume, typical) {
  const vol = Number(volume) || 0;
  const base = Number(typical) || 0;
  if (!(base > 0) || !(vol > 0)) return 0.55;
  return Math.max(0.35, Math.min(1, 0.4 + (vol / base) * 0.6));
}

export function microEvents({
  trades = [],
  spreadBps,
  prevSpreadBps,
  pressure,
  walls = [],
  lastFill,
} = {}) {
  const events = [];
  const large = trades.find((row) => Number(row.xdx) >= 250_000 && String(row.side).toLowerCase() === "buy");
  if (large) events.push({ id: "large-buy", icon: "⚡", label: "Large buy detected" });
  if (Number(spreadBps) > 0 && Number(prevSpreadBps) > 0 && spreadBps > prevSpreadBps * 1.25) {
    events.push({ id: "spread", icon: "⚠️", label: "Spread widening" });
  }
  if (pressure?.volatility > 0.08) events.push({ id: "lp", icon: "💧", label: "LP deposit spike" });
  if (pressure?.strength > 0.15) events.push({ id: "rebalance", icon: "🔄", label: "AMM rebalancing" });
  if (walls.some((wall) => wall.side === "ask" && lastFill && Number(lastFill.price) >= wall.price * 0.995)) {
    events.push({ id: "wall", icon: "🧱", label: "Sell wall hit" });
  }
  return events.slice(0, 4);
}

export function smartView(candles = [], { rangeId = "1M", spread, now = Date.now() } = {}) {
  const days =
    { "1D": 1, "5D": 5, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "5Y": 365 * 5 }[rangeId] ?? 30;
  const start = rangeId === "Max" ? candles[0]?.t : now - days * 86_400_000;
  const visible = candles.filter((row) => row.t >= (start || 0));
  const use = visible.length ? visible : candles.slice(-30);
  if (!use.length) return { start: now - 30 * 86_400_000, end: now, min: 0, max: 1 };
  const lows = use.map((row) => Number(row.l || row.c));
  const highs = use.map((row) => Number(row.h || row.c));
  let min = Math.min(...lows);
  let max = Math.max(...highs);
  const pad = (max - min) * (Number(spread) > 0 && spread / ((min + max) / 2) > 0.02 ? 0.18 : 0.08);
  if (!(max > min)) {
    min *= 0.98;
    max *= 1.02;
  }
  return {
    start: use[0].t,
    end: Math.max(use[use.length - 1].t, now),
    min: Math.max(0, min - pad),
    max: max + pad,
  };
}

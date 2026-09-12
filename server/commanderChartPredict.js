/**
 * AIM Commander HybridChart prediction drawings + theory replies.
 * Uses drawings.js kinds: fib, fibext, trend, hline (not decorative random marks).
 * Visitor side-calls are treated as predictions/estimates, never fact or Teach.
 */

function scrub(text) {
  return String(text || "")
    .replace(/\u2014/g, ". ")
    .replace(/\u2013/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatPx(v) {
  const n = Number(v);
  if (!(n > 0)) return null;
  if (n >= 10) return n.toFixed(3);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(5);
}

const CMD_COLOR = {
  bull: "#98f050",
  bear: "#ff5d73",
  fib: "#3d8bff",
  level: "#ffe14a",
  trend: "#c770ff",
};

const MIN_TREND_BARS = 4;

export function resolvePredictSide(question, classified) {
  if (classified?.side === "bull" || classified?.side === "bear") return classified.side;
  const q = String(question || "").toLowerCase();
  if (/\bbearish\b|\bbear\b|\bshort\b/.test(q) && !/\beither\b|\bboth\b|\bany\b/.test(q)) return "bear";
  if (/\bbullish\b|\bbull\b|\blong\b/.test(q) && !/\beither\b|\bboth\b|\bany\b/.test(q)) return "bull";
  // Support / demand structure => bullish higher-lows. Resistance / supply => bearish.
  if (/\b(support|demand|higher\s*lows?)\b/.test(q)) return "bull";
  if (/\b(resist(ance)?|supply|lower\s*highs?)\b/.test(q)) return "bear";
  if (isSideAgnosticReply(q)) return classified?.default_side === "bear" ? "bear" : "bull";
  return null;
}

/** User declined to pick a side: either / doesn't matter / both / any / you choose. */
export function isSideAgnosticReply(question) {
  const q = String(question || "").toLowerCase().trim();
  if (!q) return false;
  if (
    /^(either|both|any|whatever|whichever)([,.!]|\s|$)/.test(q) ||
    /\b(either|both|any|whatever|whichever)\b/.test(q) &&
      /\b(doesn'?t matter|dont matter|do not matter|no matter|fine|ok|okay|works|is fine|you (choose|pick|decide)|dealer.?s? choice|up to you|as you (like|wish)|i (don'?t|do not) (mind|care))\b/.test(q)
  ) {
    return true;
  }
  if (
    /\b(doesn'?t matter|dont matter|do not matter|no matter|you (choose|pick|decide)|dealer.?s? choice|up to you)\b/.test(q)
  ) {
    return true;
  }
  return false;
}

/** Detect visitor sharing their own call (not asking Commander to draw). */
export function looksLikeVisitorPrediction(question) {
  const q = String(question || "").toLowerCase();
  if (!q) return false;
  if (/\b(lay|draw|plot|paint|put|show)\b/.test(q) && /\b(prediction|fib|trend|hline|estimate)\b/.test(q)) {
    return false;
  }
  if (isSideAgnosticReply(q)) return false;
  return (
    /\b(i think|i believe|my (call|view|bias|prediction|estimate|take)|im (bullish|bearish)|i'?m (bullish|bearish)|we are (bullish|bearish)|going (long|short)|targets? (at|near|around)|will (go|move|hit)|should (go|hit|reach))\b/.test(
      q
    ) ||
    (/^(bullish|bearish)\b/.test(q.trim()) && /\b(to|at|near|around|target|because|since)\b/.test(q))
  );
}

function candleRows(chartContext) {
  const rows = Array.isArray(chartContext?.candles) ? chartContext.candles : [];
  return rows
    .map((c) => ({
      t: num(c?.t),
      o: num(c?.o),
      h: num(c?.h),
      l: num(c?.l),
      c: num(c?.c),
    }))
    .filter((c) => c.t != null && c.h != null && c.l != null && c.c != null);
}

function findSwingHigh(rows, from, to) {
  let best = null;
  for (let i = from; i <= to; i += 1) {
    const row = rows[i];
    if (!row) continue;
    if (!best || row.h > best.price) best = { index: i, t: row.t, price: row.h, kind: "swing_high" };
  }
  return best;
}

function findSwingLow(rows, from, to) {
  let best = null;
  for (let i = from; i <= to; i += 1) {
    const row = rows[i];
    if (!row) continue;
    if (!best || row.l < best.price) best = { index: i, t: row.t, price: row.l, kind: "swing_low" };
  }
  return best;
}

function localSwingLows(rows, pad = 2) {
  const out = [];
  for (let i = pad; i < rows.length - pad; i += 1) {
    const row = rows[i];
    let ok = true;
    for (let j = i - pad; j <= i + pad; j += 1) {
      if (j === i) continue;
      if (rows[j].l < row.l) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ index: i, t: row.t, price: row.l, kind: "swing_low" });
  }
  return out;
}

function localSwingHighs(rows, pad = 2) {
  const out = [];
  for (let i = pad; i < rows.length - pad; i += 1) {
    const row = rows[i];
    let ok = true;
    for (let j = i - pad; j <= i + pad; j += 1) {
      if (j === i) continue;
      if (rows[j].h > row.h) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ index: i, t: row.t, price: row.h, kind: "swing_high" });
  }
  return out;
}

/** Reject vertical / zero-width / same-candle "trends". */
export function isValidDiagonal(a, b, { minBars = MIN_TREND_BARS } = {}) {
  if (!a || !b) return false;
  const t1 = num(a.t);
  const t2 = num(b.t);
  const p1 = num(a.price);
  const p2 = num(b.price);
  if (t1 == null || t2 == null || p1 == null || p2 == null) return false;
  if (t1 === t2) return false;
  const i1 = Number.isFinite(Number(a.index)) ? Number(a.index) : null;
  const i2 = Number.isFinite(Number(b.index)) ? Number(b.index) : null;
  if (i1 != null && i2 != null && Math.abs(i2 - i1) < minBars) return false;
  // Meaningful time span (avoid synthetic 1ms stubs)
  if (Math.abs(t2 - t1) < 60_000) return false;
  // Must have price slope (not a horizontal disguised as trend when used as fib extremes at one x)
  if (p1 === p2) return false;
  return true;
}

/**
 * Fib impulse swings: distinct time+price extremes for retracement.
 * Bullish up-leg: A swing low -> B swing high.
 * Bearish down-leg: A swing high -> B swing low.
 */
export function detectStructureSwings(chartContext, side) {
  const rows = candleRows(chartContext);
  const swingsCtx = chartContext?.swings && typeof chartContext.swings === "object" ? chartContext.swings : null;
  if (rows.length >= 8) {
    const n = rows.length;
    const mid = Math.floor(n * 0.55);
    const earlyEnd = Math.max(3, mid - 1);
    const lateStart = Math.min(n - 3, mid);
    if (side === "bear") {
      const high = findSwingHigh(rows, 0, earlyEnd);
      const low = findSwingLow(rows, lateStart, n - 1);
      if (high && low && high.t < low.t && high.price > low.price && isValidDiagonal(high, low, { minBars: 3 })) {
        return { a: high, b: low, last: rows[n - 1], rows, source: "candles", side };
      }
      const gHigh = findSwingHigh(rows, 0, n - 2);
      const gLow = findSwingLow(rows, (gHigh?.index || 0) + 1, n - 1);
      if (gHigh && gLow && isValidDiagonal(gHigh, gLow, { minBars: 3 })) {
        return { a: gHigh, b: gLow, last: rows[n - 1], rows, source: "candles", side };
      }
    } else {
      const low = findSwingLow(rows, 0, earlyEnd);
      const high = findSwingHigh(rows, lateStart, n - 1);
      if (low && high && low.t < high.t && high.price > low.price && isValidDiagonal(low, high, { minBars: 3 })) {
        return { a: low, b: high, last: rows[n - 1], rows, source: "candles", side };
      }
      const gLow = findSwingLow(rows, 0, n - 2);
      const gHigh = findSwingHigh(rows, (gLow?.index || 0) + 1, n - 1);
      if (gLow && gHigh && isValidDiagonal(gLow, gHigh, { minBars: 3 })) {
        return { a: gLow, b: gHigh, last: rows[n - 1], rows, source: "candles", side };
      }
    }
  }

  if (swingsCtx?.high && swingsCtx?.low) {
    const hi = { t: num(swingsCtx.high.t), price: num(swingsCtx.high.price), kind: "swing_high" };
    const lo = { t: num(swingsCtx.low.t), price: num(swingsCtx.low.price), kind: "swing_low" };
    const last = swingsCtx.last
      ? { t: num(swingsCtx.last.t), price: num(swingsCtx.last.price) || num(swingsCtx.last.c) }
      : null;
    if (hi.t != null && hi.price != null && lo.t != null && lo.price != null && hi.t !== lo.t) {
      if (side === "bear") {
        const a = hi;
        const b = lo.t > hi.t ? lo : null;
        if (b && isValidDiagonal(a, b, { minBars: 1 })) return { a, b, last, rows, source: "swings", side };
      } else {
        const a = lo;
        const b = hi.t > lo.t ? hi : null;
        if (b && isValidDiagonal(a, b, { minBars: 1 })) return { a, b, last, rows, source: "swings", side };
      }
    }
  }

  const price = chartContext?.price || {};
  const lo = num(price.visible_min);
  const hi = num(price.visible_max);
  const lastPx = num(price.live) || num(price.last_close);
  if (lo != null && hi != null && hi > lo) {
    // Prefer candle span times when available so anchors are not both clamped to the right edge.
    const n = rows.length;
    const tEarly = n >= 2 ? rows[Math.max(0, Math.floor(n * 0.15))].t : null;
    const tLate = n >= 2 ? rows[Math.min(n - 1, Math.floor(n * 0.85))].t : null;
    const now = Date.parse(chartContext?.at) || Date.now();
    const span = 60 * 60 * 1000;
    const aT = tEarly != null ? tEarly : now - span * 4;
    const bT = tLate != null ? tLate : now - span;
    if (side === "bear") {
      return {
        a: { t: aT, price: hi, kind: "range_high", index: 0 },
        b: { t: bT, price: lo, kind: "range_low", index: Math.max(1, n - 1) },
        last: { t: now, price: lastPx || (lo + hi) / 2 },
        rows,
        source: "visible_range",
        side,
      };
    }
    return {
      a: { t: aT, price: lo, kind: "range_low", index: 0 },
      b: { t: bT, price: hi, kind: "range_high", index: Math.max(1, n - 1) },
      last: { t: now, price: lastPx || (lo + hi) / 2 },
      rows,
      source: "visible_range",
      side,
    };
  }
  return null;
}

/**
 * Diagonal structure trendline on candle swings.
 * Bull/support: two distinct swing lows (prefer rising / higher lows).
 * Bear/resist: two distinct swing highs (prefer falling / lower highs).
 * NEVER reuses fib 0/1 extremes at the same index, NEVER vertical.
 */
export function detectTrendAnchors(chartContext, side) {
  const rows = candleRows(chartContext);
  if (rows.length >= 10) {
    if (side === "bear") {
      const highs = localSwingHighs(rows, 2);
      // Prefer lower highs: earlier high > later high
      for (let i = 0; i < highs.length; i += 1) {
        for (let j = i + 1; j < highs.length; j += 1) {
          const a = highs[i];
          const b = highs[j];
          if (b.index - a.index < MIN_TREND_BARS) continue;
          if (b.price <= a.price * 1.002 && isValidDiagonal(a, b)) {
            return { a, b, last: rows[rows.length - 1], rows, source: "candles_trend", side, role: "resistance" };
          }
        }
      }
      // Fallback: earliest and latest swing high with span
      if (highs.length >= 2) {
        const a = highs[0];
        const b = highs[highs.length - 1];
        if (isValidDiagonal(a, b)) {
          return { a, b, last: rows[rows.length - 1], rows, source: "candles_trend", side, role: "resistance" };
        }
      }
      // Fallback: early-window high to late-window high (forced different windows)
      const n = rows.length;
      const early = findSwingHigh(rows, 0, Math.floor(n * 0.4));
      const late = findSwingHigh(rows, Math.floor(n * 0.55), n - 1);
      if (early && late && isValidDiagonal(early, late)) {
        return { a: early, b: late, last: rows[n - 1], rows, source: "candles_trend", side, role: "resistance" };
      }
    } else {
      const lows = localSwingLows(rows, 2);
      for (let i = 0; i < lows.length; i += 1) {
        for (let j = i + 1; j < lows.length; j += 1) {
          const a = lows[i];
          const b = lows[j];
          if (b.index - a.index < MIN_TREND_BARS) continue;
          // Prefer higher lows for support
          if (b.price >= a.price * 0.998 && isValidDiagonal(a, b)) {
            return { a, b, last: rows[rows.length - 1], rows, source: "candles_trend", side, role: "support" };
          }
        }
      }
      if (lows.length >= 2) {
        const a = lows[0];
        const b = lows[lows.length - 1];
        if (isValidDiagonal(a, b)) {
          return { a, b, last: rows[rows.length - 1], rows, source: "candles_trend", side, role: "support" };
        }
      }
      const n = rows.length;
      const early = findSwingLow(rows, 0, Math.floor(n * 0.4));
      const late = findSwingLow(rows, Math.floor(n * 0.55), n - 1);
      if (early && late && isValidDiagonal(early, late)) {
        return { a: early, b: late, last: rows[n - 1], rows, source: "candles_trend", side, role: "support" };
      }
    }
  }

  // Last resort: spaced points on visible range using candle times when possible
  const fibLike = detectStructureSwings(chartContext, side);
  if (!fibLike?.a || !fibLike?.b) return null;
  // Do NOT use fib A/B (impulse high/low) as trend — rebuild from thirds of the series
  const rows2 = fibLike.rows || [];
  if (rows2.length >= 8) {
    const n = rows2.length;
    const i1 = Math.max(1, Math.floor(n * 0.2));
    const i2 = Math.min(n - 2, Math.floor(n * 0.8));
    if (side === "bear") {
      const a = { index: i1, t: rows2[i1].t, price: rows2[i1].h, kind: "swing_high" };
      const b = { index: i2, t: rows2[i2].t, price: rows2[i2].h, kind: "swing_high" };
      if (isValidDiagonal(a, b)) return { a, b, last: rows2[n - 1], rows: rows2, source: "spaced", side, role: "resistance" };
    } else {
      const a = { index: i1, t: rows2[i1].t, price: rows2[i1].l, kind: "swing_low" };
      const b = { index: i2, t: rows2[i2].t, price: rows2[i2].l, kind: "swing_low" };
      if (isValidDiagonal(a, b)) return { a, b, last: rows2[n - 1], rows: rows2, source: "spaced", side, role: "support" };
    }
  }
  return null;
}

/** Infer bull/bear from visible candles when user did not specify. */
export function inferSideFromChart(chartContext, hint = null) {
  if (hint === "bull" || hint === "bear") return hint;
  const qSide = resolvePredictSide(hint || "", {});
  if (qSide) return qSide;
  const rows = candleRows(chartContext);
  if (rows.length >= 8) {
    const n = rows.length;
    const earlyLow = findSwingLow(rows, 0, Math.floor(n * 0.45));
    const lateHigh = findSwingHigh(rows, Math.floor(n * 0.5), n - 1);
    const earlyHigh = findSwingHigh(rows, 0, Math.floor(n * 0.45));
    const lateLow = findSwingLow(rows, Math.floor(n * 0.5), n - 1);
    const up =
      earlyLow && lateHigh && lateHigh.t > earlyLow.t && lateHigh.price > earlyLow.price
        ? lateHigh.price - earlyLow.price
        : 0;
    const down =
      earlyHigh && lateLow && lateLow.t > earlyHigh.t && earlyHigh.price > lateLow.price
        ? earlyHigh.price - lateLow.price
        : 0;
    if (up > down && up > 0) return "bull";
    if (down > up && down > 0) return "bear";
    const first = rows[0].c;
    const last = rows[n - 1].c;
    if (last > first) return "bull";
    if (last < first) return "bear";
  }
  const live = num(chartContext?.price?.live) || num(chartContext?.price?.last_close);
  const vmin = num(chartContext?.price?.visible_min);
  const vmax = num(chartContext?.price?.visible_max);
  if (live != null && vmin != null && vmax != null && vmax > vmin) {
    return live >= (vmin + vmax) / 2 ? "bull" : "bear";
  }
  return "bull";
}

function wantTools(question) {
  const q = String(question || "").toLowerCase();
  const fib = /\bfib(onacci)?\b|\bretrace(ment)?\b|\bfibext\b|\bextension\b|\bgolden\b/.test(q);
  const explicitTrend = /\btrend(\s*line)?s?\b|\bstructure\b|\bchannel\b/.test(q);
  const supportOrResist = /\b(support|resist(ance)?|demand|supply)\b/.test(q);
  const lineWord = /\b(line|hline|horizontal|level)s?\b/.test(q);
  // "support line" / "place support" => horizontal support (hline). "support trendline" => diagonal.
  const supportLineOnly =
    supportOrResist &&
    lineWord &&
    !explicitTrend &&
    !fib &&
    !/\b(prediction|predict|estimate|projection|full)\b/.test(q);
  const trend =
    explicitTrend ||
    (supportOrResist && explicitTrend) ||
    (/\b(support|resist(ance)?)\b/.test(q) && /\btrend\b/.test(q));
  const hline =
    /\bhline|\bhorizontal|\bs\/r\b|\blevels?\b/.test(q) ||
    supportLineOnly ||
    (supportOrResist && lineWord && !explicitTrend);
  const multi = /\b(and|plus|with|also|stack|combo|all (the )?tools|full (kit|set))\b/.test(q);
  const countOne =
    /\b(1|one|single|a)\s+(trend(\s*line)?|support|resist|hline|line)\b/.test(q) ||
    /\b(lay|draw|place)\s+(1|one|me\s+a|a)\b/.test(q);
  const supportOrResistTrendOnly =
    supportOrResist &&
    explicitTrend &&
    !fib &&
    !/\b(prediction|predict|estimate|projection|full)\b/.test(q);

  if (supportLineOnly) {
    // One support/resist horizontal; optional diagonal only if they also said trend
    return { fib: false, trend: false, hline: true, multi: false, maxTrends: 0, maxHlines: 1, supportLine: true };
  }
  if (supportOrResistTrendOnly || (trend && !fib && !hline && !multi && !/\b(prediction|predict|estimate|projection)\b/.test(q))) {
    return { fib: false, trend: true, hline: false, multi: false, maxTrends: 1, maxHlines: 0 };
  }
  if (fib && !trend && !hline && !multi) {
    return { fib: true, trend: false, hline: false, multi: false, maxTrends: 0, maxHlines: 0 };
  }
  if (!fib && !trend && !hline) {
    return { fib: true, trend: true, hline: true, multi: true, maxTrends: 1, maxHlines: 3 };
  }
  return {
    fib: fib || (multi && !trend && !hline),
    trend: trend || multi,
    hline: hline || multi,
    multi,
    maxTrends: countOne ? 1 : 1,
    maxHlines: supportLineOnly ? 1 : 3,
    supportLine: supportLineOnly,
  };
}

function tagCommander(row) {
  return {
    ...row,
    source: "commander",
    commander: true,
    label: "Estimate by AI-Matrix",
    strokeWidth: row.strokeWidth || 2,
    lineStyle: row.lineStyle || "solid",
  };
}

function pointPayload(p) {
  return { t: p.t, price: p.price };
}

export function buildCommanderPredictionDrawings(side, chartContext, estimate, question) {
  const tools = wantTools(question);
  const drawings = [];
  const narrate_steps = [];
  const color = side === "bear" ? CMD_COLOR.bear : CMD_COLOR.bull;

  const fibStructure = tools.fib ? detectStructureSwings(chartContext, side) : null;
  const trendStructure = tools.trend || tools.supportLine || tools.hline
    ? detectTrendAnchors(chartContext, side)
    : null;
  const structure = fibStructure || trendStructure || detectStructureSwings(chartContext, side);

  // Hline-only support/resist can proceed even if diagonal structure is soft
  if (!(tools.hline && (tools.supportLine || tools.maxHlines === 1)) && (!structure?.a || !structure?.b)) {
    return { drawings: [], structure: null, tools, narrate_steps: [], side };
  }

  narrate_steps.push({
    id: "open",
    text: scrub(
      tools.supportLine || (tools.hline && !tools.fib && !tools.trend)
        ? side === "bull"
          ? "Placing a bullish support line on the recent swing low."
          : "Placing a bearish resistance line on the recent swing high."
        : tools.trend && !tools.fib
          ? side === "bull"
            ? "Laying one support trendline on the higher lows."
            : "Laying one resistance trendline on the lower highs."
          : `Laying ${side === "bull" ? "bullish" : "bearish"} HybridChart tools on the visible swings.`
    ),
  });

  if (tools.fib && fibStructure?.a && fibStructure?.b && isValidDiagonal(fibStructure.a, fibStructure.b, { minBars: 2 })) {
    const a = pointPayload(fibStructure.a);
    const b = pointPayload(fibStructure.b);
    narrate_steps.push({ id: "tool:fib", text: "Selecting the Fib retracement tool." });
    narrate_steps.push({
      id: "anchor:fib:a",
      text: scrub(
        side === "bear"
          ? `Anchoring the swing high near ${formatPx(a.price)}.`
          : `Anchoring the swing low near ${formatPx(a.price)}.`
      ),
    });
    narrate_steps.push({
      id: "anchor:fib:b",
      text: scrub(
        side === "bear"
          ? `Anchoring the swing low near ${formatPx(b.price)}. Full Fib levels coming in.`
          : `Anchoring the swing high near ${formatPx(b.price)}. Full Fib levels coming in.`
      ),
    });
    drawings.push(
      tagCommander({
        kind: "fib",
        color: CMD_COLOR.fib,
        a,
        b,
        strokeWidth: 1,
        lineStyle: "solid",
      })
    );
  }

  if (tools.trend && trendStructure?.a && trendStructure?.b && isValidDiagonal(trendStructure.a, trendStructure.b)) {
    const a = pointPayload(trendStructure.a);
    const b = pointPayload(trendStructure.b);
    // Hard reject vertical / same-x before apply
    if (a.t !== b.t && Math.abs(a.t - b.t) >= 60_000) {
      narrate_steps.push({ id: "tool:trend", text: "Selecting the trendline tool." });
      narrate_steps.push({
        id: "anchor:trend:a",
        text: scrub(
          side === "bull"
            ? `Anchoring the earlier swing low near ${formatPx(a.price)}.`
            : `Anchoring the earlier swing high near ${formatPx(a.price)}.`
        ),
      });
      narrate_steps.push({
        id: "anchor:trend:b",
        text: scrub(
          side === "bull"
            ? `Anchoring the later swing low near ${formatPx(b.price)} for support.`
            : `Anchoring the later swing high near ${formatPx(b.price)} for resistance.`
        ),
      });
      drawings.push(
        tagCommander({
          kind: "trend",
          color: CMD_COLOR.trend,
          a,
          b,
          strokeWidth: 2,
          lineStyle: "solid",
          role: trendStructure.role || (side === "bull" ? "support" : "resistance"),
        })
      );
      // Cap at 1 trendline when requested
      void tools.maxTrends;
    }
  }

  if (tools.hline) {
    const levels = [];
    if (tools.supportLine || (tools.maxHlines === 1 && !tools.fib)) {
      // Single support/resist horizontal from recent swing (not estimate-dependent)
      const rows = candleRows(chartContext);
      let px = null;
      let tAt = null;
      if (side === "bull") {
        const swing = detectTrendAnchors(chartContext, "bull");
        const low = swing?.b || swing?.a || (rows.length ? { t: rows[rows.length - 1].t, price: findSwingLow(rows, Math.max(0, rows.length - 12), rows.length - 1)?.price } : null);
        px = num(low?.price);
        tAt = num(low?.t);
        if (px != null) levels.push({ price: px, role: "support", t: tAt });
      } else {
        const swing = detectTrendAnchors(chartContext, "bear");
        const high = swing?.b || swing?.a || (rows.length ? { t: rows[rows.length - 1].t, price: findSwingHigh(rows, Math.max(0, rows.length - 12), rows.length - 1)?.price } : null);
        px = num(high?.price);
        tAt = num(high?.t);
        if (px != null) levels.push({ price: px, role: "resistance", t: tAt });
      }
      if (!levels.length) {
        const vmin = num(chartContext?.price?.visible_min);
        const vmax = num(chartContext?.price?.visible_max);
        if (side === "bull" && vmin != null) levels.push({ price: vmin, role: "support", t: Date.now() });
        if (side === "bear" && vmax != null) levels.push({ price: vmax, role: "resistance", t: Date.now() });
      }
    } else if (fibStructure?.a && fibStructure?.b) {
      const a = fibStructure.a;
      const b = fibStructure.b;
      const r618 = b.price + (a.price - b.price) * 0.618;
      const r382 = b.price + (a.price - b.price) * 0.382;
      if (side === "bull") {
        levels.push(
          { price: Math.min(a.price, b.price), role: "support", t: b.t },
          { price: r618, role: "fib_618", t: b.t },
          { price: Math.max(a.price, b.price), role: "resistance", t: b.t }
        );
      } else {
        levels.push(
          { price: Math.max(a.price, b.price), role: "resistance", t: b.t },
          { price: r382, role: "fib_382", t: b.t },
          { price: Math.min(a.price, b.price), role: "support", t: b.t }
        );
      }
    }
    const used = [];
    if (levels.length) {
      narrate_steps.push({
        id: "tool:hline",
        text: side === "bull" ? "Selecting horizontal support." : "Selecting horizontal resistance.",
      });
    }
    for (const lvl of levels.slice(0, tools.maxHlines || 3)) {
      const px = num(lvl.price);
      if (px == null) continue;
      if (used.some((u) => Math.abs(u - px) / Math.max(px, 1e-12) < 0.0008)) continue;
      used.push(px);
      narrate_steps.push({
        id: `anchor:hline:${lvl.role}`,
        text: scrub(`Anchoring ${lvl.role.replace(/_/g, " ")} near ${formatPx(px)}.`),
      });
      drawings.push(
        tagCommander({
          kind: "hline",
          color: CMD_COLOR.level,
          t: lvl.t || Date.now(),
          price: px,
          strokeWidth: 2,
          lineStyle: String(lvl.role).includes("fib") ? "dash" : "solid",
          role: lvl.role,
        })
      );
    }
  }

  if ((/\bfibext|\bextension\b/.test(String(question || "").toLowerCase()) || tools.multi) && fibStructure?.last?.t) {
    if (/\bfibext|\bextension\b/.test(String(question || "").toLowerCase())) {
      const a = pointPayload(fibStructure.a);
      const b = pointPayload(fibStructure.b);
      const c = {
        t: fibStructure.last.t,
        price: num(fibStructure.last.price) || num(fibStructure.last.c) || b.price,
      };
      if (c.price != null) {
        drawings.push(
          tagCommander({
            kind: "fibext",
            color,
            a,
            b,
            c,
            strokeWidth: 1,
            lineStyle: "solid",
          })
        );
      }
    }
  }

  return { drawings, structure, tools, narrate_steps, side, trendStructure, fibStructure };
}

function patternName(side, structure, tools) {
  if (tools?.supportLine || (tools?.hline && !tools?.fib && !tools?.trend)) {
    return side === "bull" ? "horizontal support line" : "horizontal resistance line";
  }
  if (tools?.trend && !tools?.fib) {
    return side === "bull" ? "rising support trendline" : "falling resistance trendline";
  }
  if (tools?.fib && tools?.trend) {
    return side === "bull" ? "bullish impulse with Fibonacci pullback map" : "bearish impulse with Fibonacci continuation map";
  }
  if (tools?.fib) return side === "bull" ? "Fibonacci retracement on the upswing" : "Fibonacci retracement on the downswing";
  if (tools?.trend) return side === "bull" ? "rising structure trendline" : "falling structure trendline";
  return "support and resistance levels";
}

export function answerChartToolsQuestion(chartContext) {
  const ctx = chartContext && typeof chartContext === "object" ? chartContext : null;
  if (!ctx) {
    return scrub(
      "Open the HybridChart in AI-Matrix so I can see the live tools. Then ask about the active tool, MAs, magnet, or drawings."
    );
  }
  const bits = [];
  const tool = scrub(ctx.active_tool || "none") || "none";
  bits.push(`On ${scrub(ctx.pair) || "this pair"} ${scrub(ctx.timeframe) || ""} I see tool ${tool}.`);
  const maType = scrub(ctx.ma_type || "sma");
  const periods = Array.isArray(ctx.ma_periods) ? ctx.ma_periods.join(", ") : "";
  if (periods) bits.push(`MA is ${maType.toUpperCase()} ${periods}.`);
  bits.push(ctx.magnet ? "Magnet snap is on." : "Magnet snap is off.");
  const ov = ctx.overlays || {};
  const on = [];
  if (ov.volume) on.push("volume");
  if (ov.rsi) on.push("RSI");
  if (ov.arb) on.push("arb");
  if (ov.hollow) on.push("hollow candles");
  if (ov.desk_marks) on.push(`desk marks (${ov.desk_marks_count || 0})`);
  if (ov.estimate) on.push(ov.estimate_side ? `estimate ${ov.estimate_side}` : "estimate overlay");
  if (on.length) bits.push(`Overlays on: ${on.join(", ")}.`);
  const dcount = Number(ctx.drawings?.count) || 0;
  if (dcount > 0) {
    const kinds = ctx.drawings?.kinds && typeof ctx.drawings.kinds === "object" ? ctx.drawings.kinds : {};
    const parts = Object.entries(kinds)
      .slice(0, 6)
      .map(([k, v]) => `${v}x ${k}`);
    bits.push(parts.length ? `Drawings: ${parts.join(", ")}.` : `${dcount} drawings on the pane.`);
  } else {
    bits.push("No user drawings on the pane right now.");
  }
  const last = formatPx(ctx.price?.live || ctx.price?.last_close);
  const vmin = formatPx(ctx.price?.visible_min);
  const vmax = formatPx(ctx.price?.visible_max);
  if (last) bits.push(`Last ${last}.`);
  if (vmin && vmax) bits.push(`Visible range ${vmin} to ${vmax}.`);
  return scrub(bits.join(" "));
}


function samePair(a, b) {
  const left = String(a || "").replace(/\s+/g, "").toUpperCase();
  const right = String(b || "").replace(/\s+/g, "").toUpperCase();
  if (!left || !right) return false;
  if (left === right) return true;
  const [rb, rq] = right.split("/");
  return Boolean(rb && rq && left === `${rq}/${rb}`);
}

/** Commander estimate feed is XRP/RLUSD-keyed. */
export function estimateMatchesChartPair(estimate, chartContext) {
  const estPair = String(estimate?.pair || "XRP/RLUSD").replace(/\s+/g, "").toUpperCase();
  const chartPair = String(chartContext?.pair || "").replace(/\s+/g, "").toUpperCase();
  if (!chartPair) return true;
  return samePair(estPair, chartPair);
}

function isXdxPair(pair) {
  const p = String(pair || "").replace(/\s+/g, "").toUpperCase();
  return p.startsWith("XDX/") || p.endsWith("/XDX");
}

function isXrpLeadPair(pair) {
  return samePair(pair, "XRP/RLUSD") || samePair(pair, "XRP/USD");
}

function wantsCrossCurrency(question, chartContext) {
  const q = String(question || "");
  const pair = String(chartContext?.pair || "");
  if (isXdxPair(pair) || isXrpLeadPair(pair)) return true;
  return /\b(xrp|xdx)\b/i.test(q) && /\b(xrp|xdx|rlusd)\b/i.test(q);
}

/**
 * Measured-move % from support area to prior resistance (or bearish inverse).
 * Trade scoring prefers clear % gain paths, not vague edge.
 */
export function scoreMeasuredMovePct(side, supportPx, resistPx) {
  const s = num(supportPx);
  const r = num(resistPx);
  if (!(s > 0) || !(r > 0)) return null;
  if (side === "bear") {
    if (!(s < r)) return null;
    return ((r - s) / r) * 100;
  }
  if (!(r > s)) return null;
  return ((r - s) / s) * 100;
}

function formatPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return (Math.round(n * 10) / 10).toFixed(1);
}

/**
 * Scan candle history for repeating swing support/resistance and score % gain.
 * Soft recommend only (never a hard block). Prefer biggest realistic % for the visible history.
 */
/** Soft expectation bands: lower TFs = smaller %; higher TFs = larger opportunities. */
export function timeframeGainExpectation(timeframe) {
  const tf = String(timeframe || "").toUpperCase();
  if (tf === "5M" || tf === "5") return { min: 0.2, sweet: 0.6, label: "5m" };
  if (tf === "15M" || tf === "15") return { min: 0.35, sweet: 1.2, label: "15m" };
  if (tf === "1H" || tf === "60" || tf === "1HR") return { min: 0.8, sweet: 3.0, label: "1H" };
  if (tf === "4H") return { min: 1.5, sweet: 5.0, label: "4H" };
  if (tf === "1D" || tf === "D" || tf === "1DAY") return { min: 2.0, sweet: 8.0, label: "1D" };
  return { min: 0.4, sweet: 2.0, label: tf || "tf" };
}

function findNextResistanceWithTrend(rows, side = "bull") {
  if (!Array.isArray(rows) || rows.length < 6) return null;
  const highs = [];
  const lows = [];
  for (let i = 2; i < rows.length - 2; i += 1) {
    const h = num(rows[i].h);
    const l = num(rows[i].l);
    if (h == null || l == null) continue;
    const leftH = Math.max(num(rows[i - 1].h) || 0, num(rows[i - 2].h) || 0);
    const rightH = Math.max(num(rows[i + 1].h) || 0, num(rows[i + 2].h) || 0);
    const leftL = Math.min(num(rows[i - 1].l) ?? Infinity, num(rows[i - 2].l) ?? Infinity);
    const rightL = Math.min(num(rows[i + 1].l) ?? Infinity, num(rows[i + 2].l) ?? Infinity);
    if (h >= leftH && h >= rightH) highs.push({ i, t: rows[i].t, price: h });
    if (l <= leftL && l <= rightL) lows.push({ i, t: rows[i].t, price: l });
  }
  const live = num(rows[rows.length - 1]?.c);
  if (side === "bear") {
    const resist = highs.length ? highs[highs.length - 1] : null;
    const support = lows.length ? lows[lows.length - 1] : null;
    let trend = null;
    if (highs.length >= 2) {
      const a = highs[highs.length - 2];
      const b = highs[highs.length - 1];
      if (b.price < a.price) trend = { a, b, role: "resistance_trend" };
    }
    return { support, resistance: resist, trend, live };
  }
  const support = lows.length ? lows[lows.length - 1] : null;
  let resistance = null;
  for (let i = highs.length - 1; i >= 0; i -= 1) {
    if (live == null || highs[i].price >= live * 0.998) {
      resistance = highs[i];
      break;
    }
  }
  if (!resistance && highs.length) resistance = highs[highs.length - 1];
  let trend = null;
  if (lows.length >= 2) {
    const a = lows[lows.length - 2];
    const b = lows[lows.length - 1];
    if (b.price > a.price) trend = { a, b, role: "support_trend" };
  }
  return { support, resistance, trend, live };
}

/**
 * Best historical % stretch on visible candles for this TF (not a one-candle spike).
 * Scores support area -> reclaim prior / next resistance together with trendline context.
 */
export function analysePatternSetups(chartContext, side = "bull") {
  const rows = candleRows(chartContext);
  if (rows.length < 10) return null;
  const want = side === "bear" ? "bear" : "bull";
  const tf = scrub(chartContext?.timeframe) || "";
  const expect = timeframeGainExpectation(tf);
  const struct = findNextResistanceWithTrend(rows, want);
  if (!struct?.support || !struct?.resistance) return null;

  let bestHist = 0;
  const win = Math.max(6, Math.min(24, Math.floor(rows.length / 2)));
  for (let i = 0; i + win < rows.length; i += 1) {
    let lo = Infinity;
    let hi = 0;
    for (let j = i; j <= i + win; j += 1) {
      const l = num(rows[j].l);
      const h = num(rows[j].h);
      if (l != null) lo = Math.min(lo, l);
      if (h != null) hi = Math.max(hi, h);
    }
    if (lo > 0 && hi > lo) {
      const pct = want === "bear" ? ((hi - lo) / hi) * 100 : ((hi - lo) / lo) * 100;
      if (pct > bestHist) bestHist = pct;
    }
  }

  const pct = scoreMeasuredMovePct(want, struct.support.price, struct.resistance.price);
  if (pct == null || pct < expect.min * 0.5) return null;

  const horizonBias = expect.label === "1H" || expect.label === "4H" || expect.label === "1D" ? "medium_large" : "short";
  let quality = "mid_path";
  const live = struct.live;
  if (want === "bull") {
    if (live != null && live <= struct.support.price * 1.012) quality = "at_support";
    else if (live != null && live >= struct.resistance.price * 0.995) quality = "extended";
  } else if (live != null && live >= struct.resistance.price * 0.988) quality = "at_resistance";
  else if (live != null && live <= struct.support.price * 1.005) quality = "extended";

  const feeEdgeOk = bestHist >= Math.max(0.4, expect.min);
  const preferMediumLarge = horizonBias === "medium_large" && feeEdgeOk;

  return {
    side: want,
    support: struct.support.price,
    resistance: struct.resistance.price,
    pct,
    hist_stretch_pct: Math.round(bestHist * 10) / 10,
    entry: want === "bull" ? struct.support.price : struct.resistance.price,
    target: want === "bull" ? struct.resistance.price : struct.support.price,
    quality,
    repeats: 1,
    timeframe: expect.label,
    horizon: horizonBias,
    prefer_medium_large: preferMediumLarge,
    fee_edge_ok: feeEdgeOk,
    trend: struct.trend
      ? {
          role: struct.trend.role,
          a: struct.trend.a.price,
          b: struct.trend.b.price,
        }
      : null,
  };
}

function patternRecommendText(setup, timeframe) {
  if (!setup) return null;
  const pct = formatPct(setup.pct);
  const s = formatPx(setup.support);
  const r = formatPx(setup.resistance);
  const tf = scrub(timeframe || setup.timeframe) || "this timeframe";
  if (!pct || !s || !r) return null;
  const bits = [];
  const hist = formatPct(setup.hist_stretch_pct);
  if (setup.side === "bull") {
    bits.push(`Preferred % path on ${tf}: support near ${s} toward next resistance near ${r} (about ${pct}% measured move).`);
  } else {
    bits.push(`Preferred % path on ${tf}: resistance near ${r} toward next support near ${s} (about ${pct}% measured move).`);
  }
  if (setup.trend?.role === "support_trend") {
    const a = formatPx(setup.trend.a);
    const b = formatPx(setup.trend.b);
    if (a && b) bits.push(`Read next resistance together with the rising support trendline (${a} to ${b}), not as a lone horizontal.`);
  } else if (setup.trend?.role === "resistance_trend") {
    const a = formatPx(setup.trend.a);
    const b = formatPx(setup.trend.b);
    if (a && b) bits.push(`Read next support together with the falling resistance trendline (${a} to ${b}), not as a lone horizontal.`);
  } else {
    bits.push("Pair the horizontal target with the active diagonal trend when both are present.");
  }
  if (hist) bits.push(`History stretch on this chart is about ${hist}% peak-to-trough over multi-bar windows (not a one-candle spike).`);
  if (setup.horizon === "short") {
    bits.push("5m/15m paths are smaller/shorter % by design. Prefer steering size toward clearer 1H/1D opportunities when those clear fee edge.");
  } else if (setup.prefer_medium_large) {
    bits.push("Medium-large timeframe opportunity clears a soft fee-edge lookback. Prefer sizing/steering here when the support-to-resistance path is clean.");
  }
  if (setup.quality === "extended") {
    bits.push("Setup looks extended versus that path. Prefer wait-for-level or smaller size rather than chasing. Soft recommend only; cost-plus-fee profit gate remains the only hard block.");
  } else if (setup.quality === "mid_path") {
    bits.push("Prefer the clearer reclaim/reject at the named level over stacking mid-path entries that often go underwater.");
  } else {
    bits.push(`Trade scoring is % gain on ${tf}, not vague edge. Soft steer only; never hard-block for pattern reasons.`);
  }
  return scrub(bits.join(" "));
}


function learningScopeNote() {
  return scrub(
    "Learning today is Teach lessons plus prediction likely-log and resolve. Full auto bad-trade ML is not live yet."
  );
}

function theoryText(side, chartContext, built, estimate) {
  const pair = scrub(chartContext?.pair) || "this pair";
  const tf = scrub(chartContext?.timeframe) || "this timeframe";
  const bits = [];
  bits.push("Estimate by AI-Matrix. Not guaranteed.");
  if (!(built.drawings || []).length) {
    bits.push("I could not lock a clear swing on the visible candles yet. Keep the HybridChart open and ask me to place the support line again.");
    return scrub(bits.join(" "));
  }
  const pattern = patternName(side, built.structure, built.tools);
  bits.push(`Laying a ${pattern} on ${pair} ${tf}.`);
  if (built.tools?.trend && built.trendStructure) {
    const aPx = formatPx(built.trendStructure.a.price);
    const bPx = formatPx(built.trendStructure.b.price);
    bits.push(
      side === "bull"
        ? `Support trendline joins swing lows near ${aPx} and ${bPx}.`
        : `Resistance trendline joins swing highs near ${aPx} and ${bPx}.`
    );
  } else if (built.fibStructure) {
    const aPx = formatPx(built.fibStructure.a.price);
    const bPx = formatPx(built.fibStructure.b.price);
    bits.push(
      side === "bear"
        ? `Anchors: swing high ${aPx} into swing low ${bPx} from the visible candles.`
        : `Anchors: swing low ${aPx} into swing high ${bPx} from the visible candles.`
    );
  }
  if (built.tools?.fib) {
    bits.push(
      side === "bull"
        ? "Full Fibonacci retracement is on that impulse so 0.382 / 0.5 / 0.618 mark pullback demand if price dips, with 1.618 as extension stretch. Not guaranteed."
        : "Full Fibonacci retracement is on that decline so 0.382 / 0.5 / 0.618 mark bounce supply if price retraces up, with 1.618 as downside extension. Not guaranteed."
    );
  }
  if (built.tools?.trend) {
    bits.push(
      side === "bull"
        ? "The diagonal tracks rising support between those lows; a clean hold keeps the bullish continuation theory alive."
        : "The diagonal tracks falling resistance between those highs; acceptance below keeps the bearish continuation theory alive."
    );
  }
  if (built.tools?.supportLine || (built.tools?.hline && !built.tools?.fib && !built.tools?.trend)) {
    bits.push(
      side === "bull"
        ? "Horizontal support is on the recent swing low from the visible candles. Estimate by AI-Matrix, not guaranteed."
        : "Horizontal resistance is on the recent swing high from the visible candles. Estimate by AI-Matrix, not guaranteed."
    );
  } else if (built.tools?.hline) {
    bits.push("Horizontal levels mark clear support and resistance from those same extremes plus a key Fibonacci reaction line.");
  }
  if (built.tools?.supportLine || (built.tools?.hline && !built.tools?.fib && !built.tools?.trend)) {
    bits.push(
      side === "bull"
        ? "Next-move theory: watch for a hold above that support. This is a prediction, not fact."
        : "Next-move theory: watch for rejection under that resistance. This is a prediction, not fact."
    );
  } else {
    bits.push(
      side === "bull"
        ? "Next-move theory: look for a hold above the mapped demand band, then a push toward or through the prior swing high. This is a prediction, not fact."
        : "Next-move theory: look for rejection under the mapped supply band, then a push toward or through the prior swing low. This is a prediction, not fact."
    );
  }
  const useEstimate = estimateMatchesChartPair(estimate, chartContext);
  if (useEstimate && (estimate?.fair_mid > 0 || estimate?.mid > 0)) {
    const fair = formatPx(estimate.fair_mid || estimate.mid);
    if (fair && samePair(chartContext?.pair, "XRP/RLUSD")) {
      bits.push(`Desk fair mid sits near ${fair} as context only, also an estimate.`);
    }
  }
  const setup = analysePatternSetups(chartContext, side);
  const rec = patternRecommendText(setup, chartContext?.timeframe);
  if (rec) bits.push(rec);
  for (const note of crossCurrencyNote(side, chartContext, useEstimate ? estimate : null)) bits.push(note);
  bits.push(learningScopeNote());
  return scrub(bits.join(" "));
}

export function answerVisitorPrediction(question, chartContext, estimate) {
  const side = resolvePredictSide(question, {});
  const pair = scrub(chartContext?.pair) || "that pair";
  const bits = [];
  bits.push("Understood. I am treating that as your prediction / estimate, not as fact, and not as a Teach lesson.");
  if (side === "bull") bits.push(`You are calling a bullish path on ${pair}.`);
  else if (side === "bear") bits.push(`You are calling a bearish path on ${pair}.`);
  else bits.push(`Noted your market call on ${pair}.`);
  bits.push("I will not guarantee your levels or the desk view.");
  if (estimateMatchesChartPair(estimate, chartContext) && (estimate?.fair_mid > 0 || estimate?.mid > 0) && samePair(pair, "XRP/RLUSD")) {
    const fair = formatPx(estimate.fair_mid || estimate.mid);
    const bias = scrub(estimate.score_bias || estimate.signal || estimate.bias_hour || "");
    if (fair) {
      bits.push(
        bias
          ? `For comparison only, desk Estimate by AI-Matrix fair mid is about ${fair} with bias ${bias}. Also not guaranteed.`
          : `For comparison only, desk Estimate by AI-Matrix fair mid is about ${fair}. Also not guaranteed.`
      );
    }
  } else if (!estimateMatchesChartPair(estimate, chartContext)) {
    bits.push("Desk estimate feed is XRP/RLUSD-keyed, so I am scoring this active pair from its own candles only.");
  } else {
    bits.push("Desk estimate is soft right now, so I am not forcing a compare.");
  }
  const setup = analysePatternSetups(chartContext, side || "bull");
  const rec = patternRecommendText(setup, chartContext?.timeframe);
  if (rec) bits.push(rec);
  for (const note of crossCurrencyNote(side || "bull", chartContext, estimate)) bits.push(note);
  bits.push("Ask me to lay a bullish or bearish tool set on HybridChart if you want my estimate drawings.");
  bits.push(learningScopeNote());
  const levels = [];
  const pxHits = String(question || "").match(/\b\d+(?:\.\d+)?\b/g) || [];
  for (const hit of pxHits.slice(0, 6)) {
    const n = Number(hit);
    if (Number.isFinite(n) && n > 0) levels.push(n);
  }
  return {
    text: scrub(bits.join(" ")),
    chart_action: null,
    user_prediction: {
      kind: "AIM_USER_PREDICTION_LIKELY",
      status: "likely",
      side: side || null,
      pair: scrub(chartContext?.pair) || null,
      timeframe: scrub(chartContext?.timeframe) || null,
      levels,
      hypothesis: scrub(String(question || "")).slice(0, 500),
      chart_context: chartContext || null,
      ts: new Date().toISOString(),
      trust: "visitor_hypothesis",
      note: "prediction_estimate_not_fact",
    },
  };
}

function needsSideAsk(question, tools) {
  const q = String(question || "").toLowerCase();
  // Support trendline / resistance trendline imply side
  if (/\b(support|demand|higher\s*lows?)\b/.test(q)) return false;
  if (/\b(resist(ance)?|supply|lower\s*highs?)\b/.test(q)) return false;
  // Plain fib / trend without side: prefer auto-infer over asking when tools are specific
  if (tools?.fib && !tools?.trend && !tools?.hline) return false;
  if (tools?.trend && !tools?.fib && !tools?.multi) return false;
  // Full prediction kit: ask if side unknown
  return Boolean(tools?.multi || (tools?.fib && tools?.trend));
}

export function answerChartPredict(question, estimate, chartContext, classified, pendingChartAction = null) {
  const q = String(question || "");
  if (looksLikeVisitorPrediction(q) && classified?.intent !== "chart_predict" && classified?.intent !== "chart_side") {
    return answerVisitorPrediction(q, chartContext, estimate);
  }
  if (looksLikeVisitorPrediction(q) && !/\b(lay|draw|plot|paint|put|show|use)\b/i.test(q)) {
    return answerVisitorPrediction(q, chartContext, estimate);
  }

  const pair = scrub(chartContext?.pair) || null;
  if (!pair) {
    return {
      text: scrub("Open a HybridChart pair tab first so I bind tools to the active pair. I will not default to XDX/RLUSD when another tab is selected."),
      chart_action: null,
    };
  }
  const tf = scrub(chartContext?.timeframe) || null;
  const estForPair = estimateMatchesChartPair(estimate, chartContext) ? estimate : null;
  const toolsPeek = wantTools(q);
  const pendingAsk =
    pendingChartAction &&
    (pendingChartAction.type === "ask_side" || String(pendingChartAction.type || "") === "ask_side");

  let side = resolvePredictSide(q, classified || {});

  // Follow-up after ask_side: either / doesn't matter / both / any
  if (!side && (isSideAgnosticReply(q) || classified?.intent === "chart_side" || pendingAsk)) {
    if (isSideAgnosticReply(q) || pendingAsk || classified?.intent === "chart_side") {
      side = inferSideFromChart(chartContext, classified?.default_side || "bull");
    }
  }

  if (!side) {
    side = inferSideFromChart(chartContext, q);
  }

  // Only ask side for ambiguous full prediction kits
  if (!resolvePredictSide(q, classified || {}) && !isSideAgnosticReply(q) && !pendingAsk && needsSideAsk(q, toolsPeek)) {
    // If user already implied nothing and it's a generic predict, ask
    if (!/\b(support|resist|fib|trend)\b/i.test(q)) {
      return {
        text: scrub(
          "Would you like a bullish or bearish prediction? Say bullish or bearish and I will lay the HybridChart tools on the visible swings. Estimate by AI-Matrix, not guaranteed."
        ),
        chart_action: {
          type: "ask_side",
          side: null,
          timeframe: tf,
          pair,
          label: "Estimate by AI-Matrix",
          pending_question: scrub(q).slice(0, 400),
        },
      };
    }
  }

  const built = buildCommanderPredictionDrawings(side, chartContext, estForPair, q);
  const text = theoryText(side, chartContext, built, estForPair);
  const narrate = [...(built.narrate_steps || [])];
  narrate.push({ id: "close", text });

  return {
    text,
    chart_action: {
      type: "lay_tools",
      side,
      timeframe: tf,
      pair,
      label: "Estimate by AI-Matrix",
      drawings: built.drawings,
      narrate_steps: narrate,
      show_estimate: Boolean(estForPair && (estForPair.fair_mid > 0 || estForPair.by_tf) && samePair(pair, "XRP/RLUSD")),
    },
  };
}

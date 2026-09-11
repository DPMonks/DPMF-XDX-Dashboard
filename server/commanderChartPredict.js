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

export function resolvePredictSide(question, classified) {
  if (classified?.side === "bull" || classified?.side === "bear") return classified.side;
  const q = String(question || "").toLowerCase();
  if (/\bbearish\b|\bbear\b|\bshort\b/.test(q)) return "bear";
  if (/\bbullish\b|\bbull\b|\blong\b/.test(q)) return "bull";
  return null;
}

/** Detect visitor sharing their own call (not asking Commander to draw). */
export function looksLikeVisitorPrediction(question) {
  const q = String(question || "").toLowerCase();
  if (!q) return false;
  if (/\b(lay|draw|plot|paint|put|show)\b/.test(q) && /\b(prediction|fib|trend|hline|estimate)\b/.test(q)) {
    return false;
  }
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

/**
 * Structure swings from visible candles: prior impulse extreme + corrective extreme.
 * Bullish: swing low (A) then swing high (B) for retracement up impulse, or low->high for fib pullback.
 * For bullish fib retracement of an up-leg: A = swing low, B = swing high (measure pullback from B toward A).
 * For bearish fib of a down-leg: A = swing high, B = swing low.
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
      if (high && low && high.t < low.t && high.price > low.price) {
        return { a: high, b: low, last: rows[n - 1], rows, source: "candles" };
      }
      // fallback: global high then later low
      const gHigh = findSwingHigh(rows, 0, n - 2);
      const gLow = findSwingLow(rows, (gHigh?.index || 0) + 1, n - 1);
      if (gHigh && gLow) return { a: gHigh, b: gLow, last: rows[n - 1], rows, source: "candles" };
    } else {
      const low = findSwingLow(rows, 0, earlyEnd);
      const high = findSwingHigh(rows, lateStart, n - 1);
      if (low && high && low.t < high.t && high.price > low.price) {
        return { a: low, b: high, last: rows[n - 1], rows, source: "candles" };
      }
      const gLow = findSwingLow(rows, 0, n - 2);
      const gHigh = findSwingHigh(rows, (gLow?.index || 0) + 1, n - 1);
      if (gLow && gHigh) return { a: gLow, b: gHigh, last: rows[n - 1], rows, source: "candles" };
    }
  }

  // Prefer published swings from snapshot
  if (swingsCtx?.high && swingsCtx?.low) {
    const hi = { t: num(swingsCtx.high.t), price: num(swingsCtx.high.price), kind: "swing_high" };
    const lo = { t: num(swingsCtx.low.t), price: num(swingsCtx.low.price), kind: "swing_low" };
    const last = swingsCtx.last
      ? { t: num(swingsCtx.last.t), price: num(swingsCtx.last.price) || num(swingsCtx.last.c) }
      : null;
    if (hi.t != null && hi.price != null && lo.t != null && lo.price != null) {
      if (side === "bear") {
        return { a: hi, b: lo.t > hi.t ? lo : { ...lo, t: hi.t + 1 }, last, rows, source: "swings" };
      }
      return { a: lo, b: hi.t > lo.t ? hi : { ...hi, t: lo.t + 1 }, last, rows, source: "swings" };
    }
  }

  // Last resort: visible price range (still labelled estimate; times synthetic from context.at)
  const price = chartContext?.price || {};
  const lo = num(price.visible_min);
  const hi = num(price.visible_max);
  const lastPx = num(price.live) || num(price.last_close);
  if (lo != null && hi != null && hi > lo) {
    const now = Date.parse(chartContext?.at) || Date.now();
    const span = 15 * 60 * 1000;
    if (side === "bear") {
      return {
        a: { t: now - span * 4, price: hi, kind: "range_high" },
        b: { t: now - span, price: lo, kind: "range_low" },
        last: { t: now, price: lastPx || (lo + hi) / 2 },
        rows,
        source: "visible_range",
      };
    }
    return {
      a: { t: now - span * 4, price: lo, kind: "range_low" },
      b: { t: now - span, price: hi, kind: "range_high" },
      last: { t: now, price: lastPx || (lo + hi) / 2 },
      rows,
      source: "visible_range",
    };
  }
  return null;
}

function wantTools(question) {
  const q = String(question || "").toLowerCase();
  const fib = /\bfib|\bretrace|\bextension|\bgolden\b/.test(q);
  const trend = /\btrend(\s*line)?\b|\bstructure\b|\bchannel\b/.test(q);
  const hline = /\bhline|\bhorizontal|\bsupport|\bresist|\bs\/r|\blevels?\b/.test(q);
  const multi = /\b(and|plus|with|also|stack|combo|all (the )?tools|full (kit|set))\b/.test(q);
  // Default: fib + structure trend + S/R when user asks to lay prediction without naming one tool
  if (!fib && !trend && !hline) {
    return { fib: true, trend: true, hline: true, multi: true };
  }
  return {
    fib: fib || (multi && !trend && !hline),
    trend: trend || multi,
    hline: hline || multi,
    multi,
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

export function buildCommanderPredictionDrawings(side, chartContext, estimate, question) {
  const structure = detectStructureSwings(chartContext, side);
  if (!structure?.a || !structure?.b) {
    return { drawings: [], structure: null, tools: wantTools(question) };
  }
  const tools = wantTools(question);
  const drawings = [];
  const a = { t: structure.a.t, price: structure.a.price };
  const b = { t: structure.b.t, price: structure.b.price };
  const color = side === "bear" ? CMD_COLOR.bear : CMD_COLOR.bull;

  if (tools.fib) {
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

  if (tools.trend) {
    drawings.push(
      tagCommander({
        kind: "trend",
        color: CMD_COLOR.trend,
        a,
        b,
        strokeWidth: 2,
        lineStyle: "solid",
      })
    );
  }

  if (tools.hline) {
    const mid = (a.price + b.price) / 2;
    const r618 = b.price + (a.price - b.price) * 0.618;
    const r382 = b.price + (a.price - b.price) * 0.382;
    const levels =
      side === "bull"
        ? [
            { price: Math.min(a.price, b.price), role: "support" },
            { price: r618, role: "fib_618" },
            { price: Math.max(a.price, b.price), role: "resistance" },
          ]
        : [
            { price: Math.max(a.price, b.price), role: "resistance" },
            { price: r382, role: "fib_382" },
            { price: Math.min(a.price, b.price), role: "support" },
          ];
    // Deduplicate near levels
    const used = [];
    for (const lvl of levels) {
      const px = num(lvl.price);
      if (px == null) continue;
      if (used.some((u) => Math.abs(u - px) / px < 0.0008)) continue;
      used.push(px);
      drawings.push(
        tagCommander({
          kind: "hline",
          color: CMD_COLOR.level,
          t: b.t,
          price: px,
          strokeWidth: 1,
          lineStyle: lvl.role.includes("fib") ? "dash" : "solid",
          role: lvl.role,
        })
      );
    }
    // silence unused mid warning in some linters
    void mid;
  }

  // Optional fib extension when user asks extension or multi and we have a clear third point (last)
  if ((/\bfibext|\bextension\b/.test(String(question || "").toLowerCase()) || tools.multi) && structure.last?.t) {
    const c = { t: structure.last.t, price: num(structure.last.price) || num(structure.last.c) || b.price };
    if (c.price != null && (/\bfibext|\bextension\b/.test(String(question || "").toLowerCase()))) {
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

  return { drawings, structure, tools, side };
}

function patternName(side, structure, tools) {
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

function theoryText(side, chartContext, built, estimate) {
  const pair = scrub(chartContext?.pair) || "this pair";
  const tf = scrub(chartContext?.timeframe) || "this timeframe";
  const bits = [];
  bits.push("Estimate by AI-Matrix. Not guaranteed.");
  if (!built?.structure) {
    bits.push("I need a clearer visible swing on the HybridChart before I can lay tools accurately. Soft-refresh the chart and ask again.");
    return scrub(bits.join(" "));
  }
  const { a, b, source } = built.structure;
  const aPx = formatPx(a.price);
  const bPx = formatPx(b.price);
  const pattern = patternName(side, built.structure, built.tools);
  bits.push(
    `Laying a ${pattern} on ${pair} ${tf}.`
  );
  if (source === "candles" || source === "swings") {
    bits.push(
      side === "bear"
        ? `Anchors: swing high ${aPx} into swing low ${bPx} from the visible candles.`
        : `Anchors: swing low ${aPx} into swing high ${bPx} from the visible candles.`
    );
  } else {
    bits.push(`Anchors from the visible price window ${aPx} to ${bPx} (soft estimate until candle swings load).`);
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
        ? "The trendline tracks rising structure between those swings; a clean hold keeps the bullish continuation theory alive."
        : "The trendline tracks falling structure between those swings; acceptance below keeps the bearish continuation theory alive."
    );
  }
  if (built.tools?.hline) {
    bits.push("Horizontal levels mark clear support and resistance from those same extremes plus a key Fibonacci reaction line.");
  }
  bits.push(
    side === "bull"
      ? "Next-move theory: look for a hold above the mapped demand band, then a push toward or through the prior swing high. This is a prediction, not fact."
      : "Next-move theory: look for rejection under the mapped supply band, then a push toward or through the prior swing low. This is a prediction, not fact."
  );
  if (estimate?.fair_mid > 0 || estimate?.mid > 0) {
    const fair = formatPx(estimate.fair_mid || estimate.mid);
    if (fair) bits.push(`Desk fair mid sits near ${fair} as context only, also an estimate.`);
  }
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
  if (estimate?.fair_mid > 0 || estimate?.mid > 0) {
    const fair = formatPx(estimate.fair_mid || estimate.mid);
    const bias = scrub(estimate.score_bias || estimate.signal || estimate.bias_hour || "");
    if (fair) {
      bits.push(
        bias
          ? `For comparison only, desk Estimate by AI-Matrix fair mid is about ${fair} with bias ${bias}. Also not guaranteed.`
          : `For comparison only, desk Estimate by AI-Matrix fair mid is about ${fair}. Also not guaranteed.`
      );
    }
  } else {
    bits.push("Desk estimate is soft right now, so I am not forcing a compare.");
  }
  bits.push("Ask me to lay a bullish or bearish tool set on HybridChart if you want my estimate drawings.");
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

export function answerChartPredict(question, estimate, chartContext, classified) {
  const q = String(question || "");
  if (looksLikeVisitorPrediction(q) && classified?.intent !== "chart_predict" && classified?.intent !== "chart_side") {
    return answerVisitorPrediction(q, chartContext, estimate);
  }
  // Visitor sharing a call while also wording like predict without draw verbs
  if (looksLikeVisitorPrediction(q) && !/\b(lay|draw|plot|paint|put|show|use)\b/i.test(q)) {
    return answerVisitorPrediction(q, chartContext, estimate);
  }

  const side = resolvePredictSide(q, classified);
  const pair = scrub(chartContext?.pair) || "XRP/RLUSD";
  const tf = scrub(chartContext?.timeframe) || null;

  if (!side) {
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
      },
    };
  }

  const built = buildCommanderPredictionDrawings(side, chartContext, estimate, q);
  const text = theoryText(side, chartContext, built, estimate);
  return {
    text,
    chart_action: {
      type: "lay_tools",
      side,
      timeframe: tf,
      pair,
      label: "Estimate by AI-Matrix",
      drawings: built.drawings,
      // Keep estimate overlay optional companion when desk pack exists
      show_estimate: Boolean(estimate && (estimate.fair_mid > 0 || estimate.by_tf)),
    },
  };
}

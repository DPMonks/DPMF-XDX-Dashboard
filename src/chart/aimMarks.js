/**
 * AIM desk / estimate overlays shared by HybridChart (ASCII-safe labels).
 */
export const AIM_DESK_AGENT_COLORS = {
  agent1: "#38bdf8",
  agent2: "#a78bfa",
  agent3: "#34d399",
  agent4: "#fb923c",
  agent5: "#f472b6",
  agent6: "#94a3b8",
  commander: "#fbbf24",
};

const QPB_MIN = 0.05;
const QPB_MAX = 50;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function inQuotePerBaseBand(v) {
  const n = num(v);
  return n > 0 && n >= QPB_MIN && n <= QPB_MAX;
}

export function coerceQuotePerBase(raw, row = {}, refPx = null) {
  const v = num(raw);
  if (!(v > 0)) return null;
  const unit = String(row.price_unit || "").toLowerCase();
  const candidates = [];
  if (unit === "quote_per_base" || unit === "iou_per_xrp" || unit === "rlusd_per_xrp") {
    candidates.push(v);
  } else if (unit === "xrp_per_iou" || row.xrp_per_iou != null) {
    candidates.push(1 / v);
  } else {
    candidates.push(v, 1 / v);
  }
  const ref = num(refPx);
  const ok = (c) => {
    if (!inQuotePerBaseBand(c)) return false;
    if (ref > 0) {
      if (c < ref / 20 || c > ref * 20) return false;
    }
    return true;
  };
  for (const c of candidates) {
    if (ok(c)) return c;
  }
  return null;
}

export function quotePerBaseFromDeskOrder(row = {}, refPx = null) {
  const iou = num(row.iou_per_xrp);
  if (inQuotePerBaseBand(iou)) {
    const ref = num(refPx);
    if (!(ref > 0) || (iou >= ref / 20 && iou <= ref * 20)) return iou;
  }
  const unit = String(row.price_unit || "").toLowerCase();
  const raw = num(row.limit_price ?? row.price ?? row.xrp_per_iou ?? row.mark);
  return coerceQuotePerBase(raw, { ...row, price_unit: unit }, refPx);
}

export function normalizeDeskSide(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return "buy";
  if (s.includes("sell") || s.includes("ask") || s === "to_xrp" || s.includes("sell_")) return "sell";
  if (s.includes("buy") || s.includes("bid") || s === "from_xrp") return "buy";
  return "buy";
}

function samePair(a, b) {
  const left = String(a || "").replace(/\s+/g, "").toUpperCase();
  const right = String(b || "").replace(/\s+/g, "").toUpperCase();
  if (!left || !right) return true;
  if (left === right) return true;
  const [rb, rq] = right.split("/");
  return left === `${rq}/${rb}`;
}

export function asciiClean(v) {
  return String(v || "")
    .replace(/[\u2010-\u2015\u2212\u00B7\u2022\u2026\uFFFD]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Desk OfferCreate / proposal marks for the active chart pair.
 */
export function buildDeskMarks(deskOrders = [], pair = "XRP/RLUSD", refPx = null) {
  return (Array.isArray(deskOrders) ? deskOrders : [])
    .map((row, idx) => {
      const price = quotePerBaseFromDeskOrder(row, refPx);
      if (!(price > 0)) return null;
      const rowPair = String(row.pair || pair).replace(/\s+/g, "").toUpperCase();
      if (rowPair && !samePair(rowPair, pair)) return null;
      const agentId = row.agent_id || row.agent || row.id || "agent";
      return {
        kind: "desk",
        key: row.key || `${agentId}-${price}-${idx}`,
        agent_id: agentId,
        label: asciiClean(row.label || agentId || "Desk"),
        side: normalizeDeskSide(row.side || row.limit_side || row.trade_direction),
        price,
        status: row.status || (row.submitted ? "submitted" : row.open ? "open" : "proposal"),
        color: AIM_DESK_AGENT_COLORS[agentId] || "#7dd3fc",
      };
    })
    .filter(Boolean);
}

/**
 * Commander estimate level markers (no bull/bear scenario UI).
 */
export function buildEstimateMarks(estimate = null, timeframe = "1D", tapeRef = null) {
  if (!estimate || typeof estimate !== "object") return [];
  const byTf = estimate.by_tf || estimate.overlays?.by_tf || {};
  const tfPack = byTf[timeframe] || byTf["1h"] || byTf["1D"] || null;
  const overlays = estimate.overlays && typeof estimate.overlays === "object" ? estimate.overlays : null;
  const levels = tfPack?.levels || overlays?.levels || {};
  const unitRow = {
    price_unit: estimate.price_unit || "quote_per_base",
    iou_per_xrp: estimate.iou_per_xrp,
    xrp_per_iou: estimate.xrp_per_iou,
  };
  const out = [];
  const push = (role, raw, label) => {
    const price = coerceQuotePerBase(raw, unitRow, tapeRef);
    if (!(price > 0)) return;
    out.push({ kind: "estimate", role, price, label: asciiClean(label) });
  };
  push("fair", estimate.fair_mid ?? estimate.mid ?? estimate.fair ?? estimate.iou_per_xrp, "Fair");
  push("entry", estimate.entry ?? levels.entry, "Entry");
  push("sl", estimate.sl ?? estimate.stop ?? estimate.stop_loss ?? levels.sl, "SL");
  push("tp", estimate.tp ?? estimate.take_profit ?? levels.tp, "TP");
  push("support", estimate.support ?? levels.support, "Support");
  push("resistance", estimate.resistance ?? levels.resistance, "Resist");
  const lo = coerceQuotePerBase(estimate.band_lo ?? estimate.fair_lo ?? levels.band_lo, unitRow, tapeRef);
  const hi = coerceQuotePerBase(estimate.band_hi ?? estimate.fair_hi ?? levels.band_hi, unitRow, tapeRef);
  if (lo > 0) out.push({ kind: "estimate", role: "band_lo", price: lo, label: "Band" });
  if (hi > 0) out.push({ kind: "estimate", role: "band_hi", price: hi, label: "Band" });
  return out;
}

/**
 * Bull/bear projection path + demand/supply boxes from commander_estimate by_tf pack.
 * side: "bull" | "bear"
 */
export function buildEstimateScenarioOverlay(estimate = null, timeframe = "1D", side = "bull", tapeRef = null) {
  if (!estimate || typeof estimate !== "object") return null;
  const want = String(side || "bull").toLowerCase().startsWith("bear") ? "bear" : "bull";
  const byTf = estimate.by_tf || estimate.overlays?.by_tf || {};
  const tfPack = byTf[timeframe] || byTf["1h"] || byTf["1D"] || byTf["15m"] || byTf["5m"] || null;
  const scenario = want === "bull"
    ? (tfPack?.bullish || estimate.bullish || null)
    : (tfPack?.bearish || estimate.bearish || null);
  const proj =
    (want === "bull"
      ? tfPack?.projection_bull || scenario?.projection || estimate.projection_bull
      : tfPack?.projection_bear || scenario?.projection || estimate.projection_bear) || null;
  const demand = (want === "bull"
    ? (scenario?.demand || tfPack?.demand || estimate.demand || [])
    : (scenario?.demand || [])) || [];
  const supply = (want === "bear"
    ? (scenario?.supply || tfPack?.supply || estimate.supply || [])
    : (scenario?.supply || [])) || [];
  const unitRow = {
    price_unit: estimate.price_unit || "quote_per_base",
    iou_per_xrp: estimate.iou_per_xrp,
    xrp_per_iou: estimate.xrp_per_iou,
  };
  const zones = [];
  for (const z of (Array.isArray(demand) ? demand : []).slice(0, 3)) {
    const lo = coerceQuotePerBase(z?.lo, unitRow, tapeRef);
    const hi = coerceQuotePerBase(z?.hi, unitRow, tapeRef);
    if (!(lo > 0) || !(hi > 0)) continue;
    zones.push({ kind: "demand", lo: Math.min(lo, hi), hi: Math.max(lo, hi), strength: Number(z?.strength) || 1 });
  }
  for (const z of (Array.isArray(supply) ? supply : []).slice(0, 3)) {
    const lo = coerceQuotePerBase(z?.lo, unitRow, tapeRef);
    const hi = coerceQuotePerBase(z?.hi, unitRow, tapeRef);
    if (!(lo > 0) || !(hi > 0)) continue;
    zones.push({ kind: "supply", lo: Math.min(lo, hi), hi: Math.max(lo, hi), strength: Number(z?.strength) || 1 });
  }
  const path = [];
  for (const pt of (proj?.path || [])) {
    const mid = coerceQuotePerBase(pt?.mid, unitRow, tapeRef);
    const lo = coerceQuotePerBase(pt?.lo, unitRow, tapeRef);
    const hi = coerceQuotePerBase(pt?.hi, unitRow, tapeRef);
    if (!(mid > 0)) continue;
    path.push({
      i: Number(pt?.i) || path.length + 1,
      mid,
      lo: lo > 0 ? lo : null,
      hi: hi > 0 ? hi : null,
    });
  }
  if (!path.length && !zones.length) return null;
  return {
    side: want,
    label: asciiClean(proj?.label || "Estimate by AI-Matrix"),
    disclaimer: "not guaranteed",
    path,
    zones,
    bars: Number(proj?.bars) || path.length || 0,
  };
}

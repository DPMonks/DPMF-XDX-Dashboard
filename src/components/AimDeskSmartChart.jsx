import { useEffect, useMemo, useState } from "react";
import { getLiquidPairAmm, getLiquidPairBook, getPrices } from "../api/indexer";
import { composePairCandles, lockedSnapshot } from "../chart/composeChart";
import { bookBands } from "../chart/overlays";
import { visibleBarsForInterval } from "../chart/intervals";
import { quotePerXdx } from "../chart/pairQuote";
import { aimAgentShortName } from "../aimAgentNames";

const PAIR = "XRP/RLUSD";
const TF_OPTIONS = [
  { id: "1D", label: "1D" },
  { id: "1h", label: "1H" },
  { id: "15m", label: "15m" },
  { id: "5m", label: "5m" },
];
const LAYER_OPTIONS = [
  { id: "trend", label: "Trend" },
  { id: "levels", label: "Levels" },
  { id: "projection", label: "Projection" },
];
const SCENARIO_OPTIONS = [
  { id: "bull", label: "Bullish" },
  { id: "bear", label: "Bearish" },
];
const DEFAULT_TF = "1D";
const ESTIMATE_LABEL = "Estimate by AI-Matrix";
const ESTIMATE_DISC = "Estimate by AI-Matrix - not guaranteed.";
const AIM_HISTORY_BARS = {
  "5m": 288,
  "15m": 384,
  "1h": 2160,
  "1D": 780,
};

export const AIM_DESK_AGENT_COLORS = {
  agent1: "#38bdf8",
  agent2: "#a78bfa",
  agent3: "#34d399",
  agent4: "#fb923c",
  agent5: "#f472b6",
  agent6: "#94a3b8",
  commander: "#fbbf24",
};

const PAD = { l: 54, r: 12, t: 14, b: 26 };
const W = 720;
const H = 360;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const QPB_MIN = 0.05;
const QPB_MAX = 50;

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

function formatPx(v) {
  const n = num(v);
  if (!(n > 0)) return "-";
  if (n >= 10) return n.toFixed(3);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(5);
}

function historyBarsForTf(tf) {
  return AIM_HISTORY_BARS[tf] || Math.max(120, visibleBarsForInterval(tf));
}

function selectAimCandles(rows, tf) {
  const need = historyBarsForTf(tf);
  const list = (Array.isArray(rows) ? rows : []).filter((c) => {
    const o = num(c?.o);
    const h = num(c?.h);
    const l = num(c?.l);
    const close = num(c?.c);
    return o > 0 && h > 0 && l > 0 && close > 0;
  });
  return list.slice(-need);
}

function formatHistoryStart(ts) {
  const n = Number(ts);
  if (!(n > 0)) return "";
  try {
    return new Date(n).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function asciiClean(v) {
  return String(v || "")
    .replace(/[\u2010-\u2015\u2212\u00B7\u2022\u2026\uFFFD]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}


function formatScenarioSpeak(tf, side, tfPack, estimate) {
  const bits = [];
  const tfLabel = { "5m": "5 minute", "15m": "15 minute", "1h": "1 hour", "1D": "daily" }[tf] || tf;
  const why = tfPack?.why || estimate?.why || {};
  const packRationale = asciiClean(tfPack?.rationale || "");
  if (side === "bull") {
    bits.push(`Bullish estimate on the ${tfLabel} chart.`);
    const lead = asciiClean(why.rationale || packRationale || "");
    if (lead) bits.push(lead);
    const bullets = (Array.isArray(why.why_bull) && why.why_bull.length
      ? why.why_bull
      : Array.isArray(tfPack?.why_bullets)
        ? tfPack.why_bullets
        : Array.isArray(estimate?.why_bull)
          ? estimate.why_bull
          : []
    )
      .map(asciiClean)
      .filter(Boolean)
      .slice(0, 3);
    bits.push(...bullets);
    const z = (tfPack?.demand || estimate?.demand || [])[0];
    if (z) {
      const lo = formatPx(z.lo);
      const hi = formatPx(z.hi);
      if (lo !== "-" && hi !== "-") {
        const line = `Demand box at ${lo} to ${hi}.`;
        if (!bits.some((b) => b.includes(String(lo)) && b.includes(String(hi)))) bits.push(line);
      }
    }
  } else {
    bits.push(`Bearish estimate on the ${tfLabel} chart.`);
    const lead = asciiClean(why.rationale || packRationale || "");
    if (lead) bits.push(lead);
    const bullets = (Array.isArray(why.why_bear) && why.why_bear.length
      ? why.why_bear
      : Array.isArray(estimate?.why_bear)
        ? estimate.why_bear
        : []
    )
      .map(asciiClean)
      .filter(Boolean)
      .slice(0, 3);
    bits.push(...bullets);
    const z = (tfPack?.supply || estimate?.supply || [])[0];
    if (z) {
      const lo = formatPx(z.lo);
      const hi = formatPx(z.hi);
      if (lo !== "-" && hi !== "-") {
        const line = `Supply box at ${lo} to ${hi}.`;
        if (!bits.some((b) => b.includes(String(lo)) && b.includes(String(hi)))) bits.push(line);
      }
    }
  }
  bits.push(ESTIMATE_DISC);
  const out = [];
  const seen = new Set();
  for (const b of bits) {
    const k = String(b || "").toLowerCase();
    if (!b || seen.has(k)) continue;
    seen.add(k);
    out.push(b);
  }
  return out.join(" ").replace(/[\u2010-\u2015\u2212]/g, "-").slice(0, 700);
}


function priceDomain(candles, marks = [], extra = []) {
  const candleVals = [];
  for (const c of candles) {
    for (const k of ["l", "h", "c", "o"]) {
      const n = num(c[k]);
      if (n > 0) candleVals.push(n);
    }
  }
  const bookDesk = [];
  const estimates = [];
  for (const m of marks) {
    const n = num(m.price);
    if (!(n > 0)) continue;
    if (m.kind === "estimate" || m.kind === "trend" || m.kind === "level" || m.kind === "proj") {
      estimates.push(n);
    } else bookDesk.push(n);
  }
  for (const n of extra) {
    if (num(n) > 0) estimates.push(Number(n));
  }
  let base = [...candleVals, ...bookDesk];
  if (!base.length) {
    const sane = estimates.filter((n) => inQuotePerBaseBand(n));
    base = sane.length ? sane : [1];
  }
  let min = Math.min(...base);
  let max = Math.max(...base);
  const span = Math.max(max - min, Math.max(min, 1) * 0.002);
  const lo = min - span * 0.5;
  const hi = max + span * 0.5;
  for (const n of estimates) {
    if (n >= lo && n <= hi && inQuotePerBaseBand(n)) {
      if (n < min) min = n;
      if (n > max) max = n;
    }
  }
  if (min === max) {
    const pad = Math.max(min * 0.002, 1e-6);
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;
  }
  return { min, max };
}

function coercePath(raw, unitRow, tapeRef) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.path)) return null;
  const path = raw.path
    .map((pt, idx) => {
      const mid = coerceQuotePerBase(pt?.mid, unitRow, tapeRef);
      const lo = coerceQuotePerBase(pt?.lo, unitRow, tapeRef);
      const hi = coerceQuotePerBase(pt?.hi, unitRow, tapeRef);
      if (!(mid > 0)) return null;
      return {
        i: num(pt?.i) || idx + 1,
        mid,
        lo: lo > 0 ? lo : mid,
        hi: hi > 0 ? hi : mid,
      };
    })
    .filter(Boolean);
  if (!path.length) return null;
  return {
    ...raw,
    path,
    label: asciiClean(raw.label || ESTIMATE_LABEL),
  };
}

/**
 * Compact XRP/RLUSD desk chart for AI-Matrix only.
 * Per-TF overlays: Trend, Levels, Projection (bullish/bearish), demand/supply boxes.
 */
export default function AimDeskSmartChart({ deskOrders = [], estimate = null, onScenarioExplain = null }) {
  const [tf, setTf] = useState(DEFAULT_TF);
  const [layers, setLayers] = useState({ trend: true, levels: true, projection: true });
  // Exclusive scenario for the ACTIVE timeframe only: null | 'bull' | 'bear'
  const [scenario, setScenario] = useState(null);
  const [preferredApplied, setPreferredApplied] = useState("");
  const [book, setBook] = useState(null);
  const [prices, setPrices] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [liquidBook, liquidAmm, nextPrices] = await Promise.all([
          getLiquidPairBook(PAIR).catch(() => null),
          getLiquidPairAmm(PAIR).catch(() => null),
          getPrices().catch(() => ({})),
        ]);
        if (cancelled) return;
        let nextBook = liquidBook;
        if (liquidAmm && nextBook) {
          const ammPrice = Number(liquidAmm.price);
          nextBook = {
            ...nextBook,
            amm: {
              price: ammPrice > 0 ? ammPrice : null,
              reserve_asset: Number(liquidAmm.amountA) || null,
              reserve_currency: Number(liquidAmm.amountB) || null,
              account: liquidAmm.amm_account || liquidAmm.account || null,
            },
            mid:
              Number(nextBook.mid) > 0
                ? nextBook.mid
                : ammPrice > 0
                  ? ammPrice
                  : nextBook.mid,
          };
        } else if (!nextBook && liquidAmm && Number(liquidAmm.price) > 0) {
          nextBook = {
            pair: PAIR,
            mid: Number(liquidAmm.price),
            best_bid: null,
            best_ask: null,
            bids: [],
            asks: [],
            amm: { price: Number(liquidAmm.price) },
          };
        }
        setBook(nextBook);
        setPrices(nextPrices || {});
        setNow(Date.now());
        setError("");
      } catch (err) {
        if (!cancelled) setError(err?.message || "Chart feed unavailable");
      }
    }
    const start = setTimeout(load, 0);
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearInterval(id);
    };
  }, []);

  const bands = useMemo(() => bookBands(book || {}), [book]);

  const livePrice = useMemo(() => {
    const ammPrice = Number(book?.amm?.price);
    return quotePerXdx({
      pair: PAIR,
      xrpUsd: prices.xrpUsd || prices.xrp_usd,
      xrpRlusd: bands.mid || (ammPrice > 0 ? ammPrice : null),
    });
  }, [book, prices, bands.mid]);

  const candles = useMemo(() => {
    const want = historyBarsForTf(tf);
    const rows = composePairCandles({
      pair: PAIR,
      interval: tf,
      range: "Max",
      locked: lockedSnapshot(),
      sparkline: [],
      trades: [],
      prices: { xrpUsd: prices.xrpUsd || prices.xrp_usd },
      livePrice: livePrice > 0 ? livePrice : bands.mid,
      now,
      windowed: false,
      lookbackBars: want + 80,
    });
    return selectAimCandles(rows, tf);
  }, [tf, prices, livePrice, bands.mid, now]);

  const publicBookMarks = useMemo(() => {
    const out = [];
    const take = (rows, side, limit = 6) => {
      for (const row of (rows || []).slice(0, limit)) {
        const price = num(row.price);
        if (!(price > 0)) continue;
        out.push({
          kind: "book",
          side,
          price,
          size: num(row.base_size) || num(row.quote_size) || null,
          label: side === "bid" ? "Bid" : "Ask",
        });
      }
    };
    take(book?.bids, "bid");
    take(book?.asks, "ask");
    if (bands.bid > 0) out.push({ kind: "book", side: "bid", price: bands.bid, label: "Best bid", best: true });
    if (bands.ask > 0) out.push({ kind: "book", side: "ask", price: bands.ask, label: "Best ask", best: true });
    return out;
  }, [book, bands.bid, bands.ask]);

  const deskMarks = useMemo(() => {
    return (Array.isArray(deskOrders) ? deskOrders : [])
      .map((row, idx) => {
        const price = quotePerBaseFromDeskOrder(row);
        if (!(price > 0)) return null;
        const pair = String(row.pair || PAIR).replace(/\s+/g, "").toUpperCase();
        if (pair && pair !== PAIR && pair !== "RLUSD/XRP") return null;
        const agentId = row.agent_id || row.agent || row.id || "agent";
        return {
          kind: "desk",
          key: row.key || `${agentId}-${price}-${idx}`,
          agent_id: agentId,
          label: row.label || aimAgentShortName(agentId) || "Desk",
          side: normalizeDeskSide(row.side || row.limit_side || row.trade_direction),
          price,
          status: row.status || (row.submitted ? "submitted" : row.open ? "open" : "proposal"),
          color: AIM_DESK_AGENT_COLORS[agentId] || "#7dd3fc",
        };
      })
      .filter(Boolean);
  }, [deskOrders]);

  const tapeRef = useMemo(() => {
    const last = candles[candles.length - 1];
    return num(last?.c) || bands.mid || livePrice || null;
  }, [candles, bands.mid, livePrice]);

  const tfPack = useMemo(() => {
    const byTf = estimate?.by_tf || estimate?.overlays?.by_tf || {};
    return byTf[tf] || byTf["1h"] || byTf["1D"] || null;
  }, [estimate, tf]);

  // Soft-default to Score-advantaged scenario when a new plan arrives; user can still flip.
  useEffect(() => {
    const planId = estimate?.plan_id || estimate?.plan?.plan_id || "";
    const pref = String(
      tfPack?.preferred_scenario ||
        estimate?.preferred_scenario ||
        estimate?.plan?.preferred_scenario ||
        estimate?.active_scenario ||
        ""
    ).toLowerCase();
    const key = `${planId}|${tf}|${pref}`;
    if (!pref || key === preferredApplied) return;
    if (pref === "bullish" || pref === "long" || pref === "bull") {
      setScenario("bull");
      setPreferredApplied(key);
    } else if (pref === "bearish" || pref === "short" || pref === "bear") {
      setScenario("bear");
      setPreferredApplied(key);
    } else {
      setPreferredApplied(key);
    }
  }, [estimate?.plan_id, estimate?.preferred_scenario, estimate?.plan?.preferred_scenario, estimate?.active_scenario, tf, tfPack?.preferred_scenario, preferredApplied]);

  const overlays = estimate?.overlays && typeof estimate.overlays === "object" ? estimate.overlays : null;
  const unitRow = {
    price_unit: estimate?.price_unit || "quote_per_base",
    iou_per_xrp: estimate?.iou_per_xrp,
    xrp_per_iou: estimate?.xrp_per_iou,
  };

  const demandZones = useMemo(() => {
    const rows = tfPack?.demand || estimate?.demand || overlays?.demand || [];
    return (Array.isArray(rows) ? rows : [])
      .map((z) => {
        const lo = coerceQuotePerBase(z?.lo, unitRow, tapeRef);
        const hi = coerceQuotePerBase(z?.hi, unitRow, tapeRef);
        if (!(lo > 0) || !(hi > 0) || hi <= lo) return null;
        return { lo, hi, strength: num(z?.strength) || 1 };
      })
      .filter(Boolean)
      .slice(0, 4);
  }, [tfPack, estimate, overlays, tapeRef]);

  const supplyZones = useMemo(() => {
    const rows = tfPack?.supply || estimate?.supply || overlays?.supply || [];
    return (Array.isArray(rows) ? rows : [])
      .map((z) => {
        const lo = coerceQuotePerBase(z?.lo, unitRow, tapeRef);
        const hi = coerceQuotePerBase(z?.hi, unitRow, tapeRef);
        if (!(lo > 0) || !(hi > 0) || hi <= lo) return null;
        return { lo, hi, strength: num(z?.strength) || 1 };
      })
      .filter(Boolean)
      .slice(0, 4);
  }, [tfPack, estimate, overlays, tapeRef]);

  const estimateMarks = useMemo(() => {
    if (!estimate || typeof estimate !== "object") return [];
    const out = [];
    const levels = tfPack?.levels || overlays?.levels || {};
    const trend = tfPack?.trend || overlays?.trend || {};
    const push = (role, raw, label, kind = "estimate") => {
      const price = coerceQuotePerBase(raw, unitRow, tapeRef);
      if (!(price > 0)) return;
      out.push({ kind, role, price, label });
    };
    push("fair", estimate.fair_mid ?? estimate.mid ?? estimate.fair ?? estimate.iou_per_xrp, "Fair mid");
    if (layers.levels) {
      push("entry", estimate.entry ?? levels.entry, "Entry");
      push("sl", estimate.sl ?? estimate.stop ?? estimate.stop_loss ?? levels.sl, "SL");
      push("tp", estimate.tp ?? estimate.take_profit ?? levels.tp, "TP");
      const lo = coerceQuotePerBase(estimate.band_lo ?? estimate.fair_lo ?? levels.band_lo, unitRow, tapeRef);
      const hi = coerceQuotePerBase(estimate.band_hi ?? estimate.fair_hi ?? levels.band_hi, unitRow, tapeRef);
      if (lo > 0 && hi > 0) {
        out.push({ kind: "estimate", role: "band_lo", price: lo, label: "Band" });
        out.push({ kind: "estimate", role: "band_hi", price: hi, label: "Band" });
      }
      push("support", estimate.support ?? levels.support, "Support", "level");
      push("resistance", estimate.resistance ?? levels.resistance, "Resist", "level");
      push("target_hour", estimate.target_hour ?? levels.target_hour, "Hour tgt", "level");
      push("target_day", estimate.target_day ?? levels.target_day, "Day tgt", "level");
    }
    if (layers.trend) {
      push("sma_short", estimate.sma_short ?? trend.sma_short, "SMA-S", "trend");
      push("sma_long", estimate.sma_long ?? trend.sma_long, "SMA-L", "trend");
      push("ema_short", estimate.ema_short ?? trend.ema_short, "EMA-S", "trend");
      push("ema_long", estimate.ema_long ?? trend.ema_long, "EMA-L", "trend");
    }
    return out;
  }, [estimate, tapeRef, layers.levels, layers.trend, overlays, tfPack]);

  const projBull = useMemo(() => {
    if (!layers.projection || scenario !== "bull") return null;
    return coercePath(
      tfPack?.projection_bull || estimate?.projection_bull || estimate?.projection || overlays?.projection,
      unitRow,
      tapeRef
    );
  }, [layers.projection, scenario, tfPack, estimate, overlays, tapeRef]);

  const projBear = useMemo(() => {
    if (!layers.projection || scenario !== "bear") return null;
    return coercePath(tfPack?.projection_bear || estimate?.projection_bear, unitRow, tapeRef);
  }, [layers.projection, scenario, tfPack, estimate, tapeRef]);

  const projExtras = useMemo(() => {
    const vals = [];
    for (const p of [projBull, projBear]) {
      for (const pt of p?.path || []) vals.push(pt.mid, pt.lo, pt.hi);
    }
    const zones = scenario === "bull" ? demandZones : scenario === "bear" ? supplyZones : [];
    for (const z of zones) vals.push(z.lo, z.hi);
    return vals;
  }, [projBull, projBear, demandZones, supplyZones, scenario]);

  const domain = useMemo(
    () =>
      priceDomain(
        candles,
        [...deskMarks, ...estimateMarks, ...publicBookMarks.filter((m) => m.best)],
        projExtras
      ),
    [candles, deskMarks, estimateMarks, publicBookMarks, projExtras]
  );

  const projBars = Math.max(projBull?.path?.length || 0, projBear?.path?.length || 0);
  const totalSlots = Math.max(1, candles.length + (layers.projection ? projBars : 0));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const y = (p) => PAD.t + (1 - (p - domain.min) / Math.max(domain.max - domain.min, 1e-12)) * innerH;
  const slot = innerW / totalSlots;
  const bodyW = Math.max(1.6, Math.min(14, slot * 0.72));
  const xAt = (i) => PAD.l + i * slot + slot / 2;

  const biasNote = useMemo(() => {
    const hour = asciiClean(estimate?.bias_hour || estimate?.hour_bias || estimate?.trade_horizon);
    const day = asciiClean(estimate?.bias_day || estimate?.day_bias);
    const score = asciiClean(estimate?.score_bias || overlays?.score?.bias || estimate?.signal);
    const bits = [];
    if (hour) bits.push(`Hour ${hour}`);
    if (day) bits.push(`Day ${day}`);
    if (score) bits.push(`Score ${score}`);
    if (!bits.length && estimate?.chart_reason) {
      bits.push(asciiClean(String(estimate.chart_reason).replace(/_/g, " ")));
    }
    return bits.join(" | ");
  }, [estimate, overlays]);

  const historyStart = formatHistoryStart(candles[0]?.t);
  const historyNote = historyStart
    ? `History from ${historyStart} (${candles.length} bars; all available)`
    : candles.length
      ? `${candles.length} bars`
      : "";

  const last = candles[candles.length - 1];
  const lastPx = num(last?.c) || bands.mid || livePrice;
  const disclaimer = asciiClean(
    estimate?.disclaimer || overlays?.disclaimer || tfPack?.disclaimer || ESTIMATE_DISC
  );
  const rationaleNote = asciiClean(
    (scenario === "bull"
      ? (tfPack?.why?.why_bull || [])[0] || tfPack?.rationale
      : scenario === "bear"
        ? (tfPack?.why?.why_bear || [])[0] || tfPack?.rationale
        : tfPack?.rationale) || estimate?.rationale || ""
  );

  const toggleLayer = (id) => setLayers((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectScenario = (id) => {
    const next = scenario === id ? null : id;
    setScenario(next);
    if (!next || typeof onScenarioExplain !== "function") return;
    const line = formatScenarioSpeak(tf, next, tfPack, estimate);
    if (line) onScenarioExplain({ text: line, tf, scenario: next });
  };

  const changeTf = (nextTf) => {
    setTf(nextTf);
    // Overlays reload from by_tf[nextTf]. Keep scenario selection; speak only on Bullish/Bearish tap.
  };

  function buildChannel(projection, cls) {
    if (!projection?.path?.length || !candles.length) return null;
    const startIdx = candles.length - 1;
    const anchor = num(last?.c) || projection.path[0].mid;
    const upper = [`${xAt(startIdx)},${y(anchor)}`];
    const lower = [`${xAt(startIdx)},${y(anchor)}`];
    projection.path.forEach((pt, i) => {
      const xi = xAt(candles.length + i);
      upper.push(`${xi},${y(pt.hi)}`);
      lower.push(`${xi},${y(pt.lo)}`);
    });
    const mid = [`${xAt(startIdx)},${y(anchor)}`];
    projection.path.forEach((pt, i) => mid.push(`${xAt(candles.length + i)},${y(pt.mid)}`));
    return (
      <g key={cls} className={cls}>
        <polygon className="aim-desk-chart-proj-band" points={`${upper.join(" ")} ${lower.reverse().join(" ")}`} />
        <polyline className="aim-desk-chart-proj-mid" points={mid.join(" ")} fill="none" />
      </g>
    );
  }

  // Zone boxes: span recent 28% of candle width (demand/supply areas)
  const zoneX0 = PAD.l + Math.max(0, candles.length - Math.max(8, Math.floor(candles.length * 0.28))) * slot;
  const zoneX1 = PAD.l + candles.length * slot;

  return (
    <section className="aim-desk-chart neon-inset" aria-label="XRP RLUSD desk chart">
      <div className="aim-desk-chart-head">
        <div>
          <p className="aim-desk-chart-kicker">Desk map | XRP/RLUSD</p>
          <h3>Smart chart</h3>
          <p className="aim-desk-chart-sub">
            Public book + desk OfferCreates. Pick Bullish or Bearish for this TF ({ESTIMATE_LABEL}).
            {historyNote ? ` | ${historyNote}` : ""}
            {biasNote ? ` | ${biasNote}` : ""}
            {(() => {
              const sec =
                tfPack?.refresh_sec ||
                estimate?.plan?.cadence_sec?.[tf] ||
                ({ "5m": 300, "15m": 900, "1h": 3600, "1D": 86400 }[tf] || 300);
              const label =
                tf === "1D" ? "daily" : tf === "1h" ? "hourly" : `every ${Math.round(sec / 60)}m`;
              return ` | ${tf} plan ${label}`;
            })()}
            {tfPack?.planned_at ? ` | Plan ${asciiClean(String(tfPack.planned_at).slice(0, 16))}Z` : ""}
            {estimate?.preferred_scenario || estimate?.plan?.preferred_scenario
              ? ` | Prefer ${asciiClean(estimate?.preferred_scenario || estimate?.plan?.preferred_scenario)}`
              : ""}
          </p>
        </div>
        <div className="aim-desk-chart-controls">
          <div className="aim-desk-chart-tfs" role="group" aria-label="Timeframe">
            {TF_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`aim-desk-chart-tf${tf === opt.id ? " is-on" : ""}`}
                onClick={() => changeTf(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="aim-desk-chart-layers" role="group" aria-label="Overlay layers">
            {LAYER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`aim-desk-chart-layer${layers[opt.id] ? " is-on" : ""}`}
                onClick={() => toggleLayer(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="aim-desk-chart-layers" role="group" aria-label="Scenarios">
            {SCENARIO_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`aim-desk-chart-layer is-scenario is-${opt.id}${scenario === opt.id ? " is-on" : ""}`}
                onClick={() => selectScenario(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="aim-desk-chart-meta">
        <span>Last {formatPx(lastPx)} RLUSD</span>
        {bands.bid > 0 ? <span>Bid {formatPx(bands.bid)}</span> : null}
        {bands.ask > 0 ? <span>Ask {formatPx(bands.ask)}</span> : null}
        {estimateMarks.find((m) => m.role === "fair") ? (
          <span className="aim-desk-chart-fair">
            Fair {formatPx(estimateMarks.find((m) => m.role === "fair").price)}
          </span>
        ) : null}
        {estimate?.trade_score != null ? (
          <span className="aim-desk-chart-score">
            Score {Number(estimate.trade_score).toFixed(3)}
            {estimate.signal ? ` ${asciiClean(estimate.signal)}` : ""}
          </span>
        ) : null}
        {layers.levels && (estimate?.rsi != null || tfPack?.levels?.rsi != null) ? (
          <span>RSI {Number(estimate?.rsi ?? tfPack?.levels?.rsi).toFixed(1)}</span>
        ) : null}
        {scenario ? (
          <span className={`aim-desk-chart-scenario-tag is-${scenario}`}>
            {scenario === "bull" ? "Bullish" : "Bearish"} | {tf}
          </span>
        ) : null}
        <span className="aim-desk-chart-est-tag">{ESTIMATE_LABEL}</span>
      </div>

      <div className="aim-desk-chart-plot">
        {!candles.length ? (
          <p className="aim-empty">{error || "Waiting for XRP/RLUSD candles..."}</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="XRP RLUSD candles with desk overlays">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const py = PAD.t + t * innerH;
              const price = domain.max - t * (domain.max - domain.min);
              return (
                <g key={`g-${t}`}>
                  <line className="aim-desk-chart-grid" x1={PAD.l} x2={W - PAD.r} y1={py} y2={py} />
                  <text className="aim-desk-chart-axis" x={PAD.l - 6} y={py + 3} textAnchor="end">
                    {formatPx(price)}
                  </text>
                </g>
              );
            })}

            {/* Demand = green 50% opacity boxes; Supply = red 50% opacity boxes */}
            {layers.levels && scenario === "bull"
              ? demandZones.map((z, i) => (
                  <rect
                    key={`dem-${i}-${z.lo}`}
                    className="aim-desk-chart-zone is-demand"
                    x={zoneX0}
                    y={y(z.hi)}
                    width={Math.max(8, zoneX1 - zoneX0)}
                    height={Math.max(2, y(z.lo) - y(z.hi))}
                    opacity={0.5}
                  />
                ))
              : null}
            {layers.levels && scenario === "bear"
              ? supplyZones.map((z, i) => (
                  <rect
                    key={`sup-${i}-${z.hi}`}
                    className="aim-desk-chart-zone is-supply"
                    x={zoneX0}
                    y={y(z.hi)}
                    width={Math.max(8, zoneX1 - zoneX0)}
                    height={Math.max(2, y(z.lo) - y(z.hi))}
                    opacity={0.5}
                  />
                ))
              : null}

            {buildChannel(projBull, "aim-desk-chart-proj is-bull")}
            {buildChannel(projBear, "aim-desk-chart-proj is-bear")}

            {candles.map((c, i) => {
              const x = xAt(i);
              const o = Number(c.o);
              const close = Number(c.c);
              const hi = Number(c.h);
              const lo = Number(c.l);
              const up = close >= o;
              const yO = y(o);
              const yC = y(close);
              const yH = y(hi);
              const yL = y(lo);
              const bodyTop = Math.min(yO, yC);
              const bodyH = Math.max(1.8, Math.abs(yC - yO));
              return (
                <g key={c.t || i} className={up ? "is-up" : "is-down"}>
                  <line className="aim-desk-chart-wick" x1={x} x2={x} y1={yH} y2={yL} />
                  <rect
                    className="aim-desk-chart-body"
                    x={x - bodyW / 2}
                    y={bodyTop}
                    width={bodyW}
                    height={bodyH}
                  />
                </g>
              );
            })}

            {layers.projection && scenario && projBars > 0 ? (
              <line
                className="aim-desk-chart-now"
                x1={xAt(candles.length - 1)}
                x2={xAt(candles.length - 1)}
                y1={PAD.t}
                y2={H - PAD.b}
              />
            ) : null}

            {publicBookMarks
              .filter((m) => m.best)
              .map((m) => (
                <line
                  key={`book-${m.side}-${m.price}`}
                  className={`aim-desk-chart-book is-${m.side}`}
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(m.price)}
                  y2={y(m.price)}
                />
              ))}

            {estimateMarks.map((m) => (
              <g key={`est-${m.kind}-${m.role}-${m.price}`}>
                <line
                  className={`aim-desk-chart-est is-${m.role} is-${m.kind}`}
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(m.price)}
                  y2={y(m.price)}
                />
                <text className="aim-desk-chart-est-label" x={W - PAD.r - 2} y={y(m.price) - 3} textAnchor="end">
                  {m.label} {formatPx(m.price)}
                </text>
              </g>
            ))}

            {deskMarks.map((m, i) => {
              const yy = y(m.price);
              const xTag = PAD.l + 8 + (i % 3) * 72;
              return (
                <g key={m.key} className={`aim-desk-chart-order is-${m.side}`}>
                  <line
                    x1={PAD.l}
                    x2={W - PAD.r}
                    y1={yy}
                    y2={yy}
                    stroke={m.color}
                    strokeWidth={1.4}
                    strokeDasharray={m.status === "proposal" ? "4 3" : "0"}
                    opacity={0.85}
                  />
                  <circle cx={xTag} cy={yy} r={3.2} fill={m.color} />
                  <text x={xTag + 6} y={yy - 3} fill={m.color} className="aim-desk-chart-order-label">
                    {m.label} {m.side} {formatPx(m.price)}
                  </text>
                </g>
              );
            })}

            {layers.projection && scenario && (projBull || projBear) ? (
              <text className="aim-desk-chart-proj-label" x={W - PAD.r - 4} y={PAD.t + 12} textAnchor="end">
                {ESTIMATE_LABEL} | not guaranteed
              </text>
            ) : null}
          </svg>
        )}
      </div>

      <p className="aim-desk-chart-disclaimer">{disclaimer}{rationaleNote ? ` | ${rationaleNote}` : ""}</p>

      <ul className="aim-desk-chart-legend" aria-label="Desk order legend">
        {deskMarks.slice(0, 8).map((m) => (
          <li key={`leg-${m.key}`}>
            <i style={{ background: m.color }} />
            <span>
              {m.label} | {m.side} | {formatPx(m.price)} | {m.status}
            </span>
          </li>
        ))}
        {!deskMarks.length ? <li className="aim-empty">No desk XRP/RLUSD orders mapped yet.</li> : null}
      </ul>
    </section>
  );
}

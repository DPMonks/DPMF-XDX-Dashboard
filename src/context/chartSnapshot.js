/** Live HybridChart snapshot for AIM Commander chat context. Module store so main-page and AI-Matrix charts share one active view. */

import { useSyncExternalStore } from "react";

let snapshot = null;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function publishChartSnapshot(next) {
  const value = next && typeof next === "object" ? next : null;
  try {
    if (JSON.stringify(snapshot) === JSON.stringify(value)) return;
  } catch {
    /* replace */
  }
  snapshot = value;
  emit();
}

export function getChartSnapshot() {
  return snapshot;
}

export function subscribeChartSnapshot(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: latest published HybridChart snapshot (or null). */
export function useChartSnapshot() {
  return useSyncExternalStore(subscribeChartSnapshot, getChartSnapshot, () => null);
}

function pickSwingHighLow(candles = []) {
  const rows = Array.isArray(candles) ? candles : [];
  let high = null;
  let low = null;
  for (const row of rows) {
    const t = Number(row?.t);
    const h = Number(row?.h);
    const l = Number(row?.l);
    if (!Number.isFinite(t)) continue;
    if (Number.isFinite(h) && (!high || h > high.price)) high = { t, price: h };
    if (Number.isFinite(l) && (!low || l < low.price)) low = { t, price: l };
  }
  const lastRow = rows.length ? rows[rows.length - 1] : null;
  const last = lastRow
    ? {
        t: Number(lastRow.t),
        price: Number(lastRow.c) || Number(lastRow.h) || Number(lastRow.l) || null,
      }
    : null;
  return { high, low, last };
}

export function buildChartSnapshot({
  pair,
  timeframe,
  tool,
  maType,
  maPeriods,
  magnet,
  showVolume,
  showRsi,
  showArb,
  hollow,
  deskMarksCount = 0,
  estimateOn = false,
  estimateSide = null,
  drawings = [],
  viewMin = null,
  viewMax = null,
  lastClose = null,
  livePrice = null,
} = {}) {
  const kinds = {};
  for (const row of Array.isArray(drawings) ? drawings : []) {
    const kind = String(row?.kind || row?.tool || "mark");
    kinds[kind] = (kinds[kind] || 0) + 1;
  }
  const round = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (Math.abs(n) >= 1000) return Math.round(n * 100) / 100;
    if (Math.abs(n) >= 1) return Math.round(n * 1e6) / 1e6;
    return Math.round(n * 1e8) / 1e8;
  };
  return {
    pair: String(pair || "").replace(/\s+/g, "").toUpperCase() || null,
    timeframe: String(timeframe || "") || null,
    active_tool: tool === "none" || !tool ? "none" : String(tool),
    ma_type: String(maType || "sma"),
    ma_periods: Array.isArray(maPeriods) ? maPeriods.map(Number).filter((n) => Number.isFinite(n)) : [],
    magnet: Boolean(magnet),
    overlays: {
      volume: Boolean(showVolume),
      rsi: Boolean(showRsi),
      arb: Boolean(showArb),
      hollow: Boolean(hollow),
      desk_marks: Number(deskMarksCount) > 0,
      desk_marks_count: Number(deskMarksCount) || 0,
      estimate: Boolean(estimateOn),
      estimate_side: estimateSide === "bear" || estimateSide === "bull" ? estimateSide : null,
    },
    price: {
      last_close: round(lastClose),
      live: round(livePrice),
      visible_min: round(viewMin),
      visible_max: round(viewMax),
    },
    drawings: {
      count: Array.isArray(drawings) ? drawings.length : 0,
      kinds,
    },
    at: new Date().toISOString(),
  };
}

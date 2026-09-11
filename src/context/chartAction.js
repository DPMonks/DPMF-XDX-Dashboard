/** Chart actions from AIM Commander chat (ask side / show estimate). Shared by HybridChart views. */
import { useSyncExternalStore } from "react";

let action = null;
let seq = 0;
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

export function publishChartAction(next) {
  if (!next || typeof next !== "object") {
    action = null;
    seq += 1;
    emit();
    return null;
  }
  const type = String(next.type || "").trim();
  if (!type) return null;
  const sideRaw = String(next.side || "").toLowerCase();
  const side =
    sideRaw === "bull" || sideRaw === "bullish" || sideRaw === "long"
      ? "bull"
      : sideRaw === "bear" || sideRaw === "bearish" || sideRaw === "short"
        ? "bear"
        : null;
  const drawings = Array.isArray(next.drawings)
    ? next.drawings
        .filter((row) => row && typeof row === "object" && row.kind)
        .slice(0, 24)
        .map((row) => ({ ...row, source: row.source || "commander", commander: true }))
    : [];
  action = {
    type,
    side,
    timeframe: next.timeframe ? String(next.timeframe) : null,
    pair: next.pair ? String(next.pair) : null,
    label: next.label ? String(next.label) : "Estimate by AI-Matrix",
    drawings,
    show_estimate: Boolean(next.show_estimate),
    seq: ++seq,
    at: new Date().toISOString(),
  };
  emit();
  return action;
}

export function getChartAction() {
  return action;
}

export function subscribeChartAction(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChartAction() {
  return useSyncExternalStore(subscribeChartAction, getChartAction, () => null);
}

export function clearChartAction() {
  action = null;
  seq += 1;
  emit();
}

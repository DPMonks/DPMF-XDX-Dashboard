/**
 * AIM Commander chat asks from HybridChart mark clicks.
 * Shared by HybridPlot and AiMatrixPanel (drawer + inline).
 */
import { useSyncExternalStore } from "react";
import { openAimOverlay } from "../siteJump";

let ask = null;
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

export function publishAimChatAsk(next) {
  const text = String(next?.text || next || "").trim();
  if (!text) return null;
  ask = {
    text: text.slice(0, 2000),
    mark: next && typeof next === "object" ? next.mark || null : null,
    focus: next?.focus !== false,
    open: next?.open !== false,
    seq: ++seq,
    at: new Date().toISOString(),
  };
  if (ask.open) {
    try {
      openAimOverlay();
    } catch {
      /* ignore */
    }
  }
  emit();
  return ask;
}

export function getAimChatAsk() {
  return ask;
}

export function subscribeAimChatAsk(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAimChatAsk() {
  return useSyncExternalStore(subscribeAimChatAsk, getAimChatAsk, () => null);
}

export function clearAimChatAsk() {
  ask = null;
  seq += 1;
  emit();
}

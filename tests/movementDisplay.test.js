import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMovementSummary,
  movementTone,
  presentMovement,
  readMovementPair,
} from "../src/movementDisplay.js";
import { summarizeIntent } from "../server/aimMatrix.js";

test("trade proposal keeps its pair and spaces the kind", () => {
  const line = formatMovementSummary("trade_proposal", {
    action: "momentum_follow_with_xrp_exit",
    pair: "XRP/RLUSD",
    urgency: "high",
  });
  assert.equal(line, "trade proposal | XRP/RLUSD | high");
  assert.equal(line.includes("trade_proposal"), false);
  assert.equal(/[\u2013\u2014]/.test(line), false);
});

test("summarizeIntent keeps the pair and does not rename the stored kind argument", () => {
  const kind = "trade_proposal";
  const line = summarizeIntent(kind, {
    trade_proposal: { pair: "xdx/xrp", urgency: "low" },
    action: "OfferCreate",
  });
  assert.equal(kind, "trade_proposal");
  assert.equal(line, "trade proposal | XDX/XRP | low");
});

test("missing pair is left blank", () => {
  const line = formatMovementSummary("trade_proposal", { action: "OfferCreate", urgency: "high" });
  assert.equal(line, "trade proposal | high");
  assert.equal(line.includes("XRP"), false);
  assert.equal(readMovementPair({ pair: "not a pair" }), "");
  assert.equal(readMovementPair({ pair: "" }), "");
  assert.equal(readMovementPair(null), "");
});

test("execution and fill rows show pair and tesSUCCESS", () => {
  const line = formatMovementSummary("trade_execution", {
    proposal: { pair: "XRP/RLUSD", urgency: "high" },
    exec: { engine_result: "tesSUCCESS" },
  });
  assert.equal(line, "trade execution | XRP/RLUSD | tesSUCCESS");
  assert.equal(movementTone({ kind: "trade_execution", text: line }), "success");
  const fill = formatMovementSummary("fill", { pair: "XDX/RLUSD", engine_result: "tesSUCCESS" });
  assert.equal(fill, "fill | XDX/RLUSD | tesSUCCESS");
  assert.equal(movementTone({ kind: "fill", text: fill }), "success");
});

test("blocked rows stay red-scannable and keep the pair", () => {
  const line = formatMovementSummary("trade_blocked", {
    pair: "XRP/RLUSD",
    blocked_by: "below_cost_basis",
  });
  assert.equal(line, "trade blocked | XRP/RLUSD | below cost basis");
  assert.equal(movementTone({ kind: "trade_blocked", text: line }), "block");
  const proposal = formatMovementSummary("trade_proposal", {
    pair: "XDX/XRP",
    urgency: "high",
    blocked_by: "lp_hold",
  });
  assert.equal(proposal, "trade proposal | XDX/XRP | blocked, lp hold");
  assert.equal(movementTone({ kind: "trade_proposal", text: proposal }), "block");
  assert.equal(movementTone({ kind: "trade_blocked", text: "Held | gated" }), "block");
});

test("other movement rows gain a pair only when one is present", () => {
  assert.equal(
    formatMovementSummary("desk_coordination", { pair: "XDX/RLUSD" }),
    "desk coordination | XDX/RLUSD"
  );
  assert.equal(formatMovementSummary("inbox", { note: "ping" }), "inbox");
  assert.equal(
    formatMovementSummary("observe", { indexer: { skipped: true }, pair: "XRP/RLUSD" }),
    "Observing via private data path | XRP/RLUSD"
  );
  assert.equal(
    formatMovementSummary("pools", { pools: { ok: true, pool_count: 24, top_pool: "XDX/XRP" } }),
    "Pool scan ok · 24 pools · top XDX/XRP"
  );
});

test("pool scan ok is not painted as a success fill", () => {
  const line = formatMovementSummary("pools", { pools: { ok: true, pool_count: 24, top_pool: "XDX/XRP" } });
  assert.equal(movementTone({ kind: "pools", text: line }), "");
});

test("presentMovement rebuilds a raw kind and colors the line", () => {
  const proposal = presentMovement({
    kind: "trade_proposal",
    summary: "trade_proposal",
    pair: "XRP/RLUSD",
    urgency: "high",
  });
  assert.equal(proposal.text, "trade proposal | XRP/RLUSD | high");
  assert.equal(proposal.tone, "");

  const fill = presentMovement({
    kind: "trade_execution",
    summary: "trade execution | XRP/RLUSD | tesSUCCESS",
    pair: "XRP/RLUSD",
  });
  assert.equal(fill.text, "trade execution | XRP/RLUSD | tesSUCCESS");
  assert.equal(fill.tone, "success");

  const spaced = presentMovement({
    kind: "desk_coordination",
    summary: "desk_coordination",
    pair: "XDX/XRP",
  });
  assert.equal(spaced.text, "desk coordination | XDX/XRP");
});

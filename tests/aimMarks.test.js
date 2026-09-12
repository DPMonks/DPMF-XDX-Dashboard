import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeskMarks,
  classifyDeskMarkStyle,
  deskMarkAskPrompt,
  deskMarkColor,
  deskMarkPaintColor,
  deskMarkTouchClusterFlags,
  DESK_CLUSTER_PURPLE,
  DESK_CLUSTER_TOOLTIP,
} from "../src/chart/aimMarks.js";

test("classifyDeskMarkStyle splits filled vs resting", () => {
  assert.equal(classifyDeskMarkStyle({ submitted: true }), "filled");
  assert.equal(classifyDeskMarkStyle({ status: "filled" }), "filled");
  assert.equal(classifyDeskMarkStyle({ status: "open" }), "resting");
  assert.equal(classifyDeskMarkStyle({ status: "proposal" }), "resting");
});

test("buildDeskMarks is pair-scoped with green/red dots and no agent colour", () => {
  const rows = [
    { agent_id: "agent1", pair: "XRP/RLUSD", side: "buy", iou_per_xrp: 2.1, status: "submitted", submitted: true, urgency: "high" },
    { agent_id: "agent2", pair: "XRP/RLUSD", side: "sell", iou_per_xrp: 2.2, status: "open", open: true, xrp_thesis: "fade pump" },
    { agent_id: "agent3", pair: "XDX/RLUSD", side: "buy", iou_per_xrp: 0.05, status: "open" },
  ];
  const marks = buildDeskMarks(rows, "XRP/RLUSD", 2.15);
  assert.equal(marks.length, 2);
  assert.equal(marks[0].style, "filled");
  assert.equal(marks[0].color, deskMarkColor("buy"));
  assert.equal(marks[1].style, "resting");
  assert.equal(marks[1].color, deskMarkColor("sell"));
  assert.equal(marks[0].color, "#26a69a");
  assert.equal(marks[1].color, "#ef5350");
});

test("deskMarkAskPrompt is ASCII without em dashes", () => {
  const prompt = deskMarkAskPrompt({
    agent_id: "agent1",
    side: "buy",
    pair: "XRP/RLUSD",
    price: 2.1,
    style: "filled",
    tactic: "high",
    playbook: "fade pump",
  });
  assert.match(prompt, /agent1/);
  assert.match(prompt, /XRP\/RLUSD/);
  assert.match(prompt, /2\.1/);
  assert.equal(/[\u2010-\u2015\u2212]/.test(prompt), false);
});

test("deskMarkTouchClusterFlags paints purple only for touching centres", () => {
  const isolated = deskMarkTouchClusterFlags([
    { x: 10, y: 10, r: 3.6 },
    { x: 100, y: 100, r: 3.6 },
  ]);
  assert.deepEqual(isolated, [false, false]);

  const touching = deskMarkTouchClusterFlags([
    { x: 10, y: 10, r: 3.6 },
    { x: 16, y: 10, r: 3.6 },
    { x: 200, y: 200, r: 3.6 },
  ]);
  assert.deepEqual(touching, [true, true, false]);
  assert.equal(deskMarkPaintColor({ side: "buy", color: "#26a69a" }, true), DESK_CLUSTER_PURPLE);
  assert.equal(deskMarkPaintColor({ side: "sell", color: "#ef5350" }, false), "#ef5350");
  assert.equal(/[\u2010-\u2015\u2212]/.test(DESK_CLUSTER_TOOLTIP), false);
  assert.match(DESK_CLUSTER_TOOLTIP, /Tight cluster/);
});

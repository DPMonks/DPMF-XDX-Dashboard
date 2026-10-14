import test from "node:test";
import assert from "node:assert/strict";
import { formatUsd, formatXrp, normalizeNet, normalizePnlAll, normalizePnlSummary } from "../src/aimPnlFormat.js";

const net = {
  team: { net_xrp: "0.40000000", net_usd: "0.75000000", wins_xrp: "0.6", wins_usd: "1.5", losses_xrp: "-0.2", losses_usd: "-0.75", wins: 2, losses: 1 },
  by_agent: [{ agent_id: "agent4", role: "Vortex", net_xrp: "-0.0145", net_usd: "-0.0109", wins_xrp: "0", wins_usd: "0", losses_xrp: "-0.0145", losses_usd: "-0.0109", wins: 0, losses: 14 }],
};

test("net block normalizes wins, losses and net", () => {
  const out = normalizeNet(net);
  assert.equal(out.team.net_xrp, 0.4);
  assert.equal(out.team.losses, 1);
  assert.equal(out.by_agent[0].losses, 14);
  assert.equal(normalizeNet(null), null);
  assert.equal(normalizeNet({}), null);
});

test("all profit reads net_ledger, 24h reads net, and both survive re-normalizing", () => {
  const all = normalizePnlAll({ net_ledger: net });
  assert.equal(all.net.team.wins_usd, 1.5);
  const day = normalizePnlSummary({ net });
  assert.equal(normalizePnlSummary(day).net.team.losses_xrp, -0.2);
});

test("losses show at 4 decimals in XRP and USD", () => {
  assert.equal(formatXrp(-0.0145), "-0.0145 XRP");
  assert.equal(formatUsd(-0.75), "-$0.7500");
});

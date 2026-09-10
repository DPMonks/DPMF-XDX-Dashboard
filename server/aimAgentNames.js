/**
 * Shared AIM public agent identity map.
 * Internal ids stay agent1..agent6. User-facing labels use codeName (e.g. "Agent Prime").
 * Keep in sync with src/aimAgentNames.js
 */
export const AIM_AGENTS = {
  agent1: {
    codeName: "Agent Prime",
    shortName: "Prime",
    role: "Token accumulation",
    identity: "Foundational, decisive, first-layer intelligence.",
  },
  agent2: {
    codeName: "Agent Flux",
    shortName: "Flux",
    role: "AMM & LP operations",
    identity: "Fluid, adaptive, equilibrium-driven.",
  },
  agent3: {
    codeName: "Agent Vector",
    shortName: "Vector",
    role: "Arbitrage",
    identity: "Directional, fast, precision-focused.",
  },
  agent4: {
    codeName: "Agent Vortex",
    shortName: "Vortex",
    role: "Momentum",
    identity: "Accelerating, force-driven, trend-hungry.",
  },
  agent5: {
    codeName: "Agent Echo",
    shortName: "Echo",
    role: "Mean reversion + fee capture",
    identity: "Rhythmic, cyclical, pattern-aware.",
  },
  agent6: {
    codeName: "Agent Ghost",
    shortName: "Ghost",
    role: "XRPL observe (Nova / Quill / Cipher)",
    identity: "Quiet, peripheral, opportunity-spotting.",
  },
};

export const AIM_AGENT_IDS = ["agent1", "agent2", "agent3", "agent4", "agent5", "agent6"];

export function aimAgentProfile(agentId) {
  const id = String(agentId || "").toLowerCase();
  if (id === "commander") {
    return { codeName: "Commander", shortName: "Commander", role: "Desk lead", identity: "" };
  }
  if (id === "dashboard") {
    return { codeName: "You", shortName: "You", role: "", identity: "" };
  }
  return AIM_AGENTS[id] || null;
}

export function aimAgentLabel(agentId) {
  const p = aimAgentProfile(agentId);
  return p?.codeName || "Agent";
}

export function aimAgentShortName(agentId) {
  const p = aimAgentProfile(agentId);
  return p?.shortName || "Agent";
}

export function aimAgentRole(agentId) {
  const p = aimAgentProfile(agentId);
  return p?.role || "";
}

/** Resolve "prime" / "agent prime" / "agent1" / "1" -> agent1..agent6 */
export function resolveAimAgentId(raw) {
  const q = String(raw || "").trim().toLowerCase();
  if (!q) return null;
  if (/^agent[1-6]$/.test(q)) return q;
  if (/^[1-6]$/.test(q)) return `agent${q}`;
  const byShort = Object.entries(AIM_AGENTS).find(([, v]) => v.shortName.toLowerCase() === q);
  if (byShort) return byShort[0];
  const m = q.match(/^agent\s*(prime|flux|vector|vortex|echo|ghost|[1-6])$/i);
  if (m) {
    const key = m[1].toLowerCase();
    if (/^[1-6]$/.test(key)) return `agent${key}`;
    const hit = Object.entries(AIM_AGENTS).find(([, v]) => v.shortName.toLowerCase() === key);
    return hit ? hit[0] : null;
  }
  return null;
}
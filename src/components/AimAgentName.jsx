import { aimAgentProfile, aimAgentShortName } from "../aimAgentNames";

/**
 * "Agent" in white + branded violet short name (Prime / Flux / …).
 * Stacked vertically in chips; inline elsewhere.
 */
export default function AimAgentName({ agentId, label, stacked = false, className = "" }) {
  const profile = aimAgentProfile(agentId);
  let short = profile?.shortName || aimAgentShortName(agentId);
  const raw = String(label || profile?.codeName || "").trim();
  if ((!short || short === "Agent") && raw) {
    const m = raw.match(/^Agent\s+(.+)$/i);
    if (m) short = m[1].trim();
    else if (!/^agent\d$/i.test(raw) && raw.toLowerCase() !== "commander") short = raw;
  }
  if (!short || short === "Agent") {
    return <span className={`aim-agent-name ${className}`.trim()}>{raw || "Agent"}</span>;
  }
  if (/^(commander|you|dashboard)$/i.test(short)) {
    return <span className={`aim-agent-name ${className}`.trim()}>{short}</span>;
  }
  return (
    <span className={`aim-agent-name ${stacked ? "is-stacked" : "is-inline"} ${className}`.trim()}>
      <span className="aim-agent-title">Agent</span>
      {stacked ? null : " "}
      <span className="aim-agent-codename">{short}</span>
    </span>
  );
}

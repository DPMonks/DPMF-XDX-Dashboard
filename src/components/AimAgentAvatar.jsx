import { aimAgentAvatarSrc } from "../aimAgentNames";

/**
 * Circle AIM agent / Commander avatar. Returns null when no avatar resolves.
 * size: "md" (chips) | "sm" (rows / book / chatter)
 */
export default function AimAgentAvatar({ agentId, label, size = "md", className = "" }) {
  const src = aimAgentAvatarSrc(agentId) || (label ? aimAgentAvatarSrc(label) : null);
  if (!src) return null;
  const px = size === "sm" ? 18 : 30;
  return (
    <span
      className={`aim-agent-logo-wrap${size === "sm" ? " is-sm" : ""} ${className}`.trim()}
      aria-hidden="true"
      data-agent={agentId || label || undefined}
    >
      <img
        className="aim-agent-logo"
        src={src}
        alt=""
        width={px}
        height={px}
        decoding="async"
      />
    </span>
  );
}
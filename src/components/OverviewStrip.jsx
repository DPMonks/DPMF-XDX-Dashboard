import { formatNumber, formatToken } from "../utils/format";
import Skeleton from "./Skeleton";

export default function OverviewStrip({ overview, loading, error }) {
  if (loading && !overview) {
    return (
      <div className="token-details-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={72} />
        ))}
      </div>
    );
  }

  if (error && !overview) {
    return <p className="error-message">{error}</p>;
  }

  const cards = [
    ["TVL", formatToken(overview?.tvl)],
    ["LP supply", formatToken(overview?.lp_supply)],
    ["XDX holders", formatNumber(overview?.holder_count)],
    ["LP holders", formatNumber(overview?.lp_holder_count)],
  ];

  return (
    <div className="token-details-grid">
      {cards.map(([label, value]) => (
        <div key={label} className="token-detail neon-card">
          <span className="token-detail-label">{label}</span>
          <span className="token-detail-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

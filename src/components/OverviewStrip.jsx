import { formatNumber, formatToken } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

export default function OverviewStrip({ overview, loading, error }) {
  const { t, locale } = useI18n();

  if (loading && !overview) {
    return (
      <div className="token-details-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} height={58} />
        ))}
      </div>
    );
  }

  if (error && !overview) {
    return <p className="error-message">{error}</p>;
  }

  const cards = [
    [t.tvl, formatToken(overview?.tvl, locale)],
    [t.lpSupply, formatToken(overview?.lp_supply, locale)],
    [t.xdxHolders, formatNumber(overview?.holder_count, locale)],
    [t.lpHoldersCount, formatNumber(overview?.lp_holder_count, locale)],
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

import { pairParts } from "../utils/currency";
import { formatNumber, formatToken, formatUsd, formatUsdPrice, formatWhen } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

export default function AmmCard({ pools, loading, error }) {
  const { t, locale } = useI18n();

  if (loading && !pools.length) {
    return (
      <div className="pool-grid">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} height={180} />
        ))}
      </div>
    );
  }

  if (error && !pools.length) {
    return <p className="error-message">{error}</p>;
  }

  if (!pools.length) {
    return <p className="empty-message">{t.emptyPools}</p>;
  }

  return (
    <div className="pool-grid">
      {pools.map((pool, index) => {
        const { asset, quote } = pairParts(pool.pool);
        return (
          <article
            key={pool.amm_account || `${pool.pool}-${index}`}
            className="pool-card"
          >
            <header className="pool-card-head">
              <span className="pair-badge">{pool.pool}</span>
              {pool.updated && (
                <span className="pool-updated">
                  {t.updated} {formatWhen(pool.updated, locale)}
                </span>
              )}
            </header>
            <dl className="pool-stats">
              <div>
                <dt>{t.tvl}</dt>
                <dd>{formatUsd(pool.tvl, locale)}</dd>
              </div>
              <div>
                <dt>{t.price}</dt>
                <dd>{formatUsdPrice(pool.price, locale)}</dd>
              </div>
              <div>
                <dt>
                  {t.reserve} {asset}
                </dt>
                <dd>{formatToken(pool.reserve_asset, locale)}</dd>
              </div>
              <div>
                <dt>
                  {t.reserve} {quote}
                </dt>
                <dd>{formatToken(pool.reserve_currency, locale)}</dd>
              </div>
              <div>
                <dt>{t.lpSupply}</dt>
                <dd>{formatToken(pool.lp_supply, locale)}</dd>
              </div>
              <div>
                <dt>{t.fee}</dt>
                <dd>
                  {pool.trading_fee == null
                    ? "—"
                    : formatNumber(pool.trading_fee / (pool.trading_fee > 20 ? 1000 : 1), locale, {
                        maximumFractionDigits: 3,
                      })}
                </dd>
              </div>
              <div>
                <dt>{t.apr}</dt>
                <dd>
                  {pool.apr == null ? "—" : `${formatNumber(pool.apr, locale)}%`}
                </dd>
              </div>
              <div>
                <dt>{t.volume24h}</dt>
                <dd>{formatToken(pool.volume24h, locale)}</dd>
              </div>
            </dl>
          </article>
        );
      })}
    </div>
  );
}

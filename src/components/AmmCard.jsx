import { pairParts } from "../utils/currency";
import { formatNumber, formatToken, formatUsd, formatUsdPrice, formatWhen, shortAddress } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

export default function AmmCard({ pools, loading, error }) {
  const { t, locale } = useI18n();

  if (loading && !pools.length) {
    return (
      <div className="pool-grid">
        {Array.from({ length: 6 }, (_, i) => (
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
              {pool.amm_account ? (
                <div>
                  <dt>{t.issuerAccount}</dt>
                  <dd title={pool.amm_account}>{shortAddress(pool.amm_account)}</dd>
                </div>
              ) : null}
              {pool.tvl != null ? (
                <div>
                  <dt>{t.tvl}</dt>
                  <dd>{formatUsd(pool.tvl, locale)}</dd>
                </div>
              ) : null}
              {pool.price != null ? (
                <div>
                  <dt>{t.price}</dt>
                  <dd>{formatUsdPrice(pool.price, locale)}</dd>
                </div>
              ) : null}
              <div>
                <dt>
                  {t.reserve} {asset}
                </dt>
                <dd>{formatToken(pool.reserve_asset, locale)}</dd>
              </div>
              {pool.reserve_currency != null ? (
                <div>
                  <dt>
                    {t.reserve} {quote}
                  </dt>
                  <dd>{formatToken(pool.reserve_currency, locale)}</dd>
                </div>
              ) : (
                <div>
                  <dt>{t.pair}</dt>
                  <dd>{quote}</dd>
                </div>
              )}
              {pool.lp_currency ? (
                <div>
                  <dt>{t.lp}</dt>
                  <dd title={pool.lp_currency}>{shortAddress(pool.lp_currency)}</dd>
                </div>
              ) : null}
              {pool.lp_supply != null ? (
                <div>
                  <dt>{t.lpSupply}</dt>
                  <dd>{formatToken(pool.lp_supply, locale)}</dd>
                </div>
              ) : null}
              {pool.trading_fee != null ? (
                <div>
                  <dt>{t.fee}</dt>
                  <dd>
                    {formatNumber(pool.trading_fee / (pool.trading_fee > 20 ? 1000 : 1), locale, {
                      maximumFractionDigits: 3,
                    })}
                  </dd>
                </div>
              ) : null}
              {pool.apr != null ? (
                <div>
                  <dt>{t.apr}</dt>
                  <dd>{`${formatNumber(pool.apr, locale)}%`}</dd>
                </div>
              ) : null}
              {pool.volume24h != null ? (
                <div>
                  <dt>{t.volume24h}</dt>
                  <dd>{formatToken(pool.volume24h, locale)}</dd>
                </div>
              ) : null}
            </dl>
          </article>
        );
      })}
    </div>
  );
}

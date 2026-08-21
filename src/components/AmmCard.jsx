import { pairParts } from "../utils/currency";
import { formatNumber, formatToken, formatUsd, formatUsdPrice, formatWhen, shortAddress } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

function SplitBar({ asset, quote, xdxPct, quotePct, lead }) {
  if (xdxPct == null || quotePct == null) return null;
  const xdxLead = lead === "xdx" || xdxPct >= quotePct;
  return (
    <div className={`pool-split ${xdxLead ? "is-xdx-lead" : "is-quote-lead"}`}>
      <div className="pool-split-labels">
        <span className={`pool-split-xdx ${xdxLead ? "is-lead" : ""}`}>
          {xdxPct}% {asset}
        </span>
        <span className={`pool-split-quote ${xdxLead ? "" : "is-lead"}`}>
          {quotePct}% {quote}
        </span>
      </div>
      <div
        className={`pool-split-bar ${xdxLead ? "is-xdx-lead" : "is-quote-lead"}`}
        role="img"
        aria-label={`${xdxPct}% ${asset}, ${quotePct}% ${quote}`}
      >
        <span className="pool-split-bar-xdx" style={{ width: `${xdxPct}%` }} />
        <span className="pool-split-bar-quote" style={{ width: `${quotePct}%` }} />
      </div>
    </div>
  );
}

export default function AmmCard({ pools, loading, error }) {
  const { t, locale } = useI18n();

  if (loading && !pools.length) {
    return (
      <div className="pool-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={260} />
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
        const quoteName = pool.quote || quote;
        return (
          <article
            key={pool.amm_account || `${pool.pool}-${index}`}
            className={`pool-card ${
              pool.lead === "quote" ? "is-quote-lead" : pool.xdx_pct != null ? "is-xdx-lead" : ""
            }`}
          >
            <header className="pool-card-head">
              <span className="pair-badge">{pool.pool}</span>
              {pool.updated && (
                <span className="pool-updated">
                  {t.updated} {formatWhen(pool.updated, locale)}
                </span>
              )}
            </header>
            <SplitBar
              asset={asset}
              quote={quoteName}
              xdxPct={pool.xdx_pct}
              quotePct={pool.quote_pct}
              lead={pool.lead}
            />
            <dl className="pool-stats">
              {pool.amm_account ? (
                <div>
                  <dt>{t.ammAccount}</dt>
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
                    {t.reserve} {quoteName}
                  </dt>
                  <dd>{formatToken(pool.reserve_currency, locale)}</dd>
                </div>
              ) : (
                <div>
                  <dt>{t.pair}</dt>
                  <dd>{quoteName}</dd>
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

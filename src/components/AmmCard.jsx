import { pairParts } from "../utils/currency";
import { displayPoolSplit, formatPoolPct } from "../utils/poolSplit";
import { formatNumber, formatToken, formatUsd, formatUsdPrice, formatWhen, shortAddress } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";
import WalletButton from "./WalletButton";

function SplitBar({ asset, quote, xdxPct, quotePct, lead }) {
  const split = displayPoolSplit(xdxPct, quotePct);
  const ready = split.measured;
  const xdxLead = lead === "xdx" || split.xdxPct >= split.quotePct;
  const xdxShare = Math.max(split.xdxPct, 0);
  const quoteShare = Math.max(split.quotePct, 0);

  return (
    <div className={`pool-split ${ready ? (xdxLead ? "is-xdx-lead" : "is-quote-lead") : "is-pending"}`}>
      <div className="pool-split-labels">
        <span className={`pool-split-xdx ${xdxLead ? "is-lead" : ""}`}>
          <i className="pool-split-swatch is-xdx" aria-hidden="true" />
          <span className="pool-split-pct">{formatPoolPct(split.xdxPct)}%</span>
          <span className="pool-split-asset">{asset}</span>
        </span>
        <span className="pool-split-ratio">
          {`${formatPoolPct(split.xdxPct)} / ${formatPoolPct(split.quotePct)}`}
        </span>
        <span className={`pool-split-quote ${!xdxLead ? "is-lead" : ""}`}>
          <span className="pool-split-pct">{formatPoolPct(split.quotePct)}%</span>
          <span className="pool-split-asset">{quote}</span>
          <i className="pool-split-swatch is-quote" aria-hidden="true" />
        </span>
      </div>
      <div
        className={`pool-split-bar ${ready ? (xdxLead ? "is-xdx-lead" : "is-quote-lead") : "is-pending"}`}
        role="img"
        aria-label={`${formatPoolPct(split.xdxPct)} percent ${asset}, ${formatPoolPct(split.quotePct)} percent ${quote}`}
      >
        <span
          className="pool-split-bar-xdx"
          style={{ flexGrow: xdxShare, flexShrink: 0, flexBasis: 0 }}
        />
        <span
          className="pool-split-bar-quote"
          style={{ flexGrow: quoteShare, flexShrink: 0, flexBasis: 0 }}
        />
        <i className="pool-split-mid" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function AmmCard({ pools, loading, error, onAddLiquidity, onRemoveLiquidity }) {
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
            {onAddLiquidity || onRemoveLiquidity ? (
              <div className="pool-card-actions">
                {onRemoveLiquidity ? (
                  <WalletButton
                    className="is-remove-lp"
                    label={t.removeLiquidity}
                    title={`${t.removeLiquidity} ${pool.pool}`}
                    onClick={() => onRemoveLiquidity(pool)}
                  />
                ) : null}
                {onAddLiquidity ? (
                  <WalletButton
                    label={t.addLiquidity}
                    title={`${t.addLiquidity} ${pool.pool}`}
                    onClick={() => onAddLiquidity(pool)}
                  />
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

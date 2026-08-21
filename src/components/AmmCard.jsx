import { formatNumber, formatToken, formatUsd } from "../utils/format";
import Skeleton from "./Skeleton";

export default function AmmCard({ pools, loading, error }) {
  if (loading && !pools.length) {
    return <Skeleton height={120} />;
  }

  if (error && !pools.length) {
    return <p className="error-message">{error}</p>;
  }

  if (!pools.length) {
    return <p className="empty-message">No AMM pool snapshot from the indexer yet.</p>;
  }

  return (
    <div className="scroll-area">
      {pools.map((pool) => (
        <div key={pool.pool} className="amm-block">
          <div className="balance-row">
            <span>{pool.pool}</span>
            <span>TVL {formatToken(pool.tvl)}</span>
          </div>
          <div className="balance-row">
            <span>XDX reserve</span>
            <span>{formatToken(pool.reserve_asset)}</span>
          </div>
          <div className="balance-row">
            <span>XRP reserve</span>
            <span>{formatToken(pool.reserve_currency)}</span>
          </div>
          <div className="balance-row">
            <span>LP supply</span>
            <span>{formatToken(pool.lp_supply)}</span>
          </div>
          {pool.price != null && (
            <div className="balance-row">
              <span>Price</span>
              <span>{formatUsd(pool.price)}</span>
            </div>
          )}
          {pool.apr != null && (
            <div className="balance-row">
              <span>APR</span>
              <span>{formatNumber(pool.apr)}%</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

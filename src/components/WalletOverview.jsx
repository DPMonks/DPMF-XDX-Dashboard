import { useEffect, useState } from "react";
import { getWalletBalances, getWalletNetworth } from "../api/indexer";
import { formatToken, formatUsd, shortAddress } from "../utils/format";
import { copyToClipboard } from "../utils/copy";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

export default function WalletOverview({ address }) {
  const { t, locale } = useI18n();
  const [balances, setBalances] = useState(null);
  const [networth, setNetworth] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextBalances, nextNetworth] = await Promise.all([
          getWalletBalances(address),
          getWalletNetworth(address).catch(() => null),
        ]);
        if (!cancelled) {
          setBalances(nextBalances);
          setNetworth(nextNetworth);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    const id = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [address]);

  if (!balances && !error) {
    return <Skeleton height={120} />;
  }

  if (error && !balances) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <div className="wallet-overview">
      <button
        type="button"
        className="account-link"
        onClick={() => copyToClipboard(address)}
      >
        {shortAddress(address)}
      </button>
      <div className="token-details-grid">
        <div className="token-detail neon-card">
          <span className="token-detail-label">{t.xrp}</span>
          <span className="token-detail-value">
            {formatToken(balances?.xrp, locale)}
          </span>
        </div>
        <div className="token-detail neon-card">
          <span className="token-detail-label">{t.xdx}</span>
          <span className="token-detail-value">
            {formatToken(balances?.xdx, locale)}
          </span>
        </div>
        <div className="token-detail neon-card">
          <span className="token-detail-label">{t.lp}</span>
          <span className="token-detail-value">
            {formatToken(balances?.lp, locale)}
          </span>
        </div>
        <div className="token-detail neon-card">
          <span className="token-detail-label">{t.networth}</span>
          <span className="token-detail-value">
            {formatUsd(networth?.totalUsd ?? networth?.usd ?? networth?.total, locale)}
          </span>
        </div>
      </div>
    </div>
  );
}

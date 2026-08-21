import { useEffect, useState } from "react";
import { getTokenDetails } from "../api/indexer";
import { formatNumber, formatUsd, formatUsdPrice, shortAddress } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

function Detail({ label, value, hint }) {
  return (
    <div className="token-detail neon-card">
      <span className="token-detail-label">{label}</span>
      <span className="token-detail-value">{value ?? "—"}</span>
      {hint ? <span className="token-detail-hint">{hint}</span> : null}
    </div>
  );
}

function pick(data, keys) {
  for (const key of keys) {
    const value = data?.[key];
    if (value != null && value !== "") return value;
  }
  return null;
}

export default function TokenDetails() {
  const { t, locale } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getTokenDetails();
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    const timeout = setTimeout(load, 200);
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(id);
    };
  }, []);

  if (!data && !error) {
    return (
      <div className="token-details-grid">
        {Array.from({ length: 15 }, (_, i) => (
          <Skeleton key={i} height={58} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return <p className="error-message">{error}</p>;
  }

  const blackholed = pick(data, ["blackholed"]);
  const issuer = pick(data, ["issuer"]);
  const usdPrice = pick(data, ["recorded_price", "xdxUsd"]);
  const recordedHint = `${t.recordedPrice} ${formatUsdPrice(usdPrice, locale)}`;

  return (
    <div className="token-details-grid">
      <Detail label={t.tokenType} value={pick(data, ["tokenType", "token_type"])} />
      <Detail label={t.price} value={formatUsdPrice(usdPrice, locale)} />
      <Detail label={t.xdxPerXrp} value={formatUsdPrice(usdPrice, locale)} />
      <Detail
        label={t.xrplMarketCap}
        value={formatUsd(pick(data, ["xrplMarketCap"]), locale)}
        hint={recordedHint}
      />
      <Detail
        label={t.circulatingMarketCap}
        value={formatUsd(pick(data, ["circulatingMarketCap"]), locale)}
        hint={recordedHint}
      />
      <Detail
        label={t.ammMarketCap}
        value={formatUsd(pick(data, ["ammMarketCap", "tvl_usd", "tvl"]), locale)}
        hint={recordedHint}
      />
      <Detail
        label={t.circulating}
        value={formatNumber(pick(data, ["circulating", "circulating_supply"]), locale)}
      />
      <Detail
        label={t.totalSupply}
        value={formatNumber(pick(data, ["totalSupply", "total_supply"]), locale)}
      />
      <Detail
        label={t.burnedSupply}
        value={formatNumber(pick(data, ["burnedSupply", "burned_supply", "issuer_locked"]), locale)}
      />
      <Detail
        label={t.holders}
        value={formatNumber(pick(data, ["holders", "holder_count"]), locale)}
      />
      <Detail
        label={t.trustlines}
        value={formatNumber(pick(data, ["trustlines", "trustline_count"]), locale)}
      />
      <Detail
        label={t.lpHoldersCount}
        value={formatNumber(pick(data, ["lp_holder_count"]), locale)}
      />
      <Detail
        label={t.lpSupply}
        value={formatNumber(pick(data, ["lp_supply"]), locale)}
      />
      <Detail label={t.issuerAccount} value={issuer ? shortAddress(issuer) : "—"} />
      <Detail
        label={t.blackholed}
        value={blackholed == null ? "—" : blackholed ? t.yes : t.no}
      />
    </div>
  );
}

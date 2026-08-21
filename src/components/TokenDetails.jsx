import { useEffect, useState } from "react";
import { getTokenDetailsLive, getTokenDetailsStatic } from "../api/indexer";
import { formatNumber, formatUsd } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

function Detail({ label, value }) {
  return (
    <div className="token-detail neon-card">
      <span className="token-detail-label">{label}</span>
      <span className="token-detail-value">{value ?? "—"}</span>
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
        const [staticData, liveData] = await Promise.all([
          getTokenDetailsStatic(),
          getTokenDetailsLive(),
        ]);
        if (!cancelled) {
          setData({ ...staticData, ...liveData });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    const id = setInterval(async () => {
      try {
        const liveData = await getTokenDetailsLive();
        if (!cancelled) {
          setData((current) => ({ ...(current || {}), ...liveData }));
        }
      } catch {
        // keep last good snapshot
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data && !error) {
    return (
      <div className="token-details-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} height={58} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return <p className="error-message">{error}</p>;
  }

  const ath = data.ath || {};
  const atl = data.atl || {};
  const blackholed = pick(data, ["blackholed"]);

  return (
    <div className="token-details-grid">
      <Detail label={t.tokenType} value={pick(data, ["tokenType", "token_type"])} />
      <Detail
        label={t.rank}
        value={pick(data, ["rank"]) != null ? `#${pick(data, ["rank"])}` : "—"}
      />
      <Detail
        label={t.xrplMarketCap}
        value={formatUsd(pick(data, ["xrplMarketCap", "marketCap", "market_cap"]), locale)}
      />
      <Detail
        label={t.ammMarketCap}
        value={formatUsd(pick(data, ["ammMarketCap", "amm_market_cap"]), locale)}
      />
      <Detail
        label={t.circulatingMarketCap}
        value={formatUsd(
          pick(data, ["circulatingMarketCap", "circulating_market_cap"]),
          locale
        )}
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
        value={formatNumber(pick(data, ["burnedSupply", "burned_supply"]), locale)}
      />
      <Detail
        label={t.holders}
        value={formatNumber(pick(data, ["holders", "holder_count"]), locale)}
      />
      <Detail
        label={t.trustlines}
        value={formatNumber(pick(data, ["trustlines", "trustline_count"]), locale)}
      />
      <Detail label={t.issuerFee} value={pick(data, ["issuerFee", "issuer_fee"])} />
      <Detail
        label={t.blackholed}
        value={blackholed == null ? "—" : blackholed ? t.yes : t.no}
      />
      <Detail label={t.created} value={pick(data, ["created", "created_at"])} />
      <Detail
        label={t.ath}
        value={
          ath.price
            ? `${ath.price}${ath.date ? ` (${ath.date})` : ""}`
            : pick(data, ["ath"])
        }
      />
      <Detail
        label={t.atl}
        value={
          atl.price
            ? `${atl.price}${atl.date ? ` (${atl.date})` : ""}`
            : pick(data, ["atl"])
        }
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { getTokenDetailsLive, getTokenDetailsStatic } from "../api/indexer";
import { formatNumber, formatUsd } from "../utils/format";
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
          <Skeleton key={i} height={72} />
        ))}
      </div>
    );
  }

  if (error && !data) {
    return <p className="error-message">{error}</p>;
  }

  const ath = data.ath || {};
  const atl = data.atl || {};

  return (
    <div className="token-details-grid">
      <Detail label="Token Type" value={pick(data, ["tokenType", "token_type"])} />
      <Detail
        label="Rank"
        value={pick(data, ["rank"]) != null ? `#${pick(data, ["rank"])}` : "—"}
      />
      <Detail
        label="XDX/USD Market Cap"
        value={formatUsd(pick(data, ["xrplMarketCap", "marketCap", "market_cap"]))}
      />
      <Detail
        label="AMM Market Cap"
        value={formatUsd(pick(data, ["ammMarketCap", "amm_market_cap"]))}
      />
      <Detail
        label="Circulating Market Cap"
        value={formatUsd(pick(data, ["circulatingMarketCap", "circulating_market_cap"]))}
      />
      <Detail
        label="Circulating"
        value={formatNumber(pick(data, ["circulating", "circulating_supply"]))}
      />
      <Detail
        label="Total Supply"
        value={formatNumber(pick(data, ["totalSupply", "total_supply"]))}
      />
      <Detail
        label="Burned Supply"
        value={formatNumber(pick(data, ["burnedSupply", "burned_supply"]))}
      />
      <Detail label="Holders" value={formatNumber(pick(data, ["holders", "holder_count"]))} />
      <Detail
        label="Trustlines"
        value={formatNumber(pick(data, ["trustlines", "trustline_count"]))}
      />
      <Detail label="Issuer Fee" value={pick(data, ["issuerFee", "issuer_fee"])} />
      <Detail
        label="Blackholed"
        value={
          pick(data, ["blackholed"]) == null
            ? "—"
            : pick(data, ["blackholed"])
              ? "Yes"
              : "No"
        }
      />
      <Detail label="Created" value={pick(data, ["created", "created_at"])} />
      <Detail
        label="ATH"
        value={
          ath.price
            ? `${ath.price}${ath.date ? ` (${ath.date})` : ""}`
            : pick(data, ["ath"])
        }
      />
      <Detail
        label="ATL"
        value={
          atl.price
            ? `${atl.price}${atl.date ? ` (${atl.date})` : ""}`
            : pick(data, ["atl"])
        }
      />
    </div>
  );
}

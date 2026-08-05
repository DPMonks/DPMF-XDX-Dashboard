import { useEffect, useState } from "react";
import Skeleton from "./Skeleton";

export default function TokenDetails() {
  const [staticData, setStaticData] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadStatic() {
    const res = await fetch(
      "https://dpmf-xdx-indexer-production.up.railway.app/api/token-details-static"
    );
    const json = await res.json();
    setStaticData(json);
  }

  async function loadLive() {
    const res = await fetch(
      "https://dpmf-xdx-indexer-production.up.railway.app/api/token-details-live"
    );
    const json = await res.json();
    setLiveData(json);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);

      await loadStatic();
      await loadLive();

      setLoading(false);
    }

    init();

    const id = setInterval(loadLive, 4000);
    return () => clearInterval(id);
  }, []);

  if (loading || !staticData || !liveData) {
    return (
      <div className="token-details-grid">
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
        <Skeleton height={40} />
      </div>
    );
  }

  const data = { ...staticData, ...liveData };

  return (
    <div className="token-details-grid">

      <Detail label="Token Type" value={data.tokenType} />
      <Detail label="Rank" value={`#${data.rank}`} />

      {/* XRPL-Wide Market Cap */}
      <Detail
        label="XDX/USD Market Cap"
        value={`$${data.xrplMarketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
      />

      {/* AMM Market Cap */}
      <Detail
        label="AMM Market Cap"
        value={`$${data.ammMarketCap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
      />

      {/* Circulating Market Cap */}
      <Detail
        label="Circulating Market Cap"
        value={`$${data.marketCap?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "N/A"}`}
      />

      {/* FDV */}
      <Detail
        label="FDV"
        value={`$${data.fdv?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || "N/A"}`}
      />

      <Detail label="Circulating" value={data.circulating.toLocaleString()} />
      <Detail label="Total Supply" value={data.totalSupply.toLocaleString()} />
      <Detail label="Holders" value={data.holders.toLocaleString()} />
      <Detail label="Trustlines" value={data.trustlines.toLocaleString()} />
      <Detail label="Issuer Fee" value={data.issuerFee} />
      <Detail label="Blackholed" value={data.blackholed ? "Yes" : "No"} />
      <Detail label="Created" value={data.created} />
      <Detail label="ATH" value={`${data.ath.price} (${data.ath.date})`} />
      <Detail label="ATL" value={`${data.atl.price} (${data.atl.date})`} />

    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="token-detail neon-card">
      <span className="token-detail-label">{label}</span>
      <span className="token-detail-value">{value}</span>
    </div>
  );
}

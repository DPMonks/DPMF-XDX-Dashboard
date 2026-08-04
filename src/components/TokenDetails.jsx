import { useEffect, useState } from "react";
import Skeleton from "./Skeleton";

export default function TokenDetails() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const res = await fetch("https://dpmf-xdx-indexer-production.up.railway.app/api/token-details");
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="token-details-grid">
      {loading && !data ? (
        <>
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </>
      ) : (
        <>
          <Detail label="Token Type" value={data.tokenType} />
          <Detail label="Rank" value={`#${data.rank}`} />
          <Detail label="Market Cap" value={`$${data.marketCap.toLocaleString()}`} />
          <Detail label="FDV" value={`$${data.fdv.toLocaleString()}`} />
          <Detail label="Circulating" value={data.circulating.toLocaleString()} />
          <Detail label="Total Supply" value={data.totalSupply.toLocaleString()} />
          <Detail label="Holders" value={data.holders.toLocaleString()} />
          <Detail label="Trustlines" value={data.trustlines.toLocaleString()} />
          <Detail label="Issuer Fee" value={data.issuerFee} />
          <Detail label="Blackholed" value={data.blackholed ? "Yes" : "No"} />
          <Detail label="Created" value={data.created} />
          <Detail label="ATH" value={`${data.ath.price} (${data.ath.date})`} />
          <Detail label="ATL" value={`${data.atl.price} (${data.atl.date})`} />
        </>
      )}
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

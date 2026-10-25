import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

function ProDesk() {
  const { slug } = useParams();
  const [searchKey, setSearchKey] = useState(true);
  const [data, setData] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [ids, setIds] = useState("");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");

  const load = () => {
    fetch(`${configData.LOCAL_API_URL}v2/pro/${slug || ""}`)
      .then((res) => res.json())
      .then((body) => setData(body.data))
      .catch(() => setData(null));
    fetch(
      `${configData.LOCAL_API_URL}v2/portfolio/rFuzionXioDemoOwner11111111111111`
    )
      .then((res) => res.json())
      .then((body) => setPortfolio(body.data))
      .catch(() => setPortfolio(null));
  };

  useEffect(() => {
    load();
  }, [slug]);

  const batch = async () => {
    const res = await fetch(`${configData.LOCAL_API_URL}v2/list/batch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ids: ids.split(/[\s,]+/).filter(Boolean),
        amount,
        seller: "rFuzionXioDemoOwner11111111111111"
      })
    });
    const body = await res.json();
    setNote(body.ok ? `Listed ${body.count}` : body.error || "Batch failed");
    load();
  };

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Pro view</p>
            <h1>{data?.collection || "Trader desk"}</h1>
            <p className="dpmf-muted">
              Live floor {data?.liveFloor ?? "—"} {data?.currency} · best bid{" "}
              {data?.depth?.best?.amount ?? "—"} ·{" "}
              {data?.verification?.verified ? "Verified" : data?.verification?.warning}
            </p>
            <p>
              <Link to={`/explore/${data?.slug || slug || "fuzion-3d"}`}>Standard collection</Link>
              {" · "}
              <Link to="/discover">Discover</Link>
            </p>
            <div className="dpmf-grid">
              <div className="dpmf-card">
                <h3>Bid depth</h3>
                {(data?.bids || []).map((bid) => (
                  <p key={bid.id}>
                    {bid.label || `${bid.amount} ${bid.currency}`} · {bid.kind}
                  </p>
                ))}
              </div>
              <div className="dpmf-card">
                <h3>Recent sales</h3>
                {(data?.recentSales || []).map((row) => (
                  <p key={row._id || row.nftId}>
                    {row.name} · {row.amount} {row.currency}
                  </p>
                ))}
              </div>
              <div className="dpmf-card">
                <h3>Portfolio</h3>
                <p>
                  {portfolio?.count || 0} NFTs · value {portfolio?.value ?? "—"} ·
                  PnL {portfolio?.pnl ?? "—"}
                </p>
              </div>
              <div className="dpmf-card">
                <h3>Batch list</h3>
                <textarea
                  value={ids}
                  onChange={(e) => setIds(e.target.value)}
                  placeholder="NFT ids"
                />
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
                <button type="button" className="lgOut11" onClick={batch}>
                  List selected
                </button>
              </div>
            </div>
            {note && <p className="dpmf-muted">{note}</p>}
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Listing</th>
                  <th>Price</th>
                  <th>Rarity</th>
                </tr>
              </thead>
              <tbody>
                {(data?.listings || []).map((nft) => (
                  <tr key={nft._id}>
                    <td>
                      <Link to={`/Nftdetail/${nft._id}`}>{nft.name}</Link>
                    </td>
                    <td>
                      {nft.amount} {nft.currency}
                    </td>
                    <td>#{nft.rarity?.rank || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default ProDesk;

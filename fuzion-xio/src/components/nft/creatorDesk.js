import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

function CreatorDesk() {
  const { address } = useParams();
  const [searchKey, setSearchKey] = useState(true);
  const [portfolio, setPortfolio] = useState(null);
  const [royalties, setRoyalties] = useState(null);
  const [profile, setProfile] = useState(null);
  const [validation, setValidation] = useState(null);

  useEffect(() => {
    if (!address) return;
    fetch(`${configData.LOCAL_API_URL}v2/portfolio/${address}`)
      .then((res) => res.json())
      .then((body) => setPortfolio(body.data || null))
      .catch(() => setPortfolio(null));
    fetch(`${configData.LOCAL_API_URL}v2/royalties/${address}`)
      .then((res) => res.json())
      .then((body) => setRoyalties(body.data || null))
      .catch(() => setRoyalties(null));
    fetch(`${configData.LOCAL_API_URL}profiles/${address}`)
      .then((res) => res.json())
      .then((body) => setProfile(body.data || body || null))
      .catch(() => setProfile(null));
    fetch(`${configData.LOCAL_API_URL}v2/validation/${address}`)
      .then((res) => res.json())
      .then((body) => setValidation(body.data || null))
      .catch(() => setValidation(null));
  }, [address]);

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Creator desk</p>
            <h1>{profile?.pName || address}</h1>
            <p className="dpmf-muted">
              {validation?.rank || profile?.rank} · V-Score {validation?.vScore ?? profile?.vScore ?? 0} ·{" "}
              {validation?.badge || profile?.badge || "tick"} checkmark
            </p>
            <p className="dpmf-muted">{profile?.bio || profile?.tagline || address}</p>
            <p>
              <Link to={`/Profile/${address}`}>Profile</Link>
              {" · "}
              <Link to="/discover">Discover</Link>
              {" · "}
              <Link to="/governance">Governance</Link>
            </p>
            <div className="dpmf-grid">
              <div className="dpmf-card">
                <h3>Portfolio</h3>
                <p>
                  {portfolio?.count || 0} NFTs · value {portfolio?.value ?? "—"} ·
                  P&L {portfolio?.pnl ?? "—"}
                </p>
                {(portfolio?.collections || []).map((row) => (
                  <p key={row.collection}>
                    {row.collection}: {row.count} · {row.value}
                  </p>
                ))}
              </div>
              <div className="dpmf-card">
                <h3>Royalties earned</h3>
                <p>Total {royalties?.total ?? 0}</p>
                <p className="dpmf-muted">
                  24h {royalties?.periods?.d24h ?? 0} · 7d{" "}
                  {royalties?.periods?.d7d ?? 0} · 30d {royalties?.periods?.d30d ?? 0}
                </p>
                {(royalties?.byCollection || []).map((row) => (
                  <p key={row.collection}>
                    {row.collection}: {row.royalty} ({row.sales} sales)
                  </p>
                ))}
              </div>
            </div>
            <h3>Recent activity</h3>
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(portfolio?.activity || []).map((row) => (
                  <tr key={row._id || `${row.type}-${row.nftId}`}>
                    <td>{row.type}</td>
                    <td>{row.name || row.collectionName || "—"}</td>
                    <td>
                      {row.amount || "—"} {row.currency || ""}
                    </td>
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

export default CreatorDesk;

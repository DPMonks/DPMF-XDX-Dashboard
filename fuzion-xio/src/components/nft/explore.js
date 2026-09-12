import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

function Explore() {
  const [searchKey, setSearchKey] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}market/explore`)
      .then((res) => res.json())
      .then((body) => setRows(body.data || []))
      .catch(() => setRows([]));
  }, []);

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Explore</p>
            <h1>Collections</h1>
            <p className="dpmf-muted">
              Floor, listed supply, volume, and best offer. 0.1% platform fee.
              Any XRPL asset as payment.
            </p>
            <div className="dpmf-grid">
              {rows.map((row) => (
                <Link
                  key={row.slug}
                  to={`/explore/${row.slug}`}
                  className="dpmf-card dpmf-card-link"
                >
                  <h3>
                    {row.name}
                    {row.verified ? (
                      <span className="dpmf-badge">Verified</span>
                    ) : (
                      <span className="dpmf-badge dpmf-badge-warn">Unverified</span>
                    )}
                  </h3>
                  <p>
                    Floor {row.floor ?? "—"} {row.currency} · {row.listed} listed
                    · {row.size.toLocaleString()} supply
                  </p>
                  <p>
                    Volume {row.volume} · Best offer {row.bestOffer ?? "—"} · Fee{" "}
                    {row.platformFeeBps / 100}%
                  </p>
                </Link>
              ))}
            </div>
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default Explore;

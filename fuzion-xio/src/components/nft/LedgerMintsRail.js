import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Col, Container, Row } from "react-bootstrap";
import configData from "../../config.json";
import Filetype from "../common/Filetype";

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso || 0).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function LedgerMintsRail() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}v2/ledger-mints`)
      .then((res) => res.json())
      .then((body) => setRows(body.data || []))
      .catch(() => setRows([]));
  }, []);

  if (rows && !rows.length) return null;

  return (
    <div className="dpmf-mint-rail">
      <Container>
        <p className="dpmf-kicker">Live XRPL tape</p>
        <h2 className="home-hading">Just minted on XRPL</h2>
        <p className="dpmf-muted">
          Every successful NFTokenMint on the XRP Ledger is advertised here —
          minted on Fuzion or anywhere else.
        </p>
      </Container>
      <Container>
        {!rows ? (
          <p className="dpmf-muted">Reading new XRPL mints…</p>
        ) : (
          <Row className="dpmf-mint-grid">
            {rows.slice(0, 12).map((nft) => (
              <Col xs={6} sm={4} md={3} lg={2} key={nft._id || nft.NFTokenID || nft.hash}>
                <Link
                  to={`/Nftdetail/${encodeURIComponent(nft.NFTokenID || nft._id)}`}
                  className="dpmf-card dpmf-card-link dpmf-mint-card"
                >
                  <div className="dpmf-mint-media">
                    {nft.image ? (
                      <Filetype
                        image={nft.image}
                        fileType={nft.fileType || nft.contentType || "image"}
                      />
                    ) : (
                      <div className="dpmf-mint-placeholder">XRPL</div>
                    )}
                  </div>
                  <span className="dpmf-badge">{nft.badge || "Minted on XRPL"}</span>
                  <h3>{nft.name}</h3>
                  <p>
                    {timeAgo(nft.createdAt)} ·{" "}
                    {String(nft.issuer || nft.accountNumber || "").slice(0, 8)}…
                  </p>
                </Link>
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </div>
  );
}

export default LedgerMintsRail;

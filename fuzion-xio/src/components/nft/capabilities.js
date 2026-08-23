import React, { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

function Capabilities() {
  const [searchKey, setSearchKey] = useState(true);
  const [payload, setPayload] = useState(null);
  const [tokens, setTokens] = useState(null);

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}capabilities`)
      .then((res) => res.json())
      .then(setPayload)
      .catch(() => setPayload(null));
    fetch(`${configData.LOCAL_API_URL}tokens`)
      .then((res) => res.json())
      .then(setTokens)
      .catch(() => setTokens(null));
  }, []);

  const collections = payload?.catalog?.collections || [];
  const ranks = payload?.governance?.ranks || [];
  const overview = payload?.overview || [];
  const fee = payload?.fee;

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">XD-1 // FUZION-XIO</p>
            <h1>The XRPL NFT-Fi exchange</h1>
            <p className="dpmf-muted">
              All-currency minting and trading on XRPL rails.
              {fee ? ` ${fee.label} platform fee` : " 0.1% platform fee"} on
              every traded asset, any issued currency as payment, first-class
              3D/AR, XIO governance, and a wallet that auto-downloads
              trustlines as assets are used. Collector address will be added
              later.
            </p>
            <p>
              <a href="/explore">Explore</a>
              {" · "}
              <a href="/activity">Activity</a>
              {" · "}
              <a href="/assets">Assets</a>
              {" · "}
              <a href="/profiles">Profiles</a>
              {" · "}
              <a href="/rankings">Rankings</a>
              {" · "}
              <a href="/yem">Y.E.M.</a>
            </p>

            <div className="dpmf-grid">
              {overview.map((section) => (
                <div className="dpmf-card" key={section.id}>
                  <h3>
                    {section.id}. {section.title}
                  </h3>
                  <p className="dpmf-muted">
                    {section.status === "reserved"
                      ? "Reserved — blank page to build later"
                      : section.status === "partial"
                      ? "Live path, more to land"
                      : "Live"}
                  </p>
                  {(section.points || []).map((point) => (
                    <p key={point}>{point}</p>
                  ))}
                </div>
              ))}
            </div>

            <h3>Virtual collections</h3>
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Collection</th>
                  <th>Size</th>
                  <th>Program</th>
                  <th>File</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((row) => (
                  <tr key={row.slug}>
                    <td>{row.name}</td>
                    <td>{row.size.toLocaleString()}</td>
                    <td>{row.program}</td>
                    <td>{row.fileType}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3>XIO ranks</h3>
            <p className="dpmf-muted">{ranks.join(" → ")}</p>

            <h3>Settlement assets</h3>
            <p className="dpmf-muted">
              Trade any XRPL issued asset. Using one downloads its trustline on
              the platform wallet. Full book lives on <a href="/assets">Assets</a>.
            </p>
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Role</th>
                  <th>Issuer</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {(tokens?.tokens || []).slice(0, 12).map((token) => (
                  <tr key={token.key || `${token.currency}:${token.issuer || ""}`}>
                    <td>{token.name || token.currency}</td>
                    <td>{token.role}</td>
                    <td>{token.issuer ? `${token.issuer.slice(0, 8)}…` : "—"}</td>
                    <td>{token.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dpmf-muted">
              {tokens?.count || tokens?.tokens?.length || 0} assets · indexer{" "}
              {tokens?.indexerStatus || tokens?.source?.indexer || "loading"}
            </p>
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default Capabilities;

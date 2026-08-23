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

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">XD-1 // FUZION-XIO</p>
            <h1>The XRPL NFT-Fi exchange</h1>
            <p className="dpmf-muted">
              Built to outrun OpenSea-class discovery, Blur-class trading, and
              xrp.cafe on XRPL rails: 0% platform fee, any issued asset as
              payment, first-class 3D/AR files, XIO governance, and collections
              of thousands.
            </p>

            <div className="dpmf-grid">
              <div className="dpmf-card">
                <h3>3D file NFTs</h3>
                <p>
                  GLB, GLTF, FBX, USDZ plus image, video, audio, and PDF.
                  Large 3D drops live as marketplace collections. AVA, MegaBits,
                  and RWA sculpture are separate XD projects and are not built
                  here.
                </p>
              </div>
              <div className="dpmf-card">
                <h3>XIO governance</h3>
                <p>
                  Profiles carry validator rank from XIO balance and vScore
                  badges (tick / blue / gold). XIO is the exchange governance
                  asset.
                </p>
              </div>
              <div className="dpmf-card">
                <h3>Indexer + ledger</h3>
                <p>
                  Token prices and wallet balances from the XDX indexer. NFT
                  holdings and trustlines from XRPL RPC.
                </p>
              </div>
              <div className="dpmf-card">
                <h3>0% trade fee</h3>
                <p>
                  Issuer royalties stay with creators. xrp.cafe charges 1.589%.
                  Multi-currency pay is any XRPL issued asset.
                </p>
              </div>
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
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Role</th>
                  <th>Issuer</th>
                </tr>
              </thead>
              <tbody>
                {(tokens?.tokens || []).map((token) => (
                  <tr key={token.currency}>
                    <td>{token.name}</td>
                    <td>{token.role}</td>
                    <td>{token.issuer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dpmf-muted">
              Indexer source: {tokens?.source || "loading"} ·{" "}
              {tokens?.indexerStatus || ""}
            </p>
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default Capabilities;

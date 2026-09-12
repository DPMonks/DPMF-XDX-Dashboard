import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";
import { assetsLabel, optionLabel } from "../../helper/assets";
import { ensureWalletTrustlines } from "../../helper/trustlines";
import SignBadge from "./SignBadge";

const DEMO_BIDDER = "rFuzionXioDemoBidder1111111111111";
const emptyLeg = () => ({ currency: "XRP", issuer: "", amount: "" });

function AssetsBook() {
  const [searchKey, setSearchKey] = useState(true);
  const [address, setAddress] = useState("");
  const [catalog, setCatalog] = useState(null);
  const [lookupCode, setLookupCode] = useState("XIO");
  const [lookupIssuer, setLookupIssuer] = useState(
    "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU"
  );
  const [lookupNote, setLookupNote] = useState("");
  const [nftId, setNftId] = useState(
    "00081388B26A0589780AC54111320F6F5226AD8E07AD7AE721D708390000009E"
  );
  const [ledgerOffers, setLedgerOffers] = useState(null);
  const [tapeAddress, setTapeAddress] = useState(
    "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU"
  );
  const [tape, setTape] = useState(null);
  const [offerNft, setOfferNft] = useState("seed-lilly-1");
  const [legs, setLegs] = useState([
    { currency: "XRP", issuer: "", amount: "5" },
    {
      currency: "XIO",
      issuer: "rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU",
      amount: "1"
    }
  ]);
  const [offerNote, setOfferNote] = useState("");
  const [deskOffers, setDeskOffers] = useState([]);
  const [walletLines, setWalletLines] = useState([]);

  const loadCatalog = (wallet = address) => {
    const q = wallet ? `?address=${encodeURIComponent(wallet)}` : "";
    fetch(`${configData.LOCAL_API_URL}assets/catalog${q}`)
      .then((res) => res.json())
      .then((body) => setCatalog(body.data || null))
      .catch(() => setCatalog(null));
  };

  const loadDeskOffers = () => {
    fetch(`${configData.LOCAL_API_URL}market/offers`)
      .then((res) => res.json())
      .then((body) => setDeskOffers(body.data || []))
      .catch(() => setDeskOffers([]));
  };

  const assets = catalog?.assets || [];

  const currencyOptions = useMemo(() => {
    const seen = new Set();
    return assets.filter((row) => {
      if (seen.has(row.key)) return false;
      seen.add(row.key);
      return true;
    });
  }, [assets]);

  const addIssued = async () => {
    const res = await fetch(`${configData.LOCAL_API_URL}assets/lookup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currency: lookupCode, issuer: lookupIssuer })
    });
    const body = await res.json();
    setLookupNote(
      body.success
        ? `On ledger: ${body.data.asset.currency}${
            body.data.asset.issuer ? ` / ${body.data.asset.issuer}` : ""
          }`
        : body.data?.error || "Not found on the XRP Ledger"
    );
    if (body.success && address) {
      const trust = await ensureWalletTrustlines(address, [body.data.asset]);
      if (trust?.data?.downloaded?.length) {
        setWalletLines(trust.data.wallet?.trustlines || trust.data.downloaded);
        setLookupNote((prev) => `${prev} · trustline downloaded`);
      }
    }
    loadCatalog();
  };

  const loadNftOffers = async () => {
    if (!nftId.trim()) return;
    const res = await fetch(
      `${configData.LOCAL_API_URL}assets/ledger/nft/${encodeURIComponent(
        nftId.trim()
      )}/offers`
    );
    const body = await res.json();
    setLedgerOffers(body.data || null);
  };

  const loadTape = async () => {
    if (!tapeAddress.trim()) return;
    const res = await fetch(
      `${configData.LOCAL_API_URL}assets/ledger/account/${encodeURIComponent(
        tapeAddress.trim()
      )}`
    );
    const body = await res.json();
    setTape(body.data || null);
  };

  useEffect(() => {
    loadCatalog();
    loadDeskOffers();
    loadNftOffers();
    loadTape();
  }, []);

  const setLeg = (index, patch) => {
    setLegs((prev) =>
      prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg))
    );
  };

  const pickCatalog = (index, key) => {
    const asset = currencyOptions.find((row) => row.key === key);
    if (!asset) return;
    setLeg(index, {
      currency: asset.currency,
      issuer: asset.issuer || ""
    });
  };

  const placeMulti = async () => {
    const assetsToSend = legs.filter((leg) => leg.amount);
    const res = await fetch(`${configData.LOCAL_API_URL}market/offer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nftId: offerNft,
        assets: assetsToSend,
        from: DEMO_BIDDER,
        source: "desk"
      })
    });
    const body = await res.json();
    setOfferNote(
      body.ok
        ? `Recorded ${body.offer?.label || assetsLabel(body.offer)}`
        : body.error || "Offer failed"
    );
    if (body.ok) {
      const trust = await ensureWalletTrustlines(DEMO_BIDDER, assetsToSend);
      if (trust?.data?.downloaded?.length) {
        setWalletLines(trust.data.downloaded);
      }
    }
    loadDeskOffers();
  };

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">XRPL assets</p>
            <h1>Tradeable ledger assets</h1>
            <p className="dpmf-muted">
              Every issued XRPL currency can pay for an NFT. The book is XRP,
              DPMF core (XIO / XDX / XSQUAD / RLUSD), indexer tokens, the
              wallet’s live trustlines, and any currency+issuer confirmed on
              the ledger. Offers may use several assets at once. Buy/sell
              offers and account tape are read from the XRP Ledger.
            </p>
            <p>
              <Link to="/explore">Explore</Link>
              {" · "}
              <Link to="/activity">Activity</Link>
              {" · "}
              <Link to="/market">Market</Link>
            </p>

            <div className="dpmf-grid">
              <div className="dpmf-card">
                <h3>Wallet trustlines</h3>
                <p>
                  Pull live `account_lines`, and auto-download a trustline
                  whenever this wallet uses an issued asset.
                </p>
                <input
                  type="text"
                  value={address}
                  placeholder="r…"
                  onChange={(e) => setAddress(e.target.value.trim())}
                />
                <button
                  type="button"
                  className="lgOut11"
                  onClick={() => loadCatalog(address)}
                >
                  Load wallet assets
                </button>
              </div>
              <div className="dpmf-card">
                <h3>Add issued asset</h3>
                <p>Confirm currency + issuer on the XRP Ledger.</p>
                <input
                  type="text"
                  value={lookupCode}
                  placeholder="Currency"
                  onChange={(e) => setLookupCode(e.target.value)}
                />
                <input
                  type="text"
                  value={lookupIssuer}
                  placeholder="Issuer"
                  onChange={(e) => setLookupIssuer(e.target.value.trim())}
                />
                <button type="button" className="lgOut11" onClick={addIssued}>
                  Look up on ledger
                </button>
                {lookupNote && <p className="dpmf-muted">{lookupNote}</p>}
                {walletLines.length > 0 && (
                  <p className="dpmf-muted">
                    Downloaded:{" "}
                    {walletLines
                      .map((line) => line.currency || line.key)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
            <p className="dpmf-muted">
              Indexer {catalog?.source?.indexer || "—"} · XRPL{" "}
              {catalog?.source?.xrpl || "—"} · {catalog?.count || 0} assets
            </p>

            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Role</th>
                  <th>Issuer</th>
                  <th>Source</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((row) => (
                  <tr key={row.key}>
                    <td>{row.currency}</td>
                    <td>{row.role}</td>
                    <td>{row.issuer ? `${row.issuer.slice(0, 8)}…` : "—"}</td>
                    <td>{row.source}</td>
                    <td>{row.balance ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2>Ledger NFT offers</h2>
            <p className="dpmf-muted">
              `nft_buy_offers` and `nft_sell_offers` for a 64-character
              NFTokenID.
            </p>
            <div className="dpmf-grid">
              <div className="dpmf-card">
                <input
                  type="text"
                  value={nftId}
                  placeholder="NFTokenID"
                  onChange={(e) => setNftId(e.target.value.trim())}
                />
                <button
                  type="button"
                  className="lgOut11"
                  onClick={loadNftOffers}
                >
                  Read ledger offers
                </button>
              </div>
            </div>
            {ledgerOffers && (
              <table className="dpmf-table">
                <thead>
                  <tr>
                    <th>Side</th>
                    <th>Amount</th>
                    <th>Owner</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {(ledgerOffers.offers || []).length ? (
                    ledgerOffers.offers.map((row) => (
                      <tr key={row.offerId}>
                        <td>{row.side}</td>
                        <td>
                          {row.amount} {row.currency}
                        </td>
                        <td>
                          {row.owner ? `${row.owner.slice(0, 8)}…` : "—"}
                        </td>
                        <td>{row.source}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}>
                        No open offers on ledger
                        {ledgerOffers.source?.buy
                          ? ` (${ledgerOffers.source.buy})`
                          : ""}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            <h2>Ledger account tape</h2>
            <p className="dpmf-muted">
              NFT and offer transactions from `account_tx` plus `account_nfts`.
            </p>
            <div className="dpmf-card">
              <input
                type="text"
                value={tapeAddress}
                placeholder="r…"
                onChange={(e) => setTapeAddress(e.target.value.trim())}
              />
              <button type="button" className="lgOut11" onClick={loadTape}>
                Read ledger tape
              </button>
            </div>
            {tape && (
              <>
                <p className="dpmf-muted">
                  {tape.nfts?.length || 0} NFTs on ledger · source {tape.source}
                </p>
                <table className="dpmf-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>NFT</th>
                      <th>Amount</th>
                      <th>Sign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tape.activity || []).map((row) => (
                      <tr key={row.hash || `${row.type}-${row.date}`}>
                        <td>{row.type}</td>
                        <td>
                          {row.nftId ? `${String(row.nftId).slice(0, 8)}…` : "—"}
                        </td>
                        <td>
                          {row.amount
                            ? `${row.amount.amount} ${row.amount.currency}`
                            : "—"}
                        </td>
                        <td>
                          {row.signed ? (
                            <SignBadge row={row} />
                          ) : (
                            row.hash ? `${String(row.hash).slice(0, 8)}…` : "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <h2>Multi-asset offer</h2>
            <p className="dpmf-muted">
              Apply several XRPL assets to one offer. Recorded on the desk and
              shown on Activity. Ledger signing follows when Xaman keys are
              present.
            </p>
            <div className="dpmf-card">
              <label>
                NFT id
                <input
                  type="text"
                  value={offerNft}
                  onChange={(e) => setOfferNft(e.target.value.trim())}
                />
              </label>
              {legs.map((leg, index) => (
                <div className="dpmf-grid" key={`leg-${index}`}>
                  <label>
                    Asset
                    <select
                      value={
                        currencyOptions.find(
                          (row) =>
                            row.currency === leg.currency &&
                            (row.issuer || "") === (leg.issuer || "")
                        )?.key || (leg.issuer ? `${leg.currency}:${leg.issuer}` : leg.currency)
                      }
                      onChange={(e) => pickCatalog(index, e.target.value)}
                    >
                      {currencyOptions.map((row) => (
                        <option key={row.key} value={row.key}>
                          {optionLabel(row)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Amount
                    <input
                      type="text"
                      value={leg.amount}
                      onChange={(e) => setLeg(index, { amount: e.target.value })}
                    />
                  </label>
                </div>
              ))}
              <button
                type="button"
                className="lgOut11"
                onClick={() => setLegs((prev) => [...prev, emptyLeg()])}
              >
                Add asset
              </button>{" "}
              <button type="button" className="lgOut11" onClick={placeMulti}>
                Record offer
              </button>
              {offerNote && <p className="dpmf-muted">{offerNote}</p>}
            </div>

            <h3>Recorded offers</h3>
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Assets</th>
                  <th>From</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {deskOffers.map((row) => (
                  <tr key={row._id}>
                    <td>
                      {row.nftId ? (
                        <Link to={`/Nftdetail/${row.nftId}`}>{row.name}</Link>
                      ) : (
                        row.name
                      )}
                    </td>
                    <td>{assetsLabel(row)}</td>
                    <td>{row.from ? `${row.from.slice(0, 8)}…` : "—"}</td>
                    <td>{row.source || "desk"}</td>
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

export default AssetsBook;

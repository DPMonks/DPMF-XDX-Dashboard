import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

function Discover() {
  const [searchKey, setSearchKey] = useState(true);
  const [q, setQ] = useState("");
  const [saleType, setSaleType] = useState("");
  const [currency, setCurrency] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [collection, setCollection] = useState("");
  const [creator, setCreator] = useState("");
  const [rails, setRails] = useState(null);
  const [hits, setHits] = useState(null);

  const loadRails = () => {
    fetch(`${configData.LOCAL_API_URL}v2/rails`)
      .then((res) => res.json())
      .then((body) => setRails(body.data))
      .catch(() => setRails(null));
  };

  const search = () => {
    const params = new URLSearchParams({ q, chain: "xrpl" });
    if (saleType) params.set("saleType", saleType);
    if (currency) params.set("currency", currency);
    if (minPrice) params.set("minPrice", minPrice);
    if (maxPrice) params.set("maxPrice", maxPrice);
    if (collection) params.set("collection", collection);
    if (creator) params.set("creator", creator);
    fetch(`${configData.LOCAL_API_URL}v2/discover?${params}`)
      .then((res) => res.json())
      .then((body) => setHits(body.data))
      .catch(() => setHits(null));
  };

  useEffect(() => {
    loadRails();
    search();
  }, []);

  const rail = (title, rows, link) => (
    <div className="dpmf-card" key={title}>
      <h3>{title}</h3>
      {(rows || []).slice(0, 4).map((row) => (
        <p key={row.slug || row._id || row.name}>
          <Link to={link(row)}>
            {row.name || row.collectionName || row.slug}
          </Link>
          {row.verification?.verified ? " · Verified" : ""}
        </p>
      ))}
    </div>
  );

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Discovery</p>
            <h1>Search XRPL NFTs, collections, creators, and assets</h1>
            <div className="dpmf-grid">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
              <select value={saleType} onChange={(e) => setSaleType(e.target.value)}>
                <option value="">Any sale type</option>
                <option value="sale">Listed</option>
                <option value="minted">Minted</option>
                <option value="created">Created</option>
              </select>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="Currency"
              />
              <input
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="Min price"
              />
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Max price"
              />
              <input
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="Collection"
              />
              <input
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                placeholder="Creator address"
              />
              <button type="button" className="lgOut11" onClick={search}>
                Search
              </button>
            </div>
            <div className="dpmf-grid">
              {rail("Trending collections", rails?.trending, (row) => `/explore/${row.slug}`)}
              {rail("Top volume", rails?.topVolume7d, (row) => `/explore/${row.slug}`)}
              {rail("New drops", rails?.newDrops, (row) => `/drops/${row.slug}`)}
              {rail("Editor’s picks", rails?.editorPicks, (row) => `/Nftdetail/${row._id}`)}
            </div>
            {hits && (
              <>
                <h3>Results</h3>
                <table className="dpmf-table">
                  <thead>
                    <tr>
                      <th>NFT</th>
                      <th>Collection</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(hits.nfts || []).map((nft) => (
                      <tr key={nft._id}>
                        <td>
                          <Link to={`/Nftdetail/${nft._id}`}>{nft.name}</Link>
                        </td>
                        <td>{nft.collectionName || "—"}</td>
                        <td>
                          {nft.amount} {nft.currency}
                        </td>
                        <td>{nft.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(hits.collections || []).length > 0 && (
                  <>
                    <h3>Collections</h3>
                    {(hits.collections || []).map((row) => (
                      <p key={row.slug || row.collectionName}>
                        <Link to={`/explore/${row.slug}`}>{row.collectionName || row.slug}</Link>
                        {row.verification?.verified ? (
                          <span className="dpmf-badge">Verified</span>
                        ) : null}
                      </p>
                    ))}
                  </>
                )}
                {(hits.creators || []).length > 0 && (
                  <>
                    <h3>Creators</h3>
                    {(hits.creators || []).map((row) => (
                      <p key={row.wAddress}>
                        <Link to={`/creator/${row.wAddress}`}>{row.pName || row.wAddress}</Link>
                      </p>
                    ))}
                  </>
                )}
              </>
            )}
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default Discover;

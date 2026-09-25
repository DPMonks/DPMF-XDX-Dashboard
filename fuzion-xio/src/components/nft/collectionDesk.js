import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";
import { assetsLabel, optionLabel } from "../../helper/assets";
import { ensureWalletTrustlines } from "../../helper/trustlines";
import SignBadge from "./SignBadge";

const DEMO_BIDDER = "rFuzionXioDemoBidder1111111111111";

function CollectionDesk() {
  const { slug } = useParams();
  const [searchKey, setSearchKey] = useState(true);
  const [payload, setPayload] = useState(null);
  const [finish, setFinish] = useState("");
  const [palette, setPalette] = useState("");
  const [band, setBand] = useState("");
  const [sort, setSort] = useState("price_asc");
  const [sweepCount, setSweepCount] = useState(5);
  const [offerAmt, setOfferAmt] = useState("0.75");
  const [extraLegs, setExtraLegs] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [note, setNote] = useState("");
  const [insight, setInsight] = useState(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ sort, filter: "sale" });
    if (finish) params.set("finish", finish);
    if (palette) params.set("palette", palette);
    if (band) params.set("band", band);
    return params.toString();
  }, [finish, palette, band, sort]);

  const load = () => {
    fetch(`${configData.LOCAL_API_URL}market/collection/${slug}?${query}`)
      .then((res) => res.json())
      .then(setPayload)
      .catch(() => setPayload(null));
  };

  useEffect(() => {
    load();
  }, [slug, query]);

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}v2/collections/${slug}`)
      .then((res) => res.json())
      .then((body) => setInsight(body.data || null))
      .catch(() => setInsight(null));
  }, [slug]);

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}assets/catalog`)
      .then((res) => res.json())
      .then((body) => setCatalog(body.data?.assets || []))
      .catch(() => setCatalog([]));
  }, []);

  const stats = payload?.stats || {};
  const data = payload?.data || {};
  const facets = payload?.facets || [];

  const facetValues = (type) =>
    facets.find((row) => row.trait_type === type)?.values || [];

  const sweep = async () => {
    const res = await fetch(`${configData.LOCAL_API_URL}market/sweep/${slug}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count: sweepCount, buyer: DEMO_BIDDER })
    });
    const body = await res.json();
    if (body.ok) {
      await ensureWalletTrustlines(DEMO_BIDDER, [
        { currency: body.currency, issuer: "" }
      ]);
    }
    setNote(
      body.ok
        ? `Swept ${body.filled} for ${body.total} ${body.currency} (0.1% fee).`
        : body.error || "Sweep failed"
    );
    load();
  };

  const collectionOffer = async () => {
    const first = catalog.find((row) => row.currency === (stats.currency || "XIO")) || {
      currency: stats.currency || "XIO",
      issuer: ""
    };
    const assets = [
      { currency: first.currency, issuer: first.issuer || "", amount: offerAmt },
      ...extraLegs.filter((leg) => leg.amount && leg.currency)
    ];
    const res = await fetch(`${configData.LOCAL_API_URL}market/offer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "collection",
        collectionName: stats.name,
        collectionSlug: slug,
        assets,
        from: DEMO_BIDDER
      })
    });
    const body = await res.json();
    setNote(
      body.ok
        ? `Collection offer ${body.offer?.label || assetsLabel({ assets })}`
        : body.error
    );
    load();
  };

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Collection desk</p>
            {insight?.banner && (
              <div
                className="dpmf-profile-banner"
                style={{ backgroundImage: `url(${insight.banner})` }}
              />
            )}
            <h1>
              {stats.name || slug}
              {insight?.verification?.verified ? " ✓ Verified" : ""}
            </h1>
            {insight?.verification?.warning && (
              <p className="dpmf-muted">{insight.verification.warning}</p>
            )}
            <p className="dpmf-muted">{insight?.description}</p>
            <p className="dpmf-muted">
              Floor {stats.floor ?? "—"} {stats.currency} · {stats.listed} listed
              · volume {stats.volume} · holders {insight?.holders ?? "—"} · best
              bid {insight?.bidDepth?.best?.amount ?? stats.bestOffer ?? "—"} ·
              royalty {((stats.royaltyBps || 0) / 100).toFixed(1)}% · platform{" "}
              {((stats.platformFeeBps || 0) / 100).toFixed(1)}%
            </p>
            <p>
              <Link to="/explore">All collections</Link>
              {" · "}
              <Link to={`/pro/${slug}`}>Pro view</Link>
              {" · "}
              <Link to="/activity">Activity</Link>
              {insight?.issuer || insight?.owner ? (
                <>
                  {" · "}
                  <Link to={`/creator/${insight.issuer || insight.owner}`}>
                    Creator
                  </Link>
                </>
              ) : null}
            </p>
            {insight?.floorsByCurrency && (
              <p className="dpmf-muted">
                Floors:{" "}
                {Object.entries(insight.floorsByCurrency)
                  .map(([currency, floor]) => `${floor} ${currency}`)
                  .join(" · ") || "—"}
              </p>
            )}
            {insight?.floorHistory?.points && (
              <p className="dpmf-muted">
                Floor 7d:{" "}
                {insight.floorHistory.points
                  .filter((_, index) => index % 2 === 0)
                  .map((point) => point.floor)
                  .join(" → ")}
              </p>
            )}
            {insight?.topHolders?.length > 0 && (
              <p className="dpmf-muted">
                Top holders:{" "}
                {insight.topHolders
                  .slice(0, 3)
                  .map((row) => `${String(row.address).slice(0, 8)}… (${row.count})`)
                  .join(" · ")}
              </p>
            )}

            <div className="dpmf-grid">
              <label className="dpmf-card">
                Finish
                <select value={finish} onChange={(e) => setFinish(e.target.value)}>
                  <option value="">All</option>
                  {facetValues("Finish").map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.value} ({row.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="dpmf-card">
                Palette
                <select
                  value={palette}
                  onChange={(e) => setPalette(e.target.value)}
                >
                  <option value="">All</option>
                  {facetValues("Palette").map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.value} ({row.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="dpmf-card">
                Band
                <select value={band} onChange={(e) => setBand(e.target.value)}>
                  <option value="">All</option>
                  {facetValues("Band").map((row) => (
                    <option key={row.value} value={row.value}>
                      {row.value} ({row.count})
                    </option>
                  ))}
                </select>
              </label>
              <label className="dpmf-card">
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="price_asc">Price low</option>
                  <option value="price_desc">Price high</option>
                  <option value="likes">Most liked</option>
                  <option value="rarity">Rarity rank</option>
                </select>
              </label>
            </div>

            <div className="dpmf-grid">
              <div className="dpmf-card">
                <h3>Sweep</h3>
                <p>Buy the cheapest listed items in one fill. 0.1% desk fee.</p>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={sweepCount}
                  onChange={(e) => setSweepCount(e.target.value)}
                />
                <button type="button" className="lgOut11" onClick={sweep}>
                  Sweep {sweepCount}
                </button>
              </div>
              <div className="dpmf-card">
                <h3>Collection offer</h3>
                <p>
                  Bid the drop in {stats.currency || "XIO"} and add more XRPL
                  assets.
                </p>
                <input
                  value={offerAmt}
                  onChange={(e) => setOfferAmt(e.target.value)}
                />
                {extraLegs.map((leg, index) => (
                  <div key={`extra-${index}`}>
                    <select
                      value={leg.key || `${leg.currency}:${leg.issuer || ""}`}
                      onChange={(e) => {
                        const asset = catalog.find((row) => row.key === e.target.value);
                        if (!asset) return;
                        setExtraLegs((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  currency: asset.currency,
                                  issuer: asset.issuer || "",
                                  key: asset.key
                                }
                              : item
                          )
                        );
                      }}
                    >
                      {catalog.map((row) => (
                        <option key={row.key} value={row.key}>
                          {optionLabel(row)}
                        </option>
                      ))}
                    </select>
                    <input
                      value={leg.amount}
                      placeholder="Amount"
                      onChange={(e) =>
                        setExtraLegs((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, amount: e.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="lgOut11"
                  onClick={() =>
                    setExtraLegs((prev) => [
                      ...prev,
                      {
                        currency: "XRP",
                        issuer: "",
                        amount: "",
                        key: "XRP"
                      }
                    ])
                  }
                >
                  Add asset
                </button>
                <button
                  type="button"
                  className="lgOut11"
                  onClick={collectionOffer}
                >
                  Place offer
                </button>
              </div>
            </div>
            {note && <p className="dpmf-muted">{note}</p>}

            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Price</th>
                  <th>Rank</th>
                  <th>Traits</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.docs || []).map((nft) => (
                  <tr key={nft._id}>
                    <td>
                      <Link to={`/Nftdetail/${nft._id}`}>{nft.name}</Link>
                    </td>
                    <td>
                      {nft.amount} {nft.currency}
                    </td>
                    <td>#{nft.rarityRank || "—"}</td>
                    <td>
                      {(nft.traits || [])
                        .filter((trait) => trait.trait_type !== "Collection")
                        .map((trait) => trait.value)
                        .join(" · ")}
                    </td>
                    <td>{nft.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="dpmf-muted">
              {data.total} matches · page {data.page} of {data.totalPages}
            </p>
            {(insight?.activity || []).length > 0 && (
              <>
                <h3>Collection activity</h3>
                <table className="dpmf-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Item</th>
                      <th>Amount</th>
                      <th>Sign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insight.activity.map((row) => (
                      <tr key={row._id}>
                        <td>{row.type}</td>
                        <td>{row.name || row.collectionName}</td>
                        <td>
                          {row.amount || "—"} {row.currency || ""}
                        </td>
                        <td>
                          <SignBadge row={row} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default CollectionDesk;

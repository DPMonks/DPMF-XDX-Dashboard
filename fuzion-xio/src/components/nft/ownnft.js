import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { decodeToken } from "react-jwt";
import { toast } from "react-toastify";
import { Card, Col, Container, Row } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import Filetype from "../common/Filetype";
import PaginationComponent from "../common/Pagination";
import { profileBatchColor } from "../../helper/getProfileDetails";
import configData from "../../config.json";

function defaultPixel() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

function Ownnft() {
  const token = localStorage.getItem("jwtToken");
  const decoded = decodeToken(token);
  const address = decoded?.ac || "";
  const navigate = useNavigate();
  const [pixel, setPixel] = useState(defaultPixel);
  const [page, setPage] = useState(1);
  const [desk, setDesk] = useState(null);
  const [busy, setBusy] = useState("");
  const [saleId, setSaleId] = useState("");
  const [saleAmt, setSaleAmt] = useState("1");

  const load = useCallback(async () => {
    if (!address) return;
    const params = new URLSearchParams({
      wAddress: address,
      page: String(page),
      size: pixel ? "96" : "24"
    });
    const res = await fetch(`${configData.LOCAL_API_URL}nft/getSingleUserNfts?${params}`);
    const body = await res.json();
    setDesk(body.data || { docs: [] });
  }, [address, page, pixel]);

  useEffect(() => {
    load().catch(() => setDesk({ docs: [] }));
  }, [load]);

  const act = async (path, payload, okMsg) => {
    setBusy(payload.nftId || payload.Id);
    const res = await fetch(`${configData.LOCAL_API_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await res.json();
    setBusy("");
    if (body.ok === false || body.success === false) {
      toast.error(body.error || body.message || "Action failed");
      return;
    }
    toast.success(okMsg);
    setSaleId("");
    load();
  };

  const docs = desk?.docs || [];

  return (
    <>
      <Header setSearchKey={() => {}} />
      <div className={`gradientBg py-4 ${pixel ? "dpmf-pixel-page" : ""}`}>
        <Container className="dpmf-market">
          <p className="dpmf-kicker">Wallet desk</p>
          <h1>My NFTs</h1>
          <p className="dpmf-muted">
            Every NFT in this wallet — desk listings and the XRP Ledger
            `account_nfts` book, including 3D. Pixel mode shows a dense mobile
            grid.
          </p>
          <p>
            {desk?.total || 0} found · ledger {desk?.ledgerCount || 0} · store{" "}
            {desk?.storeCount || 0}
            {desk?.incomplete ? " · more pages on ledger" : ""}
          </p>
          <p>
            <button type="button" className="lgOut11" onClick={() => setPixel(false)}>
              Standard
            </button>
            <button
              type="button"
              className="lgOut11"
              onClick={() => {
                setPixel(true);
                setPage(1);
              }}
            >
              Pixel mode
            </button>
          </p>

          {!desk ? (
            <p className="dpmf-muted">Loading wallet NFTs…</p>
          ) : !docs.length ? (
            <p>No NFTs found in this wallet.</p>
          ) : pixel ? (
            <div className="dpmf-pixel-grid">
              {docs.map((nft) => (
                <Link
                  key={nft._id}
                  to={`/Nftdetail/${encodeURIComponent(nft.NFTokenID || nft._id)}`}
                  className="dpmf-pixel-cell"
                  title={nft.name}
                >
                  {nft.image ? (
                    <img src={nft.image} alt={nft.name} loading="lazy" />
                  ) : (
                    <span>{nft.threeD ? "3D" : nft.fileType || "NFT"}</span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <Row>
              {docs.map((nft) => (
                <Col xs={12} sm={6} lg={4} key={nft._id} className="mb-3">
                  <Card className="dpmf-card">
                    <div
                      className="dpmf-mint-media"
                      onClick={() =>
                        navigate(`/Nftdetail/${encodeURIComponent(nft.NFTokenID || nft._id)}`)
                      }
                    >
                      <Filetype
                        fileType={nft.fileType || nft.contentType}
                        image={nft.image || nft.metaverse}
                      />
                    </div>
                    <h3>
                      {nft.name}
                      <span className="dpmf-check">
                        {profileBatchColor(nft.vscore)}
                      </span>
                    </h3>
                    <p className="dpmf-muted">
                      {nft.status} · {nft.fileType || "file"} · {nft.source}
                    </p>
                    <p>
                      <button
                        type="button"
                        className="lgOut11"
                        disabled={!nft.actions?.canSale || busy === nft._id}
                        onClick={() => setSaleId(nft._id)}
                      >
                        Put on sale
                      </button>
                      <button
                        type="button"
                        className="lgOut11"
                        disabled={!nft.actions?.canDelist || busy === nft._id}
                        onClick={() =>
                          act("market/delist", { nftId: nft._id }, "Delisted")
                        }
                      >
                        Delist
                      </button>
                      <button
                        type="button"
                        className="lgOut11"
                        disabled={!nft.actions?.canAddToProfile || busy === nft._id}
                        onClick={() =>
                          act(
                            "collection/create",
                            { Id: nft._id, wAddress: address },
                            "Added to profile"
                          )
                        }
                      >
                        Add to profile
                      </button>
                      <button
                        type="button"
                        className="lgOut11"
                        disabled={!nft.actions?.canBurn || busy === nft._id}
                        onClick={() =>
                          act(
                            "market/burn",
                            { nftId: nft._id, from: address },
                            "Burned"
                          )
                        }
                      >
                        Burn
                      </button>
                    </p>
                    {saleId === nft._id && (
                      <p>
                        <input
                          value={saleAmt}
                          onChange={(e) => setSaleAmt(e.target.value)}
                          placeholder="Amount"
                        />
                        <button
                          type="button"
                          className="lgOut11"
                          onClick={() =>
                            act(
                              "market/list",
                              {
                                nftId: nft._id,
                                amount: saleAmt,
                                currency: nft.currency || "XRP",
                                seller: address
                              },
                              "Listed"
                            )
                          }
                        >
                          Confirm sale
                        </button>
                      </p>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {desk?.totalPages > 1 && (
            <PaginationComponent
              currentPage={page}
              totalPages={desk.totalPages}
              loading={false}
              onPageChange={setPage}
            />
          )}
        </Container>
      </div>
      <Footer />
    </>
  );
}

export default Ownnft;

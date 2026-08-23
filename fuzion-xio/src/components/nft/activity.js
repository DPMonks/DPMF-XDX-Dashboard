import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

function Activity() {
  const [searchKey, setSearchKey] = useState(true);
  const [rows, setRows] = useState([]);
  const [type, setType] = useState("");

  useEffect(() => {
    const q = type ? `?type=${encodeURIComponent(type)}` : "";
    fetch(`${configData.LOCAL_API_URL}market/activity${q}`)
      .then((res) => res.json())
      .then((body) => setRows(body.data?.docs || []))
      .catch(() => setRows([]));
  }, [type]);

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Tape</p>
            <h1>Activity</h1>
            <p className="dpmf-muted">
              Lists, sales, offers, collection bids, auctions, and sweeps.
            </p>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              <option value="sale">Sales</option>
              <option value="list">Lists</option>
              <option value="offer">Offers</option>
              <option value="collection_offer">Collection offers</option>
              <option value="bid">Bids</option>
              <option value="auction">Auctions</option>
              <option value="sweep">Sweeps</option>
            </select>
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Amount</th>
                  <th>From</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>{row.type}</td>
                    <td>
                      {row.nftId ? (
                        <Link to={`/Nftdetail/${row.nftId}`}>{row.name}</Link>
                      ) : (
                        row.name || row.collectionName
                      )}
                    </td>
                    <td>
                      {row.amount || "—"} {row.currency || ""}
                    </td>
                    <td>{row.from ? `${row.from.slice(0, 8)}…` : "—"}</td>
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

export default Activity;

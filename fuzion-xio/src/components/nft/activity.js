import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";
import { assetsLabel } from "../../helper/assets";
import SignBadge from "./SignBadge";

function Activity() {
  const [searchKey, setSearchKey] = useState(true);
  const [rows, setRows] = useState([]);
  const [type, setType] = useState("");
  const [signed, setSigned] = useState("");
  const [address, setAddress] = useState("");
  const [ledgerRows, setLedgerRows] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (signed) params.set("signed", signed);
    if (address) params.set("address", address);
    const q = params.toString() ? `?${params}` : "";
    fetch(`${configData.LOCAL_API_URL}market/activity${q}`)
      .then((res) => res.json())
      .then((body) => {
        setRows(body.data?.docs || []);
        setLedgerRows(body.ledger?.activity || []);
      })
      .catch(() => {
        setRows([]);
        setLedgerRows([]);
      });
  }, [type, signed, address]);

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Tape</p>
            <h1>Activity</h1>
            <p className="dpmf-muted">
              Every FUZION-XIO trade is marked. Signed = Xaman + ledger memo.
              Paper = desk fill that was not signed. They do not mix.
            </p>
            <p>
              <Link to="/assets">Asset book</Link>
            </p>
            <input
              type="text"
              placeholder="Ledger address for XRPL tape"
              value={address}
              onChange={(e) => setAddress(e.target.value.trim())}
            />
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All</option>
              <option value="sale">Sales</option>
              <option value="list">Lists</option>
              <option value="offer">Offers</option>
              <option value="collection_offer">Collection offers</option>
              <option value="bid">Bids</option>
              <option value="auction">Auctions</option>
              <option value="sweep">Sweeps</option>
              <option value="mint">Mints</option>
              <option value="validation">Validations</option>
              <option value="drop">Drops</option>
            </select>
            <select value={signed} onChange={(e) => setSigned(e.target.value)}>
              <option value="">Signed and paper</option>
              <option value="true">Signed only</option>
              <option value="false">Paper only</option>
            </select>
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Assets</th>
                  <th>From</th>
                  <th>Sign</th>
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
                    <td>{assetsLabel(row)}</td>
                    <td>{row.from ? `${row.from.slice(0, 8)}…` : "—"}</td>
                    <td>
                      <SignBadge row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledgerRows.length > 0 && (
              <>
                <h3>From the XRP Ledger</h3>
                <table className="dpmf-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>NFT</th>
                      <th>Assets</th>
                      <th>Sign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((row) => (
                      <tr key={row.hash || `${row.type}-${row.date}`}>
                        <td>{row.type}</td>
                        <td>
                          {row.nftId ? `${String(row.nftId).slice(0, 10)}…` : "—"}
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
                            row.source || "xrpl"
                          )}
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

export default Activity;

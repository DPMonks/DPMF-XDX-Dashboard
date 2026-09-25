import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

function Rankings() {
  const [searchKey, setSearchKey] = useState(true);
  const [data, setData] = useState({ collections: [], traders: [] });

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}market/rankings`)
      .then((res) => res.json())
      .then((body) => setData(body.data || { collections: [], traders: [] }))
      .catch(() => setData({ collections: [], traders: [] }));
  }, []);

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Rankings</p>
            <h1>Volume</h1>
            <h3>Collections</h3>
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Collection</th>
                  <th>Floor</th>
                  <th>Volume</th>
                  <th>Listed</th>
                </tr>
              </thead>
              <tbody>
                {data.collections.map((row) => (
                  <tr key={row.slug}>
                    <td>
                      <Link to={`/explore/${row.slug}`}>{row.name}</Link>
                    </td>
                    <td>
                      {row.floor ?? "—"} {row.currency}
                    </td>
                    <td>{row.volume}</td>
                    <td>{row.listed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Traders</h3>
            <table className="dpmf-table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Volume</th>
                  <th>Sales</th>
                </tr>
              </thead>
              <tbody>
                {data.traders.map((row) => (
                  <tr key={row.address}>
                    <td>
                      <Link to={`/Profile/${row.address}`}>
                        {row.address.slice(0, 9)}…{row.address.slice(-5)}
                      </Link>
                    </td>
                    <td>{row.volume}</td>
                    <td>{row.sales}</td>
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

export default Rankings;

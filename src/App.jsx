import { useEffect, useState } from "react";
import "./App.css";

export default function App() {
  const [holders, setHolders] = useState([]);
  const [lpHolders, setLpHolders] = useState([]);
  const [ammData, setAmmData] = useState(null);

  useEffect(() => {
    fetch("https://dpmf-xdx-indexer.vercel.app/api/top-holders")
      .then(res => res.json())
      .then(data => setHolders(data));

    fetch("https://dpmf-xdx-indexer.vercel.app/api/top-lp")
      .then(res => res.json())
      .then(data => setLpHolders(data));

    fetch("https://dpmf-xdx-indexer.vercel.app/api/amm")
      .then(res => res.json())
      .then(data => setAmmData(data));
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header neon-border">
        <h1 className="dashboard-title">DPMF‑XDX Dashboard</h1>
        <p className="dashboard-subtitle">Operational Intelligence Interface</p>
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-column">
          <div className="dashboard-card neon-card">
            <h2>AMM Pools</h2>
            {ammData ? (
              <>
                <div className="balance-row">
                  <span>Pool</span>
                  <span>{ammData.poolName}</span>
                </div>
                <div className="balance-row">
                  <span>Liquidity</span>
                  <span>{ammData.liquidity}</span>
                </div>
              </>
            ) : (
              <p>No pools found.</p>
            )}
          </div>

          <div className="dashboard-card neon-card">
            <h2>Top Holders</h2>
            {holders.length > 0 ? (
              holders.map((h, i) => (
                <div key={i} className="balance-row">
                  <span>{h.account}</span>
                  <span>{h.balance}</span>
                </div>
              ))
            ) : (
              <p>No holders found.</p>
            )}
          </div>
        </div>

        <div className="dashboard-column">
          <div className="dashboard-card neon-card">
            <h2>LP Holders</h2>
            {lpHolders.length > 0 ? (
              lpHolders.map((lp, i) => (
                <div key={i} className="balance-row">
                  <span>{lp.account}</span>
                  <span>{lp.balance}</span>
                </div>
              ))
            ) : (
              <p>No LP holders found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import "./App.css";

export default function App() {
  const [holders, setHolders] = useState([]);
  const [lpHolders, setLpHolders] = useState([]);
  const [ammData, setAmmData] = useState(null);
  const [page, setPage] = useState(1);

  // Fetch data
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

  // Infinite scroll handler
  function handleScroll(e, type) {
    const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
    if (bottom) {
      setPage(prev => prev + 1);
      // TODO: fetch next batch using ?page=prev+1
      console.log(`Load more ${type} page ${page + 1}`);
    }
  }

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <header className="dashboard-header neon-border">
        <h1 className="dashboard-title">DPMF‑XDX Dashboard</h1>
        <p className="dashboard-subtitle">Operational Intelligence Interface</p>
      </header>

      {/* MAIN CONTENT */}
      <div className="dashboard-grid">
        {/* AMM POOLS */}
        <div className="dashboard-card neon-card wide-card">
          <h2>AMM Pools</h2>
          <div className="scroll-area" onScroll={(e) => handleScroll(e, "amm")}>
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
        </div>

        {/* TOP HOLDERS */}
        <div className="dashboard-card neon-card wide-card">
          <h2>Top Holders</h2>
          <div className="scroll-area" onScroll={(e) => handleScroll(e, "holders")}>
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

        {/* LP HOLDERS */}
        <div className="dashboard-card neon-card wide-card">
          <h2>LP Holders</h2>
          <div className="scroll-area" onScroll={(e) => handleScroll(e, "lp")}>
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

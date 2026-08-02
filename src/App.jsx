import { useEffect, useState } from "react";
import "./App.css";

import ConnectWallet from "./components/ConnectWallet";
import { useWallet } from "./context/WalletContext";

export default function App() {
  const { walletAddress } = useWallet();

  const [holders, setHolders] = useState([]);
  const [lpHolders, setLpHolders] = useState([]);
  const [ammData, setAmmData] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch("https://dpmf-xdx-indexer-production.up.railway.app/api/top-holders")
      .then(res => res.json())
      .then(data => setHolders(data))
      .catch(err => console.error("Error fetching top-holders:", err));

    fetch("https://dpmf-xdx-indexer-production.up.railway.app/api/top-lp")
      .then(res => res.json())
      .then(data => setLpHolders(data))
      .catch(err => console.error("Error fetching top-lp:", err));

    fetch("https://dpmf-xdx-indexer-production.up.railway.app/api/amm")
      .then(res => res.json())
      .then(data => setAmmData(data))
      .catch(err => console.error("Error fetching amm:", err));
  }, []);

  function handleScroll(e, type) {
    const bottom =
      e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;

    if (bottom) {
      setPage(prev => prev + 1);
      console.log(`Load more ${type} page ${page + 1}`);
    }
  }

  return (
    <>
      <div className="dashboard-container">
        <header className="dashboard-header neon-border">
          <h1 className="dashboard-title">DPMF‑XDX Dashboard</h1>
          <p className="dashboard-subtitle">Operational Intelligence Interface</p>

          {/* LEFT BUTTON — same neon style */}
          <div className="wallet-box-left neon-button">
            <ConnectWallet />
          </div>

          {/* RIGHT BUTTON — shows ONLINE instead of address */}
          {walletAddress && (
            <div className="wallet-status-box neon-button online-indicator">
              <span className="wallet-status-online">●</span>
              <span className="wallet-status-text">Online</span>
            </div>
          )}
        </header>

        <div className="dashboard-grid">
          <div className="dashboard-card neon-card wide-card">
            <h2>AMM Pools</h2>
            <div
              className="scroll-area"
              onScroll={(e) => handleScroll(e, "amm")}
            >
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

          <div className="dashboard-card neon-card wide-card">
            <h2>Top Holders</h2>
            <div
              className="scroll-area"
              onScroll={(e) => handleScroll(e, "holders")}
            >
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

          <div className="dashboard-card neon-card wide-card">
            <h2>LP Holders</h2>
            <div
              className="scroll-area"
              onScroll={(e) => handleScroll(e, "lp")}
            >
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
    </>
  );
}

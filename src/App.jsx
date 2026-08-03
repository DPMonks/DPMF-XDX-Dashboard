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
      .then(data => setHolders(data));

    fetch("https://dpmf-xdx-indexer-production.up.railway.app/api/top-lp")
      .then(res => res.json())
      .then(data => setLpHolders(data));

    fetch("https://dpmf-xdx-indexer-production.up.railway.app/api/amm")
      .then(res => res.json())
      .then(data => setAmmData(data));
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

          <div className="wallet-box-left neon-button">
            {/* BUTTON ONLY */}
            <ConnectWallet />
          </div>

          {walletAddress && (
            <div className="wallet-status-box neon-button online-indicator">
              <span className="wallet-status-online">●</span>
              <span className="wallet-status-text">Online</span>
            </div>
          )}
        </header>

        <div className="dashboard-grid">
          {/* your cards unchanged */}
        </div>
      </div>
    </>
  );
}

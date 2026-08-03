import { useEffect, useState } from "react";
import "./App.css";

import ConnectWallet from "./components/ConnectWallet";
import { useWallet } from "./context/WalletContext";
import DexChart from "./components/DexChart";   // ⭐ ADD THIS

export default function App() {
  const { walletAddress } = useWallet();

  const [holders, setHolders] = useState([]);
  const [lpHolders, setLpHolders] = useState([]);
  const [ammData, setAmmData] = useState([]);

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

  return (
    <>
      <div className="dashboard-container">
        <header className="dashboard-header neon-border">
          <h1 className="dashboard-title">DPMF‑XDX Dashboard</h1>
          <p className="dashboard-subtitle">Operational Intelligence Interface</p>

          {/* WALLET BUTTON */}
          <div className="wallet-box-left">
            <ConnectWallet showButton={true} />
          </div>

          {walletAddress && (
            <div className="wallet-status-box neon-button online-indicator">
              <span className="wallet-status-online">●</span>
              <span className="wallet-status-text">Online</span>
            </div>
          )}
        </header>

        {/* MAIN GRID */}
        <div className="dashboard-grid">

          {/* TRADING CHART (DEXSCREENER) */}
          <div className="dashboard-card neon-card">
            <h2 className="card-title">XDX/XRP Trading Chart</h2>

            {/* ⭐ REPLACED IFRAME WITH YOUR FULL DEXCHART COMPONENT */}
            <DexChart />
          </div>

          {/* TOP HOLDERS */}
          <div className="dashboard-card neon-card">
            <h2 className="card-title">Top XDX Holders</h2>
            <div className="scroll-area">
              {holders.map((h) => (
                <div key={h.account} className="balance-row">
                  <span>{h.rank}. {h.account}</span>
                  <span>{h.balance}</span>
                </div>
              ))}
            </div>
          </div>

          {/* LP HOLDERS */}
          <div className="dashboard-card neon-card">
            <h2 className="card-title">LP Holders</h2>
            <div className="scroll-area">
              {lpHolders.map((lp) => (
                <div key={lp.account} className="balance-row">
                  <span>{lp.rank}. {lp.account}</span>
                  <span>{lp.lp_balance}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AMM POOLS */}
          <div className="dashboard-card neon-card">
            <h2 className="card-title">AMM Pools</h2>
            <div className="scroll-area">
              {ammData.map((pool, i) => (
                <div key={i} className="balance-row">
                  <span>{pool.pool}</span>
                  <span>TVL: {pool.tvl}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* MODAL ONLY */}
      <ConnectWallet showButton={false} />
    </>
  );
}

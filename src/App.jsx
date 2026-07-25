import { useState } from "react";
import "./App.css";

export default function App() {
  const [walletConnected, setWalletConnected] = useState(false);

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <header className="dashboard-header neon-border">
        <h1 className="dashboard-title">DPMF‑XDX Dashboard</h1>

        {!walletConnected ? (
          <button
            className="connect-wallet-btn"
            onClick={() => setWalletConnected(true)}
          >
            Connect Wallet
          </button>
        ) : (
          <button className="connect-wallet-btn">
            Wallet Connected
          </button>
        )}
      </header>

      {/* GRID */}
      <div className="dashboard-grid">
        {/* LEFT COLUMN */}
        <div className="dashboard-column">
          <div className="dashboard-card neon-card">
            <h2>Wallet Balances</h2>

            <div className="balance-row">
              <span>XRP</span>
              <span>0.00</span>
            </div>

            <div className="balance-row">
              <span>XDX</span>
              <span>0.00</span>
            </div>

            <div className="balance-row">
              <span>LP Tokens</span>
              <span>0.00</span>
            </div>
          </div>

          <div className="dashboard-card neon-card">
            <h2>AMM Pools</h2>

            <div className="balance-row">
              <span>XDX / XRP</span>
              <span>Pool Data</span>
            </div>

            <div className="balance-row">
              <span>APR</span>
              <span>0%</span>
            </div>

            <div className="balance-row">
              <span>Liquidity</span>
              <span>0</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="dashboard-column">
          <div className="dashboard-card neon-card">
            <h2>Actions</h2>

            <button>Swap</button>
            <button>Add Liquidity</button>
            <button>Remove Liquidity</button>
          </div>

          <div className="dashboard-card neon-card">
            <h2>System Status</h2>

            <div className="balance-row">
              <span>Indexer</span>
              <span>Online</span>
            </div>

            <div className="balance-row">
              <span>Dashboard</span>
              <span>Operational</span>
            </div>

            <div className="balance-row">
              <span>XRPL</span>
              <span>Connected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

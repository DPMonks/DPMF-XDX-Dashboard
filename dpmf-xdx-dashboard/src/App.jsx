import "./App.css";
import ConnectWallet from "./components/ConnectWallet";
import WalletBalances from "./components/WalletBalances";
import LpPositions from "./components/LpPositions";
import AddLiquidity from "./components/AddLiquidity";
import RemoveLiquidity from "./components/RemoveLiquidity";
import Pools from "./components/Pools";        // NEW: Pool stats module
import Charts from "./components/Charts";      // NEW: Chart module (optional)

export default function App() {
  return (
    <div className="dashboard-container">

      {/* HEADER */}
      <header className="dashboard-header neon-border">
        <h1 className="dashboard-title">DPMF XDX Dashboard</h1>
        <ConnectWallet />
      </header>

      {/* MAIN CONTENT */}
      <main className="dashboard-grid">

        {/* LEFT COLUMN */}
        <div className="dashboard-column">

          {/* POOL STATS */}
          <section className="dashboard-card neon-card">
            <Pools />
          </section>

          {/* USER BALANCES */}
          <section className="dashboard-card neon-card">
            <WalletBalances />
          </section>

          {/* USER LP POSITIONS */}
          <section className="dashboard-card neon-card">
            <LpPositions />
          </section>

        </div>

        {/* RIGHT COLUMN */}
        <div className="dashboard-column">

          {/* ADD LIQUIDITY */}
          <section className="dashboard-card neon-card">
            <AddLiquidity />
          </section>

          {/* REMOVE LIQUIDITY */}
          <section className="dashboard-card neon-card">
            <RemoveLiquidity />
          </section>

          {/* CHARTS */}
          <section className="dashboard-card neon-card">
            <Charts />
          </section>

        </div>

      </main>
    </div>
  );
}

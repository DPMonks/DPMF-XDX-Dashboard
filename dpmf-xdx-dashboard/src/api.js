import "./App.css";
import ConnectWallet from "./components/ConnectWallet";
import WalletBalances from "./components/WalletBalances";
import LpPositions from "./components/LpPositions";
import AddLiquidity from "./components/AddLiquidity";
import RemoveLiquidity from "./components/RemoveLiquidity";
import Pools from "./components/Pools";
import Charts from "./components/Charts";

// NEW HOOK IMPORTS
import useOverview from "./hooks/useOverview";
import useAmm from "./hooks/useAmm";
import usePools from "./hooks/usePools";

export default function App() {
  // LOAD BACKEND DATA
  const overview = useOverview();
  const amm = useAmm();
  const poolStats = usePools();

  // OPTIONAL: Loading state
  if (!overview || !amm || !poolStats) {
    return <div className="loading-screen">Loading dashboard…</div>;
  }

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
            <Pools data={poolStats} />
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
            <Charts overview={overview} amm={amm} />
          </section>
        </div>
      </main>
    </div>
  );
}



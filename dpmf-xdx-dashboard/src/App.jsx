import "./App.css";
import ConnectWallet from "./components/ConnectWallet";
import WalletBalances from "./components/WalletBalances";
import LpPositions from "./components/LpPositions";
import AddLiquidity from "./components/AddLiquidity";
import RemoveLiquidity from "./components/RemoveLiquidity";
import Pools from "./components/Pools";
import Charts from "./components/Charts";

import useOverview from "./hooks/useOverview";
import useAmm from "./hooks/useAmm";
import usePools from "./hooks/usePools";

// ICONS
import {
  Wallet,
  Layers,
  PlusCircle,
  MinusCircle,
  LineChart,
  Database
} from "lucide-react";

export default function App() {
  const overview = useOverview();
  const amm = useAmm();
  const poolStats = usePools();

  if (!overview || !amm || !poolStats) {
    return <div className="loading-screen">Loading dashboard…</div>;
  }

  return (
    <div className="dashboard-wrapper">

      {/* SMALL TOP-RIGHT XAMAN SIGN-IN BOX */}
      <div className="xaman-topright-box">
        <img
          src="https://xumm.app/assets/logo/xumm-logo.svg"
          alt="Xaman Wallet"
          className="xaman-topright-logo"
        />
        <ConnectWallet />
      </div>

      {/* HEADER */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">DPMF XDX Dashboard</h1>
        <p className="dashboard-subtitle">Operational Intelligence Interface</p>
      </header>

      {/* GRID */}
      <main className="dashboard-grid">

        <section className="dashboard-card">
          <h2 className="card-title">
            <Database className="card-icon" /> Pool Statistics
          </h2>
          <Pools data={poolStats} />
        </section>

        <section className="dashboard-card">
          <h2 className="card-title">
            <Wallet className="card-icon" /> Wallet Balances
          </h2>
          <WalletBalances />
        </section>

        <section className="dashboard-card">
          <h2 className="card-title">
            <Layers className="card-icon" /> LP Positions
          </h2>
          <LpPositions />
        </section>

        <section className="dashboard-card">
          <h2 className="card-title">
            <PlusCircle className="card-icon" /> Add Liquidity
          </h2>
          <AddLiquidity />
        </section>

        <section className="dashboard-card">
          <h2 className="card-title">
            <MinusCircle className="card-icon" /> Remove Liquidity
          </h2>
          <RemoveLiquidity />
        </section>

        <section className="dashboard-card tall-card">
          <h2 className="card-title">
            <LineChart className="card-icon" /> Analytics & Charts
          </h2>
          <Charts overview={overview} amm={amm} />
        </section>

      </main>
    </div>
  );
}

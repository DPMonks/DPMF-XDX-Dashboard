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

import { useEffect, useState } from "react";

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

  // PUBLIC XRPL DATA STATES
  const [publicOverview, setPublicOverview] = useState(null);
  const [publicAmm, setPublicAmm] = useState(null);
  const [publicPools, setPublicPools] = useState(null);

  // WALLET-BASED HOOKS (still work normally)
  const overview = useOverview();
  const amm = useAmm();
  const poolStats = usePools();

  // PUBLIC XRPL FETCHER
  async function loadPublicXrplData() {
    try {
      const resOverview = await fetch("/api/public/overview").then(r => r.json());
      const resAmm = await fetch("/api/public/amm").then(r => r.json());
      const resPools = await fetch("/api/public/pools").then(r => r.json());

      setPublicOverview(resOverview);
      setPublicAmm(resAmm);
      setPublicPools(resPools);

    } catch (err) {
      console.error("Public XRPL load failed:", err);
    }
  }

  // RUN ON PAGE LOAD
  useEffect(() => {
    loadPublicXrplData();
  }, []);

  // CHOOSE PUBLIC OR WALLET DATA
  const finalOverview = overview || publicOverview;
  const finalAmm = amm || publicAmm;
  const finalPools = poolStats || publicPools;

  return (
    <div className="dashboard-wrapper">

      {/* HEADER */}
      <header className="dashboard-header">

        {/* LEFT SIDE — TITLE + SUBTITLE */}
        <div className="header-left">
          <h1 className="dashboard-title">DPMF XDX Dashboard</h1>
          <p className="dashboard-subtitle">Operational Intelligence Interface</p>
        </div>

        {/* RIGHT SIDE — CONNECT WALLET */}
        <div className="header-right">
          <ConnectWallet />
        </div>

      </header>

      {/* GRID */}
      <main className="dashboard-grid">

        <section className="dashboard-card">
          <h2 className="card-title">
            <Database className="card-icon" /> Pool Statistics
          </h2>
          <Pools data={finalPools} />
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
          <Charts overview={finalOverview} amm={finalAmm} />
        </section>

      </main>
    </div>
  );
}

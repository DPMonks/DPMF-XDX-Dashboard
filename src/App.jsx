import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";

import ConnectWallet from "./components/ConnectWallet";
import { useWallet } from "./context/useWallet";
import TokenDetails from "./components/TokenDetails";
import AccountList from "./components/AccountList";
import AmmCard from "./components/AmmCard";
import WalletOverview from "./components/WalletOverview";
import OverviewStrip from "./components/OverviewStrip";
import Skeleton from "./components/Skeleton";
import { INDEXER_URL, getAmm, getOverview, getTopHolders, getTopLp } from "./api/indexer";

const DexChart = lazy(() => import("./components/DexChart"));
const ActivityChart = lazy(() => import("./components/ActivityChart"));

export default function App() {
  const { walletAddress } = useWallet();
  const [holders, setHolders] = useState([]);
  const [lpHolders, setLpHolders] = useState([]);
  const [ammData, setAmmData] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const nextErrors = {};
      const [holdersResult, lpResult, ammResult, overviewResult] = await Promise.allSettled([
        getTopHolders(),
        getTopLp(),
        getAmm(),
        getOverview(),
      ]);

      if (cancelled) return;

      if (holdersResult.status === "fulfilled") setHolders(holdersResult.value);
      else nextErrors.holders = holdersResult.reason.message;

      if (lpResult.status === "fulfilled") setLpHolders(lpResult.value);
      else nextErrors.lp = lpResult.reason.message;

      if (ammResult.status === "fulfilled") setAmmData(ammResult.value);
      else nextErrors.amm = ammResult.reason.message;

      if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
      else nextErrors.overview = overviewResult.reason.message;

      setErrors(nextErrors);
      setLoading(false);
    }

    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header neon-border">
        <h1 className="dashboard-title">DPMF‑XDX Dashboard</h1>
        <p className="dashboard-subtitle">
          Live XRPL intelligence from the XDX indexer
        </p>
        <div className="wallet-box-left">
          <ConnectWallet />
        </div>
        {walletAddress && (
          <div className="wallet-status-box neon-button online-indicator">
            <span className="wallet-status-online">●</span>
            <span className="wallet-status-text">Online</span>
          </div>
        )}
      </header>

      <p className="indexer-source">
        Indexer: <code>{INDEXER_URL}</code>
      </p>

      <div className="dashboard-grid">
        {walletAddress && (
          <section className="dashboard-card neon-card">
            <h2 className="card-title">Connected Wallet</h2>
            <WalletOverview address={walletAddress} />
          </section>
        )}

        <section className="dashboard-card neon-card">
          <h2 className="card-title">Network Snapshot</h2>
          <OverviewStrip
            overview={overview}
            loading={loading}
            error={errors.overview}
          />
        </section>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">Token Details</h2>
          <TokenDetails />
        </section>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">Activity Chart</h2>
          <Suspense fallback={<Skeleton height={300} />}>
            <ActivityChart />
          </Suspense>
        </section>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">XDX/XRP Trading Chart</h2>
          <Suspense fallback={<Skeleton height={300} />}>
            <DexChart />
          </Suspense>
        </section>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">Top XDX Holders</h2>
          <AccountList
            rows={holders}
            loading={loading}
            error={errors.holders}
            valueKey="balance"
            emptyLabel="No holder rows from the indexer yet."
          />
        </section>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">LP Holders</h2>
          <AccountList
            rows={lpHolders}
            loading={loading}
            error={errors.lp}
            valueKey="lp_balance"
            emptyLabel="No LP holder rows from the indexer yet."
          />
        </section>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">AMM Pools</h2>
          <AmmCard pools={ammData} loading={loading} error={errors.amm} />
        </section>
      </div>
    </div>
  );
}

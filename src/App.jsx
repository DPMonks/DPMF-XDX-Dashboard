import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";

import ConnectWallet from "./components/ConnectWallet";
import { useWallet } from "./context/useWallet";
import { useI18n } from "./i18n/useI18n";
import TokenDetails from "./components/TokenDetails";
import RichList from "./components/RichList";
import AmmCard from "./components/AmmCard";
import WalletOverview from "./components/WalletOverview";
import Footer from "./components/Footer";
import Skeleton from "./components/Skeleton";
import { INDEXER_ORIGIN, getAmm, getTopHolders, getTopLp } from "./api/indexer";

const DexChart = lazy(() => import("./components/DexChart"));
const ActivityChart = lazy(() => import("./components/ActivityChart"));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const { t } = useI18n();
  const { walletAddress } = useWallet();
  const [holders, setHolders] = useState([]);
  const [lpHolders, setLpHolders] = useState([]);
  const [ammData, setAmmData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const nextErrors = {};

      try {
        const nextHolders = await getTopHolders();
        if (!cancelled) setHolders(nextHolders);
      } catch (error) {
        nextErrors.holders = error.message;
      }

      await sleep(250);
      if (cancelled) return;

      try {
        const nextLp = await getTopLp();
        if (!cancelled) setLpHolders(nextLp);
      } catch (error) {
        nextErrors.lp = error.message;
      }

      await sleep(250);
      if (cancelled) return;

      try {
        const nextAmm = await getAmm();
        if (!cancelled) setAmmData(nextAmm);
      } catch (error) {
        nextErrors.amm = error.message;
      }

      if (!cancelled) {
        setErrors(nextErrors);
        setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header neon-border">
        <div className="header-bar">
          <div className="header-brand">
            <h1 className="dashboard-title">{t.title}</h1>
            <p className="dashboard-subtitle">{t.subtitle}</p>
          </div>
          <ConnectWallet />
        </div>
      </header>

      <p className="indexer-source">
        {t.indexer}: <code>{INDEXER_ORIGIN}</code>
      </p>

      <div className="dashboard-grid">
        {walletAddress && (
          <section className="dashboard-card neon-card">
            <h2 className="card-title">{t.connectedWallet}</h2>
            <WalletOverview address={walletAddress} />
          </section>
        )}

        <section className="dashboard-card neon-card">
          <h2 className="card-title">{t.tokenDetails}</h2>
          <TokenDetails />
        </section>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">{t.activityChart}</h2>
          <Suspense fallback={<Skeleton height={300} />}>
            <ActivityChart />
          </Suspense>
        </section>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">{t.tradingChart}</h2>
          <Suspense fallback={<Skeleton height={300} />}>
            <DexChart />
          </Suspense>
        </section>

        <div className="lists-row">
          <section className="dashboard-card neon-card">
            <h2 className="card-title">{t.topHolders}</h2>
            <RichList
              rows={holders}
              loading={loading}
              error={errors.holders}
              valueKey="balance"
              unit="XDX"
              emptyLabel={t.emptyHolders}
              searchPlaceholder={t.searchHolders}
            />
          </section>

          <section className="dashboard-card neon-card">
            <h2 className="card-title">{t.lpHolders}</h2>
            <RichList
              rows={lpHolders}
              loading={loading}
              error={errors.lp}
              valueKey="lp_balance"
              unit="LP"
              showPair
              emptyLabel={t.emptyLp}
              searchPlaceholder={t.searchLp}
            />
          </section>
        </div>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">{t.ammPools}</h2>
          <AmmCard pools={ammData} loading={loading} error={errors.amm} />
        </section>
      </div>

      <Footer />
    </div>
  );
}

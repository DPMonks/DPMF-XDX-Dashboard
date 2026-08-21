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
import { handshake } from "./api";
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
  const [link, setLink] = useState({ status: "connecting" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const nextErrors = {};
      const hsPromise = handshake();
      hsPromise.then((hs) => {
        if (cancelled) return;
        setLink({
          status: hs.ok ? "ok" : "fallback",
          protocol: hs.protocol,
          path: hs.path,
          error: hs.error,
          health: hs.health?.status,
          source: hs.source || hs.health?.source || hs.raw?.source,
          database: hs.database || hs.health?.database || hs.raw?.database,
          hint: hs.hint || hs.health?.hint || hs.raw?.hint,
          onV1: hs.xrpl?.onV1 ?? hs.health?.xrpl?.onV1,
        });
      });

      try {
        const nextHolders = await getTopHolders((rows) => {
          if (!cancelled) {
            setHolders(rows);
            setLoading(false);
          }
        });
        if (!cancelled) setHolders(nextHolders);
      } catch (error) {
        nextErrors.holders = error.message;
      }

      await sleep(250);
      if (cancelled) return;

      try {
        const nextLp = await getTopLp((rows) => {
          if (!cancelled) setLpHolders(rows);
        });
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
        const hs = await hsPromise.catch(() => ({ ok: false }));
        if (nextErrors.holders && nextErrors.lp && nextErrors.amm && !hs.ok) {
          setLink({
            status: "error",
            protocol: hs.protocol,
            path: hs.path,
            error: hs.error || nextErrors.holders,
            source: hs.source,
            database: hs.database,
            hint: hs.hint || hs.error || nextErrors.holders,
          });
        }
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

      <p className={`indexer-source is-${link.status}`}>
        <span className="handshake-dot" aria-hidden="true" />
        {link.database === "auth-failed" || /password authentication failed/i.test(`${link.error || ""} ${link.hint || ""}`)
          ? t.handshakeAuth
          : link.database === "postgres" && link.health === "ok"
            ? t.handshakeOk
            : link.status === "error"
              ? t.handshakeError
              : link.status === "connecting"
                ? t.handshakeConnecting
                : t.handshakeFallback}
        {": "}
        <code>{INDEXER_ORIGIN}</code>
        {link.protocol ? ` · ${link.protocol}` : ""}
        {link.path ? ` · ${link.path}` : ""}
        {link.health ? ` · health ${link.health}` : ""}
        {link.source ? ` · ${link.source}` : ""}
        {link.database ? ` · DATABASE_URL ${link.database}` : ""}
        {link.onV1 != null ? ` · xrpl /v1 ${link.onV1 ? "yes" : "no"}` : ""}
        {" · SELECT only, workers not started"}
        {link.hint ? ` · ${link.hint}` : ""}
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

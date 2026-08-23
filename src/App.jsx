import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";

import ConnectWallet from "./components/ConnectWallet";
import TradePanel from "./components/TradePanel";
import XdxTrustline from "./components/XdxTrustline";
import { useI18n } from "./i18n/useI18n";
import TokenDetails from "./components/TokenDetails";
import RichList from "./components/RichList";
import AmmCard from "./components/AmmCard";
import OrderBook from "./components/OrderBook";
import ConnectedWallet from "./components/ConnectedWallet";
import Footer from "./components/Footer";
import Skeleton from "./components/Skeleton";
import { handshake } from "./api";
import { INDEXER_ORIGIN, getAmm, getTopHolders, getTopLp } from "./api/indexer";
import { interfaceLinkState } from "./utils/interfaceLink";
import { XDX_TOTAL_SUPPLY } from "./constants/ledger";

const TradingChart = lazy(() => import("./components/TradingChart"));
const ActivityChart = lazy(() => import("./components/ActivityChart"));

export default function App() {
  const { t } = useI18n();
  const [holders, setHolders] = useState([]);
  const [holderFreshness, setHolderFreshness] = useState(null);
  const [holdersLoading, setHoldersLoading] = useState(true);
  const [lpHolders, setLpHolders] = useState([]);
  const [lpFreshness, setLpFreshness] = useState(null);
  const [lpLoading, setLpLoading] = useState(true);
  const [ammData, setAmmData] = useState([]);
  const [ammLoading, setAmmLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [link, setLink] = useState({ status: "connecting" });
  const [tradeAction, setTradeAction] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function applyLink(hs, extra = {}) {
      if (cancelled) return;
      setLink({
        status: extra.status || (hs.ok ? "ok" : "fallback"),
        protocol: hs.protocol,
        path: hs.path,
        error: extra.error || hs.error,
        health: hs.health?.status,
        source: hs.source || hs.health?.source || hs.raw?.source,
        database: hs.database || hs.health?.database || hs.raw?.database,
        hint: extra.hint || hs.hint || hs.health?.hint || hs.raw?.hint,
        onV1: hs.xrpl?.onV1 ?? hs.health?.xrpl?.onV1,
      });
    }

    async function loadHolders() {
      try {
        const nextHolders = await getTopHolders((rows, meta) => {
          if (!cancelled) {
            setHolders(rows);
            if (meta) setHolderFreshness(meta);
            setHoldersLoading(false);
          }
        });
        if (!cancelled) {
          setHolders(nextHolders);
          setErrors((current) => ({ ...current, holders: undefined }));
        }
        return null;
      } catch (error) {
        if (!cancelled) setErrors((current) => ({ ...current, holders: error.message }));
        return error.message;
      } finally {
        if (!cancelled) setHoldersLoading(false);
      }
    }

    async function loadLp() {
      try {
        const nextLp = await getTopLp((rows, meta) => {
          if (!cancelled) {
            setLpHolders(rows);
            if (meta) setLpFreshness(meta);
            setLpLoading(false);
          }
        });
        if (!cancelled) {
          setLpHolders(nextLp);
          setErrors((current) => ({ ...current, lp: undefined }));
        }
        return null;
      } catch (error) {
        if (!cancelled) setErrors((current) => ({ ...current, lp: error.message }));
        return error.message;
      } finally {
        if (!cancelled) setLpLoading(false);
      }
    }

    async function loadAmm() {
      try {
        const nextAmm = await getAmm();
        if (!cancelled) {
          setAmmData(nextAmm);
          setErrors((current) => ({ ...current, amm: undefined }));
        }
        return null;
      } catch (error) {
        if (!cancelled) setErrors((current) => ({ ...current, amm: error.message }));
        return error.message;
      } finally {
        if (!cancelled) setAmmLoading(false);
      }
    }

    async function load() {
      const hsPromise = handshake();
      hsPromise.then((hs) => applyLink(hs));

      const [holderErr, lpErr, ammErr] = await Promise.all([
        loadHolders(),
        loadLp(),
        loadAmm(),
      ]);
      if (cancelled) return;

      const hs = await hsPromise.catch(() => ({ ok: false }));
      if (holderErr && lpErr && ammErr && !hs.ok) {
        applyLink(hs, {
          status: "error",
          error: hs.error || holderErr,
          hint: hs.hint || hs.error || holderErr,
        });
      }
    }

    load();
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    function onOpen(event) {
      if (event.detail) setTradeAction(event.detail);
    }
    window.addEventListener("dpmf-open-trade", onOpen);
    return () => window.removeEventListener("dpmf-open-trade", onOpen);
  }, []);

  const linkState = interfaceLinkState(link, t);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header neon-border">
        <div className="header-bar">
          <div className="header-brand">
            <img src="/favicon.png" alt="" className="header-mark" />
            <div className="header-brand-copy">
              <h1 className="dashboard-title">{t.title}</h1>
              <p className="dashboard-subtitle">{t.subtitle}</p>
            </div>
          </div>
          <div className="header-actions">
            <XdxTrustline />
            <ConnectWallet />
          </div>
        </div>
      </header>

      <p className={`indexer-source is-${linkState.tone}`} title={INDEXER_ORIGIN}>
        <span className="handshake-dot" aria-hidden="true" />
        <span className="indexer-source-label">{linkState.label}</span>
      </p>

      <div className="dashboard-grid">
        <div className="wallet-token-row">
          <section className="dashboard-card neon-card">
            <h2 className="card-title">{t.connectedWallet}</h2>
            <ConnectedWallet />
          </section>
          <section className="dashboard-card neon-card">
            <h2 className="card-title">{t.tokenDetails}</h2>
            <TokenDetails />
          </section>
        </div>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">{t.tradingChart}</h2>
          <Suspense fallback={<Skeleton height={300} />}>
            <TradingChart />
          </Suspense>
          <div className="orderbook-wrap">
            <h3 className="card-title orderbook-title">{t.orderbook}</h3>
            <OrderBook />
          </div>
        </section>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">{t.activityChart}</h2>
          <Suspense fallback={<Skeleton height={300} />}>
            <ActivityChart />
          </Suspense>
        </section>

        <div className="lists-row">
          <section className="dashboard-card neon-card">
            <h2 className="card-title">{t.topHolders}</h2>
            <RichList
              rows={holders}
              loading={holdersLoading}
              error={errors.holders}
              valueKey="balance"
              unit="XDX"
              shareTotal={XDX_TOTAL_SUPPLY}
              emptyLabel={t.emptyHolders}
              searchPlaceholder={t.searchHolders}
              freshness={holderFreshness}
            />
          </section>

          <section className="dashboard-card neon-card">
            <h2 className="card-title">{t.lpHolders}</h2>
            <RichList
              rows={lpHolders}
              loading={lpLoading}
              error={errors.lp}
              valueKey="lp_balance"
              unit="LP"
              showPair
              defaultPair="XDX/XRP"
              pairOptions={ammData.map((row) => row.pool_name || row.pool).filter(Boolean)}
              emptyLabel={t.emptyLp}
              searchPlaceholder={t.searchLp}
              freshness={lpFreshness}
            />
          </section>
        </div>

        <section className="dashboard-card neon-card">
          <h2 className="card-title">{t.ammPools}</h2>
          <AmmCard pools={ammData} loading={ammLoading} error={errors.amm} />
        </section>
      </div>

      <Footer />
      {tradeAction ? <TradePanel action={tradeAction} onClose={() => setTradeAction(null)} /> : null}
    </div>
  );
}

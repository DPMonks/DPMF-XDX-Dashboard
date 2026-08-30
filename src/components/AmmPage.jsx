import { lazy, Suspense } from "react";
import { closeAmmPage } from "../ammPage";
import { SITE_JUMP_IDS } from "../siteJump";
import { useI18n } from "../i18n/useI18n";
import AmmCard from "./AmmCard";
import ConnectedWallet from "./ConnectedWallet";
import CreatePoolCard from "./CreatePoolCard";
import Footer from "./Footer";
import OrderBook from "./OrderBook";
import PoolActivity from "./PoolActivity";
import RichList from "./RichList";
import SiteJump from "./SiteJump";
import Skeleton from "./Skeleton";
import VotingContainer from "./governance/VotingContainer";
import XdxSwapPanel from "./XdxSwapPanel";
import XdxTrustline from "./XdxTrustline";
import ConnectWallet from "./ConnectWallet";

const TradingChart = lazy(() => import("./TradingChart"));

export default function AmmPage({
  pair,
  pool,
  pools,
  ammLoading,
  errors,
  lpHolders,
  lpLoading,
  lpFreshness,
  onAddLiquidity,
  onRemoveLiquidity,
  onJoinExisting,
  onCreated,
}) {
  const { t } = useI18n();
  const one = pool ? [pool] : [];

  return (
    <div className="dashboard-container amm-page">
      <div className="site-chrome">
        <header className="dashboard-header neon-border">
          <div className="header-bar">
            <div className="header-brand">
              <img src="/favicon.png" alt="" className="header-mark" />
              <div className="header-brand-copy">
                <h1 className="dashboard-title">{pair}</h1>
                <p className="dashboard-subtitle">{t.ammPageSubtitle || "This AMM only — same decks as home."}</p>
              </div>
            </div>
            <div className="header-actions">
              <button type="button" className="connect-wallet-btn" onClick={() => closeAmmPage("pools")}>
                {t.ammPageBack || "All AMM pools"}
              </button>
              <XdxTrustline />
              <ConnectWallet />
            </div>
          </div>
        </header>
      </div>

      <SiteJump ids={SITE_JUMP_IDS} />

      <div className="dashboard-grid">
        <div className="wallet-token-row">
          <section className="dashboard-card neon-card" id="wallet">
            <h2 className="card-title">{t.connectedWallet}</h2>
            <ConnectedWallet lockedPair={pair} />
          </section>
          <section className="dashboard-card neon-card" id="details">
            <h2 className="card-title">{t.ammPageDetails || "Pool details"}</h2>
            <AmmCard
              pools={one}
              loading={ammLoading && !one.length}
              error={errors?.amm}
              hideSearch
              onAddLiquidity={onAddLiquidity}
              onRemoveLiquidity={onRemoveLiquidity}
            />
          </section>
        </div>

        <section className="dashboard-card neon-card" id="trading">
          <h2 className="card-title">{t.tradingChart}</h2>
          <Suspense fallback={<Skeleton height={300} />}>
            <TradingChart lockedPair={pair} />
          </Suspense>
          <div id="swap">
            <XdxSwapPanel lockedPair={pair} />
          </div>
          <div className="orderbook-wrap" id="orderbook">
            <h3 className="card-title orderbook-title">{t.orderbook}</h3>
            <OrderBook lockedPair={pair} />
          </div>
        </section>

        <section className="dashboard-card neon-card" id="activity">
          <h2 className="card-title">{t.activityChart}</h2>
          <PoolActivity pair={pair} />
        </section>

        <div className="lists-row">
          <section className="dashboard-card neon-card" id="holders">
            <h2 className="card-title">{t.topHolders}</h2>
            <p className="empty-message">
              {(t.ammPageHoldersHint || "Token-wide XDX holders live on the home rich list. This page keeps the LP book for {pair}.")
                .replace("{pair}", pair)}
            </p>
          </section>
          <section className="dashboard-card neon-card" id="lp-owners">
            <h2 className="card-title">{t.lpHolders}</h2>
            <RichList
              className="is-lp-holders"
              rows={lpHolders}
              loading={lpLoading}
              error={errors?.lp}
              valueKey="lp_balance"
              unit="LP"
              showPair
              defaultPair={pair}
              focusPair={pair}
              pairOptions={[pair]}
              emptyLabel={t.emptyLp}
              searchPlaceholder={t.searchLp}
              freshness={lpFreshness}
            />
          </section>
        </div>

        <div id="create-pool">
          <CreatePoolCard pools={pools} onJoinExisting={onJoinExisting} onCreated={onCreated} />
        </div>

        <section className="dashboard-card neon-card amm-pools-card" id="pools">
          <h2 className="card-title">{t.ammPools}</h2>
          <AmmCard
            pools={one}
            loading={ammLoading && !one.length}
            error={errors?.amm}
            hideSearch
            onAddLiquidity={onAddLiquidity}
            onRemoveLiquidity={onRemoveLiquidity}
          />
        </section>

        <section className="dashboard-card neon-card governance-card" id="governance">
          <h2 className="card-title">{t.poolGovernance}</h2>
          <VotingContainer lockedPair={pair} />
        </section>
      </div>

      <Footer />
    </div>
  );
}

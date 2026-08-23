import { useEffect, useMemo, useState } from "react";
import { getConnectedWallet } from "../api/indexer";
import { pendingVoteFromExecution } from "../wallet/ammVote";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import {
  formatEur,
  formatGbp,
  formatJpy,
  formatNumber,
  formatQuotePerBase,
  formatSharePercent,
  formatSupplySharePercent,
  formatToken,
  formatUsd,
  formatXrpPrice,
  shortAddress,
} from "../utils/format";
import { copyToClipboard } from "../utils/copy";
import {
  emptyWalletSnapshot,
  normalizeWalletPair,
  preferredWalletPair,
  sortWalletPairs,
  xrpBarPercents,
} from "../wallet/composeWallet";
import { formatFeePercent } from "../wallet/ammVote";
import { useMorph } from "../wallet/useMorph";
import { mergeWalletActivity, mergeWalletOrders, pendingFromExecution } from "../wallet/ledgerOrders";

function XrpColumn({ label, tone, percent, value, locale, empty }) {
  return (
    <div className="wallet-xrp-col">
      <div className="wallet-xrp-bar" aria-hidden="true">
        <span className={tone} style={{ height: `${empty ? 0 : percent}%` }} />
      </div>
      <small>{label}</small>
      <b>{empty ? "—" : formatToken(value, locale, 4)}</b>
    </div>
  );
}

function XrpBalanceBars({ xrp, locale, t, empty }) {
  const spendable = useMorph(empty ? 0 : xrp.spendable);
  const reserved = useMorph(empty ? 0 : xrp.reserved);
  const total = useMorph(empty ? 0 : xrp.balance);
  const bars = xrpBarPercents(
    { reserved, spendable, total },
    !empty
  );

  return (
    <div className={`wallet-panel${empty ? " is-empty" : " is-filled"}`}>
      <p className="wallet-panel-title is-center">{t.xrpBalance}</p>
      <div className="wallet-xrp-bars">
        <XrpColumn
          label={t.reservedXrp}
          tone="is-reserve"
          percent={bars.reservePct}
          value={reserved}
          locale={locale}
          empty={empty}
        />
        <XrpColumn
          label={t.spendableXrp}
          tone="is-spend"
          percent={bars.spendPct}
          value={spendable}
          locale={locale}
          empty={empty}
        />
        <XrpColumn
          label={t.totalXrp}
          tone="is-total"
          percent={bars.totalPct}
          value={total}
          locale={locale}
          empty={empty}
        />
      </div>
    </div>
  );
}

function XdxBalancePanel({ xdx, locale, t, empty }) {
  const rows = [
    { id: "xdx", label: t.xdx, value: empty ? "—" : `${formatToken(xdx.xdx, locale, 2)} ${t.xdx}` },
    { id: "xrp", label: t.xrp, value: empty ? "—" : formatXrpPrice(xdx.xrp, locale) },
    { id: "usd", label: t.usd, value: empty ? "—" : formatUsd(xdx.usd, locale) },
    { id: "gbp", label: t.gbp, value: empty ? "—" : formatGbp(xdx.gbp, locale) },
    { id: "eur", label: t.eur, value: empty ? "—" : formatEur(xdx.eur, locale) },
    { id: "jpy", label: t.jpy, value: empty ? "—" : formatJpy(xdx.jpy, locale) },
  ];
  return (
    <div className={`wallet-panel${empty ? " is-empty" : " is-filled"}`}>
      <p className="wallet-panel-title is-center">{t.xdxValue}</p>
      <dl className="wallet-mini-list">
        {rows.map((row) => (
          <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SupplyShareBars({ supply, locale, t, empty }) {
  const circ = useMorph(empty ? 0 : supply.circulatingPct);
  const supplyPct = useMorph(empty ? 0 : supply.supplyPct);
  const circWidth = empty ? 0 : Math.min(100, Math.max(Number(circ) > 0 ? 4 : 0, Number(circ)));
  const supplyWidth = empty
    ? 0
    : Math.min(100, Math.max(Number(supplyPct) > 0 ? 4 : 0, Number(supplyPct)));
  return (
    <div className={`wallet-panel${empty ? " is-empty" : " is-filled"}`}>
      <p className="wallet-panel-title is-center">{t.supplyShare}</p>
      <div className="wallet-micro">
        <span>{t.circulating}</span>
        <span className="wallet-micro-track">
          <i style={{ width: `${circWidth}%` }} />
        </span>
        <b>{empty ? "—" : formatSharePercent(circ, locale)}</b>
      </div>
      <div className="wallet-micro">
        <span>{t.xdxSupplyShare}</span>
        <span className="wallet-micro-track">
          <i className="is-amm" style={{ width: `${supplyWidth}%` }} />
        </span>
        <b>{empty ? "—" : formatSupplySharePercent(supplyPct, locale)}</b>
      </div>
      <div className="wallet-micro is-pending">
        <span>{t.borrowed}</span>
        <span className="wallet-micro-track">
          <i />
        </span>
        <b>—</b>
      </div>
      <div className="wallet-micro is-pending">
        <span>{t.lending}</span>
        <span className="wallet-micro-track">
          <i />
        </span>
        <b>—</b>
      </div>
    </div>
  );
}

function LpInfographic({ position, locale, t, empty }) {
  const share = useMorph(empty ? 0 : position?.lp_share_percent);
  const xdxComp = useMorph(empty ? 0 : position?.composition_xdx_percent);
  const quoteComp = useMorph(empty ? 0 : position?.composition_quote_percent);
  const shareWidth = empty ? 0 : Math.min(100, Math.max(Number(share) > 0 ? 6 : 0, Number(share) * 8));
  return (
    <div className={`wallet-lp-info${empty ? " is-empty" : " is-filled"}`}>
      <div className="wallet-micro">
        <span>{t.lpShare}</span>
        <span className="wallet-micro-track">
          <i style={{ width: `${shareWidth}%` }} />
        </span>
        <b>{empty ? "—" : formatSharePercent(share, locale)}</b>
      </div>
      <div className="wallet-lp-comp" aria-hidden="true">
        <span className="is-xdx" style={{ width: `${empty ? 0 : Number(xdxComp) || 0}%` }} />
        <span className="is-quote" style={{ width: `${empty ? 0 : Number(quoteComp) || 0}%` }} />
      </div>
      <dl className="wallet-mini-list is-wide">
        <div>
          <dt>{t.lp}</dt>
          <dd>{empty ? "—" : formatToken(position?.lp_balance, locale, 2)}</dd>
        </div>
        <div>
          <dt>{t.withdrawXdx}</dt>
          <dd>{empty ? "—" : formatToken(position?.withdraw_estimate_xdx, locale, 2)}</dd>
        </div>
        <div>
          <dt>{t.withdrawQuote}</dt>
          <dd>
            {empty
              ? "—"
              : `${formatToken(position?.withdraw_estimate_quote, locale, 4)} ${position?.quote || ""}`.trim()}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function earnText(value, format, empty) {
  if (empty || value == null || !Number.isFinite(Number(value))) return "—";
  return format(Number(value));
}

function WalletEarnCell({ label, rows, empty }) {
  return (
    <div className={`wallet-earn-cell${empty ? " is-empty" : " is-filled"}`}>
      <p className="wallet-earn-label">{label}</p>
      {rows.map((row) => (
        <p key={row.range} className="wallet-earn-row">
          <span className="wallet-earn-range">{row.range}</span>
          <span className="wallet-earn-value">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

function WalletEarnBeam({ fees, locale, t, empty }) {
  const earn = fees?.earnings || {};
  return (
    <div className="wallet-earn-beam" aria-label={t.lpFeeEarnings}>
      <WalletEarnCell
        label={t.xrpEarnings}
        empty={empty}
        rows={[
          {
            range: t.lpFees24h,
            value: earnText(earn.xrp24h, (n) => `${formatToken(n, locale, 4)} ${t.xrp}`, empty),
          },
          {
            range: t.lpFees7d,
            value: earnText(earn.xrp7d, (n) => `${formatToken(n, locale, 4)} ${t.xrp}`, empty),
          },
        ]}
      />
      <WalletEarnCell
        label={t.xdxEarnings}
        empty={empty}
        rows={[
          {
            range: t.lpFees24h,
            value: earnText(earn.xdx24h, (n) => `${formatToken(n, locale, 4)} ${t.xdx}`, empty),
          },
          {
            range: t.lpFees7d,
            value: earnText(earn.xdx7d, (n) => `${formatToken(n, locale, 4)} ${t.xdx}`, empty),
          },
        ]}
      />
      <WalletEarnCell
        label={t.totalEarnings}
        empty={empty}
        rows={[
          {
            range: t.lpFees24h,
            value: earnText(earn.usd24h, (n) => formatUsd(n, locale), empty),
          },
          {
            range: t.lpFees7d,
            value: earnText(earn.usd7d, (n) => formatUsd(n, locale), empty),
          },
        ]}
      />
    </div>
  );
}

export default function ConnectedWallet() {
  const { t, locale } = useI18n();
  const { walletAddress } = useWallet();
  const [snap, setSnap] = useState(() => emptyWalletSnapshot(null));
  const [pair, setPair] = useState("XDX/XRP");

  useEffect(() => {
    if (!walletAddress) return undefined;
    let cancelled = false;

    async function load(fresh = false) {
      const next = await getConnectedWallet(walletAddress, { fresh }).catch(() =>
        emptyWalletSnapshot(walletAddress)
      );
      if (cancelled) return;
      setSnap(next);
      setPair((current) =>
        preferredWalletPair(
          next.lp.map((row) => row.pool),
          current
        )
      );
    }

    load();
    const id = setInterval(load, 30000);
    const retries = [];
    function refreshConfirmed() {
      load(true);
      retries.push(window.setTimeout(() => load(true), 2500));
      retries.push(window.setTimeout(() => load(true), 8000));
    }
    function applyPending(detail) {
      const pending =
        pendingFromExecution(detail, walletAddress) || pendingVoteFromExecution(detail, walletAddress);
      if (!pending) return;
      setSnap((current) => ({
        ...current,
        signedIn: true,
        filled: true,
        orders: mergeWalletOrders(pending.order ? [pending.order] : [], current.orders || []),
        activity: mergeWalletActivity(pending.activity ? [pending.activity] : [], current.activity || []).slice(
          0,
          3
        ),
      }));
    }
    function onRefresh() {
      load(true);
    }
    function onTrade(event) {
      applyPending(event.detail);
      refreshConfirmed();
    }
    window.addEventListener("dpmf-wallet-refresh", onRefresh);
    window.addEventListener("dpmf-trade-executed", onTrade);
    window.addEventListener("dpmf-function-confirmed", onTrade);
    return () => {
      cancelled = true;
      clearInterval(id);
      for (const timer of retries) window.clearTimeout(timer);
      window.removeEventListener("dpmf-wallet-refresh", onRefresh);
      window.removeEventListener("dpmf-trade-executed", onTrade);
      window.removeEventListener("dpmf-function-confirmed", onTrade);
    };
  }, [walletAddress]);

  const view = walletAddress ? snap : emptyWalletSnapshot(null);
  const empty = !view.signedIn || !view.filled;
  const pools = sortWalletPairs(view.lp.map((row) => row.pool));
  const selected = normalizeWalletPair(pair);
  const position = useMemo(
    () => view.lp.find((row) => normalizeWalletPair(row.pool) === selected) || null,
    [view.lp, selected]
  );
  const mid = Number(view.book?.mid);
  const own = snap.orders[0];
  const fromMid =
    own && mid > 0 ? (Math.abs(Number(own.price) - mid) / mid) * 100 : null;

  return (
    <div className="connected-wallet">
      <header className="wallet-hero">
        <div className="wallet-hero-brand">
          <img src="/favicon.png" alt="" className="wallet-mark" />
          <div className="wallet-hero-copy">
            <p className="wallet-hero-label">{t.xdxValue}</p>
            <p className={`wallet-hero-qty${empty ? " is-empty" : " is-filled"}`}>
              {empty ? "—" : `${formatToken(view.xdx.xdx, locale, 2)} ${t.xdx}`}
            </p>
            <p className={`wallet-hero-usd${empty ? " is-empty" : " is-filled"}`}>
              {empty ? "—" : formatUsd(view.xdx.usd, locale)}
            </p>
            <div className="wallet-hero-fx">
              <p className={`wallet-hero-gbp${empty ? " is-empty" : " is-filled"}`}>
                {empty ? "—" : formatGbp(view.xdx.gbp, locale)}
              </p>
              <p className={`wallet-hero-eur${empty ? " is-empty" : " is-filled"}`}>
                {empty ? "—" : formatEur(view.xdx.eur, locale)}
              </p>
              <p className={`wallet-hero-jpy${empty ? " is-empty" : " is-filled"}`}>
                {empty ? "—" : formatJpy(view.xdx.jpy, locale)}
              </p>
            </div>
          </div>
        </div>
        {walletAddress ? (
          <div className="wallet-hero-account">
            <button
              type="button"
              className="account-link"
              onClick={() => copyToClipboard(walletAddress)}
            >
              {shortAddress(walletAddress)}
            </button>
            <p className={`wallet-hero-rank${empty || view.rank == null ? " is-empty" : " is-filled"}`}>
              {t.richListPosition}{" "}
              {empty || view.rank == null
                ? "—"
                : `#${formatNumber(view.rank, locale, { maximumFractionDigits: 0 })}`}
            </p>
          </div>
        ) : (
          <p className="wallet-hero-hint">{t.connectWalletHint}</p>
        )}
      </header>

      <div className="wallet-balance-stack">
        <WalletEarnBeam fees={view.fees} locale={locale} t={t} empty={empty} />
        <div className="wallet-infographics">
          <XrpBalanceBars xrp={view.xrp} locale={locale} t={t} empty={empty} />
          <XdxBalancePanel xdx={view.xdx} locale={locale} t={t} empty={empty} />
          <SupplyShareBars supply={view.supply} locale={locale} t={t} empty={empty} />
        </div>
      </div>

      <section className="wallet-lp">
        <div className="wallet-lp-head">
          <h3>{t.lpPositions}</h3>
          <label className="wallet-lp-select">
            <span className="sr-only">{t.pair}</span>
            <select
              value={pair}
              disabled={empty || !pools.length}
              onChange={(event) => setPair(event.target.value)}
            >
              {pools.length ? (
                pools.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              ) : (
                <option value="">{t.noLpPositions}</option>
              )}
            </select>
          </label>
        </div>
        <LpInfographic position={position} locale={locale} t={t} empty={empty || !position} />
      </section>

      <section className={`wallet-book${empty ? " is-empty" : " is-filled"}`}>
        <h3>{t.orderbook}</h3>
        <ul>
          <li>
            <i className={own ? "is-on" : ""} />
            {t.topOfBook}
            <b>{empty || !own ? "—" : formatQuotePerBase(own.price, locale, "XRP")}</b>
          </li>
          <li>
            <i />
            {t.fromMid}
            <b>{empty || fromMid == null ? "—" : formatSharePercent(fromMid, locale)}</b>
          </li>
          <li>
            <i />
            {t.matchedAt}
            <b>
              {empty || !view.activity[0]?.price
                ? "—"
                : formatQuotePerBase(view.activity[0].price, locale, "XRP")}
            </b>
          </li>
          <li>
            {t.ammDepthShort}
            <span className="wallet-micro-track is-inline">
              <i
                className="is-amm"
                style={{
                  width: empty ? 0 : `${Math.min(100, Number(view.book?.ammDepth) > 0 ? 40 : 0)}%`,
                }}
              />
            </span>
          </li>
        </ul>
      </section>

      <section className={`wallet-activity${empty ? " is-empty" : " is-filled"}`}>
        <h3>{t.recentActivity}</h3>
        <ol>
          {(empty ? [0, 1, 2] : view.activity.concat([null, null, null]).slice(0, 3)).map((row, index) => (
            <li key={row?.timestamp || index}>
              {empty || !row
                ? "—"
                : row.kind === "vote"
                  ? (t.votedOnPool || "Voted on {pair} — {fee} fee")
                      .replace("{pair}", row.pair || "")
                      .replace("{fee}", formatFeePercent(row.feePercent, locale))
                  : row.side === "createPool"
                    ? (t.createdPoolActivity || "Created {pair} pool").replace("{pair}", row.pair || "")
                    : row.side === "addLp"
                      ? (t.addedLpActivity || "Added LP to {pair}").replace("{pair}", row.pair || "")
                      : row.side === "removeLp"
                        ? (t.removedLpActivity || "Removed {amount} LP from {pair}")
                            .replace("{amount}", row.lp != null ? formatNumber(row.lp, locale, { maximumFractionDigits: 4 }) : "")
                            .replace("{pair}", row.pair || "")
                            .replace(/\s+/g, " ")
                            .trim()
                        : row.side === "trustline"
                          ? (t.trustlineActivity || "Added {asset} trustline").replace(
                              "{asset}",
                              row.currency || t.xdx
                            )
                          : `${row.side === "sell" ? t.sell : t.buy} ${formatNumber(row.xdx, locale)} XDX${
                              row.price ? ` @ ${formatQuotePerBase(row.price, locale, "XRP")}` : ""
                            }`}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

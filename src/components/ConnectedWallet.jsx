import { useEffect, useMemo, useState } from "react";
import { getConnectedWallet } from "../api/indexer";
import { useWallet } from "../context/useWallet";
import { useI18n } from "../i18n/useI18n";
import {
  formatGbp,
  formatNumber,
  formatQuotePerBase,
  formatSharePercent,
  formatToken,
  formatUsd,
  formatXrpPrice,
  shortAddress,
} from "../utils/format";
import { copyToClipboard } from "../utils/copy";
import { emptyWalletSnapshot, normalizeWalletPair, xrpBarPercents } from "../wallet/composeWallet";
import { useMorph } from "../wallet/useMorph";

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
  return (
    <div className={`wallet-panel${empty ? " is-empty" : " is-filled"}`}>
      <p className="wallet-panel-title">{t.xdxValue}</p>
      <dl className="wallet-mini-list">
        <div>
          <dt>{t.xdx}</dt>
          <dd>{empty ? "—" : formatToken(xdx.xdx, locale, 2)}</dd>
        </div>
        <div>
          <dt>{t.xrp}</dt>
          <dd>{empty ? "—" : formatXrpPrice(xdx.xrp, locale)}</dd>
        </div>
      </dl>
    </div>
  );
}

function SupplyShareBars({ supply, locale, t, empty }) {
  const circ = useMorph(empty ? 0 : supply.circulatingPct);
  const amm = useMorph(empty ? 0 : supply.ammPct);
  const circWidth = empty ? 0 : Math.min(100, Math.max(Number(circ) > 0 ? 4 : 0, Number(circ) * 12));
  const ammWidth = empty ? 0 : Math.min(100, Math.max(Number(amm) > 0 ? 4 : 0, Number(amm) * 12));
  return (
    <div className={`wallet-panel${empty ? " is-empty" : " is-filled"}`}>
      <p className="wallet-panel-title">{t.supplyShare}</p>
      <div className="wallet-micro">
        <span>{t.circulating}</span>
        <span className="wallet-micro-track">
          <i style={{ width: `${circWidth}%` }} />
        </span>
        <b>{empty ? "—" : formatSharePercent(circ, locale)}</b>
      </div>
      <div className="wallet-micro">
        <span>{t.amm}</span>
        <span className="wallet-micro-track">
          <i className="is-amm" style={{ width: `${ammWidth}%` }} />
        </span>
        <b>{empty ? "—" : formatSharePercent(amm, locale)}</b>
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

export default function ConnectedWallet() {
  const { t, locale } = useI18n();
  const { walletAddress } = useWallet();
  const [snap, setSnap] = useState(() => emptyWalletSnapshot(null));
  const [pair, setPair] = useState("");

  useEffect(() => {
    if (!walletAddress) return undefined;
    let cancelled = false;

    async function load() {
      const next = await getConnectedWallet(walletAddress).catch(() =>
        emptyWalletSnapshot(walletAddress)
      );
      if (cancelled) return;
      setSnap(next);
      setPair((current) => {
        const names = next.lp.map((row) => normalizeWalletPair(row.pool));
        const wanted = normalizeWalletPair(current);
        if (wanted && names.includes(wanted)) return wanted;
        return names[0] || "";
      });
    }

    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [walletAddress]);

  const view = walletAddress ? snap : emptyWalletSnapshot(null);
  const empty = !view.signedIn || !view.filled;
  const pools = [...new Set(view.lp.map((row) => normalizeWalletPair(row.pool)).filter(Boolean))];
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
          <div>
            <p className="wallet-hero-label">{t.xdxValue}</p>
            <p className={`wallet-hero-usd${empty ? " is-empty" : " is-filled"}`}>
              {empty ? "—" : formatUsd(view.xdx.usd, locale)}
            </p>
            <p className={`wallet-hero-gbp${empty ? " is-empty" : " is-filled"}`}>
              {empty ? "—" : formatGbp(view.xdx.gbp, locale)}
            </p>
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

      <div className="wallet-infographics">
        <XrpBalanceBars xrp={view.xrp} locale={locale} t={t} empty={empty} />
        <XdxBalancePanel xdx={view.xdx} locale={locale} t={t} empty={empty} />
        <SupplyShareBars supply={view.supply} locale={locale} t={t} empty={empty} />
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

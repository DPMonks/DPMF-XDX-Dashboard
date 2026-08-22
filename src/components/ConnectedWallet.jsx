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
import { emptyWalletSnapshot } from "../wallet/composeWallet";
import { useMorph } from "../wallet/useMorph";

function Ring({ value, max = 1, radius, color, empty }) {
  const circ = 2 * Math.PI * radius;
  const pct = empty || !(max > 0) ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <circle
      cx="60"
      cy="60"
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth="7"
      strokeLinecap="round"
      strokeDasharray={`${circ * pct} ${circ}`}
      transform="rotate(-90 60 60)"
      className="wallet-dial-ring"
    />
  );
}

function XrpReserveBar({ xrp, locale, t, empty }) {
  const spendable = useMorph(empty ? 0 : xrp.spendable);
  const reserved = useMorph(empty ? 0 : xrp.reserved);
  const total = Number(xrp.balance) || Number(spendable) + Number(reserved) || 1;
  const spendPct = empty ? 0 : Math.min(100, ((Number(spendable) || 0) / total) * 100);
  const reservePct = empty ? 0 : Math.min(100 - spendPct, ((Number(reserved) || 0) / total) * 100);

  return (
    <div className={`wallet-panel${empty ? " is-empty" : " is-filled"}`}>
      <p className="wallet-panel-title">{t.xrpReserve}</p>
      <div className="wallet-xrp-bar" aria-hidden="true">
        <span className="is-spend" style={{ height: `${spendPct}%` }} />
        <span className="is-reserve" style={{ height: `${reservePct}%` }} />
      </div>
      <dl className="wallet-mini-list">
        <div>
          <dt>{t.spendableXrp}</dt>
          <dd>{empty ? "—" : formatToken(spendable, locale, 4)}</dd>
        </div>
        <div>
          <dt>{t.reservedXrp}</dt>
          <dd>{empty ? "—" : formatToken(reserved, locale, 4)}</dd>
        </div>
        <div>
          <dt>{t.xrp}</dt>
          <dd>{empty ? "—" : formatToken(xrp.balance, locale, 4)}</dd>
        </div>
      </dl>
    </div>
  );
}

function XdxBalanceDial({ xdx, locale, t, empty }) {
  const usd = useMorph(empty ? 0 : xdx.usd);
  return (
    <div className={`wallet-panel wallet-dial-panel${empty ? " is-empty" : " is-filled"}`}>
      <p className="wallet-panel-title">{t.xdxValue}</p>
      <div className="wallet-dial-wrap">
        <svg viewBox="0 0 120 120" className="wallet-dial" aria-hidden="true">
          <circle cx="60" cy="60" r="50" className="wallet-dial-track" />
          <circle cx="60" cy="60" r="38" className="wallet-dial-track" />
          <circle cx="60" cy="60" r="26" className="wallet-dial-track" />
          <Ring value={empty ? 0 : 1} max={1} radius={50} color="var(--dpmf-neon-violet)" empty={empty} />
          <Ring value={empty ? 0 : 0.72} max={1} radius={38} color="var(--dpmf-neon-cyan)" empty={empty} />
          <Ring value={empty ? 0 : 0.48} max={1} radius={26} color="var(--dpmf-neon-lime)" empty={empty} />
        </svg>
        <div className="wallet-dial-center">
          <strong>{empty ? "—" : formatUsd(usd, locale)}</strong>
          <span>{empty ? "—" : formatGbp(xdx.gbp, locale)}</span>
        </div>
      </div>
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
      setPair((current) => current || next.lp[0]?.pool || "");
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
  const pools = view.lp.map((row) => row.pool);
  const position = useMemo(
    () => view.lp.find((row) => row.pool === pair) || view.lp[0] || null,
    [view.lp, pair]
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
          <button
            type="button"
            className="account-link"
            onClick={() => copyToClipboard(walletAddress)}
          >
            {shortAddress(walletAddress)}
          </button>
        ) : (
          <p className="wallet-hero-hint">{t.connectWalletHint}</p>
        )}
      </header>

      <div className="wallet-infographics">
        <XrpReserveBar xrp={view.xrp} locale={locale} t={t} empty={empty} />
        <XdxBalanceDial xdx={view.xdx} locale={locale} t={t} empty={empty} />
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

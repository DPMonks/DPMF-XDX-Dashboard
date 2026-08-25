import { useEffect, useMemo, useRef, useState } from "react";
import { getConnectedWallet, loadWalletLpIncomeHistory } from "../api/indexer";
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
  shortAddress,
} from "../utils/format";
import { copyToClipboard } from "../utils/copy";
import {
  emptyWalletSnapshot,
  normalizeWalletPair,
  preferFilledWalletSnapshot,
  preferredWalletPair,
  sortWalletPairs,
  xrpBarPercents,
} from "../wallet/composeWallet";
import { formatFeePercent } from "../wallet/ammVote";
import { useMorph } from "../wallet/useMorph";
import { mergeWalletActivity, mergeWalletOrders, pendingFromExecution } from "../wallet/ledgerOrders";
import {
  DEFAULT_INCOME_PAIR,
  INCOME_PAGE_DAYS,
  downloadTextFile,
  incomeDayKeys,
  incomePairChoices,
  incomeRowsForPair,
  lpIncomeCsv,
  mergeRecordedLpIncome,
  pageLpIncome,
  readRecordedLpIncome,
  writeRecordedLpIncome,
} from "../wallet/lpIncome";

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

function XdxBalancePanel({ xdx, holdings, locale, t, empty }) {
  const rows = [
    { id: "xdx", label: t.xdx, value: empty ? "—" : formatToken(holdings?.xdx, locale, 2) },
    { id: "xrp", label: t.xrp, value: empty ? "—" : formatToken(holdings?.xrp, locale, 4) },
    { id: "rlusd", label: t.rlusd || "RLUSD", value: empty ? "—" : formatToken(holdings?.rlusd, locale, 2) },
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
    <div className={`wallet-panel wallet-share${empty ? " is-empty" : " is-filled"}`}>
      <p className="wallet-panel-title is-center">{t.supplyShare}</p>
      <div className="wallet-micro">
        <span>{t.circulating}</span>
        <b>{empty ? "—" : formatSharePercent(circ, locale)}</b>
        <span className="wallet-micro-track">
          <i style={{ width: `${circWidth}%` }} />
        </span>
      </div>
      <div className="wallet-micro">
        <span>{t.xdxSupplyShare}</span>
        <b>{empty ? "—" : formatSupplySharePercent(supplyPct, locale)}</b>
        <span className="wallet-micro-track">
          <i className="is-amm" style={{ width: `${supplyWidth}%` }} />
        </span>
      </div>
      <div className="wallet-micro is-pending">
        <span>{t.borrowed}</span>
        <b>—</b>
        <span className="wallet-micro-track">
          <i style={{ width: 0 }} />
        </span>
      </div>
      <div className="wallet-micro is-pending">
        <span>{t.lending}</span>
        <b>—</b>
        <span className="wallet-micro-track">
          <i style={{ width: 0 }} />
        </span>
      </div>
    </div>
  );
}

function poolWindowText(pool, window, locale, empty) {
  if (empty || !pool) return "—";
  const xdx = window === "7d" ? pool.xdx7d : pool.xdx24h;
  const usd = window === "7d" ? pool.usd7d : pool.usd24h;
  if (!(Number(xdx) > 0) && !(Number(usd) > 0)) return "—";
  return `${formatToken(xdx, locale, 2)}  ${formatUsd(usd, locale)}`;
}

function LpInfographic({ position, earn, locale, t, empty }) {
  const share = useMorph(empty ? 0 : position?.lp_share_percent);
  const xdxComp = useMorph(empty ? 0 : position?.composition_xdx_percent);
  const quoteComp = useMorph(empty ? 0 : position?.composition_quote_percent);
  const shareWidth = empty ? 0 : Math.min(100, Math.max(Number(share) > 0 ? 6 : 0, Number(share) * 8));
  const earn24 = poolWindowText(earn, "24h", locale, empty);
  const earn7 = poolWindowText(earn, "7d", locale, empty);
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
        <div>
          <dt>{t.lpFees24h}</dt>
          <dd className="is-earn">{empty ? "—" : earn24}</dd>
        </div>
        <div>
          <dt>{t.lpFees7d}</dt>
          <dd className="is-earn">{empty ? "—" : earn7}</dd>
        </div>
      </dl>
    </div>
  );
}

function WalletIncomePanel({ address, snapshotRows, positions, pools, priceBook, locale, t, empty }) {
  const [incomePair, setIncomePair] = useState(DEFAULT_INCOME_PAIR);
  const [historyActivity, setHistoryActivity] = useState(null);
  const [historyDays, setHistoryDays] = useState([]);
  const [recordedRows] = useState(() => readRecordedLpIncome(address));
  const [loading, setLoading] = useState(() => Boolean(address) && !empty);
  const [historyComplete, setHistoryComplete] = useState(false);
  const [daysShown, setDaysShown] = useState(INCOME_PAGE_DAYS);
  const [epoch, setEpoch] = useState(0);
  const cacheRef = useRef(new Map());
  const sentinelRef = useRef(null);
  const pairs = incomePairChoices({
    positions,
    activity: [...(Array.isArray(snapshotRows) ? snapshotRows : []), ...(historyActivity || [])],
  });
  const all = incomeRowsForPair({
    pair: incomePair,
    snapshotRows,
    historyActivity,
    historyDays,
    recordedRows,
    positions,
    pools,
    prices: priceBook,
    xdxUsd: priceBook?.xdxUsd,
    xrpUsd: priceBook?.xrpUsd,
    rlusdUsd: priceBook?.RLUSD,
  });
  const dayCount = incomeDayKeys(all).length;
  const visible = pageLpIncome(all, daysShown);
  const pagedOut = empty || dayCount === 0 || daysShown >= dayCount;
  const done = pagedOut && !loading && (empty || historyComplete || historyActivity != null);

  useEffect(() => {
    if (!address || empty) return undefined;
    const key = `${address}:${incomePair}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setHistoryActivity(cached.activity);
      setHistoryDays(Array.isArray(cached.days) ? cached.days : []);
      setHistoryComplete(cached.complete);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setHistoryComplete(false);
    loadWalletLpIncomeHistory(address, { pair: incomePair, fresh: epoch > 0 })
      .then((result) => {
        if (cancelled) return;
        cacheRef.current.set(key, result);
        setHistoryActivity(result.activity);
        setHistoryDays(Array.isArray(result.days) ? result.days : []);
        setHistoryComplete(result.complete);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, incomePair, empty, epoch]);

  useEffect(() => {
    if (!address) return undefined;
    function bust() {
      for (const key of [...cacheRef.current.keys()]) {
        if (key.startsWith(`${address}:`)) cacheRef.current.delete(key);
      }
      setEpoch((current) => current + 1);
    }
    window.addEventListener("dpmf-wallet-refresh", bust);
    window.addEventListener("dpmf-trade-executed", bust);
    window.addEventListener("dpmf-function-confirmed", bust);
    return () => {
      window.removeEventListener("dpmf-wallet-refresh", bust);
      window.removeEventListener("dpmf-trade-executed", bust);
      window.removeEventListener("dpmf-function-confirmed", bust);
    };
  }, [address]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || pagedOut) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDaysShown((current) => current + INCOME_PAGE_DAYS);
        }
      },
      { root: node.parentElement, rootMargin: "24px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [pagedOut, daysShown]);

  function onPairChange(next) {
    setIncomePair(next);
    setDaysShown(INCOME_PAGE_DAYS);
    const cached = address ? cacheRef.current.get(`${address}:${next}`) : null;
    if (cached) {
      setHistoryActivity(cached.activity);
      setHistoryDays(Array.isArray(cached.days) ? cached.days : []);
      setHistoryComplete(cached.complete);
      setLoading(false);
      return;
    }
    setHistoryActivity(null);
    setHistoryDays([]);
    setHistoryComplete(false);
    setLoading(true);
  }

  useEffect(() => {
    if (!address || empty || !all.length) return;
    writeRecordedLpIncome(address, mergeRecordedLpIncome(readRecordedLpIncome(address), all));
  }, [address, empty, all]);

  return (
    <section className={`wallet-book wallet-income${empty ? " is-empty" : " is-filled"}`}>
      <div className="wallet-income-head">
        <h3>{t.lpPassiveIncome || "LP Earning/Passive income"}</h3>
        <div className="wallet-income-tools">
          <label className="wallet-lp-select wallet-income-select">
            <span className="sr-only">{t.incomePairSelect || t.incomePair || "Pair"}</span>
            <select
              value={incomePair}
              disabled={empty}
              aria-label={t.incomePairSelect || t.incomePair || "Pair"}
              onChange={(event) => onPairChange(event.target.value)}
            >
              {pairs.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="copy-btn wallet-income-copy"
            disabled={empty || !all.length}
            onClick={() => downloadTextFile("lp-earnings.csv", lpIncomeCsv(all))}
            aria-label={t.downloadLpIncome || "Download LP earnings"}
          >
            {t.copy || "Copy"}
          </button>
        </div>
      </div>
      {loading ? (
        <div
          className="wallet-income-load"
          role="progressbar"
          aria-label={t.loadingLpIncome || "Loading LP history"}
        >
          <span />
        </div>
      ) : null}
      <div className="wallet-income-scroll">
        <table className="wallet-income-table">
          <thead>
            <tr>
              <th>{t.incomeDate || "Date"}</th>
              <th>{t.incomeLpTokens || "LP"}</th>
              <th>{t.incomePair || "Pair"}</th>
              <th>{t.incomeUsd || "USD"}</th>
            </tr>
          </thead>
          <tbody>
            {empty || !visible.length ? (
              <tr>
                <td colSpan={4}>{empty ? "—" : t.noLpIncome || "No LP earnings yet"}</td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={`${row.txid || row.date}-${row.pair}-${row.kind || "fee"}-${row.lpTokens}`}>
                  <td>{row.date}</td>
                  <td className="is-lp">{formatToken(row.lpTokens, locale, 4)}</td>
                  <td>{row.pair}</td>
                  <td className="is-earn">{formatUsd(row.usd, locale)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {done ? (
          <p className="wallet-income-end">{empty ? "" : t.incomeEnd || "end"}</p>
        ) : (
          <div ref={sentinelRef} className="wallet-income-more" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}

function earnText(value, format, empty) {
  if (empty || value == null || !Number.isFinite(Number(value))) return "—";
  return format(Number(value));
}

function earnAmount(amount, usd, locale, digits, empty) {
  return {
    amount: earnText(amount, (n) => formatToken(n, locale, digits), empty),
    usd: earnText(usd, (n) => formatUsd(n, locale), empty),
  };
}

function WalletEarnCell({ label, rows, empty, className = "", usdOnly = false, t }) {
  return (
    <div
      className={`wallet-earn-cell${empty ? " is-empty" : " is-filled"}${usdOnly ? " is-usd-only" : ""}${className ? ` ${className}` : ""}`}
    >
      <p className="wallet-earn-label">{label}</p>
      <p className="wallet-earn-cols">
        <span className="wallet-earn-cols-spacer" aria-hidden="true" />
        <span className="wallet-earn-cols-titles">
          {usdOnly ? null : <span className="wallet-earn-col-lp">{t?.incomeLpTokens || "LP"}</span>}
          <span className="wallet-earn-col-usd">{t?.incomeUsd || "USD"}</span>
        </span>
      </p>
      {rows.map((row) => (
        <p key={row.range} className="wallet-earn-row">
          <span className="wallet-earn-range">{row.range}</span>
          <span className="wallet-earn-value">
            <b>{row.amount}</b>
            {row.usd ? <i>{row.usd}</i> : null}
          </span>
        </p>
      ))}
    </div>
  );
}

function WalletEarnBeam({ fees, locale, t, empty }) {
  const earn = fees?.earnings || {};
  const xrp24 = earnAmount(earn.xrp24h, earn.xrp24hUsd, locale, 4, empty);
  const xrp7 = earnAmount(earn.xrp7d, earn.xrp7dUsd, locale, 4, empty);
  const xdx24 = earnAmount(earn.xdx24h, earn.xdx24hUsd, locale, 2, empty);
  const xdx7 = earnAmount(earn.xdx7d, earn.xdx7dUsd, locale, 2, empty);
  const rlusd24 = earnAmount(earn.rlusd24h, earn.rlusd24hUsd, locale, 4, empty);
  const rlusd7 = earnAmount(earn.rlusd7d, earn.rlusd7dUsd, locale, 4, empty);
  return (
    <section className="wallet-earn-board" aria-label={t.lpFeeEarnings}>
      <h3 className="wallet-earn-title">{t.lpFeeEarnings}</h3>
      <div className="wallet-earn-beam">
        <WalletEarnCell
          className="wallet-earn-xrp"
          label={t.xrp}
          empty={empty}
          t={t}
          rows={[
            { range: t.lpFees24h, amount: xrp24.amount, usd: xrp24.usd },
            { range: t.lpFees7d, amount: xrp7.amount, usd: xrp7.usd },
          ]}
        />
        <WalletEarnCell
          className="wallet-earn-xdx"
          label={t.xdx}
          empty={empty}
          t={t}
          rows={[
            { range: t.lpFees24h, amount: xdx24.amount, usd: xdx24.usd },
            { range: t.lpFees7d, amount: xdx7.amount, usd: xdx7.usd },
          ]}
        />
        <WalletEarnCell
          className="wallet-earn-rlusd"
          label={t.rlusd || "RLUSD"}
          empty={empty}
          t={t}
          rows={[
            { range: t.lpFees24h, amount: rlusd24.amount, usd: rlusd24.usd },
            { range: t.lpFees7d, amount: rlusd7.amount, usd: rlusd7.usd },
          ]}
        />
        <WalletEarnCell
          className="wallet-earn-total"
          label={t.totalEarnings}
          empty={empty}
          usdOnly
          t={t}
          rows={[
            { range: t.lpFees24h, amount: earnText(earn.usd24h, (n) => formatUsd(n, locale), empty) },
            { range: t.lpFees7d, amount: earnText(earn.usd7d, (n) => formatUsd(n, locale), empty) },
          ]}
        />
      </div>
    </section>
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
      setSnap((current) => preferFilledWalletSnapshot(current, next));
      setPair((current) => {
        const pairs = next.lp.map((row) => row.pool);
        if (!pairs.length) return current;
        return preferredWalletPair(pairs, current);
      });
    }

    load();
    const retries = [];
    retries.push(window.setTimeout(() => load(false), 800));
    retries.push(window.setTimeout(() => load(true), 2800));
    const id = setInterval(load, 30000);
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
          <XdxBalancePanel xdx={view.xdx} holdings={view.holdings} locale={locale} t={t} empty={empty} />
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
        <LpInfographic
          position={position}
          earn={view.fees?.earnings?.pools?.[selected]}
          locale={locale}
          t={t}
          empty={empty || !position}
        />
      </section>

      <WalletIncomePanel
        key={walletAddress || "out"}
        address={walletAddress}
        snapshotRows={view.income}
        positions={view.lp}
        pools={view.pools}
        priceBook={view.priceBook}
        locale={locale}
        t={t}
        empty={!walletAddress}
      />

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

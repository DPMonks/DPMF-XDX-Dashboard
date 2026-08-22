import { useEffect, useMemo, useRef, useState } from "react";
import { copyToClipboard } from "../utils/copy";
import {
  collectPairOptions,
  filterOrderbookPairs,
  normalizeOrderbookPair,
  sameOrderbookPair,
} from "../orderbook";
import {
  formatPercent,
  formatToken,
  formatWhen,
  shareOf,
  shortAddress,
} from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

const PAGE_SIZE = 100;

function PairSelect({ pairs, value, onChange, t }) {
  const boxRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => filterOrderbookPairs(pairs, query), [pairs, query]);
  const label = value === "all" ? t.allPairs : value;

  useEffect(() => {
    function onDoc(event) {
      if (!boxRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function select(next) {
    onChange(next);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={`pair-select ${open ? "is-open" : ""}`} ref={boxRef}>
      <div className="pair-select-control">
        <input
          className="pair-select-input"
          type="search"
          value={open ? query : label}
          placeholder={t.searchPair}
          aria-label={t.searchPair}
          aria-expanded={open}
          aria-haspopup="listbox"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
            }
            if (event.key === "Enter" && matches[0]) select(matches[0]);
          }}
        />
        <button
          type="button"
          className="pair-select-chevron"
          tabIndex={-1}
          aria-label={t.pair}
          onClick={() => setOpen((current) => !current)}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              d="M4.2 7.2h11.6L10 14.2 4.2 7.2z"
              fill="url(#pair-caret)"
              stroke="#c770ff"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <defs>
              <linearGradient id="pair-caret" x1="4" y1="7" x2="16" y2="15" gradientUnits="userSpaceOnUse">
                <stop stopColor="#00eaff" />
                <stop offset="1" stopColor="#c770ff" />
              </linearGradient>
            </defs>
          </svg>
        </button>
      </div>
      {open ? (
        <ul className="pair-select-list" role="listbox">
          {!query.trim() ? (
            <li>
              <button
                type="button"
                className={value === "all" ? "is-active" : ""}
                onClick={() => select("all")}
              >
                {t.allPairs}
              </button>
            </li>
          ) : null}
          {matches.map((pair) => (
            <li key={pair}>
              <button
                type="button"
                className={value === pair ? "is-active" : ""}
                onClick={() => select(pair)}
              >
                {pair}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function RichList({
  rows,
  loading,
  error,
  valueKey,
  emptyLabel,
  showPair = false,
  defaultPair = "XDX/XRP",
  pairOptions = [],
  unit = "XDX",
  searchPlaceholder,
  freshness = null,
  shareTotal = null,
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [pairFilter, setPairFilter] = useState(showPair ? defaultPair : "all");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(null);

  const pairs = useMemo(() => {
    const fromRows = rows.map((row) => row.pair).filter(Boolean);
    return collectPairOptions([...pairOptions, ...fromRows]);
  }, [rows, pairOptions]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (showPair && !sameOrderbookPair(row.pair, pairFilter)) return false;
      if (!needle) return true;
      return String(row.account || "").toLowerCase().includes(needle);
    });
  }, [rows, query, pairFilter, showPair]);

  const listedTotal = filtered.reduce(
    (sum, row) => sum + Number(row[valueKey] || 0),
    0
  );
  const total =
    Number.isFinite(Number(shareTotal)) && Number(shareTotal) > 0
      ? Number(shareTotal)
      : listedTotal;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered
    .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    .map((row, index) => ({
      ...row,
      rank: showPair ? (currentPage - 1) * PAGE_SIZE + index + 1 : row.rank,
    }));

  const copy = async (address) => {
    await copyToClipboard(address);
    setCopied(address);
    setTimeout(() => setCopied((current) => (current === address ? null : current)), 1600);
  };

  if (loading && !rows.length) {
    return (
      <div className="scroll-area">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} height={36} />
        ))}
      </div>
    );
  }

  if (error && !rows.length) {
    return <p className="error-message">{error}</p>;
  }

  const freshnessLine = freshness ? (
    <p
      className={`rich-freshness ${
        freshness.catching_up ? "is-catching-up" : "is-present"
      }`}
    >
      <span className="rich-freshness-dot" aria-hidden="true" />
      {freshness.catching_up
        ? `${t.todaySnapshotWaiting} ${
            freshness.as_of || freshness.snapshot_day
              ? formatWhen(freshness.as_of || freshness.snapshot_day, locale)
              : ""
          }`.trim()
        : freshness.as_of
          ? `${t.todaySnapshot} ${formatWhen(freshness.as_of, locale)}`
          : t.todaySnapshotLive}
    </p>
  ) : null;

  if (!rows.length) {
    return (
      <div className="rich-list">
        {freshnessLine}
        <p className="empty-message">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="rich-list">
      <div className="rich-list-toolbar">
        {showPair ? (
          <PairSelect
            pairs={pairs}
            value={pairFilter}
            onChange={(next) => {
              setPairFilter(next === "all" ? "all" : normalizeOrderbookPair(next));
              setPage(1);
            }}
            t={t}
          />
        ) : null}
        <input
          className="rich-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={searchPlaceholder}
        />
        <p className="rich-meta">
          {t.showing} {filtered.length.toLocaleString(locale)} {t.addresses}
        </p>
      </div>
      {freshnessLine}

      <div className="rich-table-wrap">
        {filtered.length ? (
          <table className="rich-table">
            <thead>
              <tr>
                <th>{t.rank}</th>
                <th>{t.address}</th>
                {showPair && <th>{t.pair}</th>}
                <th>{t.balance}</th>
                <th>{t.share}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={`${row.account}-${row.pair || "xdx"}-${row.rank}`}>
                  <td className="col-rank">{row.rank}</td>
                  <td className="col-address">
                    <button
                      type="button"
                      className="account-link"
                      title={row.account}
                      onClick={() => copy(row.account)}
                    >
                      <span className="address-full">{row.account}</span>
                      <span className="address-short">{shortAddress(row.account)}</span>
                    </button>
                    {row.frozen && <span className="frozen-badge">{t.frozen}</span>}
                  </td>
                  {showPair && (
                    <td>
                      <span className="pair-badge">
                        {normalizeOrderbookPair(row.pair || "XDX/XRP")}
                      </span>
                    </td>
                  )}
                  <td className="col-num col-balance">
                    {formatToken(row[valueKey], locale, 8)} {unit}
                  </td>
                  <td className="col-num">
                    {formatPercent(shareOf(row[valueKey], total), locale)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => copy(row.account)}
                    >
                      {copied === row.account ? t.copied : t.copy}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-message">{showPair ? t.emptyLpPair : emptyLabel}</p>
        )}
      </div>

      <div className="pagination">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          ‹
        </button>
        <span>
          {t.page} {currentPage} {t.of} {totalPages}
        </span>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
        >
          ›
        </button>
      </div>
    </div>
  );
}

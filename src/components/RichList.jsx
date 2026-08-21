import { useMemo, useState } from "react";
import { copyToClipboard } from "../utils/copy";
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

export default function RichList({
  rows,
  loading,
  error,
  valueKey,
  emptyLabel,
  showPair = false,
  unit = "XDX",
  searchPlaceholder,
  freshness = null,
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [pairFilter, setPairFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(null);

  const pairs = useMemo(() => {
    const unique = [...new Set(rows.map((row) => row.pair).filter(Boolean))];
    return unique.sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (showPair && pairFilter !== "all" && row.pair !== pairFilter) return false;
      if (!needle) return true;
      return (
        String(row.account || "").toLowerCase().includes(needle) ||
        String(row.pair || "").toLowerCase().includes(needle)
      );
    });
  }, [rows, query, pairFilter, showPair]);

  const total = filtered.reduce((sum, row) => sum + Number(row[valueKey] || 0), 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

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
        {showPair && pairs.length > 1 && (
          <div className="pair-filters">
            <button
              type="button"
              className={pairFilter === "all" ? "pair-chip active" : "pair-chip"}
              onClick={() => {
                setPairFilter("all");
                setPage(1);
              }}
            >
              {t.pair}
            </button>
            {pairs.map((pair) => (
              <button
                key={pair}
                type="button"
                className={pairFilter === pair ? "pair-chip active" : "pair-chip"}
                onClick={() => {
                  setPairFilter(pair);
                  setPage(1);
                }}
              >
                {pair}
              </button>
            ))}
          </div>
        )}
        <p className="rich-meta">
          {t.showing} {filtered.length.toLocaleString(locale)} {t.addresses}
        </p>
      </div>
      {freshnessLine}

      <div className="rich-table-wrap">
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
                    <span className="pair-badge">{row.pair || "XDX/XRP"}</span>
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
      </div>

      {totalPages > 1 && (
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
      )}
    </div>
  );
}

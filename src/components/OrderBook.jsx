import { useEffect, useMemo, useState } from "react";
import { getOrderbooks } from "../api/indexer";
import {
  bookHeader,
  emptyOrderbook,
  FEATURED_ORDERBOOK_PAIRS,
  filterOrderbookPairs,
  mergeOrderbookPayloads,
  normalizeOrderbookPair,
  padOrderbookLevels,
} from "../orderbook";
import { formatQuotePerBase, formatToken, formatUsdPrice, formatWhen } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

function depthWidth(value, max) {
  const size = Number(value || 0);
  const cap = Number(max || 0);
  if (!(size > 0) || !(cap > 0)) return 0;
  return Math.min(100, (size / cap) * 100);
}

function ammMeasure(row) {
  return Number(row?.amm_opposing || 0) || Number(row?.amm_through || 0) || 0;
}

function BookSide({ title, rows, side, locale, t }) {
  const filled = rows.filter((row) => !row.placeholder && Number(row.base_size) > 0);
  const max = Math.max(0, ...filled.map((row) => Number(row.cumulative_base || row.base_size || 0)));
  const maxAmm = Math.max(0, ...filled.map((row) => ammMeasure(row)));
  const isAsk = side === "ask";

  const amount = (row) =>
    row.placeholder || row.base_size == null ? "—" : formatToken(row.base_size, locale, 2);
  const price = (row) =>
    row.placeholder || row.price == null ? "—" : formatQuotePerBase(row.price, locale, "");

  return (
    <div className={`orderbook-side is-${side}`}>
      <h3 className="orderbook-side-title">{title}</h3>
      <div className={`orderbook-row is-head is-${side}`}>
        {isAsk ? (
          <>
            <span>{t.price}</span>
            <span>{t.orderAmount}</span>
          </>
        ) : (
          <>
            <span>{t.orderAmount}</span>
            <span>{t.price}</span>
          </>
        )}
      </div>
      <div className="orderbook-tape" role="list" aria-label={title}>
        {rows.map((row, index) => (
          <div
            key={`${side}-${row.level ?? index}-${row.price ?? "empty"}`}
            className={`orderbook-row is-${side}${row.source === "amm" ? " is-amm" : ""}${
              row.placeholder ? " is-empty" : ""
            }`}
            role="listitem"
          >
            {!row.placeholder ? (
              <>
                <span
                  className="orderbook-depth"
                  style={{ width: `${depthWidth(row.cumulative_base || row.base_size, max)}%` }}
                  aria-hidden="true"
                />
                {ammMeasure(row) > 0 ? (
                  <span
                    className="orderbook-depth is-amm"
                    style={{ width: `${depthWidth(ammMeasure(row), maxAmm)}%` }}
                    title={t.ammDepth}
                    aria-hidden="true"
                  />
                ) : null}
              </>
            ) : null}
            {isAsk ? (
              <>
                <span className="orderbook-price">{price(row)}</span>
                <span className="orderbook-amount">{amount(row)}</span>
              </>
            ) : (
              <>
                <span className="orderbook-amount">{amount(row)}</span>
                <span className="orderbook-price">{price(row)}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrderBook() {
  const { t, locale } = useI18n();
  const [pair, setPair] = useState("XDX/XRP");
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getOrderbooks();
        if (!cancelled) {
          setBooks((current) => mergeOrderbookPayloads(current, next));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    const timeout = setTimeout(load, 250);
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(id);
    };
  }, []);

  const pairs = books?.pairs || FEATURED_ORDERBOOK_PAIRS;
  const matches = useMemo(
    () => filterOrderbookPairs(pairs, query).slice(0, 8),
    [pairs, query]
  );

  const book = useMemo(() => {
    const name = normalizeOrderbookPair(pair);
    return books?.books?.[name] || books?.books?.[pair] || emptyOrderbook(name);
  }, [books, pair]);

  const bidRows = useMemo(() => padOrderbookLevels(book.bids || []), [book]);
  const askRows = useMemo(() => padOrderbookLevels(book.asks || []), [book]);

  if (!books && !error) {
    return (
      <div className="orderbook">
        <Skeleton height={220} />
      </div>
    );
  }

  if (error && !books) {
    return <p className="error-message">{error}</p>;
  }

  const quote = book.quote || pair.split("/")[1] || "XRP";
  const header = bookHeader(book);
  const chips = FEATURED_ORDERBOOK_PAIRS.includes(normalizeOrderbookPair(pair))
    ? FEATURED_ORDERBOOK_PAIRS
    : [...FEATURED_ORDERBOOK_PAIRS, normalizeOrderbookPair(pair)];

  function selectPair(name) {
    setPair(normalizeOrderbookPair(name));
    setQuery("");
  }

  return (
    <div className="orderbook">
      <div className="orderbook-toolbar">
        <div className="orderbook-pairs" role="tablist" aria-label={t.orderbook}>
          {chips.map((name) => (
            <button
              key={name}
              type="button"
              className={normalizeOrderbookPair(pair) === name ? "pair-chip active" : "pair-chip"}
              onClick={() => selectPair(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="orderbook-search-wrap">
          <input
            type="search"
            className="orderbook-search"
            value={query}
            placeholder={t.searchPair}
            aria-label={t.searchPair}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && matches[0]) selectPair(matches[0]);
            }}
          />
          {query.trim() && matches.length ? (
            <ul className="orderbook-search-list">
              {matches.map((name) => (
                <li key={name}>
                  <button type="button" onClick={() => selectPair(name)}>
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="orderbook-unit">{t.orderbookUnit} {quote}</p>
      </div>

      <dl className="orderbook-header">
        <div>
          <dt>{t.bestBid}</dt>
          <dd className="is-bid">{formatQuotePerBase(header.best_bid, locale, quote)}</dd>
        </div>
        <div>
          <dt>{t.bestAsk}</dt>
          <dd className="is-ask">{formatQuotePerBase(header.best_ask, locale, quote)}</dd>
        </div>
        <div>
          <dt>{t.mid}</dt>
          <dd>{formatQuotePerBase(header.mid, locale, quote)}</dd>
        </div>
        <div>
          <dt>{t.spreadBps}</dt>
          <dd>{header.spread_bps == null ? "—" : Number(header.spread_bps).toFixed(1)}</dd>
        </div>
        <div>
          <dt>{t.midUsdHint}</dt>
          <dd>{header.mid_usd ? formatUsdPrice(header.mid_usd, locale) : "—"}</dd>
        </div>
      </dl>

      <div className="orderbook-board">
        <BookSide title={t.bids} rows={bidRows} side="bid" locale={locale} t={t} />
        <BookSide title={t.asks} rows={askRows} side="ask" locale={locale} t={t} />
      </div>

      {book.dex_present ? (
        <p className="orderbook-asof">{t.ammDepth}</p>
      ) : (
        <p className="orderbook-asof">{t.emptyOrderbook}</p>
      )}

      {book.as_of ? (
        <p className="orderbook-asof">
          {t.updated} {formatWhen(book.as_of, locale)}
        </p>
      ) : null}
    </div>
  );
}

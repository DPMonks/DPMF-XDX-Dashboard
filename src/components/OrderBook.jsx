import { useEffect, useMemo, useState } from "react";
import { getOrderbooks } from "../api/indexer";
import { emptyOrderbook, normalizeOrderbookPair } from "../orderbook";
import { formatQuotePerBase, formatToken, formatUsdPrice, formatWhen } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

function depthWidth(row, maxCumulative) {
  const value = Number(row?.cumulative_base || row?.base_size || 0);
  const max = Number(maxCumulative || 0);
  if (!(value > 0) || !(max > 0)) return 0;
  return Math.min(100, (value / max) * 100);
}

function BookSide({ title, rows, quote, side, locale, t }) {
  const max = Math.max(0, ...rows.map((row) => Number(row.cumulative_base || 0)));
  return (
    <div className={`orderbook-side is-${side}`}>
      <h3 className="orderbook-side-title">{title}</h3>
      <div className="orderbook-row is-head">
        <span>{t.price}</span>
        <span>XDX</span>
        <span>{quote}</span>
      </div>
      <div className="orderbook-tape">
        {rows.map((row, index) => (
          <div
            key={`${side}-${row.level || index}-${row.price}`}
            className={`orderbook-row is-${side} ${row.source === "amm" ? "is-amm" : ""}`}
          >
            <span
              className="orderbook-depth"
              style={{ width: `${depthWidth(row, max)}%` }}
              aria-hidden="true"
            />
            <span className="orderbook-price">
              {formatQuotePerBase(row.price, locale, "")}
            </span>
            <span>{formatToken(row.base_size, locale, 2)}</span>
            <span>{formatToken(row.quote_size ?? row.cumulative_quote, locale, 4)}</span>
          </div>
        ))}
        {!rows.length ? <p className="orderbook-empty">{t.emptyOrderbookSide}</p> : null}
      </div>
    </div>
  );
}

export default function OrderBook() {
  const { t, locale } = useI18n();
  const [pair, setPair] = useState("XDX/XRP");
  const [books, setBooks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await getOrderbooks();
        if (!cancelled) {
          setBooks(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const book = useMemo(() => {
    const name = normalizeOrderbookPair(pair);
    return books?.books?.[name] || emptyOrderbook(name);
  }, [books, pair]);

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
  const bids = book.bids || [];
  const asks = book.asks || [];
  const ammLevels = Array.isArray(book.amm?.levels) ? book.amm.levels : [];
  const ammBids = ammLevels.filter((row) => String(row.side).toLowerCase() === "bid");
  const ammAsks = ammLevels.filter((row) => String(row.side).toLowerCase() === "ask");

  return (
    <div className="orderbook">
      <div className="orderbook-toolbar">
        <div className="pair-filters" role="tablist" aria-label={t.orderbook}>
          {["XDX/XRP", "XDX/RLUSD"].map((name) => (
            <button
              key={name}
              type="button"
              className={pair === name ? "pair-chip active" : "pair-chip"}
              onClick={() => setPair(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="orderbook-unit">{t.orderbookUnit} {quote}</p>
      </div>

      <dl className="orderbook-header">
        <div>
          <dt>{t.bestBid}</dt>
          <dd className="is-bid">{formatQuotePerBase(book.best_bid, locale, quote)}</dd>
        </div>
        <div>
          <dt>{t.bestAsk}</dt>
          <dd className="is-ask">{formatQuotePerBase(book.best_ask, locale, quote)}</dd>
        </div>
        <div>
          <dt>{t.mid}</dt>
          <dd>{formatQuotePerBase(book.mid, locale, quote)}</dd>
        </div>
        <div>
          <dt>{t.spreadBps}</dt>
          <dd>{book.spread_bps == null ? "—" : Number(book.spread_bps).toFixed(1)}</dd>
        </div>
        <div>
          <dt>{t.midUsdHint}</dt>
          <dd>{formatUsdPrice(book.mid_usd, locale)}</dd>
        </div>
      </dl>

      {book.catching_up && !book.present ? (
        <p className="empty-message">{t.emptyOrderbook}</p>
      ) : (
        <>
          <div className="orderbook-grid">
            <BookSide
              title={t.bids}
              rows={bids}
              quote={quote}
              side="bid"
              locale={locale}
              t={t}
            />
            <BookSide
              title={t.asks}
              rows={asks}
              quote={quote}
              side="ask"
              locale={locale}
              t={t}
            />
          </div>
          {ammLevels.length ? (
            <div className="orderbook-amm">
              <h3 className="orderbook-side-title">{t.ammDepth}</h3>
              <div className="orderbook-grid">
                <BookSide
                  title={`${t.amm} ${t.bids}`}
                  rows={ammBids}
                  quote={quote}
                  side="bid"
                  locale={locale}
                  t={t}
                />
                <BookSide
                  title={`${t.amm} ${t.asks}`}
                  rows={ammAsks}
                  quote={quote}
                  side="ask"
                  locale={locale}
                  t={t}
                />
              </div>
            </div>
          ) : null}
        </>
      )}

      {book.as_of ? (
        <p className="orderbook-asof">
          {t.updated} {formatWhen(book.as_of, locale)}
        </p>
      ) : null}
    </div>
  );
}

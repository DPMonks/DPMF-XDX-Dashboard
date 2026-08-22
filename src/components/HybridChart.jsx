import { useEffect, useMemo, useState } from "react";
import { getAmm, getOrderbooks, getPrices, getXdxFlows } from "../api/indexer";
import { api } from "../api";
import { CHART_PAIRS, INTERVALS } from "../chart/intervals";
import { sma } from "../chart/candles";
import { composePairCandles, lockedSnapshot } from "../chart/composeChart";
import { quotePerXdx } from "../chart/pairQuote";
import {
  ammImpact,
  ammRebalanceTrail,
  arbitrageWindow,
  bookBands,
  heatmapDots,
  liquidityPressure,
  liquidityWalls,
  median,
  microEvents,
  smartView,
} from "../chart/overlays";
import { walletChartMarks } from "../chart/walletMarks";
import { bookHeader } from "../orderbook";
import { walletOrdersFromBooks } from "../wallet/composeWallet";
import { useWallet } from "../context/useWallet";
import { formatQuotePerBase, formatPercent } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import HybridPlot from "./HybridPlot";
import "./HybridChart.css";

const RANGES = ["1D", "5D", "1M", "3M", "6M", "1Y", "5Y", "Max"];
const TOOLS = [
  { id: "cursor", label: "Cursor" },
  { id: "hline", label: "H-line" },
  { id: "trend", label: "Trend" },
  { id: "fib", label: "Fib" },
];

function poolForPair(pools, pair) {
  return (Array.isArray(pools) ? pools : []).find(
    (row) => String(row.pool || row.pool_name || "").toUpperCase() === pair
  );
}

export default function HybridChart() {
  const { t, locale } = useI18n();
  const { walletAddress } = useWallet();
  const [pair, setPair] = useState("XDX/RLUSD");
  const [timeframe, setTimeframe] = useState("1D");
  const [range, setRange] = useState("1M");
  const [tool, setTool] = useState("cursor");
  const [showSma, setShowSma] = useState(true);
  const [books, setBooks] = useState(null);
  const [pools, setPools] = useState([]);
  const [prices, setPrices] = useState({});
  const [trades, setTrades] = useState([]);
  const [sparkline, setSparkline] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [pending, setPending] = useState(null);
  const [simAmount, setSimAmount] = useState("100000");
  const [ghost, setGhost] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [nextBooks, nextPools, nextPrices, nextFlows, nextSpark] = await Promise.all([
        getOrderbooks().catch(() => null),
        getAmm().catch(() => []),
        getPrices().catch(() => ({})),
        getXdxFlows().catch(() => []),
        api.sparkline("XDX").catch(() => []),
      ]);
      if (cancelled) return;
      setBooks(nextBooks);
      setPools(Array.isArray(nextPools) ? nextPools : []);
      setPrices(nextPrices || {});
      setTrades(Array.isArray(nextFlows) ? nextFlows : []);
      setSparkline(Array.isArray(nextSpark) ? nextSpark : []);
      setNow(Date.now());
    }
    const start = setTimeout(load, 0);
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearInterval(id);
    };
  }, []);

  const quote = pair.split("/")[1] || "RLUSD";
  const book = books?.books?.[pair] || {};
  const pool = poolForPair(pools, pair);
  const reserveBase = Number(pool?.reserve_xdx ?? pool?.reserve_asset ?? 0);
  const reserveQuote = Number(pool?.reserve_currency ?? 0);
  const ammPrice = reserveBase > 0 && reserveQuote > 0 ? reserveQuote / reserveBase : Number(book.amm?.price);
  const livePrice = quotePerXdx({
    pair,
    xdxUsd: prices.xdxUsd,
    xrpUsd: prices.xrpUsd,
    xdxXrp: pair === "XDX/XRP" ? book.mid || ammPrice : null,
    xdxRlusd: pair === "XDX/RLUSD" ? book.mid || ammPrice : null,
  });

  const candles = useMemo(
    () =>
      composePairCandles({
        pair,
        interval: timeframe,
        range,
        locked: lockedSnapshot(),
        sparkline,
        trades,
        prices,
        livePrice,
        now,
      }),
    [pair, timeframe, range, sparkline, trades, prices, livePrice, now]
  );

  const closes = candles.map((row) => row.c);
  const sma20 = showSma ? sma(closes, 20) : [];
  const sma50 = showSma ? sma(closes, 50) : [];
  const bands = { ...bookBands(book), bias: liquidityPressure({
    xdxPct: pool?.xdx_pct,
    quotePct: pool?.quote_pct,
    lpSupply: pool?.lp_supply,
  }).bias };
  const pressure = liquidityPressure({
    xdxPct: pool?.xdx_pct,
    quotePct: pool?.quote_pct,
    lpSupply: pool?.lp_supply,
  });
  const walls = liquidityWalls(book);
  const header = bookHeader(book);
  const arb = arbitrageWindow(ammPrice, header.mid || livePrice);
  const view = smartView(candles, { rangeId: range, spread: bands.spread, now });
  const heat = heatmapDots(trades.filter((row) => !row.pool || String(row.pool).toUpperCase() === pair));
  const trail = ammRebalanceTrail(
    candles.slice(-24).map((row) => ({ t: row.t, price: row.c, timestamp: row.t }))
  );
  const wallet = walletChartMarks({
    address: walletAddress,
    orders: walletOrdersFromBooks(books, walletAddress),
    fills: trades,
    pair,
  });
  const events = microEvents({
    trades,
    spreadBps: header.spread_bps,
    pressure,
    walls,
    lastFill: trades[0],
  });
  const typicalVolume = median(candles.map((row) => row.v));
  const locked = lockedSnapshot();
  const historyReady = (locked.pairs?.[pair]?.candles || []).length > 0;

  function addDrawing(point) {
    if (tool === "hline") {
      setDrawings((rows) => [...rows, { kind: "hline", price: point.price }]);
      return;
    }
    if (!pending) {
      setPending({ t: point.t, price: point.price });
      return;
    }
    setDrawings((rows) => [...rows, { kind: tool, a: pending, b: { t: point.t, price: point.price } }]);
    setPending(null);
  }

  function runSim(side) {
    setGhost(
      ammImpact({
        reserveBase,
        reserveQuote,
        amount: Number(simAmount),
        side,
      })
    );
  }

  return (
    <div className={`hybrid-chart${arb?.highlight ? " is-arb" : ""}`}>
      <div className="hybrid-topbar">
        <div className="hybrid-pairs" role="tablist">
          {CHART_PAIRS.map((name) => (
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
        <div className="hybrid-intervals">
          {INTERVALS.map((row) => (
            <button
              key={row.id}
              type="button"
              className={timeframe === row.id ? "range active" : "range"}
              onClick={() => setTimeframe(row.id)}
            >
              {row.label}
            </button>
          ))}
        </div>
        <label className="hybrid-toggle">
          <input type="checkbox" checked={showSma} onChange={(event) => setShowSma(event.target.checked)} />
          SMA 20/50
        </label>
      </div>

      <div className="hybrid-body">
        <aside className="hybrid-tools" aria-label={t.chartTools}>
          {TOOLS.map((row) => (
            <button
              key={row.id}
              type="button"
              className={tool === row.id ? "hybrid-tool active" : "hybrid-tool"}
              onClick={() => {
                setTool(row.id);
                setPending(null);
              }}
              title={row.label}
            >
              {row.id === "cursor" ? "+" : row.id === "hline" ? "—" : row.id === "trend" ? "/" : "F"}
            </button>
          ))}
          <button type="button" className="hybrid-tool" onClick={() => { setDrawings([]); setPending(null); setGhost(null); }} title={t.chartClear}>
            ×
          </button>
        </aside>

        <div className="hybrid-main">
          <div className="hybrid-meta">
            <p className="hybrid-events">
              {events.map((row) => (
                <span key={row.id} title={row.label}>
                  {row.icon} {row.label}
                </span>
              ))}
            </p>
            {arb ? (
              <dl className="hybrid-arb">
                <div>
                  <dt>{t.ammPrice}</dt>
                  <dd>{formatQuotePerBase(arb.ammPrice, locale, quote)}</dd>
                </div>
                <div>
                  <dt>{t.orderBookMid}</dt>
                  <dd>{formatQuotePerBase(arb.mid, locale, quote)}</dd>
                </div>
                <div>
                  <dt>{t.arbitrageWindow}</dt>
                  <dd className={arb.highlight ? "is-hot" : ""}>{formatPercent(arb.pct, locale)}</dd>
                </div>
              </dl>
            ) : null}
          </div>

          <HybridPlot
            candles={candles}
            quote={quote}
            view={view}
            bands={bands}
            walls={walls}
            trail={trail}
            heatmap={heat}
            wallet={wallet}
            ghost={ghost}
            drawings={drawings}
            pending={pending}
            tool={tool}
            sma20={sma20}
            sma50={sma50}
            typicalVolume={typicalVolume}
            locale={locale}
            onDraw={addDrawing}
          />

          <div className="hybrid-ranges">
            {RANGES.map((name) => (
              <button
                key={name}
                type="button"
                className={range === name ? "range active" : "range"}
                onClick={() => setRange(name)}
              >
                {name === "Max" ? t.max || "Max" : name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hybrid-footer">
        <p className="hybrid-note">
          {historyReady ? t.chartLockedHistory : t.chartLiveUntilLock}
        </p>
        <form
          className="hybrid-sim"
          onSubmit={(event) => {
            event.preventDefault();
            runSim("buy");
          }}
        >
          <label>
            {t.chartSimulate}
            <input
              type="number"
              min="1"
              step="any"
              value={simAmount}
              onChange={(event) => setSimAmount(event.target.value)}
            />
            XDX
          </label>
          <button type="button" onClick={() => runSim("buy")}>{t.buy}</button>
          <button type="button" onClick={() => runSim("sell")}>{t.sell}</button>
          <button type="button" onClick={() => runSim("addLp")}>{t.chartAddLp}</button>
          <button type="button" onClick={() => runSim("removeLp")}>{t.chartRemoveLp}</button>
          {ghost ? (
            <span className="hybrid-ghost-readout">
              {formatQuotePerBase(ghost.spot, locale, quote)} → {formatQuotePerBase(ghost.next, locale, quote)} ({formatPercent(ghost.impactPct, locale)})
            </span>
          ) : null}
        </form>
      </div>
    </div>
  );
}

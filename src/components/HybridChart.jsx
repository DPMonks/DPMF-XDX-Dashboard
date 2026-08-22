import { useEffect, useMemo, useRef, useState } from "react";
import { getAmm, getOrderbooks, getPrices, getXdxFlows } from "../api/indexer";
import { api } from "../api";
import { CHART_MA_PAD, CHART_PAIRS, DEFAULT_INTERVAL, INTERVALS, visibleBarsForInterval } from "../chart/intervals";
import {
  averagesForWindow,
  clampPanOffset,
  clampVisibleBars,
  MA_PERIODS,
  MA_TYPES,
  panAfterZoom,
  windowBars,
  ZOOM_BAR_MAX,
  ZOOM_BAR_MIN,
  zoomVisibleBars,
} from "../chart/candles";
import { RSI_OVERBOUGHT, RSI_OVERSOLD, RSI_PERIODS, rsiForWindow } from "../chart/indicators";
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
  microEvents,
  smartView,
} from "../chart/overlays";
import { walletChartMarks } from "../chart/walletMarks";
import { bookHeader } from "../orderbook";
import { walletOrdersFromBooks } from "../wallet/composeWallet";
import { useWallet } from "../context/useWallet";
import { formatQuotePerBase, formatPercent } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import { moveDrawingHandle, nextDrawingState } from "../chart/drawings";
import ChartTools from "./ChartTools";
import HybridPlot from "./HybridPlot";
import "./HybridChart.css";

function MaTypeMenu({ value, t, onChange }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const current = MA_TYPES.find((row) => row.id === value) || MA_TYPES[0];

  useEffect(() => {
    if (!open) return undefined;
    function onDoc(event) {
      if (!box.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  return (
    <div className="hybrid-ma-select" ref={box}>
      <button
        type="button"
        className={open ? "hybrid-ma-select-btn is-open" : "hybrid-ma-select-btn"}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((on) => !on)}
      >
        <span>{current.short}</span>
        <svg className="hybrid-ma-caret" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 4.5 L6 8 L9 4.5" />
        </svg>
      </button>
      {open ? (
        <ul className="hybrid-ma-menu" role="listbox">
          {MA_TYPES.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className={row.id === value ? "active" : undefined}
                role="option"
                aria-selected={row.id === value}
                onClick={() => {
                  onChange(row.id);
                  setOpen(false);
                }}
              >
                {t[row.labelKey] || row.short}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function poolForPair(pools, pair) {
  return (Array.isArray(pools) ? pools : []).find(
    (row) => String(row.pool || row.pool_name || "").toUpperCase() === pair
  );
}

export default function HybridChart() {
  const { t, locale } = useI18n();
  const { walletAddress } = useWallet();
  const [pair, setPair] = useState("XDX/RLUSD");
  const [timeframe, setTimeframe] = useState(DEFAULT_INTERVAL);
  const [tool, setTool] = useState("cursor");
  const [drawColor, setDrawColor] = useState("#3d8bff");
  const [strokeWidth, setStrokeWidth] = useState(1);
  const [lineStyle, setLineStyle] = useState("solid");
  const [stayDraw, setStayDraw] = useState(true);
  const [magnet, setMagnet] = useState(false);
  const [hollow, setHollow] = useState(false);
  const [showArb, setShowArb] = useState(false);
  const [maType, setMaType] = useState("sma");
  const [maPeriods, setMaPeriods] = useState([50]);
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);
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
  const [panOffset, setPanOffset] = useState(0);
  const [barZoom, setBarZoom] = useState(null);
  const [loadedBars, setLoadedBars] = useState(() => visibleBarsForInterval(DEFAULT_INTERVAL) + CHART_MA_PAD);
  const [seriesLen, setSeriesLen] = useState(0);
  const windowKey = `${pair}:${timeframe}`;
  const [activeWindow, setActiveWindow] = useState(windowKey);

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

  const series = useMemo(
    () =>
      composePairCandles({
        pair,
        interval: timeframe,
        range: "Max",
        locked: lockedSnapshot(),
        sparkline,
        trades,
        prices,
        livePrice,
        now,
        windowed: false,
        lookbackBars: loadedBars,
      }),
    [pair, timeframe, sparkline, trades, prices, livePrice, now, loadedBars]
  );
  const baseVisible = visibleBarsForInterval(timeframe);
  const visibleCount = clampVisibleBars(barZoom ?? baseVisible, baseVisible);
  if (activeWindow !== windowKey) {
    setActiveWindow(windowKey);
    setSeriesLen(0);
    setPanOffset(0);
    setBarZoom(null);
    setLoadedBars(baseVisible + CHART_MA_PAD);
  }
  const wantLoaded = visibleCount + panOffset + CHART_MA_PAD + 32;
  if (wantLoaded > loadedBars) setLoadedBars(wantLoaded);
  if (series.length !== seriesLen) {
    const grew = series.length - seriesLen;
    setSeriesLen(series.length);
    if (grew > 0 && panOffset > 0) setPanOffset((current) => current + grew);
  }
  const clampedPan = clampPanOffset(panOffset, series.length, visibleCount);
  if (clampedPan !== panOffset) setPanOffset(clampedPan);
  const candles = useMemo(
    () => windowBars(series, { bars: visibleCount, offset: clampedPan }),
    [series, visibleCount, clampedPan]
  );
  const averages = useMemo(
    () =>
      averagesForWindow({
        series,
        visible: candles,
        type: maType,
        periods: maPeriods,
      }),
    [series, candles, maType, maPeriods]
  );
  const rsiValues = useMemo(
    () => rsiForWindow({ series, visible: candles, period: rsiPeriod }),
    [series, candles, rsiPeriod]
  );
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
  const view = smartView(candles, { rangeId: "Max", spread: bands.spread, now });
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
  const locked = lockedSnapshot();
  const historyReady = (locked.pairs?.[pair]?.candles || []).length > 0;

  function addDrawing(point) {
    const next = nextDrawingState({ tool, color: drawColor, pending, point, strokeWidth, lineStyle });
    setPending(next.pending);
    if (next.drawing) {
      setDrawings((rows) => [...rows, next.drawing]);
      if (!stayDraw) {
        setTool("cursor");
        setPending(null);
      }
    }
  }

  function moveHandle(index, key, point) {
    setDrawings((rows) =>
      rows.map((row, current) => (current === index ? moveDrawingHandle(row, key, point) : row))
    );
  }

  function selectTool(id) {
    setTool(id);
    setPending(null);
  }

  function undoDrawing() {
    setPending(null);
    setDrawings((rows) => rows.slice(0, -1));
  }

  function clearDrawings() {
    setDrawings([]);
    setPending(null);
    setGhost(null);
  }

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") setPending(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function applyZoom(directionOrEvent, maybeRatio) {
    const fromEvent = directionOrEvent && typeof directionOrEvent === "object";
    const direction = fromEvent ? directionOrEvent.direction : directionOrEvent;
    const anchorRatio = fromEvent
      ? directionOrEvent.anchorRatio
      : Number.isFinite(maybeRatio)
        ? maybeRatio
        : panOffset === 0
          ? 1
          : 0.5;
    if (!direction) return;
    const from = visibleCount;
    const next = zoomVisibleBars(from, direction, baseVisible);
    if (next === from) return;
    setBarZoom(next);
    setPanOffset((pan) =>
      panAfterZoom({
        total: series.length,
        oldVisible: from,
        newVisible: next,
        oldPan: pan,
        anchorRatio,
      })
    );
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
    <div className={`hybrid-chart${showArb && arb?.highlight ? " is-arb" : ""}`}>
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
        <div className="hybrid-ma">
          <span className="hybrid-ma-label">{t.chartMa}</span>
          <MaTypeMenu value={maType} t={t} onChange={setMaType} />
          {MA_PERIODS.map((row) => (
            <label key={row.period} className="hybrid-toggle">
              <input
                type="checkbox"
                checked={maPeriods.includes(row.period)}
                onChange={() =>
                  setMaPeriods((current) =>
                    current.includes(row.period)
                      ? current.filter((period) => period !== row.period)
                      : [...current, row.period].sort((left, right) => left - right)
                  )
                }
              />
              <span style={{ color: row.color }}>{row.period}</span>
            </label>
          ))}
        </div>
        <label className="hybrid-toggle">
          <input type="checkbox" checked={hollow} onChange={(event) => setHollow(event.target.checked)} />
          {t.chartHollow}
        </label>
        <label className="hybrid-toggle">
          <input type="checkbox" checked={showArb} onChange={(event) => setShowArb(event.target.checked)} />
          {t.chartArbitrage}
        </label>
        <div className="hybrid-ind">
          <label className="hybrid-toggle">
            <input type="checkbox" checked={showVolume} onChange={(event) => setShowVolume(event.target.checked)} />
            {t.chartVolumeWave}
          </label>
          <label className="hybrid-toggle">
            <input type="checkbox" checked={showRsi} onChange={(event) => setShowRsi(event.target.checked)} />
            {t.chartRsi}
          </label>
          {showRsi ? (
            <>
              <label className="hybrid-toggle">
                {t.chartRsiPeriod}
                <select value={rsiPeriod} onChange={(event) => setRsiPeriod(Number(event.target.value))}>
                  {RSI_PERIODS.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hybrid-toggle">
                {t.chartRsiOverbought}
                <select value={rsiOverbought} onChange={(event) => setRsiOverbought(Number(event.target.value))}>
                  {RSI_OVERBOUGHT.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="hybrid-toggle">
                {t.chartRsiOversold}
                <select value={rsiOversold} onChange={(event) => setRsiOversold(Number(event.target.value))}>
                  {RSI_OVERSOLD.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
        </div>
        <div className="hybrid-zoom" role="group" aria-label={t.chartZoom}>
          <button
            type="button"
            aria-label={t.chartZoomOut}
            disabled={visibleCount >= ZOOM_BAR_MAX}
            onClick={() => applyZoom(-1)}
          >
            −
          </button>
          <button
            type="button"
            aria-label={t.chartZoomIn}
            disabled={visibleCount <= ZOOM_BAR_MIN}
            onClick={() => applyZoom(1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="hybrid-body">
        <ChartTools
          tool={tool}
          color={drawColor}
          strokeWidth={strokeWidth}
          lineStyle={lineStyle}
          magnet={magnet}
          stay={stayDraw}
          t={t}
          onSelectTool={selectTool}
          onSelectColor={setDrawColor}
          onSelectWidth={setStrokeWidth}
          onSelectStyle={setLineStyle}
          onUndo={undoDrawing}
          onClear={clearDrawings}
          onToggleMagnet={() => setMagnet((on) => !on)}
          onToggleStay={() => setStayDraw((on) => !on)}
        />

        <div className="hybrid-main">
          <div className="hybrid-meta">
            <p className="hybrid-events">
              {events.map((row) => (
                <span key={row.id} title={row.label}>
                  {row.icon} {row.label}
                </span>
              ))}
            </p>
            {showArb && arb ? (
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
            key={windowKey}
            candles={candles}
            quote={quote}
            interval={timeframe}
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
            color={drawColor}
            strokeWidth={strokeWidth}
            lineStyle={lineStyle}
            magnet={magnet}
            hollow={hollow}
            averages={averages}
            rsiValues={rsiValues}
            rsiPeriod={rsiPeriod}
            rsiOverbought={rsiOverbought}
            rsiOversold={rsiOversold}
            showVolume={showVolume}
            showRsi={showRsi}
            showArb={showArb}
            locale={locale}
            onDraw={addDrawing}
            onMoveHandle={moveHandle}
            onPan={(steps) => {
              if (!steps) return;
              setPanOffset((current) => current + steps);
            }}
            onZoom={applyZoom}
          />

          <div className="hybrid-ranges" role="tablist" aria-label={t.chartTimeframes || "Candle size"}>
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

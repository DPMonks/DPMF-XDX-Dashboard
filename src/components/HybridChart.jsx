import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAmm, getOrderbooks, getPrices, getWalletActivity, getWalletOffers, getXdxFlows } from "../api/indexer";
import { api } from "../api";
import { CHART_MA_PAD, CHART_PAIRS, DEFAULT_INTERVAL, INTERVALS, visibleBarsForInterval } from "../chart/intervals";
import {
  averagesForWindow,
  clampPanOffset,
  clampVisibleBars,
  futureBarsFromPan,
  liveSeriesGrew,
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
import { fullViewPriceHeight } from "../chart/fullView";
import { quotePerXdx } from "../chart/pairQuote";
import {
  ammRebalanceTrail,
  arbitrageWindow,
  bookBands,
  ammFillDots,
  heatmapDots,
  median,
  sameChartPair,
  liquidityPressure,
  liquidityWalls,
  microEvents,
  scalePriceView,
  shiftAfterPriceZoom,
  smartView,
  zoomPriceScale,
} from "../chart/overlays";
import { walletChartMarks } from "../chart/walletMarks";
import { bookHeader } from "../orderbook";
import { walletOrdersFromBooks } from "../wallet/composeWallet";
import {
  mergeWalletActivity,
  mergeWalletOrders,
  pendingFor,
  pendingFromExecution,
} from "../wallet/ledgerOrders";
import { useWallet } from "../context/useWallet";
import { formatQuotePerBase, formatPercent } from "../utils/format";
import { isPhoneDevice } from "../xaman/xamanClient";
import { useI18n } from "../i18n/useI18n";
import { moveDrawingHandle, nextDrawingState, patchDrawingStyle, toolAfterDrawing } from "../chart/drawings";
import ChartErrorBoundary from "./ChartErrorBoundary";
import ChartTools from "./ChartTools";
import HybridPlot from "./HybridPlot";
import TradeBar from "./TradeBar";
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
  const [stayDraw, setStayDraw] = useState(false);
  const [magnet, setMagnet] = useState(false);
  const [hollow, setHollow] = useState(false);
  const [showArb, setShowArb] = useState(false);
  const [maType, setMaType] = useState("sma");
  const [maPeriods, setMaPeriods] = useState([50]);
  const [showVolume, setShowVolume] = useState(true);
  const [showLedgerOrders, setShowLedgerOrders] = useState(false);
  const [showRsi, setShowRsi] = useState(true);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [books, setBooks] = useState(null);
  const [ledgerOrders, setLedgerOrders] = useState([]);
  const [ledgerFills, setLedgerFills] = useState([]);
  const [pools, setPools] = useState([]);
  const [prices, setPrices] = useState({});
  const [trades, setTrades] = useState([]);
  const [sparkline, setSparkline] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [now, setNow] = useState(0);
  const [panOffset, setPanOffset] = useState(0);
  const [barZoom, setBarZoom] = useState(null);
  const [priceZoom, setPriceZoom] = useState(1);
  const [priceShift, setPriceShift] = useState(0);
  const [loadedBars, setLoadedBars] = useState(() => visibleBarsForInterval(DEFAULT_INTERVAL) + CHART_MA_PAD);
  const [seriesMeta, setSeriesMeta] = useState({ len: 0, head: 0 });
  const windowKey = `${pair}:${timeframe}`;
  const [activeWindow, setActiveWindow] = useState(windowKey);
  const phone = isPhoneDevice();
  const [fullView, setFullView] = useState(false);
  const [viewH, setViewH] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 700));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
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
        setSparkline(
          Array.isArray(nextSpark)
            ? nextSpark
            : Array.isArray(nextSpark?.rows)
              ? nextSpark.rows
              : Array.isArray(nextSpark?.price_history)
                ? nextSpark.price_history
                : []
        );
        setNow(Date.now());
      } catch {
        /* keep last good chart if a refresh fails */
      }
    }
    const start = setTimeout(load, 0);
    const id = setInterval(load, 30000);
    window.addEventListener("dpmf-wallet-refresh", load);
    return () => {
      cancelled = true;
      window.removeEventListener("dpmf-wallet-refresh", load);
      clearTimeout(start);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      const clear = setTimeout(() => {
        setLedgerOrders([]);
        setLedgerFills([]);
      }, 0);
      return () => clearTimeout(clear);
    }
    let cancelled = false;
    async function loadLedger() {
      const [offers, activity] = await Promise.all([
        getWalletOffers(walletAddress).catch(() => []),
        getWalletActivity(walletAddress).catch(() => []),
      ]);
      if (cancelled) return;
      setLedgerOrders(offers);
      setLedgerFills(activity);
    }
    const start = setTimeout(loadLedger, 0);
    const id = setInterval(loadLedger, 15000);
    function onTrade(event) {
      const pending = pendingFromExecution(event.detail, walletAddress);
      if (pending?.order) {
        setLedgerOrders((rows) => mergeWalletOrders([pending.order], rows));
        if (pending.order.pair) setPair(pending.order.pair);
      }
      if (pending?.activity) {
        setLedgerFills((rows) => mergeWalletActivity([pending.activity], rows));
        if (pending.activity.pair) setPair(pending.activity.pair);
      }
      loadLedger();
    }
    window.addEventListener("dpmf-trade-executed", onTrade);
    window.addEventListener("dpmf-wallet-refresh", loadLedger);
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearInterval(id);
      window.removeEventListener("dpmf-trade-executed", onTrade);
      window.removeEventListener("dpmf-wallet-refresh", loadLedger);
    };
  }, [walletAddress]);

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
    setSeriesMeta({ len: 0, head: 0 });
    setPanOffset(0);
    setBarZoom(null);
    setPriceZoom(1);
    setPriceShift(0);
    setLoadedBars(baseVisible + CHART_MA_PAD);
  }
  const wantLoaded = Math.min(4000, visibleCount + Math.max(0, Number(panOffset) || 0) + CHART_MA_PAD + 32);
  if (Number.isFinite(wantLoaded) && wantLoaded > loadedBars) setLoadedBars(wantLoaded);
  const seriesHead = Number(series[0]?.t) || 0;
  if (series.length !== seriesMeta.len || seriesHead !== seriesMeta.head) {
    const appended = liveSeriesGrew({
      prevLen: seriesMeta.len,
      prevHead: seriesMeta.head,
      nextLen: series.length,
      nextHead: seriesHead,
    });
    setSeriesMeta({ len: series.length, head: seriesHead });
    if (appended && panOffset > 0) {
      setPanOffset((current) => current + (series.length - seriesMeta.len));
    }
  }
  const clampedPan = clampPanOffset(panOffset, series.length, visibleCount);
  if (Number.isFinite(clampedPan) && clampedPan !== panOffset) setPanOffset(clampedPan);
  const futureBars = futureBarsFromPan(clampedPan);
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
  const autoView = smartView(candles, { rangeId: "Max", spread: bands.spread, now });
  const view = scalePriceView(autoView, { zoom: priceZoom, shift: priceShift });
  const pairTrades = trades.filter((row) => sameChartPair(row, pair));
  const heat = heatmapDots(pairTrades);
  const fillMid = median(candles.slice(-24).map((row) => Number(row.c)));
  const ammFills = ammFillDots(pairTrades, { pair, now, medianPrice: fillMid });
  const trail = ammRebalanceTrail(
    candles.slice(-24).map((row) => ({ t: row.t, price: row.c, timestamp: row.t }))
  );
  const walletPending = pendingFor(walletAddress, { offersKnown: ledgerOrders.length > 0 });
  const wallet = walletChartMarks({
    address: walletAddress,
    orders: mergeWalletOrders(
      ledgerOrders,
      walletOrdersFromBooks(books, walletAddress),
      walletPending.orders
    ),
    fills: mergeWalletActivity(ledgerFills, trades, walletPending.activity),
    pair,
  });
  const events = microEvents({
    trades,
    spreadBps: header.spread_bps,
    pressure,
    walls,
    lastFill: trades[0],
  });
  function addDrawing(point) {
    const next = nextDrawingState({ tool, color: drawColor, pending, point, strokeWidth, lineStyle });
    setPending(next.pending);
    if (next.drawing) {
      const index = drawings.length;
      setDrawings((rows) => [...rows, next.drawing]);
      setSelected(index);
      const nextTool = toolAfterDrawing(stayDraw, tool);
      setTool(nextTool);
      if (nextTool === "cursor") setPending(null);
    }
  }

  function moveHandle(index, key, point) {
    setDrawings((rows) =>
      rows.map((row, current) => (current === index ? moveDrawingHandle(row, key, point) : row))
    );
  }

  function editDrawing(index, patch) {
    setDrawings((rows) =>
      rows.map((row, current) => (current === index ? patchDrawingStyle(row, patch) : row))
    );
  }

  function deleteDrawing(index) {
    setDrawings((rows) => rows.filter((_, current) => current !== index));
    setSelected(null);
  }

  function selectTool(id) {
    setTool(id || "cursor");
    setPending(null);
    if (id && id !== "cursor") setSelected(null);
  }

  function undoDrawing() {
    setPending(null);
    setDrawings((rows) => rows.slice(0, -1));
    setSelected(null);
  }

  function clearDrawings() {
    setDrawings([]);
    setSelected(null);
    setPending(null);
    setGhost(null);
  }

  if (selected != null && selected >= drawings.length) {
    setSelected(null);
  }

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") {
        if (fullView) {
          setFullView(false);
          return;
        }
        setPending(null);
        setSelected(null);
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selected != null) {
        const tag = String(event.target?.tagName || "");
        if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
        event.preventDefault();
        deleteDrawing(selected);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [selected, fullView]);

  useEffect(() => {
    if (!fullView) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onResize() {
      window.setTimeout(() => setViewH(window.innerHeight), 0);
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [fullView]);

  function applyZoom(directionOrEvent, maybeRatio) {
    const fromEvent = directionOrEvent && typeof directionOrEvent === "object";
    const direction = Math.sign(fromEvent ? directionOrEvent.direction : directionOrEvent);
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

  function applyPriceZoom({ direction, anchorPrice } = {}) {
    const nextZoom = zoomPriceScale(priceZoom, direction);
    if (nextZoom === priceZoom) return;
    setPriceShift(
      shiftAfterPriceZoom({
        view: autoView,
        oldZoom: priceZoom,
        newZoom: nextZoom,
        anchorPrice,
        oldShift: priceShift,
      })
    );
    setPriceZoom(nextZoom);
  }

  function applyPricePan(deltaPrice) {
    if (!deltaPrice) return;
    setPriceShift((current) => current + deltaPrice);
  }

  function resetPriceScale() {
    setPriceZoom(1);
    setPriceShift(0);
  }

  const plotHeight = fullView
    ? fullViewPriceHeight(viewH, { volume: showVolume, rsi: showRsi })
    : undefined;
  const chart = (
    <div className={`hybrid-chart${showArb && arb?.highlight ? " is-arb" : ""}${fullView ? " is-fullview" : ""}`}>
      {fullView ? (
        <button
          type="button"
          className="hybrid-fullview-exit"
          onClick={() => setFullView(false)}
        >
          {t.chartExitFullView}
        </button>
      ) : null}
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
          {phone && !fullView ? (
            <button type="button" className="hybrid-fullview-enter" onClick={() => setFullView(true)}>
              {t.chartFullView}
            </button>
          ) : null}
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

          <div className="hybrid-plot-wrap">
            <div className="hybrid-zoom" role="group" aria-label={t.chartZoom}>
              <label className="hybrid-toggle hybrid-ledger-toggle">
                <input
                  type="checkbox"
                  checked={showLedgerOrders}
                  onChange={(event) => setShowLedgerOrders(event.target.checked)}
                />
                {t.showLedgerOrders}
              </label>
              <p className="hybrid-amm-legend" title={t.chartAmmFills || "AMM fills"}>
                <i aria-hidden="true" />
                <span>{t.chartAmmFills || "AMM fills"}</span>
              </p>
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
              {phone && !fullView ? (
                <button type="button" className="hybrid-fullview-enter" onClick={() => setFullView(true)}>
                  {t.chartFullView}
                </button>
              ) : null}
            </div>
          <ChartErrorBoundary message={t.chartCrashed} retryLabel={t.chartReload}>
          <HybridPlot
            key={windowKey}
            candles={candles}
            futureBars={futureBars}
            quote={quote}
            interval={timeframe}
            view={view}
            bands={bands}
            walls={walls}
            trail={trail}
            heatmap={heat}
            ammFills={ammFills}
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
            showLedgerOrders={showLedgerOrders}
            locale={locale}
            t={t}
            selectedIndex={selected}
            onDraw={addDrawing}
            onMoveHandle={moveHandle}
            onSelect={setSelected}
            onEditDrawing={editDrawing}
            onDeleteDrawing={deleteDrawing}
            onPan={(steps) => {
              if (!steps) return;
              setPanOffset((current) => current + steps);
            }}
            onZoom={applyZoom}
            onPriceZoom={applyPriceZoom}
            onPricePan={applyPricePan}
            onPriceReset={resetPriceScale}
            priceHeight={plotHeight}
          />
          </ChartErrorBoundary>
          </div>

          <div className="hybrid-ranges" role="tablist" aria-label={t.chartTimeframes || "Candle size"}>
            {INTERVALS.map((row) => (
              <button
                key={row.id}
                type="button"
                className={timeframe === row.id ? "range active" : "range"}
                onClick={() => setTimeframe(row.id)}
              >
                <span className="range-label">{row.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hybrid-footer">
        <TradeBar />
        {ghost ? (
          <span className="hybrid-ghost-readout">
            {formatQuotePerBase(ghost.spot, locale, quote)} → {formatQuotePerBase(ghost.next, locale, quote)} ({formatPercent(ghost.impactPct, locale)})
          </span>
        ) : null}
      </div>
    </div>
  );

  if (fullView && typeof document !== "undefined") {
    return createPortal(chart, document.body);
  }
  return chart;
}

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatQuotePerBase, formatToken } from "../utils/format";
import { barSlots, clientToSvg, equalGrid, formatAxisPrice, formatAxisTime, formatCursorWhen, plotViewKey, priceTicks } from "../chart/axis";
import { candleBodyBox, candleBodyWidth, wheelPanSteps, wheelZoomSteps } from "../chart/candles";
import { extendMaPoints, maCurvePoints, maPath, maRevealState, volumeWaveValues, waveArea, wavePath } from "../chart/indicators";
import { intervalMs } from "../chart/intervals";
import { applyPlaceOffset, canMoveHandle, clickIsPan, hitDrawingHandle, shouldFollowCrosshair, snapPoint, toggleInspect } from "../chart/drawings";
import { hideToolPreview, paintPlaceMark, paintToolPreview } from "../chart/paintPreview";
import ChartDrawings from "./ChartDrawings";

const PRICE_H = 348;
const VOL_H = 72;
const RSI_H = 72;
const PANE_GAP = 8;
const GRID_COLS = 8;
const GRID_ROWS = 6;
const PAD = { l: 84, r: 18, t: 16, b: 36 };
const UP = "#26a69a";
const DOWN = "#ef5350";

export default function HybridPlot({
  candles = [],
  quote = "RLUSD",
  interval = "1D",
  view,
  bands,
  walls = [],
  trail = [],
  heatmap = [],
  wallet,
  ghost,
  drawings = [],
  pending,
  tool = "cursor",
  color = "#3d8bff",
  strokeWidth = 1,
  lineStyle = "solid",
  magnet = false,
  hollow = false,
  averages = [],
  rsiValues = [],
  rsiPeriod = 14,
  rsiOverbought = 70,
  rsiOversold = 30,
  showVolume = true,
  showRsi = true,
  showArb = false,
  showLedgerOrders = false,
  locale,
  onDraw,
  onMoveHandle,
  onPan,
  onZoom,
}) {
  const box = useRef(null);
  const svgRef = useRef(null);
  const hairVRef = useRef(null);
  const hairHRef = useRef(null);
  const timeTagRef = useRef(null);
  const timeTextRef = useRef(null);
  const priceTagRef = useRef(null);
  const priceTextRef = useRef(null);
  const hoverRef = useRef(null);
  const inspectRef = useRef(null);
  const clickRef = useRef(null);
  const rafRef = useRef(0);
  const placeMarkRef = useRef(null);
  const previewRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [inspect, setInspect] = useState(null);
  const [drag, setDrag] = useState(null);
  const [panDrag, setPanDrag] = useState(null);
  const [enterTs, setEnterTs] = useState([]);
  const [seenTs, setSeenTs] = useState([]);
  const [maDraw, setMaDraw] = useState({ ready: [], armed: [] });
  const wheelLeft = useRef(0);
  const wheelZoomLeft = useRef(0);
  const onPanRef = useRef(onPan);
  const onZoomRef = useRef(onZoom);
  const uid = useId().replace(/:/g, "");
  const width = 960;
  const volH = showVolume ? VOL_H : 0;
  const rsiH = showRsi ? RSI_H : 0;
  const volTop = PAD.t + PRICE_H + (volH ? 4 : 0);
  const rsiTop = volTop + volH + (volH && rsiH ? PANE_GAP : rsiH ? 4 : 0);
  const height = rsiTop + rsiH + PAD.b;
  const innerW = width - PAD.l - PAD.r;
  const plotBottom = PAD.t + PRICE_H;
  const volBottom = volTop + volH;
  const rsiBottom = rsiTop + rsiH;

  const scale = useMemo(() => {
    const start = candles[0]?.t || view?.start || 0;
    const end = candles[candles.length - 1]?.t || view?.end || 1;
    const min = view?.min || 0;
    const max = view?.max || 1;
    const spanT = Math.max(end - start, 1);
    const spanP = Math.max(max - min, 1e-12);
    const slots = barSlots(candles, { left: PAD.l, width: innerW });
    return {
      x: slots.x,
      tAt: slots.tAt,
      y: (p) => PAD.t + (1 - (p - min) / spanP) * PRICE_H,
      start,
      end,
      min,
      max,
      spanT,
      slot: slots.slot,
      ticks: slots.ticks,
      viewKey: plotViewKey(candles, { left: PAD.l, width: innerW }),
    };
  }, [view, candles, innerW]);

  const yTicks = useMemo(() => priceTicks(scale.min, scale.max, 6), [scale.min, scale.max]);
  const xTicks = useMemo(() => scale.ticks(6), [scale]);
  const volumes = useMemo(() => volumeWaveValues(candles), [candles]);
  const seenSet = new Set(seenTs);
  const freshBars = candles.map((row) => row.t).filter((stamp) => !seenSet.has(stamp) && !enterTs.includes(stamp));
  if (freshBars.length) {
    setSeenTs((current) => [...current, ...freshBars]);
    setEnterTs((current) => [...current, ...freshBars]);
  }

  const maIds = averages.map((row) => row.id);
  const maLive = new Set(maIds);
  const maReady = maDraw.ready.filter((id) => maLive.has(id));
  const maArmed = maDraw.armed.filter((id) => maLive.has(id));
  const maAdded = maIds.filter((id) => !maReady.includes(id) && !maArmed.includes(id));
  if (
    maAdded.length ||
    maReady.length !== maDraw.ready.length ||
    maArmed.length !== maDraw.armed.length
  ) {
    setMaDraw({ ready: maReady, armed: [...maArmed, ...maAdded] });
  }
  useEffect(() => {
    onPanRef.current = onPan;
  }, [onPan]);
  useEffect(() => {
    onZoomRef.current = onZoom;
  }, [onZoom]);
  useEffect(() => {
    if (tool === "cursor") hideToolPreview(previewRef.current, placeMarkRef.current);
  }, [tool]);
  useEffect(() => {
    inspectRef.current = inspect;
  }, [inspect]);
  if (tool !== "cursor" && inspect) {
    setInspect(null);
  }
  useEffect(() => {
    const node = svgRef.current;
    if (!node) return undefined;
    const inner = width - PAD.l - PAD.r;
    function onWheel(event) {
      event.preventDefault();
      try {
        const horizontal = event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY);
        if (horizontal) {
          const next = wheelPanSteps(event.deltaX, event.shiftKey ? event.deltaY : 0, wheelLeft.current);
          wheelLeft.current = next.leftover;
          if (next.steps && onPanRef.current) onPanRef.current(next.steps);
          return;
        }
        const mapped = clientToSvg(node, event.clientX, event.clientY, width, height);
        const ratio = mapped ? (mapped.x - PAD.l) / Math.max(1, inner) : 0.5;
        const next = wheelZoomSteps(event.deltaY, wheelZoomLeft.current);
        wheelZoomLeft.current = next.leftover;
        if (next.steps && onZoomRef.current) {
          onZoomRef.current({
            direction: next.steps > 0 ? -1 : 1,
            anchorRatio: Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0.5)),
          });
        }
      } catch {
        wheelLeft.current = 0;
        wheelZoomLeft.current = 0;
      }
    }
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [height]);

  const candleW = candleBodyWidth({
    innerW,
    candles,
    start: scale.start,
    end: scale.end,
    stepMs: intervalMs(interval),
  });

  function locate(event, { place = false } = {}) {
    const mapped = clientToSvg(svgRef.current || event.currentTarget, event.clientX, event.clientY, width, height);
    if (!mapped) return null;
    const shifted =
      place && tool !== "cursor"
        ? applyPlaceOffset(mapped, { tool, pad: PAD, width, plotBottom })
        : mapped;
    const x = shifted.x;
    const y = shifted.y;
    const t = scale.tAt ? scale.tAt(x) : scale.start + ((x - PAD.l) / innerW) * (scale.end - scale.start);
    const price = scale.max - ((y - PAD.t) / PRICE_H) * (scale.max - scale.min);
    const inPrice = y >= PAD.t - 2 && y <= plotBottom + 2 && x >= PAD.l && x <= width - PAD.r;
    const inVolume = volH > 0 && y >= volTop && y <= volBottom && x >= PAD.l && x <= width - PAD.r;
    const inRsi = rsiH > 0 && y >= rsiTop && y <= rsiBottom && x >= PAD.l && x <= width - PAD.r;
    let nearest = candles[0];
    let best = Infinity;
    for (const row of candles) {
      const dist = Math.abs(row.t - t);
      if (dist < best) {
        best = dist;
        nearest = row;
      }
    }
    const raw = { t, price };
    const snapped = magnet ? snapPoint(raw, candles) : raw;
    return {
      x: magnet ? scale.x(snapped.t) : x,
      y: magnet ? scale.y(snapped.price) : y,
      t: snapped.t,
      price: snapped.price,
      viewKey: scale.viewKey,
      candle: nearest,
      inPrice,
      inVolume,
      inRsi,
    };
  }

  function paintCursor(next) {
    const hairV = hairVRef.current;
    const hairH = hairHRef.current;
    const timeTag = timeTagRef.current;
    const timeText = timeTextRef.current;
    const priceTag = priceTagRef.current;
    const priceText = priceTextRef.current;
    if (!next) {
      if (hairV) hairV.setAttribute("visibility", "hidden");
      if (hairH) hairH.setAttribute("visibility", "hidden");
      if (timeTag) timeTag.setAttribute("visibility", "hidden");
      if (priceTag) priceTag.setAttribute("visibility", "hidden");
      return;
    }
    const x = Math.min(width - PAD.r, Math.max(PAD.l, next.x));
    if (hairV) {
      hairV.setAttribute("visibility", "visible");
      hairV.setAttribute("x1", String(x));
      hairV.setAttribute("x2", String(x));
    }
    if (next.inPrice) {
      const y = Math.min(plotBottom - 1, Math.max(PAD.t + 1, next.y));
      if (hairH) {
        hairH.setAttribute("visibility", "visible");
        hairH.setAttribute("y1", String(y));
        hairH.setAttribute("y2", String(y));
      }
      if (priceTag && priceText) {
        priceTag.setAttribute("visibility", "visible");
        priceTag.setAttribute("transform", `translate(0 ${y - 9})`);
        priceText.textContent = formatAxisPrice(next.price);
      }
    } else {
      if (hairH) hairH.setAttribute("visibility", "hidden");
      if (priceTag) priceTag.setAttribute("visibility", "hidden");
    }
    if (timeTag && timeText && Number.isFinite(next.t)) {
      const label = formatCursorWhen(next.t, locale);
      const tagW = Math.max(108, label.length * 6.1);
      const tagX = Math.min(width - PAD.r - tagW / 2, Math.max(PAD.l + tagW / 2, x));
      timeTag.setAttribute("visibility", "visible");
      timeTag.setAttribute("transform", `translate(${tagX - tagW / 2} ${height - PAD.b + 4})`);
      const rect = timeTag.querySelector("rect");
      if (rect) rect.setAttribute("width", String(tagW));
      timeText.setAttribute("x", String(tagW / 2));
      timeText.textContent = label;
    }
  }

  function paintPlacement(next) {
    const placing = tool !== "cursor";
    paintPlaceMark(placeMarkRef.current, {
      x: next?.x,
      y: next?.y,
      color,
      visible: Boolean(placing && next?.inPrice),
    });
    if (!placing) {
      hideToolPreview(previewRef.current, null);
      return;
    }
    paintToolPreview(previewRef.current, {
      tool,
      color,
      pending,
      hover: next,
      scale,
      pad: PAD,
      width,
      plotBottom,
      strokeWidth,
      lineStyle,
    });
  }

  function queueHover(next) {
    hoverRef.current = next;
    if (tool !== "cursor") return;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setHover(hoverRef.current);
    });
  }

  function onMove(event) {
    let livePan = panDrag;
    if (clickRef.current && !panDrag && !drag && tool === "cursor" && clickIsPan(clickRef.current.clientX, event.clientX)) {
      livePan = { x: clickRef.current.clientX };
      setPanDrag(livePan);
      clickRef.current = null;
    }
    if (livePan) {
      const slot = Math.max(
        4,
        ((svgRef.current?.getBoundingClientRect?.().width || width) / width) * (innerW / Math.max(1, candles.length))
      );
      const moved = event.clientX - livePan.x;
      const steps = Math.trunc(moved / slot);
      if (steps && onPanRef.current) {
        onPanRef.current(steps);
        setPanDrag((current) => (current ? { ...current, x: current.x + steps * slot } : { ...livePan, x: livePan.x + steps * slot }));
      }
      return;
    }
    const pointer = locate(event);
    const placing = tool !== "cursor";
    const next = placing && !drag ? locate(event, { place: true }) : pointer;
    const overHandle = Boolean(canMoveHandle(tool) && pointer && hitDrawingHandle(drawings, scale, pointer.x, pointer.y));
    if (shouldFollowCrosshair({ tool, dragging: Boolean(drag), overHandle })) {
      paintCursor(pointer);
    } else {
      paintCursor(null);
    }
    paintPlacement(placing && !drag ? next : null);
    queueHover(pointer);
    if (drag && pointer && Number.isFinite(pointer.t) && Number.isFinite(pointer.price) && onMoveHandle) {
      onMoveHandle(drag.index, drag.key, pointer);
    }
  }

  function onPointerDown(event) {
    const pointer = locate(event);
    if (!pointer) return;
    const hit = event.button === 0 && canMoveHandle(tool) ? hitDrawingHandle(drawings, scale, pointer.x, pointer.y) : null;
    if (hit) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      clickRef.current = null;
      setDrag(hit);
      paintCursor(pointer);
      if (onMoveHandle) onMoveHandle(hit.index, hit.key, pointer);
      return;
    }
    if (event.button === 1) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      clickRef.current = null;
      setPanDrag({ x: event.clientX });
      return;
    }
    if (event.button !== 0) return;
    if (tool === "cursor") {
      if (!pointer.inPrice) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      clickRef.current = { clientX: event.clientX, pointer };
      return;
    }
    const next = locate(event, { place: true });
    if (!next?.inPrice || !onDraw) return;
    event.preventDefault();
    onDraw(next);
  }

  function onPointerUp() {
    if (clickRef.current && tool === "cursor") {
      const next = toggleInspect(inspectRef.current, clickRef.current.pointer);
      inspectRef.current = next;
      setInspect(next);
    }
    clickRef.current = null;
    setDrag(null);
    setPanDrag(null);
    if (!shouldFollowCrosshair({ tool, dragging: false, overHandle: false }) && !inspectRef.current) {
      paintCursor(null);
    }
  }

  const overHandle = Boolean(
    canMoveHandle(tool) && hover && hitDrawingHandle(drawings, scale, hover.x, hover.y)
  );
  const liveHair = shouldFollowCrosshair({ tool, dragging: Boolean(drag), overHandle });
  const inspectX = inspect ? Math.min(width - PAD.r, Math.max(PAD.l, scale.x(inspect.t))) : null;
  const inspectY = inspect ? Math.min(plotBottom - 1, Math.max(PAD.t + 1, scale.y(inspect.price))) : null;
  const hoverCandle = inspect?.candle;
  const clipId = `hybrid-plot-${uid}`;
  const volClipId = `hybrid-vol-${uid}`;
  const rsiClipId = `hybrid-rsi-${uid}`;
  const volGradId = `hybrid-vol-grad-${uid}`;
  const volMax = Math.max(...volumes, 0) || 1;
  const volPoints = candles.map((row, index) => ({
    x: scale.x(row.t),
    y: volBottom - (volumes[index] / volMax) * Math.max(volH - 10, 1),
    up: row.c >= row.o,
  }));
  const volLine = wavePath(volPoints);
  const volFill = waveArea(volPoints, volBottom);
  const rsiY = (value) => rsiTop + (1 - Math.min(100, Math.max(0, Number(value) || 0)) / 100) * rsiH;
  const rsiPoints = candles
    .map((row, index) => {
      const value = rsiValues[index];
      return Number.isFinite(value) ? { x: scale.x(row.t), y: rsiY(value) } : null;
    })
    .filter(Boolean);
  const hoverRsi = hoverCandle
    ? rsiValues[candles.findIndex((row) => row.t === hoverCandle.t)]
    : null;
  const rsiTagY =
    inspect && Number.isFinite(hoverRsi)
      ? Math.min(rsiBottom - 1, Math.max(rsiTop + 1, rsiY(hoverRsi)))
      : null;

  return (
    <div className={hollow ? "hybrid-plot is-hollow" : "hybrid-plot"} ref={box}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`hybrid-svg${tool !== "cursor" ? " is-placing" : " is-pan"}${panDrag ? " is-panning" : ""}${drag ? " is-grabbing" : overHandle ? " is-grab" : ""}`}
        onPointerMove={onMove}
        onPointerLeave={() => {
          if (drag) return;
          paintCursor(null);
          hideToolPreview(previewRef.current, placeMarkRef.current);
          hoverRef.current = null;
          setHover(null);
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={`${quote} hybrid chart`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} />
          </clipPath>
          <clipPath id={volClipId}>
            <rect x={PAD.l} y={volTop} width={innerW} height={Math.max(volH, 0)} />
          </clipPath>
          <clipPath id={rsiClipId}>
            <rect x={PAD.l} y={rsiTop} width={innerW} height={Math.max(rsiH, 0)} />
          </clipPath>
          <linearGradient id={`pressure-down-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff5d73" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#9818f0" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`pressure-up-${uid}`} x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="#00eaff" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#98f050" stopOpacity="0.02" />
          </linearGradient>
          {volH > 0 && volPoints.length ? (
            <linearGradient
              id={volGradId}
              x1={PAD.l}
              x2={width - PAD.r}
              y1="0"
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              {volPoints.map((row, index) => (
                <stop
                  key={`vol-stop-${index}`}
                  offset={volPoints.length === 1 ? "0%" : `${(index / (volPoints.length - 1)) * 100}%`}
                  stopColor={row.up ? UP : DOWN}
                />
              ))}
            </linearGradient>
          ) : null}
        </defs>

        <rect className="hybrid-plot-bg" x="0" y="0" width={width} height={height} />
        <rect className="hybrid-axis-gutter" x="0" y={PAD.t} width={PAD.l} height={PRICE_H} />
        <rect className="hybrid-plot-frame" x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} />
        {volH > 0 ? (
          <rect className="hybrid-plot-frame" x={PAD.l} y={volTop} width={innerW} height={volH} />
        ) : null}
        {rsiH > 0 ? (
          <rect className="hybrid-plot-frame" x={PAD.l} y={rsiTop} width={innerW} height={rsiH} />
        ) : null}

        {equalGrid(GRID_ROWS, PAD.t, PRICE_H).map((y) => (
          <line key={`gy-${y}`} className="hybrid-grid" x1={PAD.l} x2={width - PAD.r} y1={y} y2={y} />
        ))}
        {volH > 0
          ? equalGrid(2, volTop, volH).map((y) => (
              <line key={`gvy-${y}`} className="hybrid-grid" x1={PAD.l} x2={width - PAD.r} y1={y} y2={y} />
            ))
          : null}
        {rsiH > 0
          ? equalGrid(2, rsiTop, rsiH).map((y) => (
              <line key={`gry-${y}`} className="hybrid-grid" x1={PAD.l} x2={width - PAD.r} y1={y} y2={y} />
            ))
          : null}
        {equalGrid(GRID_COLS, PAD.l, innerW).map((x) => (
          <g key={`gx-${x}`}>
            <line className="hybrid-grid is-time" x1={x} x2={x} y1={PAD.t} y2={plotBottom} />
            {volH > 0 ? <line className="hybrid-grid is-time" x1={x} x2={x} y1={volTop} y2={volBottom} /> : null}
            {rsiH > 0 ? <line className="hybrid-grid is-time" x1={x} x2={x} y1={rsiTop} y2={rsiBottom} /> : null}
          </g>
        ))}
        {yTicks.map((price) => (
          <text key={`yt-${price}`} className="hybrid-axis is-price" x={PAD.l - 8} y={scale.y(price) + 3} textAnchor="end">
            {formatAxisPrice(price)}
          </text>
        ))}
        {xTicks.map((stamp) => {
          const x = scale.x(stamp);
          const anchor = x < PAD.l + 28 ? "start" : x > width - PAD.r - 28 ? "end" : "middle";
          return (
            <text key={`xt-${stamp}`} className="hybrid-axis is-time" x={x} y={height - 10} textAnchor={anchor}>
              {formatAxisTime(stamp, { spanMs: scale.spanT, intervalId: interval, locale })}
            </text>
          );
        })}

        <g clipPath={`url(#${clipId})`}>
          {showArb && bands?.bias === "down" ? (
            <rect x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} fill={`url(#pressure-down-${uid})`} />
          ) : null}
          {showArb && bands?.bias === "up" ? (
            <rect x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} fill={`url(#pressure-up-${uid})`} />
          ) : null}

          {showArb && bands?.bid && bands?.mid ? (
            <rect
              className="hybrid-band is-bid"
              x={PAD.l}
              y={scale.y(bands.mid)}
              width={innerW}
              height={Math.max(1, scale.y(bands.bid) - scale.y(bands.mid))}
            />
          ) : null}
          {showArb && bands?.ask && bands?.mid ? (
            <rect
              className="hybrid-band is-ask"
              x={PAD.l}
              y={scale.y(bands.ask)}
              width={innerW}
              height={Math.max(1, scale.y(bands.mid) - scale.y(bands.ask))}
            />
          ) : null}
          {showArb && bands?.bid && bands?.ask ? (
            <rect
              className="hybrid-spread"
              x={PAD.l}
              y={scale.y(bands.ask)}
              width={innerW}
              height={Math.max(1.5, scale.y(bands.bid) - scale.y(bands.ask))}
            />
          ) : null}

          {(showArb ? walls : []).map((wall) => (
            <rect
              key={`wall-${wall.side}-${wall.price}`}
              className={`hybrid-wall is-${wall.side}`}
              x={PAD.l}
              y={scale.y(wall.price) - 1}
              width={innerW}
              height="2"
              opacity={Math.min(0.28, 0.1 + wall.dominance / 20)}
            />
          ))}

          {trail.length > 1 ? (
            <polyline
              className="hybrid-trail"
              fill="none"
              points={trail.map((row) => `${scale.x(row.t)},${scale.y(row.price)}`).join(" ")}
            />
          ) : null}

          {candles.map((row) => {
            const x = scale.x(row.t);
            const up = row.c >= row.o;
            const color = up ? UP : DOWN;
            const bodyTop = scale.y(Math.max(row.o, row.c));
            const bodyH = Math.max(1.2, Math.abs(scale.y(row.c) - scale.y(row.o)));
            const box = candleBodyBox({ width: candleW, height: bodyH, hollow });
            const entering = enterTs.includes(row.t);
            return (
              <g
                key={row.t}
                className={`${up ? "hybrid-candle is-up" : "hybrid-candle is-down"}${entering ? " is-enter" : ""}`}
                onAnimationEnd={
                  entering
                    ? () => setEnterTs((current) => current.filter((stamp) => stamp !== row.t))
                    : undefined
                }
              >
                <line className="hybrid-wick" x1={x} x2={x} y1={scale.y(row.h)} y2={scale.y(row.l)} />
                <rect
                  className="hybrid-candle-body"
                  x={x - box.width / 2}
                  y={bodyTop - box.offsetY}
                  width={box.width}
                  height={box.height}
                  style={{
                    fill: hollow ? "none" : color,
                    stroke: color,
                    strokeWidth: box.strokeWidth,
                  }}
                />
              </g>
            );
          })}

          {showArb && bands?.mid ? (
            <line className="hybrid-mid" x1={PAD.l} x2={width - PAD.r} y1={scale.y(bands.mid)} y2={scale.y(bands.mid)} />
          ) : null}

          {averages.map((row) => {
            const reveal = maRevealState(row.id, { seen: maDraw.ready, armed: maDraw.armed });
            if (reveal === "wait") return null;
            const drawing = reveal === "drawing";
            const d = maPath(
              extendMaPoints(
                maCurvePoints(candles, row.values).map((point) => ({
                  x: scale.x(point.t),
                  y: scale.y(point.v),
                })),
                { right: width - PAD.r, top: PAD.t, bottom: plotBottom }
              )
            );
            if (!d) return null;
            const finishDraw = () => {
              setMaDraw((current) => ({
                ready: current.ready.includes(row.id) ? current.ready : [...current.ready, row.id],
                armed: current.armed.filter((id) => id !== row.id),
              }));
            };
            return (
              <g key={row.id}>
                <path
                  className={drawing ? "hybrid-sma is-drawing" : "hybrid-sma"}
                  d={d}
                  pathLength="1"
                  style={{
                    stroke: row.color,
                    ...(drawing ? { strokeDasharray: 1, strokeDashoffset: 1 } : {}),
                  }}
                  onAnimationEnd={drawing ? finishDraw : undefined}
                />
                {drawing ? (
                  <circle className="hybrid-sma-glow" r="5" style={{ fill: row.color, color: row.color }}>
                    <animateMotion dur="2.6s" fill="freeze" path={d} rotate="0" />
                  </circle>
                ) : null}
              </g>
            );
          })}

          {showLedgerOrders
            ? (wallet?.orders || []).map((row, index) => {
                const y = scale.y(row.price);
                const when = row.when ? formatCursorWhen(row.when, locale) : "";
                const label = [when, formatQuotePerBase(row.price, locale, quote), formatToken(row.amount, locale, 2)]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <g key={`order-${index}`} className={`hybrid-wallet-order is-${row.side}`}>
                    <line x1={PAD.l} x2={width - PAD.r} y1={y} y2={y} />
                    <text x={PAD.l + 8} y={y - 4}>
                      {label}
                    </text>
                  </g>
                );
              })
            : null}
          {(wallet?.fills || []).map((row, index) =>
            Number(row.price) > 0 ? (
              <circle
                key={`fill-${index}`}
                className={`hybrid-wallet-fill is-${row.side}`}
                cx={scale.x(row.t)}
                cy={scale.y(row.price)}
                r="4"
              />
            ) : null
          )}

          {ghost?.next > 0 ? (
            <g className="hybrid-ghost">
              <rect
                x={width - PAD.r - candleW - 6}
                y={scale.y(Math.max(ghost.spot, ghost.next))}
                width={candleW}
                height={Math.max(2, Math.abs(scale.y(ghost.next) - scale.y(ghost.spot)))}
              />
            </g>
          ) : null}

        </g>
        <ChartDrawings
          drawings={drawings}
          scale={scale}
          pad={PAD}
          width={width}
          plotBottom={plotBottom}
          clipId={clipId}
          activeHandle={drag}
        />
        <g className="hybrid-place-layer" pointerEvents="none">
          <g ref={previewRef} clipPath={`url(#${clipId})`} />
          <g ref={placeMarkRef} className="hybrid-place-mark" visibility="hidden">
            <circle r="5" />
            <line x1="-7" x2="7" y1="0" y2="0" />
            <line x1="0" x2="0" y1="-7" y2="7" />
          </g>
        </g>

        {volH > 0 ? (
          <g className="hybrid-volume" clipPath={`url(#${volClipId})`}>
            {volFill ? <path className="hybrid-volume-fill" d={volFill} fill={`url(#${volGradId})`} /> : null}
            {volLine ? (
              <path className="hybrid-volume-wave" d={volLine} stroke={`url(#${volGradId})`} />
            ) : null}
            {heatmap.map((row, index) => (
              <circle
                key={`heat-${index}`}
                className={`hybrid-heat is-${row.side}`}
                cx={scale.x(row.t)}
                cy={volTop + 10 + (row.side === "sell" ? 16 : 8)}
                r={Math.max(2, Math.min(7, Math.log10(row.size + 10) * 1.6))}
                opacity={row.opacity}
              />
            ))}
          </g>
        ) : null}
        {volH > 0 ? (
          <text className="hybrid-pane-label" x={PAD.l - 8} y={volTop + 11} textAnchor="end">
            VOL
          </text>
        ) : null}

        {rsiH > 0 ? (
          <g className="hybrid-rsi">
            <rect
              className="hybrid-rsi-band"
              x={PAD.l}
              y={rsiY(rsiOverbought)}
              width={innerW}
              height={Math.max(1, rsiY(rsiOversold) - rsiY(rsiOverbought))}
            />
            <line className="hybrid-rsi-level is-ob" x1={PAD.l} x2={width - PAD.r} y1={rsiY(rsiOverbought)} y2={rsiY(rsiOverbought)} />
            <line className="hybrid-rsi-level is-mid" x1={PAD.l} x2={width - PAD.r} y1={rsiY(50)} y2={rsiY(50)} />
            <line className="hybrid-rsi-level is-os" x1={PAD.l} x2={width - PAD.r} y1={rsiY(rsiOversold)} y2={rsiY(rsiOversold)} />
            <g clipPath={`url(#${rsiClipId})`}>
              {wavePath(rsiPoints) ? <path className="hybrid-rsi-line" d={wavePath(rsiPoints)} /> : null}
            </g>
            <text className="hybrid-pane-label" x={PAD.l - 8} y={rsiTop + 11} textAnchor="end">
              RSI {rsiPeriod}
            </text>
            <text className="hybrid-axis is-price" x={PAD.l - 8} y={rsiY(rsiOverbought) + 3} textAnchor="end">
              {rsiOverbought}
            </text>
            <text className="hybrid-axis is-price" x={PAD.l - 8} y={rsiY(rsiOversold) + 3} textAnchor="end">
              {rsiOversold}
            </text>
          </g>
        ) : null}

        <g className={`hybrid-crosshair is-live${tool !== "cursor" ? " is-place" : ""}`} pointerEvents="none">
          <line ref={hairVRef} visibility="hidden" x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={height - PAD.b} />
          <line ref={hairHRef} visibility="hidden" x1={PAD.l} x2={width - PAD.r} y1={PAD.t} y2={PAD.t} />
          <g ref={timeTagRef} className="hybrid-cursor-tag is-time" visibility="hidden">
            <rect x="0" y="0" width="108" height="18" rx="3" />
            <text ref={timeTextRef} x="54" y="13" textAnchor="middle" />
          </g>
          <g ref={priceTagRef} className="hybrid-cursor-tag is-price" visibility="hidden">
            <rect x="2" y="0" width={PAD.l - 6} height="18" rx="3" />
            <text ref={priceTextRef} x={PAD.l - 8} y="13" textAnchor="end" />
          </g>
        </g>
        {inspect && !liveHair && Number.isFinite(inspectX) && Number.isFinite(inspectY) ? (
          <g className="hybrid-crosshair is-pinned" pointerEvents="none">
            <line x1={inspectX} x2={inspectX} y1={PAD.t} y2={height - PAD.b} />
            <line x1={PAD.l} x2={width - PAD.r} y1={inspectY} y2={inspectY} />
            <g className="hybrid-cursor-tag is-time" transform={`translate(${Math.min(width - PAD.r - 54, Math.max(PAD.l, inspectX - 54))} ${height - PAD.b + 4})`}>
              <rect x="0" y="0" width="108" height="18" rx="3" />
              <text x="54" y="13" textAnchor="middle">
                {formatCursorWhen(inspect.t, locale)}
              </text>
            </g>
            <g className="hybrid-cursor-tag is-price" transform={`translate(0 ${inspectY - 9})`}>
              <rect x="2" y="0" width={PAD.l - 6} height="18" rx="3" />
              <text x={PAD.l - 8} y="13" textAnchor="end">
                {formatAxisPrice(inspect.price)}
              </text>
            </g>
            {rsiTagY != null ? (
              <g className="hybrid-cursor-tag is-price">
                <rect x={2} y={rsiTagY - 9} width={PAD.l - 6} height={18} rx="3" />
                <text x={PAD.l - 8} y={rsiTagY + 4} textAnchor="end">
                  {Number(hoverRsi).toFixed(1)}
                </text>
              </g>
            ) : null}
          </g>
        ) : null}
      </svg>

      {hoverCandle ? (
        <div className="hybrid-ohlc">
          <span>{formatCursorWhen(hoverCandle.t, locale)}</span>
          <span>O {formatQuotePerBase(hoverCandle.o, locale, quote)}</span>
          <span>H {formatQuotePerBase(hoverCandle.h, locale, quote)}</span>
          <span>L {formatQuotePerBase(hoverCandle.l, locale, quote)}</span>
          <span>C {formatQuotePerBase(hoverCandle.c, locale, quote)}</span>
          <span>V {formatToken(hoverCandle.v, locale, 2)}</span>
          {Number.isFinite(hoverRsi) ? <span>RSI {Number(hoverRsi).toFixed(1)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

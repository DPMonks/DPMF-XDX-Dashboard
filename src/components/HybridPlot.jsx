import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatQuotePerBase, formatToken } from "../utils/format";
import { clientToSvg, formatAxisPrice, formatAxisTime, formatCursorWhen, priceTicks, timeTicks } from "../chart/axis";
import { candleBodyBox, candleBodyWidth } from "../chart/candles";
import { maCurvePoints, maPath, volumeWaveValues, waveArea, wavePath } from "../chart/indicators";
import { intervalMs } from "../chart/intervals";
import { hitDrawingHandle, previewDrawing, snapPoint } from "../chart/drawings";
import ChartDrawings from "./ChartDrawings";

const PRICE_H = 348;
const VOL_H = 72;
const RSI_H = 72;
const PANE_GAP = 8;
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
  locale,
  onDraw,
  onMoveHandle,
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
  const rafRef = useRef(0);
  const [hover, setHover] = useState(null);
  const [drag, setDrag] = useState(null);
  const [glowIds, setGlowIds] = useState([]);
  const seenMa = useRef(new Set());
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
    const start = view?.start || candles[0]?.t || 0;
    const end = view?.end || candles[candles.length - 1]?.t || 1;
    const min = view?.min || 0;
    const max = view?.max || 1;
    const spanT = Math.max(end - start, 1);
    const spanP = Math.max(max - min, 1e-12);
    return {
      x: (t) => PAD.l + ((t - start) / spanT) * innerW,
      y: (p) => PAD.t + (1 - (p - min) / spanP) * PRICE_H,
      start,
      end,
      min,
      max,
      spanT,
    };
  }, [view, candles, innerW]);

  const yTicks = useMemo(() => priceTicks(scale.min, scale.max, 6), [scale.min, scale.max]);
  const xTicks = useMemo(
    () => timeTicks(scale.start, scale.end, { count: 6, intervalId: interval }),
    [scale.start, scale.end, interval]
  );
  const volumes = useMemo(() => volumeWaveValues(candles), [candles]);
  useEffect(() => {
    const ids = averages.map((row) => row.id);
    const added = ids.filter((id) => !seenMa.current.has(id));
    seenMa.current = new Set(ids);
    if (added.length) setGlowIds((current) => [...new Set([...current, ...added])]);
  }, [averages]);

  const candleW = candleBodyWidth({
    innerW,
    candles,
    start: scale.start,
    end: scale.end,
    stepMs: intervalMs(interval),
  });

  function locate(event) {
    const mapped = clientToSvg(svgRef.current || event.currentTarget, event.clientX, event.clientY, width, height);
    if (!mapped) return null;
    const x = mapped.x;
    const y = mapped.y;
    const t = scale.start + ((x - PAD.l) / innerW) * (scale.end - scale.start);
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
      x,
      y,
      t: snapped.t,
      price: snapped.price,
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

  function queueHover(next) {
    hoverRef.current = next;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setHover(hoverRef.current);
    });
  }

  function onMove(event) {
    const next = locate(event);
    paintCursor(next);
    queueHover(next);
    if (drag && next && Number.isFinite(next.t) && Number.isFinite(next.price) && onMoveHandle) {
      onMoveHandle(drag.index, drag.key, next);
    }
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    const next = locate(event);
    if (!next?.inPrice) return;
    const hit = hitDrawingHandle(drawings, scale, next.x, next.y);
    if (hit) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setDrag(hit);
      if (onMoveHandle) onMoveHandle(hit.index, hit.key, next);
      return;
    }
    if (tool === "cursor" || !onDraw) return;
    event.preventDefault();
    onDraw(next);
  }

  function onPointerUp() {
    setDrag(null);
  }

  const hoverCandle = hover?.candle;
  const preview = hover?.inPrice ? previewDrawing({ tool, color, pending, hover }) : null;
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
    hover?.inRsi && Number.isFinite(hoverRsi)
      ? Math.min(rsiBottom - 1, Math.max(rsiTop + 1, rsiY(hoverRsi)))
      : null;

  return (
    <div className={hollow ? "hybrid-plot is-hollow" : "hybrid-plot"} ref={box}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`hybrid-svg${drag ? " is-grabbing" : hover && hitDrawingHandle(drawings, scale, hover.x, hover.y) ? " is-grab" : ""}`}
        onPointerMove={onMove}
        onPointerLeave={() => {
          if (drag) return;
          paintCursor(null);
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

        {yTicks.map((price) => (
          <g key={`yt-${price}`}>
            <line
              className="hybrid-grid"
              x1={PAD.l}
              x2={width - PAD.r}
              y1={scale.y(price)}
              y2={scale.y(price)}
            />
            <text className="hybrid-axis is-price" x={PAD.l - 8} y={scale.y(price) + 3} textAnchor="end">
              {formatAxisPrice(price)}
            </text>
          </g>
        ))}
        {xTicks.map((stamp) => {
          const x = scale.x(stamp);
          const anchor = x < PAD.l + 28 ? "start" : x > width - PAD.r - 28 ? "end" : "middle";
          return (
            <g key={`xt-${stamp}`}>
              <line className="hybrid-grid is-time" x1={x} x2={x} y1={PAD.t} y2={plotBottom} />
              {volH > 0 ? (
                <line className="hybrid-grid is-time" x1={x} x2={x} y1={volTop} y2={volBottom} />
              ) : null}
              {rsiH > 0 ? (
                <line className="hybrid-grid is-time" x1={x} x2={x} y1={rsiTop} y2={rsiBottom} />
              ) : null}
              <text className="hybrid-axis is-time" x={x} y={height - 10} textAnchor={anchor}>
                {formatAxisTime(stamp, { spanMs: scale.spanT, intervalId: interval, locale })}
              </text>
            </g>
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

          {averages.map((row) => {
            const d = maPath(
              maCurvePoints(candles, row.values).map((point) => ({
                x: scale.x(point.t),
                y: scale.y(point.v),
              }))
            );
            if (!d) return null;
            return (
              <g key={row.id}>
                <path className="hybrid-sma" d={d} style={{ stroke: row.color }} />
                {glowIds.includes(row.id) ? (
                  <path
                    className="hybrid-sma-glow"
                    d={d}
                    pathLength="1"
                    style={{ stroke: row.color, color: row.color }}
                    onAnimationEnd={() => setGlowIds((current) => current.filter((id) => id !== row.id))}
                  />
                ) : null}
              </g>
            );
          })}

          {candles.map((row) => {
            const x = scale.x(row.t);
            const up = row.c >= row.o;
            const color = up ? UP : DOWN;
            const bodyTop = scale.y(Math.max(row.o, row.c));
            const bodyH = Math.max(1.2, Math.abs(scale.y(row.c) - scale.y(row.o)));
            const box = candleBodyBox({ width: candleW, height: bodyH, hollow });
            return (
              <g key={row.t} className={up ? "hybrid-candle is-up" : "hybrid-candle is-down"}>
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

          {(wallet?.orders || []).map((row, index) => (
            <line
              key={`order-${index}`}
              className={`hybrid-wallet-order is-${row.side}`}
              x1={PAD.l}
              x2={width - PAD.r}
              y1={scale.y(row.price)}
              y2={scale.y(row.price)}
            />
          ))}
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
          preview={preview}
          pending={pending}
          scale={scale}
          pad={PAD}
          width={width}
          plotBottom={plotBottom}
          activeHandle={drag}
        />

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

        <g className="hybrid-crosshair" pointerEvents="none">
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
          {rsiTagY != null ? (
            <g className="hybrid-cursor-tag is-price">
              <rect x={2} y={rsiTagY - 9} width={PAD.l - 6} height={18} rx="3" />
              <text x={PAD.l - 8} y={rsiTagY + 4} textAnchor="end">
                {Number(hoverRsi).toFixed(1)}
              </text>
            </g>
          ) : null}
        </g>
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

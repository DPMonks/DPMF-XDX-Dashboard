import { useId, useMemo, useRef, useState } from "react";
import { formatQuotePerBase, formatToken } from "../utils/format";
import { formatAxisPrice, formatAxisTime, formatCursorWhen, priceTicks, timeTicks } from "../chart/axis";
import { candleBodyWidth } from "../chart/candles";
import { intervalMs } from "../chart/intervals";
import { previewDrawing, snapPoint } from "../chart/drawings";
import ChartDrawings from "./ChartDrawings";

const PRICE_H = 348;
const VOL_H = 82;
const PAD = { l: 84, r: 18, t: 16, b: 36 };

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
  locale,
  onDraw,
}) {
  const box = useRef(null);
  const [hover, setHover] = useState(null);
  const uid = useId().replace(/:/g, "");
  const width = 960;
  const height = PAD.t + PRICE_H + VOL_H + PAD.b;
  const innerW = width - PAD.l - PAD.r;
  const plotBottom = PAD.t + PRICE_H;

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

  const candleW = candleBodyWidth({
    innerW,
    candles,
    start: scale.start,
    end: scale.end,
    stepMs: intervalMs(interval),
  });

  function locate(event) {
    const node = box.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    const t = scale.start + ((x - PAD.l) / innerW) * (scale.end - scale.start);
    const price = scale.max - ((y - PAD.t) / PRICE_H) * (scale.max - scale.min);
    const inPrice = y >= PAD.t - 2 && y <= plotBottom + 2 && x >= PAD.l && x <= width - PAD.r;
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
    };
  }

  function onMove(event) {
    const next = locate(event);
    setHover(next);
  }

  function onPointerDown(event) {
    if (event.button !== 0 || tool === "cursor" || !onDraw) return;
    const next = locate(event);
    if (next?.inPrice) {
      event.preventDefault();
      onDraw(next);
    }
  }

  const hoverCandle = hover?.candle;
  const preview = hover?.inPrice ? previewDrawing({ tool, color, pending, hover }) : null;
  const clipId = `hybrid-plot-${uid}`;
  const cursorT = hover && Number.isFinite(hover.t) ? hover.t : hoverCandle?.t;
  const timeLabel = cursorT != null ? formatCursorWhen(cursorT, locale) : "";
  const timeTagW = Math.max(108, timeLabel.length * 6.1);
  const cursorX = hover ? Math.min(width - PAD.r, Math.max(PAD.l, hover.x)) : 0;
  const timeTagX = hover
    ? Math.min(width - PAD.r - timeTagW / 2, Math.max(PAD.l + timeTagW / 2, cursorX))
    : 0;
  const priceY = hover?.inPrice ? Math.min(plotBottom - 1, Math.max(PAD.t + 1, hover.y)) : null;

  return (
    <div className={hollow ? "hybrid-plot is-hollow" : "hybrid-plot"} ref={box}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="hybrid-svg"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onPointerDown={onPointerDown}
        role="img"
        aria-label={`${quote} hybrid chart`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} />
          </clipPath>
          <linearGradient id={`pressure-down-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff5d73" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#9818f0" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`pressure-up-${uid}`} x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="#00eaff" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#98f050" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <rect className="hybrid-plot-bg" x="0" y="0" width={width} height={height} />
        <rect className="hybrid-axis-gutter" x="0" y={PAD.t} width={PAD.l} height={PRICE_H} />
        <rect className="hybrid-plot-frame" x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} />

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
              <text className="hybrid-axis is-time" x={x} y={height - 10} textAnchor={anchor}>
                {formatAxisTime(stamp, { spanMs: scale.spanT, intervalId: interval, locale })}
              </text>
            </g>
          );
        })}

        <g clipPath={`url(#${clipId})`}>
          {bands?.bias === "down" ? (
            <rect x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} fill={`url(#pressure-down-${uid})`} />
          ) : null}
          {bands?.bias === "up" ? (
            <rect x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} fill={`url(#pressure-up-${uid})`} />
          ) : null}

          {bands?.bid && bands?.mid ? (
            <rect
              className="hybrid-band is-bid"
              x={PAD.l}
              y={scale.y(bands.mid)}
              width={innerW}
              height={Math.max(1, scale.y(bands.bid) - scale.y(bands.mid))}
            />
          ) : null}
          {bands?.ask && bands?.mid ? (
            <rect
              className="hybrid-band is-ask"
              x={PAD.l}
              y={scale.y(bands.ask)}
              width={innerW}
              height={Math.max(1, scale.y(bands.mid) - scale.y(bands.ask))}
            />
          ) : null}
          {bands?.bid && bands?.ask ? (
            <rect
              className="hybrid-spread"
              x={PAD.l}
              y={scale.y(bands.ask)}
              width={innerW}
              height={Math.max(1.5, scale.y(bands.bid) - scale.y(bands.ask))}
            />
          ) : null}

          {walls.map((wall) => (
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

          {averages.flatMap((row) =>
            (row.values || []).map((value, index) => {
              const next = row.values[index + 1];
              if (value == null || next == null || !candles[index] || !candles[index + 1]) return null;
              return (
                <line
                  key={`${row.id}-${candles[index].t}`}
                  className="hybrid-sma"
                  x1={scale.x(candles[index].t)}
                  y1={scale.y(value)}
                  x2={scale.x(candles[index + 1].t)}
                  y2={scale.y(next)}
                  style={{ stroke: row.color }}
                />
              );
            })
          )}

          {candles.map((row) => {
            const x = scale.x(row.t);
            const up = row.c >= row.o;
            const bodyTop = scale.y(Math.max(row.o, row.c));
            const bodyH = Math.max(1.2, Math.abs(scale.y(row.c) - scale.y(row.o)));
            return (
              <g key={row.t} className={up ? "hybrid-candle is-up" : "hybrid-candle is-down"}>
                <line className="hybrid-wick" x1={x} x2={x} y1={scale.y(row.h)} y2={scale.y(row.l)} />
                <rect className="hybrid-body" x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} />
              </g>
            );
          })}

          {bands?.mid ? (
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

          <ChartDrawings
            drawings={drawings}
            preview={preview}
            pending={pending}
            scale={scale}
            pad={PAD}
            width={width}
            plotBottom={plotBottom}
          />
        </g>

        {heatmap.map((row, index) => (
          <circle
            key={`heat-${index}`}
            className={`hybrid-heat is-${row.side}`}
            cx={scale.x(row.t)}
            cy={PAD.t + PRICE_H + 8 + (row.side === "sell" ? 28 : 18)}
            r={Math.max(2, Math.min(9, Math.log10(row.size + 10) * 2))}
            opacity={row.opacity}
          />
        ))}

        {hover ? (
          <g className="hybrid-crosshair">
            <line
              x1={cursorX}
              x2={cursorX}
              y1={PAD.t}
              y2={height - PAD.b}
            />
            {priceY != null ? <line x1={PAD.l} x2={width - PAD.r} y1={priceY} y2={priceY} /> : null}
            <g className="hybrid-cursor-tag is-time">
              <rect x={timeTagX - timeTagW / 2} y={height - PAD.b + 4} width={timeTagW} height={18} rx="3" />
              <text x={timeTagX} y={height - PAD.b + 17} textAnchor="middle">
                {timeLabel}
              </text>
            </g>
            {priceY != null ? (
              <g className="hybrid-cursor-tag is-price">
                <rect x={2} y={priceY - 9} width={PAD.l - 6} height={18} rx="3" />
                <text x={PAD.l - 8} y={priceY + 4} textAnchor="end">
                  {formatAxisPrice(hover.price)}
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
        </div>
      ) : null}
    </div>
  );
}

import { useMemo, useRef, useState } from "react";
import { formatQuotePerBase, formatToken, formatWhen } from "../utils/format";
import { depthIntensity } from "../chart/overlays";

const PRICE_H = 348;
const VOL_H = 82;
const PAD = { l: 10, r: 78, t: 18, b: 26 };

export default function HybridPlot({
  candles = [],
  quote = "RLUSD",
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
  sma20 = [],
  sma50 = [],
  typicalVolume = 0,
  locale,
  onDraw,
}) {
  const box = useRef(null);
  const [hover, setHover] = useState(null);
  const width = 960;
  const height = PAD.t + PRICE_H + VOL_H + PAD.b;
  const innerW = width - PAD.l - PAD.r;

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
    };
  }, [view, candles, innerW]);

  const candleW = Math.max(2, innerW / Math.max(candles.length, 1) * 0.7);

  function locate(event) {
    const node = box.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const y = ((event.clientY - rect.top) / rect.height) * height;
    const t = scale.start + ((x - PAD.l) / innerW) * (scale.end - scale.start);
    const price = scale.max - ((y - PAD.t) / PRICE_H) * (scale.max - scale.min);
    let nearest = candles[0];
    let best = Infinity;
    for (const row of candles) {
      const dist = Math.abs(row.t - t);
      if (dist < best) {
        best = dist;
        nearest = row;
      }
    }
    return { x, y, t, price, candle: nearest };
  }

  function onMove(event) {
    const next = locate(event);
    setHover(next);
  }

  function onClick(event) {
    if (tool === "cursor" || !onDraw) return;
    const next = locate(event);
    if (next) onDraw(next);
  }

  const hoverCandle = hover?.candle;
  const fib = drawings.filter((row) => row.kind === "fib");

  return (
    <div className="hybrid-plot" ref={box}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="hybrid-svg"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
        role="img"
        aria-label={`${quote} hybrid chart`}
      >
        <defs>
          <linearGradient id="pressure-down" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ff5d73" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#9818f0" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="pressure-up" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor="#00eaff" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#98f050" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {bands?.bias === "down" ? (
          <rect x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} fill="url(#pressure-down)" />
        ) : null}
        {bands?.bias === "up" ? (
          <rect x={PAD.l} y={PAD.t} width={innerW} height={PRICE_H} fill="url(#pressure-up)" />
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
            y={scale.y(wall.price) - Math.min(10, wall.dominance)}
            width={innerW}
            height={Math.max(2, Math.min(16, wall.dominance * 2))}
            opacity={Math.min(0.55, 0.15 + wall.dominance / 12)}
          />
        ))}

        {trail.length > 1 ? (
          <polyline
            className="hybrid-trail"
            fill="none"
            points={trail.map((row) => `${scale.x(row.t)},${scale.y(row.price)}`).join(" ")}
          />
        ) : null}

        {sma20.map((value, index) => {
          if (value == null || !candles[index]) return null;
          const next = sma20[index + 1];
          if (next == null || !candles[index + 1]) return null;
          return (
            <line
              key={`sma20-${candles[index].t}`}
              className="hybrid-sma is-20"
              x1={scale.x(candles[index].t)}
              y1={scale.y(value)}
              x2={scale.x(candles[index + 1].t)}
              y2={scale.y(next)}
            />
          );
        })}
        {sma50.map((value, index) => {
          if (value == null || !candles[index]) return null;
          const next = sma50[index + 1];
          if (next == null || !candles[index + 1]) return null;
          return (
            <line
              key={`sma50-${candles[index].t}`}
              className="hybrid-sma is-50"
              x1={scale.x(candles[index].t)}
              y1={scale.y(value)}
              x2={scale.x(candles[index + 1].t)}
              y2={scale.y(next)}
            />
          );
        })}

        {candles.map((row) => {
          const x = scale.x(row.t);
          const up = row.c >= row.o;
          const bodyTop = scale.y(Math.max(row.o, row.c));
          const bodyH = Math.max(1.2, Math.abs(scale.y(row.c) - scale.y(row.o)));
          const intensity = depthIntensity(row.v, typicalVolume);
          return (
            <g key={row.t} className={up ? "hybrid-candle is-up" : "hybrid-candle is-down"} opacity={intensity}>
              <line x1={x} x2={x} y1={scale.y(row.h)} y2={scale.y(row.l)} />
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} rx="1" />
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

        {drawings.map((row, index) => {
          if (row.kind === "hline") {
            return (
              <line
                key={`d-${index}`}
                className="hybrid-draw"
                x1={PAD.l}
                x2={width - PAD.r}
                y1={scale.y(row.price)}
                y2={scale.y(row.price)}
              />
            );
          }
          if (row.kind === "trend" && row.a && row.b) {
            return (
              <line
                key={`d-${index}`}
                className="hybrid-draw"
                x1={scale.x(row.a.t)}
                y1={scale.y(row.a.price)}
                x2={scale.x(row.b.t)}
                y2={scale.y(row.b.price)}
              />
            );
          }
          return null;
        })}
        {fib.map((row) => {
          if (!row.a || !row.b) return null;
          const hi = Math.max(row.a.price, row.b.price);
          const lo = Math.min(row.a.price, row.b.price);
          const span = hi - lo || 1;
          return [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((level) => {
            const price = hi - span * level;
            return (
              <line
                key={`fib-${row.a.t}-${level}`}
                className="hybrid-fib"
                x1={PAD.l}
                x2={width - PAD.r}
                y1={scale.y(price)}
                y2={scale.y(price)}
              />
            );
          });
        })}
        {pending ? (
          <circle className="hybrid-pending" cx={scale.x(pending.t)} cy={scale.y(pending.price)} r="3" />
        ) : null}

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

        {hoverCandle ? (
          <g className="hybrid-crosshair">
            <line x1={scale.x(hoverCandle.t)} x2={scale.x(hoverCandle.t)} y1={PAD.t} y2={height - PAD.b} />
            <line x1={PAD.l} x2={width - PAD.r} y1={hover.y} y2={hover.y} />
          </g>
        ) : null}

        <text className="hybrid-axis" x={width - 6} y={scale.y(scale.max) + 4} textAnchor="end">
          {formatQuotePerBase(scale.max, locale, "")}
        </text>
        <text className="hybrid-axis" x={width - 6} y={scale.y(scale.min)} textAnchor="end">
          {formatQuotePerBase(scale.min, locale, "")}
        </text>
      </svg>

      {hoverCandle ? (
        <div className="hybrid-ohlc">
          <span>{formatWhen(hoverCandle.t, locale)}</span>
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

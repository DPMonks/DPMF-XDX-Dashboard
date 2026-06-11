export default function MiniCandleChart({ candles }) {
  if (!candles || candles.length === 0) return null;

  const max = Math.max(...candles.map(c => c.high));
  const min = Math.min(...candles.map(c => c.low));
  const range = max - min || 1;

  return (
    <svg viewBox="0 0 100 100" className="mini-candle-chart">
      {candles.map((c, i) => {
        const x = (i / candles.length) * 100 + 1;
        const wickTop = 100 - ((c.high - min) / range) * 100;
        const wickBottom = 100 - ((c.low - min) / range) * 100;

        const openY = 100 - ((c.open - min) / range) * 100;
        const closeY = 100 - ((c.close - min) / range) * 100;

        const isUp = c.close >= c.open;
        const color = isUp ? "#00ff6a" : "#ff3b3b";

        return (
          <g key={i}>
            {/* Wick */}
            <line
              x1={x}
              x2={x}
              y1={wickTop}
              y2={wickBottom}
              stroke={color}
              strokeWidth="1.5"
            />

            {/* Body */}
            <rect
              x={x - 1.5}
              width="3"
              y={Math.min(openY, closeY)}
              height={Math.abs(openY - closeY)}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}

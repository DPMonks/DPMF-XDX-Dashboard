import { channelOffset, extendSegment, FIB_LEVELS, raySegment, rangeStats } from "../chart/drawings";
import { formatAxisPrice } from "../chart/axis";

function stroke(row) {
  return row?.color || "#ffffff";
}

function Line({ a, b, scale, color, dashed, marker }) {
  if (!a || !b) return null;
  return (
    <line
      className={dashed ? "hybrid-draw is-preview" : "hybrid-draw"}
      x1={scale.x(a.t)}
      y1={scale.y(a.price)}
      x2={scale.x(b.t)}
      y2={scale.y(b.price)}
      stroke={color}
      markerEnd={marker}
    />
  );
}

export default function ChartDrawings({
  drawings = [],
  preview,
  pending,
  scale,
  pad,
  width,
  plotBottom,
}) {
  const tMin = scale.start;
  const tMax = scale.end;
  const items = preview ? [...drawings, preview] : drawings;
  const first = pending?.points?.[0];

  return (
    <g className="hybrid-drawings">
      {first ? <circle className="hybrid-pending" cx={scale.x(first.t)} cy={scale.y(first.price)} r="3" fill={pending.color} /> : null}
      {items.map((row, index) => {
        const color = stroke(row);
        const dashed = row.preview;
        const key = `${row.kind}-${index}-${row.preview ? "p" : "d"}`;
        if (row.kind === "hline" && Number(row.price) > 0) {
          return (
            <line
              key={key}
              className={dashed ? "hybrid-draw is-preview" : "hybrid-draw"}
              x1={pad.l}
              x2={width - pad.r}
              y1={scale.y(row.price)}
              y2={scale.y(row.price)}
              stroke={color}
            />
          );
        }
        if (row.kind === "vline" && Number(row.t) > 0) {
          return (
            <line
              key={key}
              className={dashed ? "hybrid-draw is-preview" : "hybrid-draw"}
              x1={scale.x(row.t)}
              x2={scale.x(row.t)}
              y1={pad.t}
              y2={plotBottom}
              stroke={color}
            />
          );
        }
        if (row.kind === "trend" && row.a && row.b) {
          return <Line key={key} a={row.a} b={row.b} scale={scale} color={color} dashed={dashed} />;
        }
        if (row.kind === "arrow" && row.a && row.b) {
          const mark = `arrow-${key.replace(/[^a-z0-9-]/gi, "")}`;
          return (
            <g key={key}>
              <defs>
                <marker id={mark} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6 Z" fill={color} />
                </marker>
              </defs>
              <Line a={row.a} b={row.b} scale={scale} color={color} dashed={dashed} marker={`url(#${mark})`} />
            </g>
          );
        }
        if (row.kind === "ray" && row.a && row.b) {
          const [a, b] = raySegment(row.a, row.b, tMin, tMax);
          return <Line key={key} a={a} b={b} scale={scale} color={color} dashed={dashed} />;
        }
        if (row.kind === "extended" && row.a && row.b) {
          const [a, b] = extendSegment(row.a, row.b, tMin, tMax);
          return <Line key={key} a={a} b={b} scale={scale} color={color} dashed={dashed} />;
        }
        if ((row.kind === "rect" || row.kind === "range") && row.a && row.b) {
          const x = Math.min(scale.x(row.a.t), scale.x(row.b.t));
          const y = Math.min(scale.y(row.a.price), scale.y(row.b.price));
          const w = Math.max(2, Math.abs(scale.x(row.b.t) - scale.x(row.a.t)));
          const h = Math.max(2, Math.abs(scale.y(row.b.price) - scale.y(row.a.price)));
          const stats = rangeStats(row.a, row.b);
          return (
            <g key={key}>
              <rect
                className={dashed ? "hybrid-shape is-preview" : "hybrid-shape"}
                x={x}
                y={y}
                width={w}
                height={h}
                stroke={color}
              />
              {row.kind === "range" ? (
                <text className="hybrid-draw-label" x={x + 6} y={y + 14} fill={color}>
                  {formatAxisPrice(stats.delta)} ({stats.pct.toFixed(2)}%)
                </text>
              ) : null}
            </g>
          );
        }
        if (row.kind === "channel" && row.a && row.b) {
          const offset = row.c ? channelOffset(row.a, row.b, row.c) : 0;
          const parallel = [
            { t: row.a.t, price: row.a.price + offset },
            { t: row.b.t, price: row.b.price + offset },
          ];
          return (
            <g key={key}>
              <Line a={row.a} b={row.b} scale={scale} color={color} dashed={dashed} />
              {row.c ? <Line a={parallel[0]} b={parallel[1]} scale={scale} color={color} dashed={dashed} /> : null}
            </g>
          );
        }
        if (row.kind === "fib" && row.a && row.b) {
          const hi = Math.max(row.a.price, row.b.price);
          const lo = Math.min(row.a.price, row.b.price);
          const span = hi - lo || 1;
          return (
            <g key={key}>
              {FIB_LEVELS.map((level) => {
                const price = hi - span * level;
                return (
                  <g key={`${key}-${level}`}>
                    <line
                      className={dashed ? "hybrid-fib is-preview" : "hybrid-fib"}
                      x1={pad.l}
                      x2={width - pad.r}
                      y1={scale.y(price)}
                      y2={scale.y(price)}
                      stroke={color}
                    />
                    <text className="hybrid-draw-label" x={pad.l + 4} y={scale.y(price) - 3} fill={color}>
                      {level.toFixed(3)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        }
        if (row.kind === "text" && row.t && row.price) {
          return (
            <text key={key} className="hybrid-draw-label is-note" x={scale.x(row.t)} y={scale.y(row.price)} fill={color}>
              {row.text || "Note"}
            </text>
          );
        }
        if (row.kind === "pricelabel" && Number(row.price) > 0) {
          return (
            <g key={key}>
              <line
                className={dashed ? "hybrid-draw is-preview" : "hybrid-draw"}
                x1={pad.l}
                x2={width - pad.r}
                y1={scale.y(row.price)}
                y2={scale.y(row.price)}
                stroke={color}
              />
              <text className="hybrid-draw-label" x={width - pad.r - 4} y={scale.y(row.price) - 4} textAnchor="end" fill={color}>
                {formatAxisPrice(row.price)}
              </text>
            </g>
          );
        }
        return null;
      })}
    </g>
  );
}

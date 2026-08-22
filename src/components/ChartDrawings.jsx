import { channelOffset, drawingHandles, extendSegment, fibBands, fibExtent, rangeColor, raySegment, rangeStats } from "../chart/drawings";
import { formatAxisPrice, formatPriceLabel } from "../chart/axis";

function stroke(row) {
  return row?.color || "#d1d4dc";
}

function paint(color) {
  return { stroke: color, color };
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
      style={paint(color)}
      markerEnd={marker}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function FibRetracement({ row, scale, pad, plotBottom, clipId, dashed }) {
  const span = fibExtent(row.a, row.b);
  if (!span) return null;
  const x0 = scale.x(span.t0);
  const x1 = scale.x(span.t1);
  const width = Math.max(1, x1 - x0);
  const bands = fibBands(row.a, row.b);
  const topBound = (pad?.t ?? 16) + 8;
  const bottomBound = (plotBottom ?? 364) - 4;
  const clip = clipId ? `url(#${clipId})` : undefined;
  const zero = bands.find((band) => band.level === 0);
  const one = bands.find((band) => band.level === 1);
  return (
    <g className={dashed ? "hybrid-fib is-preview" : "hybrid-fib"}>
      <g clipPath={clip}>
        {zero && one ? (
          <rect
            className="hybrid-fib-frame"
            x={x0}
            y={Math.min(scale.y(zero.price), scale.y(one.price))}
            width={width}
            height={Math.max(1, Math.abs(scale.y(one.price) - scale.y(zero.price)))}
          />
        ) : null}
        {bands.map((band) => {
          const y = scale.y(band.price);
          const nextY = band.nextPrice != null ? scale.y(band.nextPrice) : y;
          const top = Math.min(y, nextY);
          const height = Math.abs(nextY - y);
          return (
            <g key={`band-${band.level}`}>
              {band.nextPrice != null && height > 0.25 ? (
                <rect
                  className="hybrid-fib-fill"
                  x={x0}
                  y={top}
                  width={width}
                  height={height}
                  style={{ fill: band.color, fillOpacity: 0.28 }}
                />
              ) : null}
              <line
                className="hybrid-fib-line"
                x1={x0}
                x2={x1}
                y1={y}
                y2={y}
                style={paint(band.color)}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
        <Line a={row.a} b={row.b} scale={scale} color="#787B86" dashed={false} />
      </g>
      {bands.map((band) => {
        const y = scale.y(band.price);
        if (y < topBound - 20 || y > bottomBound + 20) return null;
        const yLabel = Math.min(bottomBound, Math.max(topBound, y));
        return (
          <text
            key={`label-${band.level}`}
            className="hybrid-draw-label hybrid-fib-label"
            x={x0 + 6}
            y={yLabel + 3}
            textAnchor="start"
            style={{ fill: band.color }}
          >
            {band.label} ({formatAxisPrice(band.price)})
          </text>
        );
      })}
    </g>
  );
}

function Handles({ row, scale, fallbackPrice, activeKey }) {
  return drawingHandles(row, fallbackPrice).map((handle) => (
    <circle
      key={`handle-${handle.key}`}
      className={activeKey === handle.key ? "hybrid-handle is-active" : "hybrid-handle"}
      cx={scale.x(handle.t)}
      cy={scale.y(handle.price)}
      r="4"
    />
  ));
}

export default function ChartDrawings({
  drawings = [],
  scale,
  pad,
  width,
  plotBottom,
  clipId,
  activeHandle,
}) {
  const tMin = scale.start;
  const tMax = scale.end;
  const items = drawings;

  return (
    <g className="hybrid-drawings">
      {items.map((row, index) => {
        const color = stroke(row);
        const dashed = row.preview;
        const key = `${row.kind}-${index}-${row.preview ? "p" : "d"}`;
        if ((row.kind === "hline" || row.kind === "hray") && Number.isFinite(Number(row.price))) {
          const x1 = row.kind === "hray" && Number(row.t) > 0 ? scale.x(row.t) : pad.l;
          return (
            <line
              key={key}
              className={dashed ? "hybrid-draw is-preview" : "hybrid-draw"}
              x1={x1}
              x2={width - pad.r}
              y1={scale.y(row.price)}
              y2={scale.y(row.price)}
              style={paint(color)}
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        if (row.kind === "vline" && Number.isFinite(Number(row.t))) {
          return (
            <line
              key={key}
              className={dashed ? "hybrid-draw is-preview" : "hybrid-draw"}
              x1={scale.x(row.t)}
              x2={scale.x(row.t)}
              y1={pad.t}
              y2={plotBottom}
              style={paint(color)}
              vectorEffect="non-scaling-stroke"
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
                <marker id={mark} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L7,3 L0,6 Z" fill={color} />
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
          const w = Math.max(1, Math.abs(scale.x(row.b.t) - scale.x(row.a.t)));
          const h = Math.max(1, Math.abs(scale.y(row.b.price) - scale.y(row.a.price)));
          const stats = rangeStats(row.a, row.b);
          const tone = row.kind === "range" ? rangeColor(row.a, row.b) : color;
          const clip = clipId ? `url(#${clipId})` : undefined;
          return (
            <g key={key} clipPath={row.kind === "range" ? clip : undefined}>
              <rect
                className={dashed ? "hybrid-shape is-preview" : "hybrid-shape"}
                x={x}
                y={y}
                width={w}
                height={h}
                style={{ ...paint(tone), fill: tone, fillOpacity: row.kind === "range" ? 0.14 : undefined }}
              />
              {row.kind === "range" ? (
                <text className="hybrid-draw-label" x={x + 6} y={y + 12} style={{ fill: tone }}>
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
          return (
            <FibRetracement
              key={key}
              row={row}
              scale={scale}
              pad={pad}
              plotBottom={plotBottom}
              clipId={clipId}
              dashed={dashed}
            />
          );
        }
        if (row.kind === "text" && row.t && Number.isFinite(Number(row.price))) {
          return (
            <text key={key} className="hybrid-draw-label is-note" x={scale.x(row.t)} y={scale.y(row.price)} style={{ fill: color }}>
              {row.text || "Note"}
            </text>
          );
        }
        if (row.kind === "pricelabel" && Number.isFinite(Number(row.price))) {
          const cx = Number(row.t) > 0 ? scale.x(row.t) : pad.l + 80;
          const cy = scale.y(row.price);
          const label = formatPriceLabel(row.price);
          const boxW = Math.max(72, 8 + label.length * 6.2);
          const boxH = 18;
          const gap = 8;
          let boxX = cx - gap - boxW;
          if (boxX < pad.l + 2) boxX = cx + gap;
          const boxY = cy - boxH / 2;
          const tickX1 = cx;
          const tickX2 = boxX < cx ? boxX + boxW : boxX;
          return (
            <g key={key} className={dashed ? "hybrid-price-tag is-preview" : "hybrid-price-tag"}>
              <line
                className={dashed ? "hybrid-draw is-preview" : "hybrid-draw"}
                x1={tickX1}
                x2={tickX2}
                y1={cy}
                y2={cy}
                style={paint(color)}
                vectorEffect="non-scaling-stroke"
              />
              <rect x={boxX} y={boxY} width={boxW} height={boxH} rx="3" style={{ stroke: color }} />
              <text x={boxX + boxW / 2} y={boxY + 13} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        }
        return null;
      })}
      {drawings.map((row, index) => (
        <g key={`handles-${index}`}>
          <Handles
            row={row}
            scale={scale}
            fallbackPrice={(scale.min + scale.max) / 2}
            activeKey={activeHandle?.index === index ? activeHandle.key : null}
          />
        </g>
      ))}
    </g>
  );
}

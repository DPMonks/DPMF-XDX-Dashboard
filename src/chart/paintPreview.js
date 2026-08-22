import { formatAxisPrice } from "./axis.js";
import {
  channelOffset,
  extendSegment,
  fibBands,
  fibExtent,
  previewDrawing,
  rangeColor,
  rangeStats,
  raySegment,
} from "./drawings.js";

const NS = "http://www.w3.org/2000/svg";

function svg(name, attrs = {}) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null && value !== false) node.setAttribute(key, String(value));
  }
  return node;
}

function clear(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function line(parent, x1, y1, x2, y2, color, extra = {}) {
  parent.appendChild(
    svg("line", {
      class: extra.className || "hybrid-draw",
      x1,
      y1,
      x2,
      y2,
      style: `stroke:${color};fill:none`,
      "vector-effect": "non-scaling-stroke",
      ...extra.attrs,
    })
  );
}

export function paintPlaceMark(group, { x, y, color, visible }) {
  if (!group) return;
  if (!visible || !Number.isFinite(x) || !Number.isFinite(y)) {
    group.setAttribute("visibility", "hidden");
    return;
  }
  group.setAttribute("visibility", "visible");
  group.setAttribute("transform", `translate(${x} ${y})`);
  group.setAttribute("style", `color:${color};stroke:${color}`);
}

export function paintToolPreview(group, {
  tool,
  color,
  pending,
  hover,
  scale,
  pad,
  width,
  plotBottom,
}) {
  if (!group) return;
  clear(group);
  if (!hover?.inPrice || tool === "cursor") return;

  if (pending?.points?.[0]) {
    const first = pending.points[0];
    group.appendChild(
      svg("circle", {
        class: "hybrid-pending",
        cx: scale.x(first.t),
        cy: scale.y(first.price),
        r: 3.5,
        style: `fill:${pending.color || color}`,
      })
    );
  }

  const ghost = previewDrawing({ tool, color, pending, hover });
  if (!ghost) return;
  const tone = ghost.color || color;
  const tMin = scale.start;
  const tMax = scale.end;

  if ((ghost.kind === "hline" || ghost.kind === "hray") && Number.isFinite(Number(ghost.price))) {
    const x1 = ghost.kind === "hray" && Number(ghost.t) > 0 ? scale.x(ghost.t) : pad.l;
    line(group, x1, scale.y(ghost.price), width - pad.r, scale.y(ghost.price), tone);
    return;
  }
  if (ghost.kind === "vline" && Number.isFinite(Number(ghost.t))) {
    line(group, scale.x(ghost.t), pad.t, scale.x(ghost.t), plotBottom, tone);
    return;
  }
  if ((ghost.kind === "trend" || ghost.kind === "arrow") && ghost.a && ghost.b) {
    line(group, scale.x(ghost.a.t), scale.y(ghost.a.price), scale.x(ghost.b.t), scale.y(ghost.b.price), tone);
    return;
  }
  if (ghost.kind === "ray" && ghost.a && ghost.b) {
    const [a, b] = raySegment(ghost.a, ghost.b, tMin, tMax);
    if (a && b) line(group, scale.x(a.t), scale.y(a.price), scale.x(b.t), scale.y(b.price), tone);
    return;
  }
  if (ghost.kind === "extended" && ghost.a && ghost.b) {
    const [a, b] = extendSegment(ghost.a, ghost.b, tMin, tMax);
    if (a && b) line(group, scale.x(a.t), scale.y(a.price), scale.x(b.t), scale.y(b.price), tone);
    return;
  }
  if ((ghost.kind === "rect" || ghost.kind === "range") && ghost.a && ghost.b) {
    const x = Math.min(scale.x(ghost.a.t), scale.x(ghost.b.t));
    const y = Math.min(scale.y(ghost.a.price), scale.y(ghost.b.price));
    const w = Math.max(1, Math.abs(scale.x(ghost.b.t) - scale.x(ghost.a.t)));
    const h = Math.max(1, Math.abs(scale.y(ghost.b.price) - scale.y(ghost.a.price)));
    const shade = ghost.kind === "range" ? rangeColor(ghost.a, ghost.b) : tone;
    group.appendChild(
      svg("rect", {
        class: "hybrid-shape",
        x,
        y,
        width: w,
        height: h,
        style: `stroke:${shade};fill:${shade};fill-opacity:${ghost.kind === "range" ? 0.14 : 0.06}`,
      })
    );
    if (ghost.kind === "range") {
      const stats = rangeStats(ghost.a, ghost.b);
      const label = svg("text", {
        class: "hybrid-draw-label",
        x: x + 6,
        y: y + 12,
        style: `fill:${shade}`,
      });
      label.textContent = `${formatAxisPrice(stats.delta)} (${stats.pct.toFixed(2)}%)`;
      group.appendChild(label);
    }
    return;
  }
  if (ghost.kind === "channel" && ghost.a && ghost.b) {
    line(group, scale.x(ghost.a.t), scale.y(ghost.a.price), scale.x(ghost.b.t), scale.y(ghost.b.price), tone);
    if (ghost.c) {
      const offset = channelOffset(ghost.a, ghost.b, ghost.c);
      line(
        group,
        scale.x(ghost.a.t),
        scale.y(ghost.a.price + offset),
        scale.x(ghost.b.t),
        scale.y(ghost.b.price + offset),
        tone
      );
    }
    return;
  }
  if (ghost.kind === "fib" && ghost.a && ghost.b) {
    const span = fibExtent(ghost.a, ghost.b);
    if (!span) return;
    const x0 = scale.x(span.t0);
    const x1 = scale.x(span.t1);
    const bands = fibBands(ghost.a, ghost.b);
    for (const band of bands) {
      const y = scale.y(band.price);
      if (band.nextPrice != null) {
        const nextY = scale.y(band.nextPrice);
        group.appendChild(
          svg("rect", {
            class: "hybrid-fib-fill",
            x: x0,
            y: Math.min(y, nextY),
            width: Math.max(1, x1 - x0),
            height: Math.max(0.25, Math.abs(nextY - y)),
            style: `fill:${band.color};fill-opacity:0.28`,
          })
        );
      }
      line(group, x0, y, x1, y, band.color, { className: "hybrid-fib-line" });
    }
    line(group, scale.x(ghost.a.t), scale.y(ghost.a.price), scale.x(ghost.b.t), scale.y(ghost.b.price), "#787B86");
    return;
  }
  if (ghost.kind === "pricelabel" && Number.isFinite(Number(ghost.price))) {
    const cx = scale.x(ghost.t);
    const cy = scale.y(ghost.price);
    group.appendChild(
      svg("circle", {
        class: "hybrid-pending",
        cx,
        cy,
        r: 3.2,
        style: `fill:${tone}`,
      })
    );
  }
}

export function hideToolPreview(group, mark) {
  clear(group);
  paintPlaceMark(mark, { visible: false });
}

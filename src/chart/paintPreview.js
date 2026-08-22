import { formatAxisPrice } from "./axis.js";
import {
  channelOffset,
  dashForStyle,
  extendSegment,
  fibBands,
  fibExtent,
  fibExtensionBands,
  fibLabelPlacement,
  pitchforkRays,
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
  const width = extra.strokeWidth || 1;
  const dash = extra.dasharray || dashForStyle(extra.lineStyle);
  parent.appendChild(
    svg("line", {
      class: extra.className || "hybrid-draw",
      x1,
      y1,
      x2,
      y2,
      style: `stroke:${color};fill:none;stroke-width:${width}${dash ? `;stroke-dasharray:${dash}` : ""}`,
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
  strokeWidth,
  lineStyle,
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

  const ghost = previewDrawing({ tool, color, pending, hover, strokeWidth, lineStyle });
  if (!ghost) return;
  const tone = ghost.color || color;
  const tMin = scale.start;
  const tMax = scale.end;
  const ink = { strokeWidth: ghost.strokeWidth, lineStyle: ghost.lineStyle, dasharray: ghost.dasharray };

  if ((ghost.kind === "hline" || ghost.kind === "hray" || ghost.kind === "crossline") && Number.isFinite(Number(ghost.price))) {
    const x1 = ghost.kind === "hray" && Number(ghost.t) > 0 ? scale.x(ghost.t) : pad.l;
    line(group, x1, scale.y(ghost.price), width - pad.r, scale.y(ghost.price), tone, ink);
    if (ghost.kind === "crossline" && Number.isFinite(Number(ghost.t))) {
      line(group, scale.x(ghost.t), pad.t, scale.x(ghost.t), plotBottom, tone, ink);
    }
    return;
  }
  if (ghost.kind === "vline" && Number.isFinite(Number(ghost.t))) {
    line(group, scale.x(ghost.t), pad.t, scale.x(ghost.t), plotBottom, tone, ink);
    return;
  }
  if ((ghost.kind === "trend" || ghost.kind === "arrow" || ghost.kind === "infoline") && ghost.a && ghost.b) {
    line(group, scale.x(ghost.a.t), scale.y(ghost.a.price), scale.x(ghost.b.t), scale.y(ghost.b.price), tone, ink);
    if (ghost.kind === "infoline") {
      const stats = rangeStats(ghost.a, ghost.b);
      const label = svg("text", {
        class: "hybrid-draw-label",
        x: (scale.x(ghost.a.t) + scale.x(ghost.b.t)) / 2 + 6,
        y: (scale.y(ghost.a.price) + scale.y(ghost.b.price)) / 2 - 6,
        style: `fill:${tone}`,
      });
      label.textContent = `${formatAxisPrice(stats.delta)} (${stats.pct.toFixed(2)}%)`;
      group.appendChild(label);
    }
    return;
  }
  if (ghost.kind === "ray" && ghost.a && ghost.b) {
    const [a, b] = raySegment(ghost.a, ghost.b, tMin, tMax);
    if (a && b) line(group, scale.x(a.t), scale.y(a.price), scale.x(b.t), scale.y(b.price), tone, ink);
    return;
  }
  if (ghost.kind === "extended" && ghost.a && ghost.b) {
    const [a, b] = extendSegment(ghost.a, ghost.b, tMin, tMax);
    if (a && b) line(group, scale.x(a.t), scale.y(a.price), scale.x(b.t), scale.y(b.price), tone, ink);
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
        style: `stroke:${shade};fill:${shade};fill-opacity:${ghost.kind === "range" ? 0.14 : 0.06};stroke-width:${ink.strokeWidth || 1}${ink.dasharray ? `;stroke-dasharray:${ink.dasharray}` : ""}`,
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
    line(group, scale.x(ghost.a.t), scale.y(ghost.a.price), scale.x(ghost.b.t), scale.y(ghost.b.price), tone, ink);
    if (ghost.c) {
      const offset = channelOffset(ghost.a, ghost.b, ghost.c);
      line(
        group,
        scale.x(ghost.a.t),
        scale.y(ghost.a.price + offset),
        scale.x(ghost.b.t),
        scale.y(ghost.b.price + offset),
        tone,
        ink
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
      line(group, x0, y, x1, y, band.color, { className: "hybrid-fib-line", ...ink });
    }
    line(group, scale.x(ghost.a.t), scale.y(ghost.a.price), scale.x(ghost.b.t), scale.y(ghost.b.price), "#787B86", ink);
    return;
  }
  if (ghost.kind === "fibext" && ghost.a && ghost.b && ghost.c) {
    const bands = fibExtensionBands(ghost.a, ghost.b, ghost.c);
    const x0 = scale.x(ghost.c.t);
    const x1 = width - pad.r;
    const label = fibLabelPlacement(x0, { side: "left", minX: (pad?.l ?? 16) + 4 });
    for (const band of bands) {
      line(group, x0, scale.y(band.price), x1, scale.y(band.price), band.color, { className: "hybrid-fib-line", ...ink });
      const node = svg("text", {
        class: "hybrid-draw-label hybrid-fib-label",
        x: label.x,
        y: scale.y(band.price) + 3,
        "text-anchor": label.textAnchor,
        style: `fill:${band.color}`,
      });
      node.textContent = `${band.label} (${formatAxisPrice(band.price)})`;
      group.appendChild(node);
    }
    line(group, scale.x(ghost.a.t), scale.y(ghost.a.price), scale.x(ghost.b.t), scale.y(ghost.b.price), "#787B86", ink);
    return;
  }
  if (ghost.kind === "pitchfork" && ghost.a && ghost.b && ghost.c) {
    for (const seg of pitchforkRays(ghost.a, ghost.b, ghost.c, tMin, tMax)) {
      line(group, scale.x(seg[0].t), scale.y(seg[0].price), scale.x(seg[1].t), scale.y(seg[1].price), tone, ink);
    }
    return;
  }
  if ((ghost.kind === "ellipse" || ghost.kind === "circle") && ghost.a && ghost.b) {
    const x1 = scale.x(ghost.a.t);
    const y1 = scale.y(ghost.a.price);
    const x2 = scale.x(ghost.b.t);
    const y2 = scale.y(ghost.b.price);
    const cx = ghost.kind === "circle" ? x1 : (x1 + x2) / 2;
    const cy = ghost.kind === "circle" ? y1 : (y1 + y2) / 2;
    const rx = ghost.kind === "circle" ? Math.hypot(x2 - x1, y2 - y1) : Math.max(1, Math.abs(x2 - x1) / 2);
    const ry = ghost.kind === "circle" ? rx : Math.max(1, Math.abs(y2 - y1) / 2);
    group.appendChild(
      svg("ellipse", {
        class: "hybrid-shape",
        cx,
        cy,
        rx,
        ry,
        style: `stroke:${tone};fill:${tone};fill-opacity:0.06;stroke-width:${ink.strokeWidth || 1}${ink.dasharray ? `;stroke-dasharray:${ink.dasharray}` : ""}`,
      })
    );
    return;
  }
  if (ghost.kind === "triangle" && ghost.a && ghost.b && ghost.c) {
    const points = [ghost.a, ghost.b, ghost.c].map((point) => `${scale.x(point.t)},${scale.y(point.price)}`).join(" ");
    group.appendChild(
      svg("polygon", {
        class: "hybrid-shape",
        points,
        style: `stroke:${tone};fill:${tone};fill-opacity:0.06;stroke-width:${ink.strokeWidth || 1}${ink.dasharray ? `;stroke-dasharray:${ink.dasharray}` : ""}`,
      })
    );
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

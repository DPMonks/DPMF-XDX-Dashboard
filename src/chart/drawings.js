export const PLACE_OFFSET = { x: 16, y: -14 };

export function applyPlaceOffset(point, { tool = "cursor", pad, width, plotBottom } = {}) {
  if (!point || tool === "cursor") return point;
  const left = Number(pad?.l) || 0;
  const right = Number.isFinite(Number(width)) ? Number(width) - (Number(pad?.r) || 0) : Infinity;
  const top = Number(pad?.t) || 0;
  const bottom = Number(plotBottom);
  const x = (Number(point.x) || 0) + PLACE_OFFSET.x;
  const y = (Number(point.y) || 0) + PLACE_OFFSET.y;
  return {
    ...point,
    x: Math.min(right - 2, Math.max(left, x)),
    y: Number.isFinite(bottom) ? Math.min(bottom - 2, Math.max(top + 2, y)) : Math.max(top + 2, y),
  };
}

export const DRAW_COLORS = [
  { id: "green", hex: "#98f050" },
  { id: "red", hex: "#ff5d73" },
  { id: "blue", hex: "#3d8bff" },
  { id: "yellow", hex: "#ffe14a" },
  { id: "orange", hex: "#ff9a3c" },
  { id: "purple", hex: "#c770ff" },
];

export const LINE_WIDTHS = [1, 2, 3, 4];
export const LINE_STYLES = [
  { id: "solid", dash: "" },
  { id: "dash", dash: "7 4" },
  { id: "dot", dash: "1.6 3.4" },
];

export function dashForStyle(lineStyle) {
  return LINE_STYLES.find((row) => row.id === lineStyle)?.dash || "";
}

export function drawingStyle({ strokeWidth, lineStyle } = {}) {
  const width = LINE_WIDTHS.includes(Number(strokeWidth)) ? Number(strokeWidth) : 1;
  const style = LINE_STYLES.some((row) => row.id === lineStyle) ? lineStyle : "solid";
  return { strokeWidth: width, lineStyle: style, dasharray: dashForStyle(style) };
}

export const TOOL_GROUPS = [
  {
    id: "pointer",
    labelKey: "chartPointer",
    tools: [{ id: "cursor", labelKey: "chartCrosshair", clicks: 0, icon: "cross", colors: false }],
  },
  {
    id: "lines",
    labelKey: "chartLines",
    tools: [
      { id: "trend", labelKey: "chartTrend", clicks: 2, icon: "trend" },
      { id: "hline", labelKey: "chartHLine", clicks: 1, icon: "hline" },
      { id: "vline", labelKey: "chartVLine", clicks: 1, icon: "vline" },
      { id: "hray", labelKey: "chartHRay", clicks: 1, icon: "hray" },
      { id: "crossline", labelKey: "chartCrossLine", clicks: 1, icon: "crossline" },
      { id: "ray", labelKey: "chartRay", clicks: 2, icon: "ray" },
      { id: "extended", labelKey: "chartExtended", clicks: 2, icon: "extended" },
      { id: "infoline", labelKey: "chartInfoLine", clicks: 2, icon: "infoline" },
      { id: "arrow", labelKey: "chartArrow", clicks: 2, icon: "arrow" },
    ],
  },
  {
    id: "fib",
    labelKey: "chartFibGroup",
    tools: [
      { id: "fib", labelKey: "chartFib", clicks: 2, icon: "fib" },
      { id: "fibext", labelKey: "chartFibExt", clicks: 3, icon: "fibext" },
      { id: "range", labelKey: "chartRange", clicks: 2, icon: "range" },
      { id: "pitchfork", labelKey: "chartPitchfork", clicks: 3, icon: "pitchfork" },
    ],
  },
  {
    id: "shapes",
    labelKey: "chartPatterns",
    tools: [
      { id: "rect", labelKey: "chartRect", clicks: 2, icon: "rect" },
      { id: "ellipse", labelKey: "chartEllipse", clicks: 2, icon: "ellipse" },
      { id: "circle", labelKey: "chartCircle", clicks: 2, icon: "circle" },
      { id: "triangle", labelKey: "chartTriangle", clicks: 3, icon: "triangle" },
      { id: "channel", labelKey: "chartChannel", clicks: 3, icon: "channel" },
    ],
  },
  {
    id: "waves",
    labelKey: "chartElliottGroup",
    tools: [
      { id: "elliottimpulse", labelKey: "chartElliottImpulse", clicks: 5, icon: "elliottimpulse", labels: ["1", "2", "3", "4", "5"] },
      { id: "elliottcorrection", labelKey: "chartElliottCorrection", clicks: 3, icon: "elliottcorrection", labels: ["A", "B", "C"] },
      { id: "elliotttriangle", labelKey: "chartElliottTriangle", clicks: 5, icon: "elliotttriangle", labels: ["A", "B", "C", "D", "E"] },
      { id: "elliottdouble", labelKey: "chartElliottDouble", clicks: 3, icon: "elliottdouble", labels: ["W", "X", "Y"] },
      { id: "elliotttriple", labelKey: "chartElliottTriple", clicks: 5, icon: "elliotttriple", labels: ["W", "X", "Y", "XX", "Z"] },
    ],
  },
  {
    id: "notes",
    labelKey: "chartNotes",
    tools: [
      { id: "text", labelKey: "chartText", clicks: 1, icon: "text" },
      { id: "pricelabel", labelKey: "chartPriceLabel", clicks: 1, icon: "price" },
    ],
  },
];

export function groupForTool(id) {
  return TOOL_GROUPS.find((group) => group.tools.some((row) => row.id === id)) || TOOL_GROUPS[0];
}

export function elliottTools() {
  return TOOL_GROUPS.find((group) => group.id === "waves")?.tools || [];
}

export function flyoutSections(groupId) {
  const group = TOOL_GROUPS.find((row) => row.id === groupId);
  if (!group || group.id === "pointer") return [];
  if (group.id === "shapes") {
    const waves = TOOL_GROUPS.find((row) => row.id === "waves");
    return waves ? [group, waves] : [group];
  }
  return [group];
}

export function canMoveHandle(tool) {
  return tool === "cursor";
}

export const INSPECT_PAN_PX = 5;

export function clickIsPan(startClientX, currentClientX, threshold = INSPECT_PAN_PX) {
  return Math.abs(Number(currentClientX) - Number(startClientX)) >= threshold;
}

export function shouldFollowCrosshair({ tool, dragging, overHandle } = {}) {
  return Boolean(dragging || (tool === "cursor" && overHandle));
}

export function toggleInspect(current, next) {
  if (!next) return null;
  const currentT = Number(current?.candle?.t ?? current?.t);
  const nextT = Number(next.candle?.t ?? next.t);
  if (Number.isFinite(currentT) && currentT === nextT) return null;
  return next;
}

export function toolAfterDrawing(stay, tool) {
  if (stay === true && tool && tool !== "cursor") return tool;
  return "cursor";
}

export function toggleTool(current, next) {
  if (!next || next === "cursor") return "cursor";
  return next === current ? "cursor" : next;
}

// City Index / TradingView default Fib retracement colours.
export const FIB_LEVELS = [
  { level: 0, color: "#808080" },
  { level: 0.236, color: "#F23645" },
  { level: 0.382, color: "#FF9800" },
  { level: 0.5, color: "#4CAF50" },
  { level: 0.618, color: "#089981" },
  { level: 0.786, color: "#00BCD4" },
  { level: 1, color: "#808080" },
  { level: 1.618, color: "#2962FF" },
  { level: 2.618, color: "#F23645" },
  { level: 3.618, color: "#9C27B0" },
  { level: 4.236, color: "#E91E63" },
];

export function fibPrice(a, b, level) {
  if (!a || !b) return null;
  return Number(b.price) + (Number(a.price) - Number(b.price)) * Number(level);
}

export function formatFibLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return "";
  if (Math.abs(n - 1.618) < 1e-9) return "1.618";
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

export function fibBands(a, b) {
  return FIB_LEVELS.map((row, index) => {
    const next = FIB_LEVELS[index + 1];
    return {
      level: row.level,
      color: row.color,
      label: formatFibLevel(row.level),
      price: fibPrice(a, b, row.level),
      nextPrice: next ? fibPrice(a, b, next.level) : null,
    };
  }).filter((row) => Number.isFinite(row.price));
}

export function fibExtent(a, b) {
  if (!a || !b) return null;
  const t0 = Number(a.t);
  const t1 = Number(b.t);
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  return { t0: Math.min(t0, t1), t1: Math.max(t0, t1) };
}

export function fibLabelPlacement(x0, { side = "left", gap = 10, minX = 8, maxX } = {}) {
  const origin = Number(x0);
  if (!Number.isFinite(origin)) return { x: minX, textAnchor: "end" };
  if (side === "right") {
    const raw = origin + gap;
    return { x: Number.isFinite(maxX) ? Math.min(maxX, raw) : raw, textAnchor: "start" };
  }
  return { x: Math.max(minX, origin - gap), textAnchor: "end" };
}

export function fibToolLabelPlacement(xLeft, xRight, { padLeft = 88, padRight = Infinity, gap = 12, textWidth = 78 } = {}) {
  const left = Math.min(Number(xLeft) || 0, Number(xRight) || 0);
  const right = Math.max(Number(xLeft) || 0, Number(xRight) || 0);
  const outsideLeft = left - gap;
  if (outsideLeft - textWidth >= Number(padLeft) || outsideLeft > Number(padLeft) + 8) {
    return { x: Math.max(Number(padLeft), outsideLeft), textAnchor: "end" };
  }
  const outsideRight = right + gap;
  return {
    x: Number.isFinite(Number(padRight)) ? Math.min(Number(padRight), outsideRight) : outsideRight,
    textAnchor: "start",
  };
}

export const FIB_EXT_LEVELS = [
  { level: 0, color: "#808080" },
  { level: 0.382, color: "#FF9800" },
  { level: 0.618, color: "#089981" },
  { level: 1, color: "#808080" },
  { level: 1.272, color: "#FF9800" },
  { level: 1.618, color: "#2962FF" },
  { level: 2.618, color: "#F23645" },
];

export function fibExtensionBands(a, b, c) {
  if (!a || !b || !c) return [];
  const impulse = Number(b.price) - Number(a.price);
  if (!Number.isFinite(impulse)) return [];
  const rows = FIB_EXT_LEVELS.map((row) => ({
    ...row,
    label: formatFibLevel(row.level),
    price: Number(c.price) + impulse * row.level,
  })).filter((row) => Number.isFinite(row.price));
  return rows.map((row, index) => ({
    ...row,
    nextPrice: rows[index + 1]?.price ?? null,
  }));
}

export function pitchforkRays(a, b, c, tMin, tMax) {
  if (!a || !b || !c) return [];
  const mid = { t: (Number(b.t) + Number(c.t)) / 2, price: (Number(b.price) + Number(c.price)) / 2 };
  const dt = mid.t - Number(a.t);
  const dp = mid.price - Number(a.price);
  const through = (point) =>
    extendSegment(point, { t: Number(point.t) + dt, price: Number(point.price) + dp }, tMin, tMax);
  return [extendSegment(a, mid, tMin, tMax), through(b), through(c)].filter((row) => row.length === 2);
}

export function allTools() {
  return TOOL_GROUPS.flatMap((group) => group.tools);
}

export function toolMeta(id) {
  return allTools().find((row) => row.id === id) || TOOL_GROUPS[0].tools[0];
}

export function snapPoint(point, candles = []) {
  if (!point || !candles.length) return point;
  let nearest = candles[0];
  let best = Infinity;
  for (const row of candles) {
    const dist = Math.abs(row.t - point.t);
    if (dist < best) {
      best = dist;
      nearest = row;
    }
  }
  const levels = [nearest.o, nearest.h, nearest.l, nearest.c].map(Number).filter((n) => n > 0);
  let price = Number(point.price);
  let closest = Infinity;
  for (const level of levels) {
    const dist = Math.abs(level - Number(point.price));
    if (dist < closest) {
      closest = dist;
      price = level;
    }
  }
  return { t: nearest.t, price };
}

export function priceAtTime(a, b, t) {
  const span = b.t - a.t;
  if (!span) return a.price;
  return a.price + ((b.price - a.price) * (t - a.t)) / span;
}

export function extendSegment(a, b, tMin, tMax) {
  if (!a || !b) return [];
  if (a.t === b.t) return [{ t: a.t, price: a.price }, { t: a.t, price: b.price }];
  return [
    { t: tMin, price: priceAtTime(a, b, tMin) },
    { t: tMax, price: priceAtTime(a, b, tMax) },
  ];
}

export function raySegment(a, b, tMin, tMax) {
  if (!a || !b) return [];
  const endT = b.t >= a.t ? tMax : tMin;
  return [a, { t: endT, price: priceAtTime(a, b, endT) }];
}

export function channelOffset(a, b, c) {
  if (!a || !b || !c) return 0;
  return c.price - priceAtTime(a, b, c.t);
}

export const RANGE_UP = "#26a69a";
export const RANGE_DOWN = "#ef5350";

export function rangeStats(a, b) {
  if (!a || !b) return { delta: 0, pct: 0, bars: 0 };
  const delta = b.price - a.price;
  const pct = a.price ? (delta / a.price) * 100 : 0;
  return { delta, pct, bars: Math.abs(b.t - a.t) };
}

export function rangeColor(a, b) {
  const delta = rangeStats(a, b).delta;
  if (delta > 0) return RANGE_UP;
  if (delta < 0) return RANGE_DOWN;
  return "#787B86";
}

function seedPoint(point) {
  if (!point) return point;
  const next = { t: Number(point.t), price: Number(point.price) };
  if (Number.isFinite(Number(point.x))) next.x = Number(point.x);
  if (Number.isFinite(Number(point.y))) next.y = Number(point.y);
  if (point.viewKey) next.viewKey = String(point.viewKey);
  return next;
}

export function shapeFromPoints(kind, points = [], color) {
  const [a, b, c] = points.map(seedPoint);
  if (kind === "hline" || kind === "hray" || kind === "crossline") {
    return { kind, color, t: (b || a)?.t, price: (b || a)?.price };
  }
  if (kind === "vline") return { kind, color, t: (b || a)?.t, price: (b || a)?.price };
  if (kind === "text") return { kind, color, t: a?.t, price: a?.price, text: "Note" };
  if (kind === "pricelabel") return { kind, color, t: a?.t, price: a?.price };
  if (String(kind).startsWith("elliott")) {
    const labels = toolMeta(kind).labels || [];
    return { kind, color, points: points.map(seedPoint), labels };
  }
  if (kind === "channel" || kind === "triangle" || kind === "pitchfork" || kind === "fibext") {
    return { kind, color, a, b, c };
  }
  return { kind, color, a, b };
}

export function isUsablePoint(point) {
  return Boolean(point) && Number.isFinite(Number(point.t)) && Number.isFinite(Number(point.price));
}

export function nextDrawingState({ tool, color, pending, point, strokeWidth, lineStyle } = {}) {
  const meta = toolMeta(tool);
  const style = drawingStyle({
    strokeWidth: strokeWidth ?? pending?.strokeWidth,
    lineStyle: lineStyle ?? pending?.lineStyle,
  });
  if (!meta || meta.clicks < 1 || !isUsablePoint(point)) {
    return { pending: pending || null, drawing: null };
  }
  const points = [...(pending?.points || []), seedPoint(point)];
  if (points.length < meta.clicks) {
    return { pending: { tool, color, points, ...style }, drawing: null };
  }
  return { pending: null, drawing: { ...shapeFromPoints(tool, points, color), ...style } };
}

export const HANDLE_HIT_R = 12;

export function drawingHandles(row, fallbackPrice) {
  if (!row || row.preview) return [];
  const mid = Number(fallbackPrice);
  if (
    row.kind === "hline" ||
    row.kind === "hray" ||
    row.kind === "crossline" ||
    row.kind === "pricelabel" ||
    row.kind === "text"
  ) {
    if (!Number.isFinite(Number(row.price))) return [];
    return [{ key: "point", t: Number(row.t) || 0, price: Number(row.price) }];
  }
  if (row.kind === "vline") {
    if (!Number.isFinite(Number(row.t))) return [];
    return [{
      key: "point",
      t: Number(row.t),
      price: Number.isFinite(Number(row.price)) ? Number(row.price) : mid,
    }];
  }
  if (Array.isArray(row.points) && row.points.length) {
    return row.points
      .map((point, index) => ({ key: `p${index}`, ...seedPoint(point) }))
      .filter((point) => Number.isFinite(Number(point.t)) && Number.isFinite(Number(point.price)));
  }
  return ["a", "b", "c"]
    .filter((key) => row[key] && Number.isFinite(Number(row[key].t)) && Number.isFinite(Number(row[key].price)))
    .map((key) => ({ key, ...seedPoint(row[key]) }));
}

export function moveDrawingHandle(row, key, point) {
  if (!row || !isUsablePoint(point)) return row;
  const next = seedPoint(point);
  if (key === "point") {
    return { ...row, t: next.t, price: next.price, x: next.x, y: next.y, viewKey: next.viewKey };
  }
  if (key === "a" || key === "b" || key === "c") {
    return { ...row, [key]: next };
  }
  if (String(key).startsWith("p") && Array.isArray(row.points)) {
    const index = Number(String(key).slice(1));
    if (!Number.isInteger(index) || !row.points[index]) return row;
    const points = row.points.map((point, current) => (current === index ? next : point));
    return { ...row, points };
  }
  return row;
}

export function hitDrawingHandle(drawings = [], scale, x, y, radius = HANDLE_HIT_R) {
  const r2 = radius * radius;
  const fallback = Number.isFinite(scale?.min) && Number.isFinite(scale?.max) ? (scale.min + scale.max) / 2 : 0;
  for (let index = drawings.length - 1; index >= 0; index -= 1) {
    const handles = drawingHandles(drawings[index], fallback);
    for (const handle of handles) {
      const dx = plotX(handle, scale) - x;
      const dy = plotY(handle, scale) - y;
      if (dx * dx + dy * dy <= r2) return { index, key: handle.key };
    }
  }
  return null;
}

export function plotX(point, scale) {
  if (Number.isFinite(Number(point?.x)) && (!point.viewKey || !scale?.viewKey || String(point.viewKey) === String(scale.viewKey))) {
    return Number(point.x);
  }
  return scale?.x?.(point?.t);
}

export function plotY(point, scale) {
  if (Number.isFinite(Number(point?.y)) && (!point.viewKey || !scale?.viewKey || String(point.viewKey) === String(scale.viewKey))) {
    return Number(point.y);
  }
  return scale?.y?.(point?.price);
}

export function previewDrawing({ tool, color, pending, hover, strokeWidth, lineStyle } = {}) {
  const meta = toolMeta(tool);
  if (!meta || meta.clicks < 1 || !isUsablePoint(hover)) return null;
  if (!pending && meta.clicks > 1) return null;
  const live = { t: Number(hover.t), price: Number(hover.price) };
  if (Number.isFinite(Number(hover.x))) live.x = Number(hover.x);
  if (Number.isFinite(Number(hover.y))) live.y = Number(hover.y);
  const points = [...(pending?.points || []), live];
  return {
    ...shapeFromPoints(tool, points, color),
    ...drawingStyle({
      strokeWidth: strokeWidth ?? pending?.strokeWidth,
      lineStyle: lineStyle ?? pending?.lineStyle,
    }),
    preview: true,
  };
}

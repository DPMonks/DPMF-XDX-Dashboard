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
      { id: "hline", labelKey: "chartHLine", clicks: 1, icon: "hline" },
      { id: "vline", labelKey: "chartVLine", clicks: 1, icon: "vline" },
      { id: "hray", labelKey: "chartHRay", clicks: 1, icon: "hray" },
      { id: "trend", labelKey: "chartTrend", clicks: 2, icon: "trend" },
      { id: "ray", labelKey: "chartRay", clicks: 2, icon: "ray" },
      { id: "extended", labelKey: "chartExtended", clicks: 2, icon: "extended" },
      { id: "arrow", labelKey: "chartArrow", clicks: 2, icon: "arrow" },
    ],
  },
  {
    id: "fib",
    labelKey: "chartFibGroup",
    tools: [
      { id: "fib", labelKey: "chartFib", clicks: 2, icon: "fib" },
      { id: "range", labelKey: "chartRange", clicks: 2, icon: "range" },
    ],
  },
  {
    id: "shapes",
    labelKey: "chartShapes",
    tools: [
      { id: "rect", labelKey: "chartRect", clicks: 2, icon: "rect" },
      { id: "channel", labelKey: "chartChannel", clicks: 3, icon: "channel" },
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

// TradingView default Fib retracement colors (dark theme).
export const FIB_LEVELS = [
  { level: 0, color: "#787B86" },
  { level: 0.236, color: "#F23645" },
  { level: 0.382, color: "#FF9800" },
  { level: 0.5, color: "#3179F5" },
  { level: 0.618, color: "#089981" },
  { level: 0.786, color: "#2962FF" },
  { level: 1, color: "#787B86" },
  { level: 1.618, color: "#F23645" },
  { level: 2.618, color: "#9C27B0" },
  { level: 3.618, color: "#FF9800" },
  { level: 4.236, color: "#E040FB" },
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

export function shapeFromPoints(kind, points = [], color) {
  const [a, b, c] = points;
  if (kind === "hline" || kind === "hray") return { kind, color, t: (b || a)?.t, price: (b || a)?.price };
  if (kind === "vline") return { kind, color, t: (b || a)?.t, price: (b || a)?.price };
  if (kind === "text") return { kind, color, t: a?.t, price: a?.price, text: "Note" };
  if (kind === "pricelabel") return { kind, color, t: a?.t, price: a?.price };
  if (kind === "channel") return { kind, color, a, b, c };
  return { kind, color, a, b };
}

export function isUsablePoint(point) {
  return Boolean(point) && Number.isFinite(Number(point.t)) && Number.isFinite(Number(point.price));
}

export function nextDrawingState({ tool, color, pending, point }) {
  const meta = toolMeta(tool);
  if (!meta || meta.clicks < 1 || !isUsablePoint(point)) {
    return { pending: pending || null, drawing: null };
  }
  const points = [...(pending?.points || []), { t: Number(point.t), price: Number(point.price) }];
  if (points.length < meta.clicks) {
    return { pending: { tool, color, points }, drawing: null };
  }
  return { pending: null, drawing: shapeFromPoints(tool, points, color) };
}

export const HANDLE_HIT_R = 12;

export function drawingHandles(row, fallbackPrice) {
  if (!row || row.preview) return [];
  const mid = Number(fallbackPrice);
  if (row.kind === "hline" || row.kind === "hray" || row.kind === "pricelabel" || row.kind === "text") {
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
  return ["a", "b", "c"]
    .filter((key) => row[key] && Number.isFinite(Number(row[key].t)) && Number.isFinite(Number(row[key].price)))
    .map((key) => ({ key, t: Number(row[key].t), price: Number(row[key].price) }));
}

export function moveDrawingHandle(row, key, point) {
  if (!row || !isUsablePoint(point)) return row;
  const next = { t: Number(point.t), price: Number(point.price) };
  if (key === "point") {
    return { ...row, t: next.t, price: next.price };
  }
  if (key === "a" || key === "b" || key === "c") {
    return { ...row, [key]: next };
  }
  return row;
}

export function hitDrawingHandle(drawings = [], scale, x, y, radius = HANDLE_HIT_R) {
  const r2 = radius * radius;
  const fallback = Number.isFinite(scale?.min) && Number.isFinite(scale?.max) ? (scale.min + scale.max) / 2 : 0;
  for (let index = drawings.length - 1; index >= 0; index -= 1) {
    const handles = drawingHandles(drawings[index], fallback);
    for (const handle of handles) {
      const dx = scale.x(handle.t) - x;
      const dy = scale.y(handle.price) - y;
      if (dx * dx + dy * dy <= r2) return { index, key: handle.key };
    }
  }
  return null;
}

export function previewDrawing({ tool, color, pending, hover }) {
  const meta = toolMeta(tool);
  if (!meta || meta.clicks < 1 || !isUsablePoint(hover)) return null;
  if (!pending && meta.clicks > 1) return null;
  const points = [...(pending?.points || []), { t: Number(hover.t), price: Number(hover.price) }];
  return { ...shapeFromPoints(tool, points, color), preview: true };
}

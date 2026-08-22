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
      { id: "hline", labelKey: "chartHLine", clicks: 2, icon: "hline" },
      { id: "vline", labelKey: "chartVLine", clicks: 2, icon: "vline" },
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

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

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

export function rangeStats(a, b) {
  if (!a || !b) return { delta: 0, pct: 0, bars: 0 };
  const delta = b.price - a.price;
  const pct = a.price ? (delta / a.price) * 100 : 0;
  return { delta, pct, bars: Math.abs(b.t - a.t) };
}

export function shapeFromPoints(kind, points = [], color) {
  const [a, b, c] = points;
  if (kind === "hline") return { kind, color, price: (b || a)?.price };
  if (kind === "vline") return { kind, color, t: (b || a)?.t };
  if (kind === "text") return { kind, color, t: a?.t, price: a?.price, text: "Note" };
  if (kind === "pricelabel") return { kind, color, t: a?.t, price: a?.price };
  if (kind === "channel") return { kind, color, a, b, c };
  return { kind, color, a, b };
}

export function nextDrawingState({ tool, color, pending, point }) {
  const meta = toolMeta(tool);
  if (!meta || meta.clicks < 1 || !point) {
    return { pending: null, drawing: null };
  }
  const points = [...(pending?.points || []), { t: point.t, price: point.price }];
  if (points.length < meta.clicks) {
    return { pending: { tool, color, points }, drawing: null };
  }
  return { pending: null, drawing: shapeFromPoints(tool, points, color) };
}

export function previewDrawing({ tool, color, pending, hover }) {
  const meta = toolMeta(tool);
  if (!meta || meta.clicks < 1 || !hover) return null;
  if (!pending && meta.clicks > 1 && tool !== "hline" && tool !== "vline") return null;
  const points = [...(pending?.points || []), { t: hover.t, price: hover.price }];
  return { ...shapeFromPoints(tool, points, color), preview: true };
}

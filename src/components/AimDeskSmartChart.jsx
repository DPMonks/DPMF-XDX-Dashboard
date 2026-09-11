import { useEffect, useMemo, useState } from "react";
import { getLiquidPairAmm, getLiquidPairBook, getPrices } from "../api/indexer";
import { composePairCandles, lockedSnapshot } from "../chart/composeChart";
import { bookBands } from "../chart/overlays";
import { visibleBarsForInterval } from "../chart/intervals";
import { quotePerXdx } from "../chart/pairQuote";
import { aimAgentShortName } from "../aimAgentNames";

const PAIR = "XRP/RLUSD";
const TF_OPTIONS = [
  { id: "5m", label: "5m" },
  { id: "15m", label: "15m" },
  { id: "1h", label: "1H" },
];
const DEFAULT_TF = "15m";

export const AIM_DESK_AGENT_COLORS = {
  agent1: "#38bdf8",
  agent2: "#a78bfa",
  agent3: "#34d399",
  agent4: "#fb923c",
  agent5: "#f472b6",
  agent6: "#94a3b8",
  commander: "#fbbf24",
};

const PAD = { l: 52, r: 10, t: 12, b: 22 };
const W = 640;
const H = 220;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Chart uses quote-per-base (RLUSD per XRP). */
export function quotePerBaseFromDeskOrder(row = {}) {
  const iou = num(row.iou_per_xrp);
  if (iou > 0) return iou;
  const unit = String(row.price_unit || "").toLowerCase();
  const raw = num(row.limit_price ?? row.price ?? row.xrp_per_iou ?? row.mark);
  if (!(raw > 0)) return null;
  if (unit === "xrp_per_iou" || row.xrp_per_iou != null) return 1 / raw;
  // Heuristic: XRP/RLUSD quote-per-base is usually 0.3-4; xrp-per-iou similar band after invert.
  if (raw > 0 && raw < 0.05) return 1 / raw;
  return raw;
}

export function normalizeDeskSide(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return "buy";
  if (s.includes("sell") || s.includes("ask") || s === "to_xrp" || s.includes("sell_")) return "sell";
  if (s.includes("buy") || s.includes("bid") || s === "from_xrp") return "buy";
  return "buy";
}

function formatPx(v) {
  const n = num(v);
  if (!(n > 0)) return "-";
  if (n >= 10) return n.toFixed(3);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(5);
}

function windowCandles(rows, tf) {
  const need = Math.max(36, visibleBarsForInterval(tf));
  return (Array.isArray(rows) ? rows : []).slice(-need);
}

function priceDomain(candles, marks = []) {
  const vals = [];
  for (const c of candles) {
    for (const k of ["l", "h", "c", "o"]) {
      const n = num(c[k]);
      if (n > 0) vals.push(n);
    }
  }
  for (const m of marks) {
    const n = num(m.price);
    if (n > 0) vals.push(n);
  }
  if (!vals.length) return { min: 0, max: 1 };
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    const pad = Math.max(min * 0.002, 1e-6);
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;
  }
  return { min, max };
}

/**
 * Compact XRP/RLUSD desk chart for AI-Matrix only.
 * Layers: (1) public book (2) desk OfferCreate / submit levels (3) Commander estimate markers.
 */
export default function AimDeskSmartChart({ deskOrders = [], estimate = null }) {
  const [tf, setTf] = useState(DEFAULT_TF);
  const [book, setBook] = useState(null);
  const [prices, setPrices] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [liquidBook, liquidAmm, nextPrices] = await Promise.all([
          getLiquidPairBook(PAIR).catch(() => null),
          getLiquidPairAmm(PAIR).catch(() => null),
          getPrices().catch(() => ({})),
        ]);
        if (cancelled) return;
        let nextBook = liquidBook;
        if (liquidAmm && nextBook) {
          const ammPrice = Number(liquidAmm.price);
          nextBook = {
            ...nextBook,
            amm: {
              price: ammPrice > 0 ? ammPrice : null,
              reserve_asset: Number(liquidAmm.amountA) || null,
              reserve_currency: Number(liquidAmm.amountB) || null,
              account: liquidAmm.amm_account || liquidAmm.account || null,
            },
            mid:
              Number(nextBook.mid) > 0
                ? nextBook.mid
                : ammPrice > 0
                  ? ammPrice
                  : nextBook.mid,
          };
        } else if (!nextBook && liquidAmm && Number(liquidAmm.price) > 0) {
          nextBook = {
            pair: PAIR,
            mid: Number(liquidAmm.price),
            best_bid: null,
            best_ask: null,
            bids: [],
            asks: [],
            amm: { price: Number(liquidAmm.price) },
          };
        }
        setBook(nextBook);
        setPrices(nextPrices || {});
        setNow(Date.now());
        setError("");
      } catch (err) {
        if (!cancelled) setError(err?.message || "Chart feed unavailable");
      }
    }
    const start = setTimeout(load, 0);
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearInterval(id);
    };
  }, []);

  const bands = useMemo(() => bookBands(book || {}), [book]);

  const livePrice = useMemo(() => {
    const ammPrice = Number(book?.amm?.price);
    return quotePerXdx({
      pair: PAIR,
      xrpUsd: prices.xrpUsd || prices.xrp_usd,
      xrpRlusd: bands.mid || (ammPrice > 0 ? ammPrice : null),
    });
  }, [book, prices, bands.mid]);

  const candles = useMemo(() => {
    const rows = composePairCandles({
      pair: PAIR,
      interval: tf,
      range: "Max",
      locked: lockedSnapshot(),
      sparkline: [],
      trades: [],
      prices: { xrpUsd: prices.xrpUsd || prices.xrp_usd },
      livePrice: livePrice > 0 ? livePrice : bands.mid,
      now,
      windowed: false,
      lookbackBars: visibleBarsForInterval(tf) + 40,
    });
    return windowCandles(rows, tf);
  }, [tf, prices, livePrice, bands.mid, now]);

  const publicBookMarks = useMemo(() => {
    const out = [];
    const take = (rows, side, limit = 6) => {
      for (const row of (rows || []).slice(0, limit)) {
        const price = num(row.price);
        if (!(price > 0)) continue;
        out.push({
          kind: "book",
          side,
          price,
          size: num(row.base_size) || num(row.quote_size) || null,
          label: side === "bid" ? "Bid" : "Ask",
        });
      }
    };
    take(book?.bids, "bid");
    take(book?.asks, "ask");
    if (bands.bid > 0) out.push({ kind: "book", side: "bid", price: bands.bid, label: "Best bid", best: true });
    if (bands.ask > 0) out.push({ kind: "book", side: "ask", price: bands.ask, label: "Best ask", best: true });
    return out;
  }, [book, bands.bid, bands.ask]);

  const deskMarks = useMemo(() => {
    return (Array.isArray(deskOrders) ? deskOrders : [])
      .map((row, idx) => {
        const price = quotePerBaseFromDeskOrder(row);
        if (!(price > 0)) return null;
        const pair = String(row.pair || PAIR).replace(/\s+/g, "").toUpperCase();
        if (pair && pair !== PAIR && pair !== "RLUSD/XRP") return null;
        const agentId = row.agent_id || row.agent || row.id || "agent";
        return {
          kind: "desk",
          key: row.key || `${agentId}-${price}-${idx}`,
          agent_id: agentId,
          label: row.label || aimAgentShortName(agentId) || "Desk",
          side: normalizeDeskSide(row.side || row.limit_side || row.trade_direction),
          price,
          status: row.status || (row.submitted ? "submitted" : row.open ? "open" : "proposal"),
          color: AIM_DESK_AGENT_COLORS[agentId] || "#7dd3fc",
        };
      })
      .filter(Boolean);
  }, [deskOrders]);

  const estimateMarks = useMemo(() => {
    if (!estimate || typeof estimate !== "object") return [];
    const out = [];
    const fair = num(estimate.fair_mid ?? estimate.mid ?? estimate.fair);
    if (fair > 0) out.push({ kind: "estimate", role: "fair", price: fair, label: "Fair mid" });
    const entry = num(estimate.entry);
    if (entry > 0) out.push({ kind: "estimate", role: "entry", price: entry, label: "Entry" });
    const sl = num(estimate.sl ?? estimate.stop ?? estimate.stop_loss);
    if (sl > 0) out.push({ kind: "estimate", role: "sl", price: sl, label: "SL" });
    const tp = num(estimate.tp ?? estimate.take_profit);
    if (tp > 0) out.push({ kind: "estimate", role: "tp", price: tp, label: "TP" });
    const lo = num(estimate.band_lo ?? estimate.fair_lo);
    const hi = num(estimate.band_hi ?? estimate.fair_hi);
    if (lo > 0 && hi > 0) {
      out.push({ kind: "estimate", role: "band_lo", price: lo, label: "Band" });
      out.push({ kind: "estimate", role: "band_hi", price: hi, label: "Band" });
    }
    return out;
  }, [estimate]);

  const domain = useMemo(
    () => priceDomain(candles, [...deskMarks, ...estimateMarks, ...publicBookMarks.filter((m) => m.best)]),
    [candles, deskMarks, estimateMarks, publicBookMarks]
  );

  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const y = (p) => PAD.t + (1 - (p - domain.min) / Math.max(domain.max - domain.min, 1e-12)) * innerH;
  const slot = candles.length > 1 ? innerW / candles.length : innerW;
  const bodyW = Math.max(2, Math.min(10, slot * 0.62));

  const biasNote = useMemo(() => {
    const hour = estimate?.bias_hour || estimate?.hour_bias || estimate?.trade_horizon;
    const day = estimate?.bias_day || estimate?.day_bias;
    const bits = [];
    if (hour) bits.push(`Hour ${String(hour)}`);
    if (day) bits.push(`Day ${String(day)}`);
    if (!bits.length && estimate?.chart_reason) bits.push(String(estimate.chart_reason).replace(/_/g, " "));
    return bits.join(" ? ");
  }, [estimate]);

  const last = candles[candles.length - 1];
  const lastPx = num(last?.c) || bands.mid || livePrice;

  return (
    <section className="aim-desk-chart neon-inset" aria-label="XRP RLUSD desk chart">
      <div className="aim-desk-chart-head">
        <div>
          <p className="aim-desk-chart-kicker">Desk map ? XRP/RLUSD</p>
          <h3>Smart chart</h3>
          <p className="aim-desk-chart-sub">
            Public book + desk OfferCreates. Commander estimate markers when live.
            {biasNote ? ` ? ${biasNote}` : ""}
          </p>
        </div>
        <div className="aim-desk-chart-tfs" role="group" aria-label="Timeframe">
          {TF_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`aim-desk-chart-tf${tf === opt.id ? " is-on" : ""}`}
              onClick={() => setTf(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="aim-desk-chart-meta">
        <span>Last {formatPx(lastPx)} RLUSD</span>
        {bands.bid > 0 ? <span>Bid {formatPx(bands.bid)}</span> : null}
        {bands.ask > 0 ? <span>Ask {formatPx(bands.ask)}</span> : null}
        {estimateMarks.find((m) => m.role === "fair") ? (
          <span className="aim-desk-chart-fair">
            Fair {formatPx(estimateMarks.find((m) => m.role === "fair").price)}
          </span>
        ) : null}
      </div>

      <div className="aim-desk-chart-plot">
        {!candles.length ? (
          <p className="aim-empty">{error || "Waiting for XRP/RLUSD candles?"}</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="XRP RLUSD candles with desk overlays">
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const py = PAD.t + t * innerH;
              const price = domain.max - t * (domain.max - domain.min);
              return (
                <g key={`g-${t}`}>
                  <line className="aim-desk-chart-grid" x1={PAD.l} x2={W - PAD.r} y1={py} y2={py} />
                  <text className="aim-desk-chart-axis" x={PAD.l - 6} y={py + 3} textAnchor="end">
                    {formatPx(price)}
                  </text>
                </g>
              );
            })}

            {candles.map((c, i) => {
              const x = PAD.l + i * slot + slot / 2;
              const up = Number(c.c) >= Number(c.o);
              const yO = y(c.o);
              const yC = y(c.c);
              const yH = y(c.h);
              const yL = y(c.l);
              return (
                <g key={c.t || i} className={up ? "is-up" : "is-down"}>
                  <line className="aim-desk-chart-wick" x1={x} x2={x} y1={yH} y2={yL} />
                  <rect
                    className="aim-desk-chart-body"
                    x={x - bodyW / 2}
                    y={Math.min(yO, yC)}
                    width={bodyW}
                    height={Math.max(1.2, Math.abs(yC - yO))}
                  />
                </g>
              );
            })}

            {/* Public book: best levels only as light guides (not full noise) */}
            {publicBookMarks
              .filter((m) => m.best)
              .map((m) => (
                <line
                  key={`book-${m.side}-${m.price}`}
                  className={`aim-desk-chart-book is-${m.side}`}
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(m.price)}
                  y2={y(m.price)}
                />
              ))}

            {/* Commander estimate layer (separate from order layers) */}
            {estimateMarks.map((m) => (
              <g key={`est-${m.role}-${m.price}`}>
                <line
                  className={`aim-desk-chart-est is-${m.role}`}
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={y(m.price)}
                  y2={y(m.price)}
                />
                <text className="aim-desk-chart-est-label" x={W - PAD.r - 2} y={y(m.price) - 3} textAnchor="end">
                  {m.label} {formatPx(m.price)}
                </text>
              </g>
            ))}

            {/* Desk orders */}
            {deskMarks.map((m, i) => {
              const yy = y(m.price);
              const xTag = PAD.l + 8 + (i % 3) * 72;
              return (
                <g key={m.key} className={`aim-desk-chart-order is-${m.side}`}>
                  <line
                    x1={PAD.l}
                    x2={W - PAD.r}
                    y1={yy}
                    y2={yy}
                    stroke={m.color}
                    strokeWidth={1.4}
                    strokeDasharray={m.status === "proposal" ? "4 3" : "0"}
                    opacity={0.85}
                  />
                  <circle cx={xTag} cy={yy} r={3.2} fill={m.color} />
                  <text x={xTag + 6} y={yy - 3} fill={m.color} className="aim-desk-chart-order-label">
                    {m.label} {m.side} {formatPx(m.price)}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      <ul className="aim-desk-chart-legend" aria-label="Desk order legend">
        {deskMarks.slice(0, 8).map((m) => (
          <li key={`leg-${m.key}`}>
            <i style={{ background: m.color }} />
            <span>
              {m.label} ? {m.side} ? {formatPx(m.price)} ? {m.status}
            </span>
          </li>
        ))}
        {!deskMarks.length ? <li className="aim-empty">No desk XRP/RLUSD orders mapped yet.</li> : null}
      </ul>
    </section>
  );
}

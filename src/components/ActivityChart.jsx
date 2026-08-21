import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getChartHistory, getTradeHistory } from "../api/indexer";
import { formatDay, formatNumber, formatUsdPrice, formatWhen } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

const METRICS = ["tvl", "holders", "trustlines", "lpHolders", "trades", "price"];
const RANGES = ["1H", "4H", "12H", "24H", "1W", "1M", "3M", "1Y", "Max"];
const RANGE_MS = {
  "1H": 3600000,
  "4H": 4 * 3600000,
  "12H": 12 * 3600000,
  "24H": 86400000,
  "1W": 7 * 86400000,
  "1M": 30 * 86400000,
  "3M": 90 * 86400000,
  "1Y": 365 * 86400000,
};
const PAGE_SIZE = 100;

function toTs(value) {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function withTs(row) {
  const ts = toTs(row.timestamp);
  return ts == null ? null : { ...row, ts };
}

function windowedSeries(rows, range, now) {
  const all = rows.map(withTs).filter(Boolean).sort((a, b) => a.ts - b.ts);
  if (!all.length) return [];
  if (range === "Max") return all;

  const windowMs = RANGE_MS[range];
  if (!windowMs) return all;
  const start = now - windowMs;
  const inside = all.filter((row) => row.ts >= start && row.ts <= now);
  const lastBefore = [...all].reverse().find((row) => row.ts < start);
  const seed = lastBefore || (inside[0] ? null : all[all.length - 1]);
  const out = [...inside];

  if (seed) {
    out.unshift({ ...seed, timestamp: new Date(start).toISOString(), ts: start });
  } else if (out[0] && out[0].ts > start) {
    out.unshift({ ...out[0], timestamp: new Date(start).toISOString(), ts: start });
  }

  const last = out[out.length - 1];
  if (last && last.ts < now) {
    out.push({ ...last, timestamp: new Date(now).toISOString(), ts: now });
  }
  return out;
}

function yDomain(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return [0, 1];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min === max) {
    const pad = Math.abs(min) * 0.08 || 1;
    return [Math.max(0, min - pad), max + pad];
  }
  const pad = (max - min) * 0.08;
  return [Math.max(0, min - pad), max + pad];
}

function isIntraday(range) {
  return range === "1H" || range === "4H" || range === "12H" || range === "24H";
}

function metricValue(row, metric) {
  if (metric === "trades") return row.volume ?? row.trades;
  return row[metric];
}

function HistoryPager({ rows, renderHead, renderRow }) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <div className="rich-table-wrap history-scroll">
        <table className="rich-table compact">
          <thead>{renderHead()}</thead>
          <tbody>
            {pageRows.map((row, index) =>
              renderRow(row, (currentPage - 1) * PAGE_SIZE + index)
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            ‹
          </button>
          <span>
            {t.page} {currentPage} {t.of} {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            ›
          </button>
        </div>
      )}
    </>
  );
}

export default function ActivityChart() {
  const { t, locale } = useI18n();
  const [data, setData] = useState([]);
  const [trades, setTrades] = useState([]);
  const [metric, setMetric] = useState("tvl");
  const [range, setRange] = useState("24H");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [rows, tradeRows] = await Promise.all([
          getChartHistory(),
          getTradeHistory().catch(() => []),
        ]);
        if (!cancelled) {
          setData(rows);
          setTrades(tradeRows);
          setNow(Date.now());
          setError(rows.length || tradeRows.length ? null : t.noHistory);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timeout = setTimeout(load, 400);
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(id);
    };
  }, [t.noHistory]);

  const chartRows = useMemo(
    () =>
      windowedSeries(data, range, now).map((row) => ({
        ...row,
        plot: Number(metricValue(row, metric)),
      })),
    [data, range, metric, now]
  );
  const yValues = chartRows.map((row) => Number(row.plot));
  const xRange = useMemo(() => {
    if (range === "Max") {
      if (!chartRows.length) return ["auto", "auto"];
      return [chartRows[0].ts, chartRows[chartRows.length - 1].ts];
    }
    return [now - RANGE_MS[range], now];
  }, [chartRows, range, now]);

  const historyRows = useMemo(() => {
    const windowMs = RANGE_MS[range];
    const start = range === "Max" ? 0 : now - windowMs;
    const visible = data
      .map(withTs)
      .filter((row) => row && row.ts >= start)
      .sort((a, b) => b.ts - a.ts)
      .map((row, index, list) => {
        const previous = list[index + 1];
        const value = Number(metricValue(row, metric));
        const prior = previous ? Number(metricValue(previous, metric)) : null;
        const change = prior != null && Number.isFinite(prior) ? value - prior : null;
        return { ...row, value, previous: prior, change };
      });
    return visible;
  }, [data, metric, range, now]);

  const visibleTrades = useMemo(() => {
    const windowMs = RANGE_MS[range];
    const start = range === "Max" ? 0 : now - windowMs;
    return trades.filter((row) => {
      const ts = toTs(row.timestamp);
      return ts != null && ts >= start;
    });
  }, [trades, range, now]);

  const metrics = useMemo(() => {
    const available = METRICS.filter(
      (item) =>
        item === metric ||
        item === "tvl" ||
        item === "holders" ||
        item === "trustlines" ||
        item === "lpHolders" ||
        (item === "trades" && (trades.length || data.some((row) => row.trades != null || row.volume != null))) ||
        (item === "price" && data.some((row) => row.price != null))
    );
    return available;
  }, [data, metric, trades.length]);

  return (
    <div className="activity-chart-container">
      <div className="activity-controls">
        <div className="tabs">
          {metrics.map((item) => (
            <button
              key={item}
              type="button"
              className={item === metric ? "tab active" : "tab"}
              onClick={() => setMetric(item)}
            >
              {(t[item] || item).toUpperCase()}
            </button>
          ))}
        </div>
        <div className="ranges">
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              className={item === range ? "range active" : "range"}
              onClick={() => {
                setRange(item);
                setNow(Date.now());
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading && data.length === 0 ? (
        <Skeleton height={280} />
      ) : error && data.length === 0 && !trades.length ? (
        <p className="error-message">{error}</p>
      ) : (
        <>
          <div className="activity-plot is-live">
            {!chartRows.length ? (
              <p className="empty-message">{t.noRangeData}</p>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <XAxis
                  type="number"
                  dataKey="ts"
                  domain={xRange}
                  tick={{ fill: "#7f8ba8", fontSize: 11 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    if (isIntraday(range)) {
                      return date.toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    }
                    return date.toLocaleDateString(locale, {
                      day: "2-digit",
                      month: "short",
                    });
                  }}
                />
                <YAxis
                  tick={{ fill: "#7f8ba8", fontSize: 11 }}
                  width={64}
                  domain={yDomain(yValues)}
                  allowDecimals={metric === "price" || metric === "tvl" || metric === "trades"}
                  tickFormatter={(value) =>
                    metric === "price"
                      ? formatUsdPrice(value, locale)
                      : formatNumber(value, locale, {
                          maximumFractionDigits: metric === "tvl" || metric === "trades" ? 2 : 0,
                        })
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: "#0b0f1a",
                    border: "1px solid #1f2535",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  labelFormatter={(value) => formatWhen(value, locale)}
                  formatter={(value) => [
                    metric === "price"
                      ? formatUsdPrice(value, locale)
                      : formatNumber(value, locale, { maximumFractionDigits: 6 }),
                    t[metric] || metric,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="plot"
                  stroke="#00ff6a"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 5, fill: "#00ff6a", stroke: "#c770ff", strokeWidth: 2 }}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-in-out"
                  className="activity-line"
                />
              </LineChart>
            </ResponsiveContainer>
            )}
          </div>

          <div className="history-block">
            <h3 className="history-title">{t.history}</h3>
            <HistoryPager
              key={`hist-${metric}-${range}`}
              rows={historyRows}
              renderHead={() => (
                <tr>
                  <th>{t.updated}</th>
                  <th>{t[metric] || metric}</th>
                  <th>{t.previous}</th>
                  <th>{t.change}</th>
                  <th>{t.holders}</th>
                  <th>{t.trustlines}</th>
                </tr>
              )}
              renderRow={(row) => (
                <tr key={`hist-${row.timestamp}-${row.ts}`}>
                  <td>
                    {isIntraday(range)
                      ? formatWhen(row.timestamp, locale)
                      : formatDay(row.timestamp, locale)}
                  </td>
                  <td className="col-num">
                    {metric === "price"
                      ? formatUsdPrice(row.value, locale)
                      : formatNumber(row.value, locale, { maximumFractionDigits: 6 })}
                  </td>
                  <td className="col-num">
                    {row.previous == null
                      ? "—"
                      : metric === "price"
                        ? formatUsdPrice(row.previous, locale)
                        : formatNumber(row.previous, locale, { maximumFractionDigits: 6 })}
                  </td>
                  <td
                    className={`col-num ${
                      row.change > 0 ? "trade-buy" : row.change < 0 ? "trade-sell" : ""
                    }`}
                  >
                    {row.change == null
                      ? "—"
                      : formatNumber(row.change, locale, { maximumFractionDigits: 6 })}
                  </td>
                  <td className="col-num">{formatNumber(row.holders, locale)}</td>
                  <td className="col-num">{formatNumber(row.trustlines, locale)}</td>
                </tr>
              )}
            />
          </div>

          <div className="history-block">
            <h3 className="history-title">{t.trades}</h3>
            {visibleTrades.length ? (
              <HistoryPager
                key={`trades-${range}`}
                rows={visibleTrades}
                renderHead={() => (
                  <tr>
                    <th>{t.updated}</th>
                    <th>{t.side}</th>
                    <th>{t.xdxAmount}</th>
                    <th>{t.pair}</th>
                    <th>{t.price}</th>
                  </tr>
                )}
                renderRow={(row, index) => (
                  <tr key={`trade-${row.timestamp}-${row.pool}-${index}`}>
                    <td>
                      {isIntraday(range)
                        ? formatWhen(row.timestamp, locale)
                        : formatDay(row.timestamp, locale)}
                    </td>
                    <td className={row.side === "sell" ? "trade-sell" : "trade-buy"}>
                      {(row.side === "sell" ? t.sell : t.buy).toUpperCase()}
                    </td>
                    <td className={`col-num ${row.side === "sell" ? "trade-sell" : "trade-buy"}`}>
                      {formatNumber(row.xdx, locale, { maximumFractionDigits: 6 })}
                    </td>
                    <td>{row.pool}</td>
                    <td className="col-num">
                      {row.price == null
                        ? "—"
                        : formatNumber(row.price, locale, {
                            minimumFractionDigits: 8,
                            maximumFractionDigits: 8,
                          })}
                    </td>
                  </tr>
                )}
              />
            ) : (
              <p className="empty-message">{t.noTrades}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

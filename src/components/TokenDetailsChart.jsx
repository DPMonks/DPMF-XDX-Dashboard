import { useEffect, useMemo, useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getTokenDetailsHistory } from "../api/indexer";
import { XDX_ISSUED_AT } from "../constants/ledger";
import {
  TOKEN_DETAIL_METRICS,
  TOKEN_DETAIL_RANGE_MS,
  TOKEN_DETAIL_RANGES,
  tokenDetailDecimals,
  tokenDetailIsIntraday,
  tokenDetailLabel,
  tokenDetailYDomain,
  windowedTokenSeries,
} from "../tokenDetailsHistory";
import { formatNumber, formatWhen } from "../utils/format";
import { DRIFT_MS, driftPlot, easeInOutCubic, lerpPair } from "../utils/lineDrift";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

export default function TokenDetailsChart() {
  const { t, locale } = useI18n();
  const [data, setData] = useState([]);
  const [metric, setMetric] = useState("price");
  const [ranges, setRanges] = useState(() =>
    Object.fromEntries(TOKEN_DETAIL_METRICS.map((key) => [key, "24H"]))
  );
  const range = ranges[metric] || "24H";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const rows = await getTokenDetailsHistory();
        if (!cancelled) {
          setData(rows);
          setNow(Date.now());
          setError(rows.length ? null : t.noHistory);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timeout = setTimeout(load, 900);
    const id = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(id);
    };
  }, [t.noHistory]);

  const chartRows = useMemo(
    () => windowedTokenSeries(data, range, now, metric),
    [data, range, metric, now]
  );
  const xRange = useMemo(() => {
    if (range === "Max") {
      const issued = new Date(XDX_ISSUED_AT).getTime();
      const first = chartRows[0]?.ts;
      const last = chartRows[chartRows.length - 1]?.ts || now;
      if (!first) return [issued, now];
      return [Math.min(issued, first), last];
    }
    return [now - TOKEN_DETAIL_RANGE_MS[range], now];
  }, [chartRows, range, now]);
  const targetY = useMemo(
    () => tokenDetailYDomain(chartRows.map((row) => Number(row.plot))),
    [chartRows]
  );
  const [displayRows, setDisplayRows] = useState(chartRows);
  const [displayX, setDisplayX] = useState(xRange);
  const [displayY, setDisplayY] = useState(targetY);
  const displayRef = useRef({ rows: chartRows, x: xRange, y: targetY, metric, range });

  useEffect(() => {
    const nextX = xRange;
    const nextY = targetY;
    const prev = displayRef.current;
    const shouldDrift =
      prev.rows.length > 0 &&
      chartRows.length > 0 &&
      (prev.metric !== metric || prev.range !== range);

    if (!shouldDrift) {
      setDisplayRows(chartRows);
      setDisplayX(nextX);
      setDisplayY(nextY);
      displayRef.current = { rows: chartRows, x: nextX, y: nextY, metric, range };
      return undefined;
    }

    const fromRows = prev.rows;
    const fromX = prev.x || nextX;
    const fromY = prev.y || nextY;
    const started = performance.now();
    let frame = 0;
    const step = (stamp) => {
      const progress = Math.min(1, (stamp - started) / DRIFT_MS);
      const eased = easeInOutCubic(progress);
      const rows = progress >= 1 ? chartRows : driftPlot(fromRows, chartRows, progress);
      const x = progress >= 1 ? nextX : lerpPair(fromX, nextX, eased);
      const y = progress >= 1 ? nextY : lerpPair(fromY, nextY, eased);
      setDisplayRows(rows);
      setDisplayX(x);
      setDisplayY(y);
      displayRef.current = { rows, x, y, metric, range };
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [chartRows, xRange, targetY, metric, range]);

  const digits = tokenDetailDecimals(metric);
  const label = tokenDetailLabel(t, metric);

  return (
    <div className="activity-chart-container token-details-chart">
      <div className="activity-controls">
        <div className="tabs">
          {TOKEN_DETAIL_METRICS.map((item) => (
            <button
              key={item}
              type="button"
              className={item === metric ? "tab active" : "tab"}
              onClick={() => setMetric(item)}
            >
              {tokenDetailLabel(t, item).toUpperCase()}
            </button>
          ))}
        </div>
        <div className="ranges">
          {TOKEN_DETAIL_RANGES.map((item) => (
            <button
              key={item}
              type="button"
              className={item === range ? "range active" : "range"}
              onClick={() => {
                setRanges((current) => ({ ...current, [metric]: item }));
                setNow(Date.now());
              }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading && data.length === 0 ? (
        <Skeleton height={260} />
      ) : error && data.length === 0 ? (
        <p className="error-message">{error}</p>
      ) : (
        <div className="activity-plot is-live">
          {!chartRows.length && !displayRows.length ? (
            <p className="empty-message">{t.noRangeData}</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayRows.length ? displayRows : chartRows}>
                <XAxis
                  type="number"
                  dataKey="ts"
                  domain={displayX}
                  tick={{ fill: "#7f8ba8", fontSize: 11 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    if (tokenDetailIsIntraday(range)) {
                      return date.toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                    }
                    if (range === "1Y" || range === "Max") {
                      return date.toLocaleDateString(locale, {
                        month: "short",
                        year: "2-digit",
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
                  width={72}
                  domain={displayY}
                  allowDecimals={digits > 0}
                  tickFormatter={(value) =>
                    formatNumber(value, locale, { maximumFractionDigits: digits })
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
                    formatNumber(value, locale, { maximumFractionDigits: digits }),
                    label,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="plot"
                  stroke="#00ff6a"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 5, fill: "#00ff6a", stroke: "#c770ff", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                  className="activity-line"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
      {chartRows.length ? (
        <p className="orderbook-asof activity-source">{t.historyFromIssuance}</p>
      ) : null}
    </div>
  );
}

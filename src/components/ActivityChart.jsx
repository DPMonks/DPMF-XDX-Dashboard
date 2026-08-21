import { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getChartHistory } from "../api/indexer";
import { formatDay, formatNumber, formatWhen } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

const METRICS = ["tvl", "holders", "lpHolders", "price", "volume"];
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

function filterRange(rows, range) {
  if (!rows.length || range === "Max") return rows;
  const windowMs = RANGE_MS[range];
  if (!windowMs) return rows;
  const now = Date.now();
  return rows.filter((row) => {
    const ts = new Date(row.timestamp).getTime();
    return Number.isFinite(ts) && now - ts <= windowMs;
  });
}

function isIntraday(range) {
  return range === "1H" || range === "4H" || range === "12H" || range === "24H";
}

export default function ActivityChart() {
  const { t, locale } = useI18n();
  const [data, setData] = useState([]);
  const [metric, setMetric] = useState("tvl");
  const [range, setRange] = useState("Max");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `activity-${range}`;

    async function load(useCache = true) {
      try {
        if (useCache) {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (!cancelled && parsed.rows?.length) {
              setData(filterRange(parsed.rows, range));
              setLoading(false);
            }
          }
        }

        const rows = await getChartHistory(range);
        if (!cancelled) {
          const visible = filterRange(rows, range);
          setData(visible.length ? visible : rows);
          setError(rows.length ? null : t.noHistory);
          sessionStorage.setItem(cacheKey, JSON.stringify({ rows }));
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timeout = setTimeout(() => load(), 400);
    const id = setInterval(() => load(false), 60000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      clearInterval(id);
    };
  }, [range, t.noHistory]);

  const history = useMemo(() => [...data].reverse().slice(0, 12), [data]);
  const metrics = useMemo(
    () => METRICS.filter((item) => data.some((row) => row[item] != null) || item === metric),
    [data, metric]
  );

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
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {loading && data.length === 0 ? (
        <Skeleton height={280} />
      ) : error && data.length === 0 ? (
        <p className="error-message">{error}</p>
      ) : (
        <>
          <div className="activity-plot">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <XAxis
                  dataKey="timestamp"
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
                <YAxis tick={{ fill: "#7f8ba8", fontSize: 11 }} width={56} />
                <Tooltip
                  contentStyle={{
                    background: "#0b0f1a",
                    border: "1px solid #1f2535",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  labelFormatter={(value) => formatDay(value, locale)}
                />
                <Line
                  type="monotone"
                  dataKey={metric}
                  stroke="#00ff6a"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="history-block">
            <h3 className="history-title">{t.history}</h3>
            <div className="rich-table-wrap">
              <table className="rich-table compact">
                <thead>
                  <tr>
                    <th>{t.updated}</th>
                    <th>{t[metric] || metric}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={String(row.timestamp)}>
                      <td>
                        {isIntraday(range)
                          ? formatWhen(row.timestamp, locale)
                          : formatDay(row.timestamp, locale)}
                      </td>
                      <td className="col-num">
                        {formatNumber(row[metric], locale, {
                          maximumFractionDigits: 6,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
import { formatDay, formatNumber } from "../utils/format";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

const METRICS = ["tvl", "holders", "lpHolders"];
const RANGES = ["1D", "1W", "1M", "Max"];

function filterRange(rows, range) {
  if (!rows.length || range === "Max") return rows;
  const now = Date.now();
  const windowMs =
    range === "1D" ? 86400000 : range === "1W" ? 7 * 86400000 : 30 * 86400000;
  return rows.filter((row) => {
    const ts = new Date(row.timestamp).getTime();
    return Number.isFinite(ts) && now - ts <= windowMs;
  });
}

export default function ActivityChart() {
  const { t, locale } = useI18n();
  const [data, setData] = useState([]);
  const [metric, setMetric] = useState("tvl");
  const [range, setRange] = useState("1M");
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

        const rows = await getChartHistory();
        if (!cancelled) {
          setData(filterRange(rows, range));
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

  return (
    <div className="activity-chart-container">
      <div className="activity-controls">
        <div className="tabs">
          {METRICS.map((item) => (
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
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString(locale, {
                      day: "2-digit",
                      month: "short",
                    })
                  }
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
                      <td>{formatDay(row.timestamp, locale)}</td>
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

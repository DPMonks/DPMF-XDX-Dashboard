import { useEffect, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getActivityChart, getChartHistory } from "../api/indexer";
import Skeleton from "./Skeleton";

const METRICS = ["price", "volume", "marketcap", "rank", "traders", "holders"];
const FALLBACK_METRICS = ["tvl", "holders", "lpHolders"];
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
  const [data, setData] = useState([]);
  const [metric, setMetric] = useState("price");
  const [range, setRange] = useState("1M");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

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
              setData(parsed.rows);
              setUsingFallback(Boolean(parsed.fallback));
              setMetric((current) =>
                parsed.fallback && !FALLBACK_METRICS.includes(current)
                  ? "tvl"
                  : current
              );
              setLoading(false);
            }
          }
        }

        setLoading(true);
        try {
          const rows = await getActivityChart(range);
          if (!cancelled && rows.length) {
            setData(rows);
            setUsingFallback(false);
            setError(null);
            sessionStorage.setItem(cacheKey, JSON.stringify({ rows, fallback: false }));
            setLoading(false);
            return;
          }
        } catch {
          // Older indexer builds expose chart history instead.
        }

        const [tvl, holders, lp] = await Promise.all([
          getChartHistory("tvl").catch(() => []),
          getChartHistory("holders").catch(() => []),
          getChartHistory("lp").catch(() => []),
        ]);

        const merged = new Map();
        for (const row of tvl) {
          merged.set(String(row.timestamp), { timestamp: row.timestamp, tvl: row.tvl });
        }
        for (const row of holders) {
          const key = String(row.timestamp);
          merged.set(key, { ...(merged.get(key) || { timestamp: row.timestamp }), holders: row.holders });
        }
        for (const row of lp) {
          const key = String(row.timestamp);
          merged.set(key, { ...(merged.get(key) || { timestamp: row.timestamp }), lpHolders: row.lpHolders });
        }

        const rows = filterRange(
          [...merged.values()].sort(
            (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
          ),
          range
        );

        if (!cancelled) {
          setData(rows);
          setUsingFallback(true);
          setMetric((current) =>
            FALLBACK_METRICS.includes(current) ? current : "tvl"
          );
          setError(rows.length ? null : "No activity history from the indexer yet");
          sessionStorage.setItem(cacheKey, JSON.stringify({ rows, fallback: true }));
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(() => load(false), 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [range]);

  const metrics = usingFallback ? FALLBACK_METRICS : METRICS;

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
              {item.toUpperCase()}
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

      {usingFallback && (
        <p className="chart-note">
          Showing indexer TVL / holder history while `/api/activity-chart` is unavailable.
        </p>
      )}

      {loading && data.length === 0 ? (
        <Skeleton height={300} />
      ) : error && data.length === 0 ? (
        <p className="error-message">{error}</p>
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis
                dataKey="timestamp"
                tick={{ fill: "#7f8ba8" }}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                  })
                }
              />
              <YAxis tick={{ fill: "#7f8ba8" }} />
              <Tooltip
                contentStyle={{
                  background: "#0b0f1a",
                  border: "1px solid #1f2535",
                  borderRadius: "8px",
                  color: "#fff",
                }}
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
      )}
    </div>
  );
}

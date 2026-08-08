import { useEffect, useState } from "react";
import Skeleton from "./Skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip
} from "recharts";

const METRICS = ["price", "volume", "marketcap", "rank", "traders", "holders"];
const RANGES = ["1D", "1W", "1M", "Max"];

export default function ActivityChart() {
  const [data, setData] = useState([]);
  const [metric, setMetric] = useState("price");
  const [range, setRange] = useState("1M");
  const [loading, setLoading] = useState(true);

  // cache to avoid redundant fetches
  const cacheKey = `activity-${range}`;
  const cached = sessionStorage.getItem(cacheKey);

  async function load(r, useCache = true) {
    try {
      setLoading(true);

      // use cached data if available
      if (useCache && cached) {
        setData(JSON.parse(cached));
        setLoading(false);
        return;
      }

      const res = await fetch(
        `https://dpmf-xdx-indexer-production.up.railway.app/api/activity-chart?range=${r}`
      );
      const json = await res.json();

      if (Array.isArray(json)) {
        setData(json);
        sessionStorage.setItem(cacheKey, JSON.stringify(json));
      } else {
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range);
    const id = setInterval(() => load(range, false), 60000); // refresh every minute
    return () => clearInterval(id);
  }, [range]);

  return (
    <div className="activity-chart-container">
      <div className="activity-controls">
        <div className="tabs">
          {METRICS.map((m) => (
            <button
              key={m}
              className={m === metric ? "tab active" : "tab"}
              onClick={() => setMetric(m)}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="ranges">
          {RANGES.map((r) => (
            <button
              key={r}
              className={r === range ? "range active" : "range"}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading && data.length === 0 ? (
        <Skeleton height={300} />
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <XAxis
                dataKey="timestamp"
                tick={{ fill: "#7f8ba8" }}
                tickFormatter={(t) =>
                  new Date(t).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short"
                  })
                }
              />
              <YAxis tick={{ fill: "#7f8ba8" }} />
              <Tooltip
                contentStyle={{
                  background: "#0b0f1a",
                  border: "1px solid #1f2535",
                  borderRadius: "8px",
                  color: "#fff"
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

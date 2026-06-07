import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

import useCharts from "../hooks/useCharts";

export default function Charts() {
  const { tvl, holders, lpHolders, loading } = useCharts();

  if (loading) {
    return (
      <div className="dashboard-card neon-card">
        <h2>Charts</h2>
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-card neon-card">
      <h2>Charts</h2>

      <div style={{ height: 200, marginBottom: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 6, color: "#9a9ab3" }}>TVL</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={tvl}>
            <XAxis dataKey="timestamp" hide />
            <YAxis hide />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="tvl"
              stroke="#00eaff"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ height: 200, marginBottom: 20 }}>
        <h3 style={{ margin: 0, marginBottom: 6, color: "#9a9ab3" }}>
          Token Holders
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={holders}>
            <XAxis dataKey="day" hide />
            <YAxis hide />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="holder_count"
              stroke="#c770ff"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ height: 200 }}>
        <h3 style={{ margin: 0, marginBottom: 6, color: "#9a9ab3" }}>
          LP Holders
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lpHolders}>
            <XAxis dataKey="day" hide />
            <YAxis hide />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="lp_holder_count"
              stroke="#00eaff"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

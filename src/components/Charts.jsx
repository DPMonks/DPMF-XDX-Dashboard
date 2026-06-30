// src/components/Charts.jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import useCharts from "../hooks/useCharts.js";

export default function Charts() {
  const { charts, loading } = useCharts();

  if (loading) return <p>Loading charts...</p>;

  return (
    <div className="charts-container" style={{ width: "100%", minHeight: "700px" }}>
      <h2>Charts</h2>

      {/* TVL Chart */}
      <div style={{ width: "100%", minHeight: 250 }}>
        <h3>Total Value Locked</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.tvl}>
            <XAxis dataKey="timestamp" hide />
            <YAxis hide />
            <Tooltip />
            <Line type="monotone" dataKey="tvl" stroke="#00eaff" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Holders Chart */}
      <div style={{ width: "100%", minHeight: 250 }}>
        <h3>Token Holders</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.holders}>
            <XAxis dataKey="timestamp" hide />
            <YAxis hide />
            <Tooltip />
            <Line type="monotone" dataKey="holders" stroke="#ff00aa" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* LP Holders Chart */}
      <div style={{ width: "100%", minHeight: 250 }}>
        <h3>LP Holders</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={charts.lpHolders}>
            <XAxis dataKey="timestamp" hide />
            <YAxis hide />
            <Tooltip />
            <Line type="monotone" dataKey="lpHolders" stroke="#ffaa00" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

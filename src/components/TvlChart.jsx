import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fetchTvlHistory } from "../api";

export default function TvlChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchTvlHistory().then((rows) => {
      setData(
        rows.map((r) => ({
          time: new Date(r.timestamp).toLocaleString(),
          tvl: Number(r.tvl)
        }))
      );
    }).catch(console.error);
  }, []);

  return (
    <div className="mt-6">
      <h2 className="text-lg mb-2">TVL Over Time</h2>
      <div className="h-64 bg-slate-900 border border-slate-700 rounded p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="time" hide />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="tvl" stroke="#38bdf8" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

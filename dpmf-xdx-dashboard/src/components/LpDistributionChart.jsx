import { useEffect, useState } from "react";
import { api } from "../api";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

// Address shortener
function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 9)}******${addr.slice(-4)}`;
}

export default function LpDistributionChart() {
  const [holders, setHolders] = useState([]);

  async function load() {
    const data = await api.topLp(200);
    const sorted = data.sort((a, b) => b.balance - a.balance);
    setHolders(sorted);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  // Top 10 whales + "Others"
  const top10 = holders.slice(0, 10);
  const others = holders.slice(10).reduce((sum, h) => sum + h.balance, 0);

  const chartData = [
    ...top10.map(h => ({
      name: shortAddress(h.account),
      value: h.balance
    })),
    { name: "Others", value: others }
  ];

  const COLORS = [
    "#4CAF50",
    "#2196F3",
    "#FF9800",
    "#9C27B0",
    "#F44336",
    "#00BCD4",
    "#8BC34A",
    "#FFC107",
    "#3F51B5",
    "#E91E63",
    "#9E9E9E"
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          outerRadius={110}
          label
        >
          {chartData.map((entry, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>

        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

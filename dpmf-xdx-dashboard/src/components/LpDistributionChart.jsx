import { useEffect, useState } from "react";
import { api } from "../api";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

// Address shortener
function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 9)}******${addr.slice(-4)}`;
}

export default function LpDistributionChart() {
  const [holders, setHolders] = useState([]);

  async function load() {
    const data = await api.topLp(200); // enough for distribution
    const sorted = data.sort((a, b) => b.balance - a.balance);
    setHolders(sorted);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000); // auto-refresh
    return () => clearInterval(interval);
  }, []);

  // Top 10 whales + "Others"
  const top10 = holders.slice(0, 10);
  const others = holders.slice(10).reduce((sum, h) => sum + h.balance, 0);

  const labels = [
    ...top10.map(h => shortAddress(h.account)),
    "Others"
  ];

  const data = {
    labels,
    datasets: [
      {
        label: "LP Holder Distribution",
        data: [...top10.map(h => h.balance), others],
        backgroundColor: [
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
        ],
        borderWidth: 1
      }
    ]
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Pie data={data} />
    </div>
  );
}

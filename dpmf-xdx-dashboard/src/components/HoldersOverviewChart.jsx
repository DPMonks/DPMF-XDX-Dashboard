import { useEffect, useState } from "react";
import { api } from "../api";
import { Line } from "react-chartjs-2";

export default function HoldersOverviewChart() {
  const [tokenHistory, setTokenHistory] = useState([]);
  const [lpHistory, setLpHistory] = useState([]);

  async function load() {
    const t = await api.holdersHistory();
    const l = await api.lpHoldersHistory();
    setTokenHistory(t);
    setLpHistory(l);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const data = {
    labels: tokenHistory.map(h => h.day),
    datasets: [
      {
        label: "Token Holders",
        data: tokenHistory.map(h => h.holder_count),
        borderColor: "#4CAF50",
        tension: 0.3
      },
      {
        label: "LP Holders",
        data: lpHistory.map(h => h.lp_holder_count),
        borderColor: "#2196F3",
        tension: 0.3
      }
    ]
  };

  return <Line data={data} />;
}

import { useEffect, useState } from "react";
import OverviewCard from "./components/OverviewCard";
import { getTVL, getHolders, getAMM } from "./api";

export default function App() {
  const [tvl, setTvl] = useState(null);
  const [holders, setHolders] = useState(null);
  const [amm, setAmm] = useState(null);

  useEffect(() => {
    getTVL().then(setTvl);
    getHolders().then(setHolders);
    getAMM().then(setAmm);
  }, []);

  return (
    <div className="min-h-screen p-10 bg-dpmfBg text-dpmfText">
      <h1 className="text-4xl font-bold mb-8 text-dpmfAccent">DPMF XDX Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <OverviewCard title="Total Value Locked" value={tvl ? `$${tvl}` : "Loading…"} />
        <OverviewCard title="Total Holders" value={holders ?? "Loading…"} />
        <OverviewCard title="AMM Liquidity" value={amm ? `$${amm.liquidity}` : "Loading…"} />
      </div>
    </div>
  );
}

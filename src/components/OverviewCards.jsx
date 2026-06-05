import { useEffect, useState } from "react";
import { fetchOverview } from "../api";

export default function OverviewCards() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchOverview().then(setData).catch(console.error);
  }, []);

  if (!data) return <div>Loading overview…</div>;

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card label="TVL" value={data.tvl.toLocaleString()} />
      <Card label="LP Supply" value={data.lp_supply.toLocaleString()} />
      <Card label="Holders" value={data.holder_count.toLocaleString()} />
      <Card label="LP Holders" value={data.lp_holder_count.toLocaleString()} />
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="p-4 bg-slate-900 rounded border border-slate-700">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

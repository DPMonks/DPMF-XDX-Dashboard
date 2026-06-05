import OverviewCards from "./components/OverviewCards";
import TopHoldersTable from "./components/TopHoldersTable";
import TopLpTable from "./components/TopLpTable";
import TvlChart from "./components/TvlChart";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6">
      <h1 className="text-2xl mb-4 font-semibold">XDX Indexer Dashboard</h1>
      <OverviewCards />
      <div className="grid grid-cols-2 gap-6 mt-6">
        <TvlChart />
        {/* Add holders / LP holders charts here */}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <TopHoldersTable />
        <TopLpTable />
      </div>
    </div>
  );
}

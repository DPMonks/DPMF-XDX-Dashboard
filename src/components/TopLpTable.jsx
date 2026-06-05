import { useEffect, useState } from "react";
import { fetchTopLp } from "../api";

export default function TopLpTable() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetchTopLp(100).then(setRows).catch(console.error);
  }, []);

  return (
    <div className="mt-6">
      <h2 className="text-lg mb-2">Top LP Holders</h2>
      <div className="overflow-auto max-h-96 border border-slate-700 rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="p-2 text-left">Account</th>
              <th className="p-2 text-right">LP Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account} className="odd:bg-slate-900/40">
                <td className="p-2 font-mono text-xs">{r.account}</td>
                <td className="p-2 text-right">
                  {Number(r.lp_balance).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

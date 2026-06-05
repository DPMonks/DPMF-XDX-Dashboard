import { useEffect, useState } from "react";
import { fetchTopHolders } from "../api";

export default function TopHoldersTable() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetchTopHolders(100).then(setRows).catch(console.error);
  }, []);

  return (
    <div className="mt-6">
      <h2 className="text-lg mb-2">Top Holders</h2>
      <div className="overflow-auto max-h-96 border border-slate-700 rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="p-2 text-left">Account</th>
              <th className="p-2 text-right">Balance</th>
              <th className="p-2 text-center">Frozen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.account} className="odd:bg-slate-900/40">
                <td className="p-2 font-mono text-xs">{r.account}</td>
                <td className="p-2 text-right">{Number(r.balance).toLocaleString()}</td>
                <td className="p-2 text-center">{r.frozen ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { getXdxFlows } from "../api/indexer";
import { formatToken, formatWhen, shortAddress } from "../utils/format";
import { normalizeAmmPair } from "../ammPage";
import { useI18n } from "../i18n/useI18n";
import Skeleton from "./Skeleton";

export default function PoolActivity({ pair }) {
  const { t, locale } = useI18n();
  const name = normalizeAmmPair(pair);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getXdxFlows()
      .then((list) => {
        if (cancelled) return;
        const want = name.replace(/\s+/g, "").toUpperCase();
        setRows(
          (Array.isArray(list) ? list : []).filter((row) => {
            const pool = String(row.pool || row.pool_name || "")
              .replace(/\s+/g, "")
              .toUpperCase();
            return !pool || pool === want;
          })
        );
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || t.emptyActivity || "No activity");
      });
    return () => {
      cancelled = true;
    };
  }, [name, t.emptyActivity]);

  if (!rows && !error) return <Skeleton height={220} />;
  if (error) return <p className="error-message">{error}</p>;
  if (!rows.length) return <p className="empty-message">{t.emptyActivity || "No prints for this pool yet."}</p>;

  return (
    <div className="rich-table-wrap">
      <table className="rich-table has-pair">
        <thead>
          <tr>
            <th>{t.when || "When"}</th>
            <th>{t.side || "Side"}</th>
            <th>{t.xdx || "XDX"}</th>
            <th>{t.account || "Account"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 24).map((row, index) => (
            <tr key={`${row.timestamp}-${row.account}-${index}`}>
              <td>{formatWhen(row.timestamp, locale)}</td>
              <td>{row.side}</td>
              <td>{formatToken(row.xdx, locale)}</td>
              <td>{row.account ? shortAddress(row.account) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

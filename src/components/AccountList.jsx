import { formatToken, shortAddress } from "../utils/format";
import { copyToClipboard } from "../utils/copy";
import Skeleton from "./Skeleton";

export default function AccountList({
  rows,
  loading,
  error,
  valueKey,
  emptyLabel,
}) {
  if (loading && !rows.length) {
    return (
      <div className="scroll-area">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={28} />
        ))}
      </div>
    );
  }

  if (error && !rows.length) {
    return <p className="error-message">{error}</p>;
  }

  if (!rows.length) {
    return <p className="empty-message">{emptyLabel}</p>;
  }

  return (
    <div className="scroll-area">
      {rows.map((row) => (
        <div key={`${row.account}-${row.rank}`} className="balance-row">
          <button
            type="button"
            className="account-link"
            onClick={() => copyToClipboard(row.account)}
            title="Copy address"
          >
            {row.rank}. {shortAddress(row.account)}
          </button>
          <span>{formatToken(row[valueKey])}</span>
        </div>
      ))}
    </div>
  );
}

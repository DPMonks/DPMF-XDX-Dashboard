import { formatFeePercent } from "../../wallet/ammVote";
import { formatDay } from "../../utils/format";

export default function VoteHistory({ rows, locale, t }) {
  const list = Array.isArray(rows) ? rows.slice(0, 8) : [];
  return (
    <section className="governance-history">
      <h3>{t.voteHistory}</h3>
      {list.length ? (
        <table>
          <thead>
            <tr>
              <th>{t.voteDate}</th>
              <th>{t.pair}</th>
              <th>{t.feeVoted}</th>
              <th>{t.voteStatus}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row, index) => (
              <tr key={row.txid || `${row.pair}-${row.timestamp}-${index}`}>
                <td>{formatDay(row.timestamp, locale)}</td>
                <td>{row.pair}</td>
                <td>{formatFeePercent(row.feePercent, locale)}</td>
                <td>{row.status === "replaced" ? t.voteReplaced : t.voteActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="governance-empty">{t.noVoteHistory}</p>
      )}
    </section>
  );
}

import { useEffect } from "react";
import { useWalletContext } from "../context/WalletContext";
import { useLpPositions } from "../hooks/useLpPositions";

export default function LpPositions() {
  const { account } = useWalletContext();
  const { lpPositions, loading, fetchLpPositions } = useLpPositions();

  useEffect(() => {
    if (account) fetchLpPositions(account);
  }, [account]);

  if (!account) return null;

  return (
    <div>
      <h2>Your LP Positions</h2>

      {loading && <p>Loading LP positions...</p>}

      {!loading && lpPositions.length === 0 && (
        <p>No LP positions found.</p>
      )}

      {lpPositions.map((pos, i) => (
        <div key={i} className="dashboard-section" style={{ marginBottom: "20px" }}>
          <h3>{pos.pool_name}</h3>

          <div className="balance-row">
            <span>LP Tokens</span>
            <span>{pos.lp_balance}</span>
          </div>

          <div className="balance-row">
            <span>Pool Share</span>
            <span>{pos.share_percent}%</span>
          </div>

          <div className="balance-row">
            <span>{pos.token_a_symbol}</span>
            <span>{pos.token_a_amount}</span>
          </div>

          <div className="balance-row">
            <span>{pos.token_b_symbol}</span>
            <span>{pos.token_b_amount}</span>
          </div>

          <div className="balance-row">
            <span>Total Value (USD)</span>
            <span>${pos.usd_value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

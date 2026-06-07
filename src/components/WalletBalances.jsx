import { useEffect } from "react";
import { useWalletContext } from "../context/WalletContext";
import { useBalances } from "../hooks/useBalances";

export default function WalletBalances() {
  const { account } = useWalletContext();
  const { balances, lpBalances, fetchBalances } = useBalances();

  useEffect(() => {
    if (account) fetchBalances(account);
  }, [account]);

  if (!account) return null;

  return (
    <div className="wallet-balances">
      <h2>Your Balances</h2>

      {balances.map((b, i) => (
        <div key={i} className="balance-row">
          <span>{b.currency}</span>
          <span>{b.balance}</span>
        </div>
      ))}

      <div style={{ margin: "20px 0", borderBottom: "1px solid #333" }} />

      <h2>Your LP Tokens</h2>

      {lpBalances.length === 0 && <p>No LP tokens found</p>}

      {lpBalances.map((lp, i) => (
        <div key={i} className="balance-row">
          <span>{lp.currency}</span>
          <span>{lp.balance}</span>
        </div>
      ))}
    </div>
  );
}

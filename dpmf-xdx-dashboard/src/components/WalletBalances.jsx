import { useBalances } from "../hooks/useBalances";
import { useWallet } from "../context/WalletContext";

export default function WalletBalances() {
  const { walletAddress } = useWallet();
  const { balances, loading } = useBalances(walletAddress);

  if (!walletAddress) return <p>Connect wallet to view balances.</p>;

  return (
    <div>
      <h2>Your Balances</h2>

      {loading && <p>Loading balances...</p>}

      {!loading && balances.length === 0 && <p>No balances found.</p>}

      {!loading &&
        balances.map((bal, i) => (
          <div key={i} className="balance-row">
            <span>{bal.currency}</span>
            <strong>{bal.value}</strong>
          </div>
        ))}
    </div>
  );
}

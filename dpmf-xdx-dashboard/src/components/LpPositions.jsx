import { useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext";

export default function LpPositions() {
  const { walletAddress } = useWallet();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;

    const fetchPositions = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/lp/${walletAddress}`
        );
        const data = await res.json();
        setPositions(data?.positions || []);
      } catch (err) {
        console.error("LP fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
  }, [walletAddress]);

  if (!walletAddress) return <p>Connect wallet to view LP positions.</p>;

  return (
    <div>
      <h2>Your LP Positions</h2>

      {loading && <p>Loading positions...</p>}

      {!loading && positions.length === 0 && <p>No LP positions found.</p>}

      {!loading &&
        positions.map((pos, i) => (
          <div key={i} className="pool-row">
            <strong>{pos.tokenA}/{pos.tokenB}</strong>
            <p>Share: {pos.share}</p>
          </div>
        ))}
    </div>
  );
}

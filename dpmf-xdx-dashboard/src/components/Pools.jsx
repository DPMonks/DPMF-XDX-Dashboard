import { useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext";

export default function Pools() {
  const { walletAddress } = useWallet();
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPools = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/pools`);
        const data = await res.json();
        setPools(data?.pools || []);
      } catch (err) {
        console.error("Pool fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPools();
  }, []);

  return (
    <div>
      <h2>Liquidity Pools</h2>

      {loading && <p>Loading pools...</p>}

      {!loading && pools.length === 0 && <p>No pools found.</p>}

      {!loading &&
        pools.map((pool, i) => (
          <div key={i} className="pool-row">
            <strong>{pool.tokenA}/{pool.tokenB}</strong>
            <p>Liquidity: {pool.liquidity}</p>
          </div>
        ))}
    </div>
  );
}

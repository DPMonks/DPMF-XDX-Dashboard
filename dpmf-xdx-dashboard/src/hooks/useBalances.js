import { useEffect, useState } from "react";

export const useBalances = (walletAddress) => {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setBalances([]);
      return;
    }

    const fetchBalances = async () => {
      try {
        setLoading(true);

        const res = await fetch(
          `${import.meta.env.VITE_API_BASE}/balances/${walletAddress}`
        );

        if (!res.ok) {
          console.error("Failed to fetch balances:", res.status);
          setBalances([]);
          return;
        }

        const data = await res.json();
        setBalances(data?.balances || []);
      } catch (err) {
        console.error("Balance fetch error:", err);
        setBalances([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBalances();
  }, [walletAddress]);

  return { balances, loading };
};

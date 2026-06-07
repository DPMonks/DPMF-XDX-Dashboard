import { useEffect, useState } from "react";

export default function useCharts() {
  const [tvl, setTvl] = useState([]);
  const [holders, setHolders] = useState([]);
  const [lpHolders, setLpHolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tvlRes, holdersRes, lpRes] = await Promise.all([
          fetch("/api/charts/tvl"),
          fetch("/api/charts/holders"),
          fetch("/api/charts/lp-holders")
        ]);

        setTvl(await tvlRes.json());
        setHolders(await holdersRes.json());
        setLpHolders(await lpRes.json());
      } catch (err) {
        console.error("Failed to load charts:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { tvl, holders, lpHolders, loading };
}

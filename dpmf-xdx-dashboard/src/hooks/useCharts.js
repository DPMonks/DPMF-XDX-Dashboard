// src/hooks/useCharts.js
import { useEffect, useState } from "react";
import { api } from "../api";

export default function useCharts() {
  const [charts, setCharts] = useState({
    tvl: [],
    holders: [],
    lpHolders: []
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [tvl, holders, lp] = await Promise.all([
          api.tvlHistory(),
          api.holdersHistory(),
          api.lpHoldersHistory()
        ]);

        setCharts({
          tvl: tvl || [],
          holders: holders || [],
          lpHolders: lp || []
        });
      } catch (err) {
        console.error("Failed to load charts:", err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { charts, loading };
}

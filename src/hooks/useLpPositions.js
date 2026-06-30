import { useState } from "react";

const API_BASE = "https://dpmf-xdx-indexer-production.up.railway.app/api";

export function useLpPositions() {
  const [lpPositions, setLpPositions] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchLpPositions(wallet) {
    if (!wallet) return;

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/lp/${wallet}`);
      const data = await res.json();

      setLpPositions(data || []);
    } catch (err) {
      console.error("LP positions fetch error:", err);
    }

    setLoading(false);
  }

  return { lpPositions, loading, fetchLpPositions };
}


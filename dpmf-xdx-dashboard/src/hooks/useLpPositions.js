import { useState } from "react";

export function useLpPositions() {
  const [lpPositions, setLpPositions] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchLpPositions(wallet) {
    if (!wallet) return;

    setLoading(true);

    try {
      const res = await fetch(`/api/lp/${wallet}`);
      const data = await res.json();

      setLpPositions(data || []);
    } catch (err) {
      console.error("LP positions fetch error:", err);
    }

    setLoading(false);
  }

  return { lpPositions, loading, fetchLpPositions };
}

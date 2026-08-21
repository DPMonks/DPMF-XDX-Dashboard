import { useEffect, useState } from "react";
import { api } from "../api";

export default function useTopHolders() {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const pageSize = 200;
        const all = [];
        let offset = 0;
        while (offset < 5000) {
          const page = await api.topHolders(pageSize, offset);
          const rows = Array.isArray(page) ? page : [];
          if (!rows.length) break;
          all.push(...rows);
          if (rows.length < pageSize) break;
          offset += rows.length;
        }
        if (!cancelled) {
          setData(all);
          setCount(all.length);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, count, error };
}

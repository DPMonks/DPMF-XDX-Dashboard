import { useEffect, useState } from "react";
import { api } from "../api";

export default function useTopHolders(limit = 200) {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function loadAll() {
      let all = [];
      let offset = 0;

      while (true) {
        const batch = await api.topHolders(limit, offset);

        if (!batch || batch.length === 0) break;

        all = [...all, ...batch];
        offset += limit;
      }

      setData(all);
      setCount(all.length);
    }

    loadAll();
  }, [limit]);

  return { data, count };
}

import { useEffect, useState } from "react";
import { api } from "../api";

export default function useTopHolders(page = 0, size = 50) {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Fetch total holder count
    api.holderCount().then(res => setCount(res.count));

    // Fetch paginated holders
    api.topHoldersPage(page, size).then(setData);
  }, [page, size]);

  return { data, count };
}

import { useEffect, useState } from "react";
import { api } from "../api";

export default function useTopHolders(limit = 100) {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.topHolders(limit).then(setData);
  }, [limit]);

  return data;
}

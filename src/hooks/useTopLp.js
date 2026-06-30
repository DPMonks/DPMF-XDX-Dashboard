import { useEffect, useState } from "react";
import { api } from "../api";

export default function useTopLp(limit = 100) {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.topLp(limit).then(setData);
  }, [limit]);

  return data;
}

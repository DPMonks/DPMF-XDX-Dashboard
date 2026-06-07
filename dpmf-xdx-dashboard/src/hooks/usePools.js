import { useEffect, useState } from "react";
import { api } from "../api";

export default function usePools() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.pools().then(setData);
  }, []);

  return data;
}

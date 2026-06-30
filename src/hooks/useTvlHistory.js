import { useEffect, useState } from "react";
import { api } from "../api";

export default function useTvlHistory() {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.tvlHistory().then(setData);
  }, []);

  return data;
}

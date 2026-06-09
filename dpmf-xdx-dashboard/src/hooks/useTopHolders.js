import { useEffect, useState } from "react";
import { api } from "../api";

export default function useTopHolders() {
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const holders = await api.topHolders();
        setData(holders);
        setCount(holders.length);
      } catch (err) {
        console.error("Failed to load top holders:", err);
      }
    }

    load();
  }, []);

  return { data, count };
}

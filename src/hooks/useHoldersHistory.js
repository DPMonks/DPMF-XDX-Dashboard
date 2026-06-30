import { useEffect, useState } from "react";
import { api } from "../api";

export default function useHoldersHistory() {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.holdersHistory().then(setData);
  }, []);

  return data;
}

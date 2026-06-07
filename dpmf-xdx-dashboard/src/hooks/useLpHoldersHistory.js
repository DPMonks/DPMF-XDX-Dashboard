import { useEffect, useState } from "react";
import { api } from "../api";

export default function useLpHoldersHistory() {
  const [data, setData] = useState([]);

  useEffect(() => {
    api.lpHoldersHistory().then(setData);
  }, []);

  return data;
}

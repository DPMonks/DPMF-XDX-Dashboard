import { useEffect, useState } from "react";
import { api } from "../api";

export default function useAmm() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.amm().then(setData);
  }, []);

  return data;
}

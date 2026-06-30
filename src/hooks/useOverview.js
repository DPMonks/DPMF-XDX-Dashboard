import { useEffect, useState } from "react";
import { api } from "../api";

export default function useOverview() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.overview().then(setData);
  }, []);

  return data;
}

import { XDX_XRPL_TO_MD5 } from "../src/constants/ledger.js";
import { rowsFromXrplToGraph } from "../src/activityHistory.js";

const CACHE_MS = 60 * 60_000;
let cache = { at: 0, rows: [] };

export async function loadIssuedHolderHistory() {
  if (Date.now() - cache.at < CACHE_MS && cache.rows.length) {
    return cache.rows;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://api.xrpl.to/v1/holders/graph/${XDX_XRPL_TO_MD5}?range=5Y`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }
    );
    if (!response.ok) return cache.rows;
    const rows = rowsFromXrplToGraph(await response.json());
    if (rows.length) cache = { at: Date.now(), rows };
    return rows;
  } catch {
    return cache.rows;
  } finally {
    clearTimeout(timer);
  }
}

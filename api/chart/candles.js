import locked from "../../src/data/lockedCandles.json" with { type: "json" };
import { hasIndexerDatabase, readIndexerDb } from "../../server/readIndexerDb.js";
import { buildChartCandlesPayload, pairFromRequest } from "../../server/xioChartCandles.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  let db = null;
  if (hasIndexerDatabase()) {
    const result = await readIndexerDb("chart/candles");
    if (result?.status < 400) {
      try {
        db = JSON.parse(result.body);
      } catch {
        db = null;
      }
    }
  }
  const pair = pairFromRequest(req);
  const body = await buildChartCandlesPayload({ pair, locked, db });
  if (body.xio) {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  }
  res.status(200).json(body);
}

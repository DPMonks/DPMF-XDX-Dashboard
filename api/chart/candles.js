import locked from "../../src/data/lockedCandles.json" with { type: "json" };
import { hasIndexerDatabase, readIndexerDb } from "../../server/readIndexerDb.js";
import { buildLedgerChartPayload } from "../../server/pairLedgerCandles.js";
import { buildChartCandlesPayload, pairFromRequest } from "../../server/xioChartCandles.js";
import { GENERATED_AT_HEADER, cacheControlFor } from "../../server/cachePolicy.js";

function viewFromRequest(req) {
  const raw = req?.query?.view;
  if (typeof raw === "string") return raw;
  try {
    return new URL(req?.url || "/", "http://localhost").searchParams.get("view") || "";
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (viewFromRequest(req) === "ledger") {
    // Per-pool ledger OHLC only (no locked snapshot), so XDX pair charts stay light.
    const body = await buildLedgerChartPayload(pairFromRequest(req) || "XDX/XRP");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=3600");
    res.setHeader(GENERATED_AT_HEADER, new Date().toISOString());
    res.status(200).json(body);
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
  res.setHeader(
    "Cache-Control",
    body.xio ? "public, max-age=0, s-maxage=60, stale-while-revalidate=3600" : cacheControlFor("chart/candles")
  );
  res.setHeader(GENERATED_AT_HEADER, new Date().toISOString());
  res.status(200).json(body);
}

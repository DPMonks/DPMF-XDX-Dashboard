#!/usr/bin/env node
/**
 * Lock daily quote/XRP OHLC for pairs that have no native XDX candle file.
 * XDX/XSQUAD and XDX/XIO are crossed with locked XDX/XRP at chart time.
 *
 *   node scripts/lock-quote-xrp.js
 */
import { writeFileSync } from "node:fs";
import { candlesFromMarketData } from "../src/chart/candles.js";

const OUT = new URL("../src/data/quoteXrpDaily.json", import.meta.url);
const SPECS = [
  {
    pair: "XSQUAD/XRP",
    url: "https://xrpldata.inftf.org/v1/iou/market_data/roBYiFtZsTRpWEUw6TtpUCwZCfjcQeRBg_5853515541440000000000000000000000000000/XRP?interval=1d",
  },
  {
    pair: "XIO/XRP",
    url: "https://xrpldata.inftf.org/v1/iou/market_data/rfuzioNFTKArnU1PQD5BEF272vpbHMRoxU_XIO/XRP?interval=1d",
  },
];

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 DPMF-XDX-Dashboard" },
    signal: AbortSignal.timeout(60_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return body;
}

async function lockPair(spec) {
  const seen = new Map();
  let start = "2021-10-24T00:00:00Z";
  for (let page = 0; page < 12; page += 1) {
    const rows = await getJson(`${spec.url}&start=${encodeURIComponent(start)}&limit=1000`);
    if (!Array.isArray(rows) || !rows.length) break;
    for (const row of candlesFromMarketData(rows, "inftf")) {
      seen.set(row.t, { t: row.t, o: row.o, h: row.h, l: row.l, c: row.c, v: row.v });
    }
    const last = rows[rows.length - 1]?.timestamp;
    if (!last || rows.length < 1000) break;
    start = last;
  }
  return [...seen.values()].sort((left, right) => left.t - right.t);
}

const pairs = {};
for (const spec of SPECS) {
  const candles = await lockPair(spec);
  pairs[spec.pair] = {
    quote: "XRP",
    source: candles.length ? "inftf-xrpl-dex" : "pending",
    candles,
  };
}

const locked = {
  lockedAt: new Date().toISOString(),
  interval: "1D",
  note: "Quote per XRP daily OHLC. XDX/XSQUAD and XDX/XIO cross these with locked XDX/XRP.",
  pairs,
};

writeFileSync(OUT, `${JSON.stringify(locked)}\n`);
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(pairs).map(([name, row]) => [
        name,
        {
          candles: row.candles.length,
          first: row.candles[0]?.t && new Date(row.candles[0].t).toISOString(),
          last: row.candles.at(-1)?.t && new Date(row.candles.at(-1).t).toISOString(),
          close: row.candles.at(-1)?.c,
        },
      ])
    ),
    null,
    2
  )
);

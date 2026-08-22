#!/usr/bin/env node
/**
 * Pull XDX candle history once and lock it.
 *
 * XDX/XRP: OnTheDEX public OHLC (XRPL DEX, from issuance when available).
 * XRP/USD: Yahoo XRP-USD daily from issuance, used to backdate
 *          XDX/RLUSD = XDX/XRP * XRP/USD (RLUSD ≈ $1) until the RLUSD AMM exists.
 *
 * Re-run only when you intentionally refresh the locked snapshot.
 * Does not start indexer workers. Does not call XRPL from the browser.
 *
 *   node scripts/lock-hybrid-candles.js
 */
import { writeFileSync } from "node:fs";
import { XDX_ISSUED_AT, XDX_ISSUER } from "../src/constants/ledger.js";
import { backdateRlusdCandle, usdLookup } from "../src/chart/pairQuote.js";
import { ticksToCandles } from "../src/chart/candles.js";

const ISSUED = Date.parse(XDX_ISSUED_AT);
const OUT = new URL("../src/data/lockedCandles.json", import.meta.url);

async function getJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 DPMF-XDX-Dashboard" },
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return body;
}

function krakenRows(body) {
  const result = body?.result || {};
  const key = Object.keys(result).find((name) => name !== "last");
  return Array.isArray(result[key]) ? result[key] : [];
}

async function lockXrpUsd() {
  const period1 = Math.floor(ISSUED / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const body = await getJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/XRP-USD?period1=${period1}&period2=${period2}&interval=1d&events=history`
  );
  const result = body?.chart?.result?.[0];
  const stamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const candles = stamps.map((stamp, index) => ({
    t: Number(stamp) * 1000,
    o: Number(quote.open?.[index]),
    h: Number(quote.high?.[index]),
    l: Number(quote.low?.[index]),
    c: Number(quote.close?.[index]),
    v: Number(quote.volume?.[index]) || 0,
    source: "yahoo-xrp-usd",
  })).filter((row) => row.t >= ISSUED && row.c > 0);
  if (candles.length) return ticksToCandles(candles, "1D", { continuous: false });

  // Fallback: Kraken only keeps ~720 public daily bars.
  const kraken = await getJson("https://api.kraken.com/0/public/OHLC?pair=XRPUSD&interval=1440");
  return ticksToCandles(
    krakenRows(kraken).map((row) => ({
      t: Number(row[0]) * 1000,
      o: Number(row[1]),
      h: Number(row[2]),
      l: Number(row[3]),
      c: Number(row[4]),
      v: Number(row[6]) || 0,
      source: "kraken",
    })),
    "1D",
    { continuous: false }
  );
}

async function lockXdxXrp() {
  const url =
    `https://api.onthedex.live/public/v1/ohlc?base=XDX.${XDX_ISSUER}&quote=XRP&interval=D&bars=5000&cf=yes`;
  try {
    const body = await getJson(url);
    if (body?.error) throw new Error(body.message || body.error);
    const rows = body?.data?.ohlc || body?.ohlc || [];
    return ticksToCandles(
      rows.map((row) => ({
        t: Number(row.t || row.time) * (Number(row.t || row.time) < 1e12 ? 1000 : 1),
        o: Number(row.o),
        h: Number(row.h),
        l: Number(row.l),
        c: Number(row.c),
        v: Number(row.vb || row.v || 0),
        source: "onthedex",
      })),
      "1D",
      { continuous: false }
    );
  } catch (error) {
    console.error("OnTheDEX XDX/XRP lock skipped:", error.message);
    return [];
  }
}

const xrpUsd = await lockXrpUsd();
const xdxXrp = await lockXdxXrp();
const xdxRlusd = xdxXrp
  .map((candle) => backdateRlusdCandle(candle, usdLookup(xrpUsd, candle.t)))
  .filter(Boolean);

const locked = {
  lockedAt: new Date().toISOString(),
  issuedAt: XDX_ISSUED_AT,
  interval: "1D",
  pairs: {
    "XDX/XRP": {
      quote: "XRP",
      source: xdxXrp.length ? "onthedex" : "pending",
      candles: xdxXrp,
    },
    "XDX/RLUSD": {
      quote: "RLUSD",
      source: xdxRlusd.length ? "backdated(xdx_xrp*xrp_usd)" : "pending",
      candles: xdxRlusd,
    },
  },
  xrpUsd,
};

writeFileSync(OUT, `${JSON.stringify(locked)}\n`);
console.log(
  JSON.stringify(
    {
      file: "src/data/lockedCandles.json",
      xrpUsd: xrpUsd.length,
      xdxXrp: xdxXrp.length,
      xdxRlusd: xdxRlusd.length,
      firstXrp: xrpUsd[0]?.t && new Date(xrpUsd[0].t).toISOString(),
      lastXrp: xrpUsd.at(-1)?.t && new Date(xrpUsd.at(-1).t).toISOString(),
    },
    null,
    2
  )
);

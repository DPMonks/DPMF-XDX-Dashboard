import { XDX_HEX, XDX_XRPL_TO_MD5 } from "../src/constants/ledger.js";
import { rowsFromXrplToGraph } from "../src/activityHistory.js";
import { XRPL_TO_TOKEN_URL } from "../src/utils/xrplToToken.js";

const GRAPH_URL = `https://api.xrpl.to/v1/holders/graph/${XDX_XRPL_TO_MD5}`;
const HOLDERS_URL = `https://api.xrpl.to/v1/holders/list/${XDX_XRPL_TO_MD5}`;
const OHLC_URL = `https://api.xrpl.to/v1/ohlc/${XDX_XRPL_TO_MD5}`;
const HISTORY_URL = `https://api.xrpl.to/v1/history`;

function jsonFetch(url, options = {}) {
  return (options.fetchImpl || fetch)(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(Number(options.timeoutMs) || 4000),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`xrpl.to ${res.status}`);
    return res.json();
  });
}

export function holdersFromXrplTo(payload = {}, offset = 0) {
  const rows = Array.isArray(payload.richList) ? payload.richList : [];
  const holders = rows.map((row, index) => ({
    rank: Number(row.rank) || offset + index + 1,
    account: row.account,
    balance: Number(row.balance) || 0,
    frozen: Boolean(row.freeze || row.frozen),
  }));
  return {
    holders,
    rows: holders,
    count: Number(payload.length) || holders.length,
    as_of: new Date().toISOString(),
    source: "xrpl.to",
    present: holders.length > 0,
    catching_up: false,
  };
}

export function candlesFromOhlc(payload = {}) {
  const rows = Array.isArray(payload.ohlc) ? payload.ohlc : [];
  return rows
    .map((row) => {
      const time = Number(row?.[0]);
      const close = Number(row?.[4]);
      if (!Number.isFinite(time) || !(close > 0)) return null;
      return {
        timestamp: new Date(time > 1e12 ? time : time * 1000).toISOString(),
        price_usd: close,
        asset: "XDX",
      };
    })
    .filter(Boolean);
}

function isXdxLeg(leg) {
  const currency = String(leg?.currency || "").toUpperCase();
  return currency === "XDX" || currency === XDX_HEX;
}

export function flowsFromXrplToHistory(payload = {}) {
  const rows = Array.isArray(payload.data) ? payload.data : [];
  const out = [];
  for (const row of rows) {
    const paid = row.paid || {};
    const got = row.got || {};
    const bought = isXdxLeg(got) ? Number(got.value) : 0;
    const sold = isXdxLeg(paid) ? Number(paid.value) : 0;
    if (!(bought > 0) && !(sold > 0)) continue;
    const xdx = bought || sold;
    out.push({
      timestamp: row.time
        ? new Date(row.time > 1e12 ? row.time : Number(row.time) * 1000).toISOString()
        : new Date().toISOString(),
      pool: "XDX/XRP",
      side: bought > 0 ? "buy" : "sell",
      xdx,
      price: Number(row.price) || 0,
      account: row.taker || row.maker || null,
      hash: row.hash || null,
      source: "xrpl.to",
    });
  }
  return out;
}

export async function loadXrplToHolders(options = {}) {
  const limit = Math.min(Number(options.limit) || 100, 200);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const payload = await jsonFetch(`${HOLDERS_URL}?limit=${limit}&offset=${offset}`, options);
  return holdersFromXrplTo(payload, offset);
}

export async function loadXrplToHolderGraph(options = {}) {
  const range = options.range || "ALL";
  const payload = await jsonFetch(`${GRAPH_URL}?range=${encodeURIComponent(range)}`, options);
  return rowsFromXrplToGraph(payload);
}

export async function loadXrplToCandles(options = {}) {
  const range = options.range || "1M";
  const interval = options.interval || "1h";
  const vs = options.vs || "USD";
  const payload = await jsonFetch(
    `${OHLC_URL}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&vs_currency=${encodeURIComponent(vs)}`,
    options
  );
  return candlesFromOhlc(payload);
}

export async function loadXrplToFlows(options = {}) {
  const limit = Math.min(Number(options.limit) || 100, 200);
  const payload = await jsonFetch(
    `${HISTORY_URL}?md5=${XDX_XRPL_TO_MD5}&limit=${limit}`,
    options
  );
  return flowsFromXrplToHistory(payload);
}

export async function loadXrplToRank(address, options = {}) {
  const page = await loadXrplToHolders({ ...options, limit: 200, offset: 0 });
  const hit = page.holders.find(
    (row) => String(row.account || "").toLowerCase() === String(address || "").toLowerCase()
  );
  return {
    account: address,
    rank: hit?.rank ?? null,
    source: "xrpl.to",
  };
}

export { XRPL_TO_TOKEN_URL, HOLDERS_URL, GRAPH_URL, OHLC_URL };

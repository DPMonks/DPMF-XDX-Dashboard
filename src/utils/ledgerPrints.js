import { isXdxCurrency, rippleCloseIso } from "./ammSwapVolume.js";

const INTERVAL_MS = {
  "1m": 60_000,
  "1h": 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

const KEEP_MS = {
  "1m": 7 * 24 * 60 * 60_000,
};

function nodeBody(wrap) {
  return wrap?.ModifiedNode || wrap?.CreatedNode || wrap?.DeletedNode || null;
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function intervalMs(interval) {
  return INTERVAL_MS[interval] || INTERVAL_MS["1h"];
}

function xrpDeltaDrops(meta, account) {
  const nodes = Array.isArray(meta?.AffectedNodes) ? meta.AffectedNodes : [];
  for (const wrap of nodes) {
    const node = nodeBody(wrap);
    if (!node || node.LedgerEntryType !== "AccountRoot") continue;
    const final = node.FinalFields || node.NewFields || {};
    if (String(final.Account || "") !== account) continue;
    const after = finite(final.Balance);
    const before = finite(node.PreviousFields?.Balance ?? final.Balance);
    if (after == null || before == null) return null;
    return after - before;
  }
  return null;
}

function issuedDelta(meta, account, wantXdx) {
  const nodes = Array.isArray(meta?.AffectedNodes) ? meta.AffectedNodes : [];
  let delta = 0;
  let seen = false;
  let currency = null;
  for (const wrap of nodes) {
    const node = nodeBody(wrap);
    if (!node || node.LedgerEntryType !== "RippleState") continue;
    const final = node.FinalFields || node.NewFields || {};
    const balance = final.Balance || {};
    const code = balance.currency;
    const xdx = isXdxCurrency(code);
    if (wantXdx !== xdx) continue;
    const high = String(final.HighLimit?.issuer || "");
    const low = String(final.LowLimit?.issuer || "");
    if (high !== account && low !== account) continue;
    const after = finite(balance.value);
    const before = finite(node.PreviousFields?.Balance?.value);
    if (after == null || before == null) continue;
    const raw = after - before;
    delta += low === account ? raw : -raw;
    currency = code || currency;
    seen = true;
  }
  if (!seen) return null;
  return { delta, currency };
}

export function tradePrintFromTx(row, { account } = {}) {
  const tx = row?.tx || row?.tx_json || row || {};
  const type = String(tx.TransactionType || "");
  if (type !== "Payment" && type !== "OfferCreate") return null;
  const meta = row?.meta || row?.metaData || {};
  if (meta.TransactionResult && meta.TransactionResult !== "tesSUCCESS") return null;
  const owner = String(account || tx.Account || "").trim();
  if (!owner) return null;
  const xdx = issuedDelta(meta, owner, true);
  if (!xdx || !(Math.abs(xdx.delta) > 0)) return null;
  const xrpDrops = xrpDeltaDrops(meta, owner);
  const feeDrops = String(tx.Account || "") === owner ? finite(tx.Fee) || 0 : 0;
  const xrp = xrpDrops == null ? null : (xrpDrops - (xrpDrops < 0 ? feeDrops : 0)) / 1_000_000;
  const quoteIou = issuedDelta(meta, owner, false);
  let quote = null;
  let quoteCurrency = null;
  if (xrp != null && Math.abs(xrp) > 0) {
    quote = xrp;
    quoteCurrency = "XRP";
  } else if (quoteIou && Math.abs(quoteIou.delta) > 0) {
    quote = quoteIou.delta;
    quoteCurrency = quoteIou.currency || "IOU";
  }
  if (quote == null || !(Math.abs(quote) > 0)) return null;
  const xdxAbs = Math.abs(xdx.delta);
  const quoteAbs = Math.abs(quote);
  const price = quoteAbs / xdxAbs;
  if (!(price > 0) || !Number.isFinite(price)) return null;
  const iso = rippleCloseIso(row);
  if (!iso) return null;
  return {
    timestamp: iso,
    hash: row.hash || tx.hash || null,
    type,
    xdx: xdxAbs,
    quote: quoteAbs,
    quoteCurrency,
    price,
    side: xdx.delta < 0 ? "sell" : "buy",
    source: type === "OfferCreate" ? "xrpl-offer" : "xrpl-amm",
  };
}

export function printsFromAccountTx(transactions = [], options = {}) {
  const out = [];
  for (const row of Array.isArray(transactions) ? transactions : []) {
    const print = tradePrintFromTx(row, options);
    if (print) out.push(print);
  }
  return out.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function aggregatePrints(prints = [], interval = "1h", now = Date.now()) {
  const size = intervalMs(interval);
  const keep = KEEP_MS[interval] || 0;
  const cutoff = keep ? Number(now) - keep : 0;
  const ordered = [...(Array.isArray(prints) ? prints : [])].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
  );
  const buckets = new Map();
  for (const print of ordered) {
    const ts = Date.parse(print.timestamp);
    const price = Number(print.price);
    const xdx = Number(print.xdx);
    if (!Number.isFinite(ts) || !(price > 0) || !(xdx > 0)) continue;
    if (cutoff && ts < cutoff) continue;
    const bucket = Math.floor(ts / size) * size;
    const row = buckets.get(bucket);
    if (!row) {
      buckets.set(bucket, {
        bucket,
        open: price,
        high: price,
        low: price,
        close: price,
        volume_xdx: xdx,
        trades: 1,
      });
      continue;
    }
    row.high = Math.max(row.high, price);
    row.low = Math.min(row.low, price);
    row.close = price;
    row.volume_xdx += xdx;
    row.trades += 1;
  }
  return [...buckets.values()].sort((a, b) => a.bucket - b.bucket);
}

export function mergeCandleRows(left = [], right = []) {
  const byBucket = new Map();
  for (const row of [...left, ...right]) {
    const bucket = Number(row?.bucket);
    const close = Number(row?.close);
    if (!Number.isFinite(bucket) || !(close > 0)) continue;
    const prev = byBucket.get(bucket);
    if (!prev) {
      byBucket.set(bucket, {
        bucket,
        open: Number(row.open) > 0 ? Number(row.open) : close,
        high: Number(row.high) > 0 ? Number(row.high) : close,
        low: Number(row.low) > 0 ? Number(row.low) : close,
        close,
        volume_xdx: Number(row.volume_xdx) > 0 ? Number(row.volume_xdx) : 0,
        trades: Number(row.trades) > 0 ? Number(row.trades) : 0,
      });
      continue;
    }
    const incomingOpen = Number(row.open) > 0 ? Number(row.open) : close;
    prev.high = Math.max(prev.high, Number(row.high) > 0 ? Number(row.high) : close);
    prev.low = Math.min(prev.low, Number(row.low) > 0 ? Number(row.low) : close);
    prev.close = close;
    prev.open = prev.open || incomingOpen;
    prev.volume_xdx = Math.max(prev.volume_xdx, Number(row.volume_xdx) || 0);
    prev.trades = Math.max(prev.trades, Number(row.trades) || 0);
  }
  return [...byBucket.values()].sort((a, b) => a.bucket - b.bucket);
}

export function pruneCandles(rows = [], interval = "1h", now = Date.now()) {
  const keep = KEEP_MS[interval] || 0;
  if (!keep) return Array.isArray(rows) ? rows : [];
  const cutoff = Number(now) - keep;
  return (Array.isArray(rows) ? rows : []).filter((row) => Number(row.bucket) >= cutoff);
}

export function change24hFromCandles(rows = [], now = Date.now()) {
  const list = (Array.isArray(rows) ? rows : [])
    .map((row) => ({ bucket: Number(row.bucket), close: Number(row.close) }))
    .filter((row) => Number.isFinite(row.bucket) && row.close > 0)
    .sort((a, b) => a.bucket - b.bucket);
  if (list.length < 2) return null;
  const latest = list[list.length - 1];
  const target = Number(now) - 24 * 60 * 60_000;
  let prior = null;
  for (const row of list) {
    if (row.bucket <= target) prior = row;
  }
  if (!prior || !(prior.close > 0)) return null;
  return ((latest.close - prior.close) / prior.close) * 100;
}

export function volumeSince(rows = [], now = Date.now(), windowMs = 24 * 60 * 60_000) {
  const cutoff = Number(now) - Number(windowMs);
  let volume = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (Number(row.bucket) < cutoff) continue;
    volume += Number(row.volume_xdx) || 0;
  }
  return volume;
}

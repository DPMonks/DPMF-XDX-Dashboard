import {
  RLUSD_HEX,
  RLUSD_ISSUER,
  XDX_HEX,
  XDX_ISSUER,
  XIO_HEX,
  XIO_ISSUER,
  XSQUAD_HEX,
  XSQUAD_ISSUER,
} from "../constants/ledger.js";
import { activityFromAmmVoteTx } from "./ammVote.js";

export const RIPPLE_EPOCH = 946684800;
export const TF_IMMEDIATE_OR_CANCEL = 131072;

const KNOWN = [
  { code: "XDX", hex: XDX_HEX, issuer: XDX_ISSUER },
  { code: "RLUSD", hex: RLUSD_HEX, issuer: RLUSD_ISSUER },
  { code: "XIO", hex: XIO_HEX, issuer: XIO_ISSUER },
  { code: "XSQUAD", hex: XSQUAD_HEX, issuer: XSQUAD_ISSUER },
];

export function sameWallet(value, address) {
  const who = String(address || "").trim().toLowerCase();
  const name = String(value || "").trim().toLowerCase();
  return Boolean(who) && who === name;
}

export function rippleIso(seconds, fallback) {
  const n = Number(seconds);
  if (Number.isFinite(n) && n >= 0) {
    return new Date((n + RIPPLE_EPOCH) * 1000).toISOString();
  }
  if (fallback) return new Date(fallback).toISOString();
  return null;
}

export function currencyCode(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.toUpperCase() === "XRP") return "XRP";
  const upper = raw.toUpperCase();
  if (/^[A-Z0-9]{3}$/.test(upper)) return upper;
  const known = KNOWN.find((row) => row.hex === upper || row.code === upper);
  if (known) return known.code;
  if (/^[A-F0-9]{40}$/.test(upper)) {
    const chars = [];
    for (let i = 0; i < 40; i += 2) {
      const code = Number.parseInt(upper.slice(i, i + 2), 16);
      if (!code) break;
      chars.push(String.fromCharCode(code));
    }
    return chars.join("") || upper;
  }
  return upper;
}

export function readAmount(value) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") {
    const drops = Number(value);
    if (!Number.isFinite(drops) || drops < 0) return null;
    return { currency: "XRP", issuer: null, value: drops / 1_000_000 };
  }
  if (typeof value !== "object") return null;
  const n = Number(value.value ?? value.amount);
  if (!Number.isFinite(n) || n < 0) return null;
  return {
    currency: currencyCode(value.currency || value.currencyCode),
    issuer: value.issuer || null,
    value: n,
  };
}

export function isXdxAmount(amount) {
  return amount?.currency === "XDX";
}

export function orderFromOffer(offer = {}, address = "") {
  const gets = readAmount(offer.TakerGets ?? offer.taker_gets);
  const pays = readAmount(offer.TakerPays ?? offer.taker_pays);
  if (!gets || !pays) return null;
  const fundedGets = readAmount(offer.taker_gets_funded ?? offer.TakerGetsFunded);
  const fundedPays = readAmount(offer.taker_pays_funded ?? offer.TakerPaysFunded);
  let side;
  let amount;
  let quote;
  let cost;
  if (isXdxAmount(gets)) {
    side = "ask";
    amount = fundedGets && isXdxAmount(fundedGets) ? fundedGets.value : gets.value;
    quote = pays.currency;
    cost = pays.value;
  } else if (isXdxAmount(pays)) {
    side = "bid";
    amount = fundedPays && isXdxAmount(fundedPays) ? fundedPays.value : pays.value;
    quote = gets.currency;
    cost = gets.value;
  } else {
    return null;
  }
  if (!(amount > 0) || !(cost > 0)) return null;
  const account = offer.Account || offer.account || address || null;
  return {
    account,
    pair: `XDX/${quote === "XRP" ? "XRP" : quote}`,
    side,
    price: cost / amount,
    amount,
    quote,
    seq: offer.seq ?? offer.Sequence ?? null,
    txid: offer.hash || offer.txid || null,
    timestamp: offer.timestamp || null,
  };
}

export function orderFromPayment(txjson, extra = {}) {
  if (!txjson || txjson.TransactionType !== "Payment") return null;
  const sendMax = readAmount(txjson.SendMax);
  const delivered = readAmount(txjson.Amount);
  if (!sendMax || !delivered) return null;
  let side;
  let amount;
  let quote;
  let cost;
  if (isXdxAmount(delivered) && !isXdxAmount(sendMax)) {
    side = "bid";
    amount = delivered.value;
    quote = sendMax.currency;
    cost = sendMax.value;
  } else if (isXdxAmount(sendMax) && !isXdxAmount(delivered)) {
    side = "ask";
    amount = sendMax.value;
    quote = delivered.currency;
    cost = delivered.value;
  } else {
    return null;
  }
  if (!(amount > 0) || !(cost > 0)) return null;
  return {
    account: extra.account || txjson.Account || null,
    pair: `XDX/${quote === "XRP" ? "XRP" : quote}`,
    side,
    price: cost / amount,
    amount,
    quote,
    seq: txjson.Sequence ?? extra.seq ?? null,
    txid: extra.txid || txjson.hash || null,
    timestamp: extra.timestamp || null,
  };
}

export function isMarketSwap(txjson) {
  return Boolean(txjson?.TransactionType === "Payment" && txjson.SendMax != null) || isImmediateOrCancel(txjson);
}

export function orderFromTxjson(txjson, extra = {}) {
  if (txjson?.TransactionType === "Payment") return orderFromPayment(txjson, extra);
  if (!txjson || txjson.TransactionType !== "OfferCreate") return null;
  return orderFromOffer(
    {
      ...txjson,
      Account: extra.account || txjson.Account,
      hash: extra.txid || txjson.hash,
      timestamp: extra.timestamp,
    },
    extra.account
  );
}

export function offerStillOnLedger(meta, account) {
  const nodes = Array.isArray(meta?.AffectedNodes) ? meta.AffectedNodes : [];
  for (const node of nodes) {
    const created = node.CreatedNode;
    if (created?.LedgerEntryType !== "Offer") continue;
    const who = created.NewFields?.Account;
    if (!who || sameWallet(who, account)) return true;
  }
  for (const node of nodes) {
    const modified = node.ModifiedNode;
    if (modified?.LedgerEntryType !== "Offer") continue;
    const who = modified.FinalFields?.Account || modified.PreviousFields?.Account;
    if (!who || sameWallet(who, account)) return true;
  }
  return false;
}

export function unwrapAccountTx(row = {}) {
  const tx = row.tx || row.tx_json || row;
  const meta = row.meta || row.metaData || tx.meta || {};
  const hash = String(row.hash || tx.hash || "").toUpperCase() || null;
  const timestamp =
    row.close_time_iso ||
    rippleIso(row.date ?? tx.date, row.timestamp) ||
    null;
  return { tx, meta, hash, timestamp, validated: row.validated !== false };
}

export function activityFromOfferTx(row, address) {
  const { tx, meta, hash, timestamp } = unwrapAccountTx(row);
  if (tx?.TransactionType !== "OfferCreate") return null;
  if (address && tx.Account && !sameWallet(tx.Account, address)) return null;
  const result = meta.TransactionResult || row.TransactionResult || "";
  if (result && result !== "tesSUCCESS") return null;
  const order = orderFromTxjson(tx, {
    account: tx.Account || address,
    txid: hash,
    timestamp,
  });
  if (!order) return null;
  const resting = offerStillOnLedger(meta, tx.Account || address);
  return {
    account: order.account,
    side: order.side === "ask" ? "sell" : "buy",
    pair: order.pair,
    pool: order.pair,
    xdx: order.amount,
    price: order.price,
    timestamp: timestamp || new Date().toISOString(),
    txid: hash,
    status: resting ? "open" : "filled",
  };
}

export function ordersFromAccountOffers(offers, address) {
  return (Array.isArray(offers) ? offers : [])
    .map((row) => orderFromOffer(row, address))
    .filter(Boolean)
    .filter((row) => !address || sameWallet(row.account, address));
}

export function activityFromAccountTx(transactions, address) {
  return (Array.isArray(transactions) ? transactions : [])
    .map((row) => activityFromOfferTx(row, address) || activityFromAmmVoteTx(row, address))
    .filter(Boolean)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));
}

function orderKey(row) {
  return [
    String(row.account || "").toLowerCase(),
    row.pair || "",
    row.side || "",
    Number(row.price || 0).toPrecision(8),
    row.seq || row.txid || "",
  ].join(":");
}

function activityKey(row) {
  if (row.txid) return String(row.txid).toUpperCase();
  return [
    String(row.account || "").toLowerCase(),
    row.side || "",
    Number(row.xdx || 0).toPrecision(8),
    Number(row.price || 0).toPrecision(8),
    row.timestamp || "",
  ].join(":");
}

export function mergeWalletOrders(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      if (!(Number(row?.price) > 0) || !(Number(row?.amount) > 0)) continue;
      const key = orderKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

export function mergeWalletActivity(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const row of Array.isArray(list) ? list : []) {
      if (!row) continue;
      const key = activityKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out.sort((left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0));
}

export function isImmediateOrCancel(txjson) {
  return Boolean(Number(txjson?.Flags || 0) & TF_IMMEDIATE_OR_CANCEL);
}

const pendingByWallet = new Map();

export function rememberPending(address, pending) {
  const key = String(address || "").trim().toLowerCase();
  if (!key || !pending) return;
  const current = pendingByWallet.get(key) || { orders: [], activity: [], at: 0 };
  pendingByWallet.set(key, {
    orders: mergeWalletOrders(pending.order ? [pending.order] : [], current.orders),
    activity: mergeWalletActivity(pending.activity ? [pending.activity] : [], current.activity),
    at: Date.now(),
  });
}

export function pendingFor(address, { offersKnown = false } = {}) {
  const key = String(address || "").trim().toLowerCase();
  const hit = pendingByWallet.get(key);
  if (!hit) return { orders: [], activity: [] };
  const age = Date.now() - hit.at;
  if (age > 45_000) {
    pendingByWallet.delete(key);
    return { orders: [], activity: [] };
  }
  if (offersKnown && age > 10_000) {
    return { orders: [], activity: hit.activity };
  }
  return hit;
}

export function pendingFromExecution(detail = {}, address = "") {
  const txjson = detail.txjson || detail.tx || null;
  const account = address || txjson?.Account || detail.account || null;
  const order = orderFromTxjson(txjson, {
    account,
    txid: detail.txid,
    timestamp: detail.timestamp || new Date().toISOString(),
  });
  if (!order || !account) return null;
  const activity = {
    account,
    side: order.side === "ask" ? "sell" : "buy",
    pair: order.pair,
    pool: order.pair,
    xdx: order.amount,
    price: order.price,
    timestamp: order.timestamp || new Date().toISOString(),
    txid: detail.txid || null,
    status: isMarketSwap(txjson) ? "filled" : "open",
  };
  return {
    order: isMarketSwap(txjson) ? null : order,
    activity,
  };
}

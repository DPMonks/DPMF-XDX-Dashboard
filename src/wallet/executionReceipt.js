import { poolFromTradeContext } from "../xaman/exchangeMemo.js";
import { currencyCode, isLpCurrencyHex, lpDeltaFromMeta, readAmount, sameWallet } from "./ledgerOrders.js";

function unwrapLedger(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.result && typeof raw.result === "object" && (raw.result.meta || raw.result.hash)) {
    return raw.result;
  }
  return raw;
}

function isLpCurrency(value) {
  return /^03[A-Fa-f0-9]{38}$/.test(String(value || "").trim());
}

function labeledAmount(amount) {
  if (!amount || !(Number(amount.value) > 0)) return null;
  const code = isLpCurrency(amount.currency) ? "LP" : currencyCode(amount.currency);
  return { value: Number(amount.value), asset: code || "IOU" };
}

function pushAmount(list, amount) {
  const row = labeledAmount(amount);
  if (row) list.push(row);
}

function metaOf(ledger) {
  if (!ledger || typeof ledger !== "object") return null;
  return ledger.meta || ledger.metaData || null;
}

function txOf(ledger) {
  if (!ledger || typeof ledger !== "object") return {};
  const nested = ledger.tx_json && typeof ledger.tx_json === "object" ? ledger.tx_json : null;
  return nested ? { ...ledger, ...nested } : ledger;
}

export function ledgerHasSwapMeta(raw) {
  const ledger = unwrapLedger(raw);
  const meta = metaOf(ledger);
  if (!meta) return false;
  return meta.delivered_amount != null || meta.DeliveredAmount != null || Array.isArray(meta.AffectedNodes);
}

function nodeParts(wrap) {
  if (wrap?.ModifiedNode) return { kind: "modified", node: wrap.ModifiedNode };
  if (wrap?.CreatedNode) return { kind: "created", node: wrap.CreatedNode };
  if (wrap?.DeletedNode) return { kind: "deleted", node: wrap.DeletedNode };
  return null;
}

function rippleHolding(account, fields, balance) {
  if (!balance || typeof balance !== "object") return null;
  const high = fields.HighLimit?.issuer;
  const low = fields.LowLimit?.issuer;
  const value = Number(balance.value);
  if (!Number.isFinite(value)) return null;
  const currency = balance.currency;
  if (sameWallet(high, account)) return { currency, issuer: low || null, value: -value };
  if (sameWallet(low, account)) return { currency, issuer: high || null, value };
  return null;
}

function xrpDrops(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Positive delta means the sender gained that asset. XRP is in drops.
export function senderDeltasFromMeta(meta, account) {
  const nodes = Array.isArray(meta?.AffectedNodes) ? meta.AffectedNodes : [];
  let xrpDropsDelta = null;
  const issued = [];
  for (const wrap of nodes) {
    const parts = nodeParts(wrap);
    if (!parts) continue;
    const { kind, node } = parts;
    const final = node.FinalFields || node.NewFields || {};
    const prev = node.PreviousFields || {};
    if (node.LedgerEntryType === "AccountRoot") {
      const who = final.Account || prev.Account;
      if (!sameWallet(who, account)) continue;
      const after = xrpDrops(final.Balance);
      const before = prev.Balance != null ? xrpDrops(prev.Balance) : after;
      if (after == null || before == null) continue;
      xrpDropsDelta = (xrpDropsDelta || 0) + (after - before);
      continue;
    }
    if (node.LedgerEntryType !== "RippleState") continue;
    const limits = {
      HighLimit: final.HighLimit || prev.HighLimit,
      LowLimit: final.LowLimit || prev.LowLimit,
    };
    const high = limits.HighLimit?.issuer;
    const low = limits.LowLimit?.issuer;
    if (!sameWallet(high, account) && !sameWallet(low, account)) continue;
    const afterBalance = kind === "deleted" ? { ...(prev.Balance || final.Balance), value: "0" } : final.Balance;
    const beforeBalance = kind === "created" ? { ...(final.Balance || prev.Balance), value: "0" } : prev.Balance;
    if (!afterBalance || !beforeBalance) continue;
    const after = rippleHolding(account, limits, afterBalance);
    const before = rippleHolding(account, limits, beforeBalance);
    if (!after || !before) continue;
    if (isLpCurrencyHex(after.currency)) continue;
    issued.push({
      currency: after.currency,
      issuer: after.issuer,
      delta: after.value - before.value,
    });
  }
  return { xrpDropsDelta, issued };
}

function sameAsset(left, right) {
  return currencyCode(left) === currencyCode(right);
}

function feeDropsOf(ledger, txjson) {
  const tx = txOf(ledger);
  const raw = tx.Fee ?? ledger?.Fee ?? txjson?.Fee;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function spentFromDeltas(deltas, sendMax, feeDrops) {
  const want = readAmount(sendMax);
  if (!want) return null;
  if (want.currency === "XRP") {
    if (deltas.xrpDropsDelta == null) return null;
    const spent = -deltas.xrpDropsDelta - feeDrops;
    if (!(spent > 0)) return null;
    return { value: spent / 1_000_000, asset: "XRP" };
  }
  let spent = 0;
  let found = false;
  for (const row of deltas.issued) {
    if (!sameAsset(row.currency, want.currency)) continue;
    found = true;
    spent += -row.delta;
  }
  if (!found || !(spent > 0)) return null;
  return { value: spent, asset: currencyCode(want.currency) };
}

function gainedFromDeltas(deltas, amount, feeDrops) {
  const want = readAmount(amount);
  if (!want) return null;
  if (want.currency === "XRP") {
    if (deltas.xrpDropsDelta == null) return null;
    const got = deltas.xrpDropsDelta + feeDrops;
    if (!(got > 0)) return null;
    return { value: got / 1_000_000, asset: "XRP" };
  }
  let got = 0;
  let found = false;
  for (const row of deltas.issued) {
    if (!sameAsset(row.currency, want.currency)) continue;
    found = true;
    got += row.delta;
  }
  if (!found || !(got > 0)) return null;
  return { value: got, asset: currencyCode(want.currency) };
}

function paymentLegsFromLedger(detail, ledger) {
  const meta = metaOf(ledger);
  const result = String(detail.engineResult || meta?.TransactionResult || "");
  if (result && result !== "tesSUCCESS") return null;
  if (!meta) return null;
  const txjson = detail.txjson || detail.tx || {};
  const tx = txOf(ledger);
  const account = detail.account || txjson.Account || tx.Account;
  if (!account) return null;
  const deltas = senderDeltasFromMeta(meta, account);
  const feeDrops = feeDropsOf(ledger, txjson);
  const paid = spentFromDeltas(deltas, txjson.SendMax ?? tx.SendMax, feeDrops);
  const delivered = readAmount(meta.delivered_amount ?? meta.DeliveredAmount);
  const received = labeledAmount(delivered) || gainedFromDeltas(deltas, txjson.Amount ?? tx.Amount, feeDrops);
  if (!paid || !received) return null;
  const fee = feeDrops > 0 ? { value: feeDrops / 1_000_000, asset: "XRP" } : null;
  return { paid: [paid], received: [received], fee };
}

export function lpDeltaFromLedger(raw, account) {
  const ledger = unwrapLedger(raw);
  return lpDeltaFromMeta(ledger?.meta || ledger, account);
}

export function executionReceipt(detail = {}) {
  const txjson = detail.txjson || detail.tx || {};
  const type = String(txjson.TransactionType || detail.txType || "");
  const trade = detail.trade || {};
  const pair = poolFromTradeContext(txjson, trade);
  const account = detail.account || txjson.Account || null;
  const ledger = unwrapLedger(detail.ledger);
  const paid = [];
  const received = [];
  let fee = null;
  let settled = false;
  const swapLegs = type === "Payment" ? paymentLegsFromLedger(detail, ledger) : null;
  if (swapLegs) {
    paid.push(...swapLegs.paid);
    received.push(...swapLegs.received);
    fee = swapLegs.fee;
    settled = true;
  } else if (type === "AMMDeposit" || type === "AMMCreate") {
    pushAmount(paid, readAmount(txjson.Amount));
    pushAmount(paid, readAmount(txjson.Amount2));
    const lp = Number(detail.lpReceived) || lpDeltaFromLedger(ledger || detail.ledger, account);
    if (lp > 0) received.push({ value: lp, asset: "LP" });
  } else if (type === "AMMWithdraw") {
    pushAmount(paid, readAmount(txjson.LPTokenIn));
    pushAmount(received, readAmount(txjson.Amount));
    pushAmount(received, readAmount(txjson.Amount2));
    if (!received.length) {
      const lp = lpDeltaFromLedger(ledger || detail.ledger, account);
      if (lp > 0) paid.push({ value: lp, asset: "LP" });
    }
  } else if (type === "Payment") {
    pushAmount(paid, readAmount(txjson.SendMax));
    pushAmount(received, readAmount(txjson.Amount));
  } else if (type === "OfferCreate") {
    pushAmount(paid, readAmount(txjson.TakerGets));
    pushAmount(received, readAmount(txjson.TakerPays));
  } else if (type === "AMMVote") {
    const units = Number(txjson.TradingFee);
    if (Number.isFinite(units)) received.push({ value: units / 1000, asset: "fee %" });
  }

  const txid = String(detail.txid || ledger?.hash || "").trim().toUpperCase();
  return {
    pair: pair || null,
    type: type || null,
    paid,
    received,
    fee,
    settled,
    txid: /^[A-F0-9]{64}$/.test(txid) ? txid : null,
    ledgerIndex: Number(detail.ledgerIndex ?? ledger?.ledger_index) || null,
    engineResult: detail.engineResult || ledger?.meta?.TransactionResult || null,
    account,
  };
}

export function formatReceiptHash(txid) {
  const hash = String(txid || "").trim();
  if (hash.length < 16) return hash;
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

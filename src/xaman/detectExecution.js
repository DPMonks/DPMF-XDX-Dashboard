export const TRADE_TX_TYPES = new Set(["OfferCreate", "AMMDeposit", "AMMWithdraw", "AMMVote"]);

export function isTradeTxjson(txjson) {
  if (TRADE_TX_TYPES.has(txjson?.TransactionType)) return true;
  return txjson?.TransactionType === "Payment" && txjson.SendMax != null;
}

function isTxHash(value) {
  return /^[A-Fa-f0-9]{64}$/.test(String(value || "").trim());
}

export function extractTxHash(...sources) {
  const keys = ["txid", "tx_hash", "hash", "dispatched_txid"];
  function walk(node, depth) {
    if (!node || depth > 4) return null;
    if (typeof node === "string" && isTxHash(node)) return node.trim().toUpperCase();
    if (typeof node !== "object") return null;
    for (const key of keys) {
      if (isTxHash(node[key])) return String(node[key]).trim().toUpperCase();
    }
    for (const child of [node.response, node.meta, node.tx, node.result, node.data, node.payload]) {
      const hit = walk(child, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  for (const source of sources) {
    const hit = walk(source, 0);
    if (hit) return hit;
  }
  return null;
}

export function unwrapLedgerTx(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.error && !raw.Account && !raw.hash) return raw;
  if (raw.result && typeof raw.result === "object" && (raw.result.Account || raw.result.hash || raw.result.meta)) {
    return raw.result;
  }
  return raw;
}

export function payloadExecutionSignals(result) {
  const meta = result?.meta && typeof result.meta === "object" ? result.meta : {};
  const response = result?.response && typeof result.response === "object" ? result.response : {};
  const dispatched = String(response.dispatched_result || result?.dispatched_result || "");
  return {
    signed: meta.signed === true || result?.signed === true,
    resolved: meta.resolved === true,
    cancelled: meta.cancelled === true,
    expired: meta.expired === true,
    submitted: meta.submitted === true || Boolean(extractTxHash(result, response)),
    tesSuccess: dispatched === "tesSUCCESS",
    dispatched,
    txid: extractTxHash(result, response),
    account: response.account || result?.account || null,
  };
}

export function socketExecutionSignals(data) {
  return {
    signed: data?.signed === true,
    cancelled: data?.signed === false && data?.expired !== true,
    expired: data?.expired === true,
    submitted: Boolean(extractTxHash(data)),
    tesSuccess: false,
    txid: extractTxHash(data),
    account: data?.account || null,
  };
}

export function ledgerExecutionSignals(raw) {
  const tx = unwrapLedgerTx(raw);
  const hash = extractTxHash(tx, raw);
  const result = tx?.meta?.TransactionResult || tx?.TransactionResult || raw?.meta?.TransactionResult || "";
  return {
    found: Boolean(tx && (tx.Account || tx.hash || tx.meta) && !tx.error),
    validated: tx?.validated === true || raw?.validated === true,
    tesSuccess: result === "tesSUCCESS",
    txid: hash,
  };
}

export function detectTradeExecution({ payload, socket, ledger } = {}) {
  const p = payload ? payloadExecutionSignals(payload) : {};
  const s = socket ? socketExecutionSignals(socket) : {};
  const l = ledger ? ledgerExecutionSignals(ledger) : {};
  const txid = l.txid || p.txid || s.txid || null;
  const signed = Boolean(p.signed || s.signed);
  const tesSuccess = Boolean(l.tesSuccess || p.tesSuccess);
  const submitted = Boolean(p.submitted || s.submitted || l.found);
  const detectors = [];
  if (s.signed) detectors.push("xaman-socket");
  if (p.signed) detectors.push("xaman-signed");
  if (p.submitted) detectors.push("xaman-submitted");
  if (p.tesSuccess) detectors.push("xaman-dispatch");
  if (p.txid || s.txid) detectors.push("xaman-txid");
  if (l.found) detectors.push("xrpl-tx");
  if (l.validated && l.tesSuccess) detectors.push("xrpl-validated");

  if ((p.cancelled || s.cancelled) && !signed && !submitted) {
    return { executed: false, rejected: true, via: "cancelled", txid, detectors };
  }
  if ((p.expired || s.expired) && !signed && !submitted) {
    return { executed: false, rejected: true, via: "expired", txid, detectors };
  }
  if (l.validated && tesSuccess && txid) {
    return { executed: true, via: "xrpl-validated", txid, detectors, signed, tesSuccess };
  }
  if (p.tesSuccess && txid) {
    return { executed: true, via: "xaman-dispatch", txid, detectors, signed, tesSuccess };
  }
  if (signed && txid) {
    return { executed: true, via: "xaman-txid", txid, detectors, signed, tesSuccess };
  }
  if (signed && submitted) {
    return { executed: true, via: "xaman-submitted", txid, detectors, signed, tesSuccess };
  }
  if (l.found && tesSuccess) {
    return { executed: true, via: "xrpl-tx", txid, detectors, signed, tesSuccess };
  }
  if (signed && (p.resolved || p.submitted) && !p.cancelled && !p.expired) {
    return { executed: true, via: "xaman-resolved", txid, detectors, signed, tesSuccess };
  }
  if (signed && !p.cancelled && !p.expired) {
    return { executed: true, via: "xaman-signed", txid, detectors, signed, tesSuccess };
  }
  return { executed: false, rejected: false, signed, tesSuccess, txid, via: null, detectors };
}

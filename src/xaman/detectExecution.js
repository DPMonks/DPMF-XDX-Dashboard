export const TRADE_TX_TYPES = new Set(["OfferCreate", "AMMDeposit", "AMMWithdraw"]);

export function isTradeTxjson(txjson) {
  return TRADE_TX_TYPES.has(txjson?.TransactionType);
}

export function extractTxHash(...sources) {
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const raw =
      source.txid ||
      source.tx_hash ||
      source.hash ||
      source.response?.txid ||
      source.response?.tx_hash ||
      source.response?.hash;
    const hash = String(raw || "").trim();
    if (/^[A-Fa-f0-9]{64}$/.test(hash)) return hash.toUpperCase();
  }
  return null;
}

export function payloadExecutionSignals(result) {
  const meta = result?.meta && typeof result.meta === "object" ? result.meta : {};
  const response = result?.response && typeof result.response === "object" ? result.response : {};
  const dispatched = String(response.dispatched_result || result?.dispatched_result || "");
  return {
    signed: meta.signed === true,
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

export function ledgerExecutionSignals(tx) {
  const hash = extractTxHash(tx);
  const result = tx?.meta?.TransactionResult || tx?.TransactionResult || "";
  return {
    found: Boolean(tx && (tx.Account || tx.hash || tx.meta) && !tx.error),
    validated: tx?.validated === true,
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
  return { executed: false, rejected: false, signed, tesSuccess, txid, via: null, detectors };
}

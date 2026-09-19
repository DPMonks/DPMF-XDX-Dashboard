import {
  extractSignedAccount,
  isFreshXamanCreate,
  isReusableUnsignedPayload,
  payloadLooksSigned,
  payloadResolvedAtMs,
  payloadSignedThisSession
} from "../../fuzion-xio/src/helper/xamanProof.js";

export {
  extractSignedAccount,
  isFreshXamanCreate,
  isReusableUnsignedPayload,
  payloadLooksSigned,
  payloadResolvedAtMs,
  payloadSignedThisSession
};

export function isTxHash(value) {
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

export function isEngineSuccess(code) {
  return String(code || "") === "tesSUCCESS";
}

export function isEngineFailure(code) {
  return /^(tec|tef|tem|tel|ter)/i.test(String(code || "").trim());
}

export function engineResultOf(...sources) {
  for (const source of sources) {
    const code = String(
      source?.dispatched_result ||
        source?.engine_result ||
        source?.TransactionResult ||
        source?.meta?.TransactionResult ||
        ""
    ).trim();
    if (isEngineSuccess(code) || isEngineFailure(code)) return code;
  }
  return "";
}

export function isSignInKind(kind) {
  return ["connect", "register", "signin", "SignIn"].includes(String(kind || ""));
}

export function detectExecution({ payload, ledger } = {}) {
  const meta = payload?.meta && typeof payload.meta === "object" ? payload.meta : {};
  const response = payload?.response && typeof payload.response === "object" ? payload.response : {};
  const dispatched = engineResultOf(response, payload, meta);
  const tx = unwrapLedgerTx(ledger);
  const ledgerCode = engineResultOf(tx?.meta, tx, ledger?.meta, ledger);
  const txid = extractTxHash(tx, ledger, payload, response);
  const signed = meta.signed === true || payloadLooksSigned(payload);
  const tesSuccess = isEngineSuccess(dispatched) || isEngineSuccess(ledgerCode);
  const failed = isEngineFailure(dispatched) || isEngineFailure(ledgerCode);
  const cancelled = meta.cancelled === true;
  const expired = meta.expired === true;
  const submitted = meta.submitted === true || Boolean(txid);
  const validated = tx?.validated === true || ledger?.validated === true;

  if (cancelled && !signed && !submitted) {
    return { executed: false, rejected: true, failed: false, status: "cancelled", txid, signed, tesSuccess, account: extractSignedAccount(payload) };
  }
  if (expired && !signed && !submitted) {
    return { executed: false, rejected: true, failed: false, status: "expired", txid, signed, tesSuccess, account: extractSignedAccount(payload) };
  }
  if (failed) {
    return {
      executed: false,
      rejected: true,
      failed: true,
      status: "failed",
      txid,
      signed,
      tesSuccess,
      engineResult: dispatched || ledgerCode,
      account: extractSignedAccount(payload)
    };
  }
  if ((validated && tesSuccess && txid) || tesSuccess) {
    return {
      executed: true,
      rejected: false,
      failed: false,
      status: "completed",
      txid,
      signed,
      tesSuccess: true,
      engineResult: dispatched || ledgerCode || "tesSUCCESS",
      account: extractSignedAccount(payload)
    };
  }
  if (signed || submitted) {
    return {
      executed: false,
      rejected: false,
      failed: false,
      pending: true,
      status: "confirming",
      txid,
      signed,
      tesSuccess,
      account: extractSignedAccount(payload)
    };
  }
  return {
    executed: false,
    rejected: false,
    failed: false,
    pending: true,
    status: "pending",
    txid,
    signed: false,
    tesSuccess: false,
    account: ""
  };
}

export function settleDecision(kind, payload, ledger) {
  const detection = detectExecution({ payload, ledger });
  if (isSignInKind(kind)) {
    if (detection.status === "cancelled" || detection.status === "expired") return detection;
    if (detection.signed && detection.account) {
      return { ...detection, executed: true, status: "completed" };
    }
    if (payloadLooksSigned(payload) && !detection.account) {
      return { ...detection, status: "confirming", pending: true };
    }
    return { ...detection, status: detection.status || "pending" };
  }
  return detection;
}

export function statusHttp(status) {
  if (status === "completed") return 200;
  if (status === "pending" || status === "confirming") return 202;
  if (status === "failed") return 409;
  return 400;
}

export function shouldRetryXaman(status) {
  return status === 429 || status === 408 || status >= 500;
}

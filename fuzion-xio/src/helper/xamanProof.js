function classicAccount(value) {
  const text = String(value || "").trim();
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(text)) return text;
  if (/^r[A-Za-z0-9]{24,34}$/.test(text)) return text;
  return "";
}

export function extractSignedAccount(result) {
  const response = result?.response && typeof result.response === "object" ? result.response : {};
  const nested =
    result?.payload?.response && typeof result.payload.response === "object"
      ? result.payload.response
      : {};
  return (
    classicAccount(response.account) ||
    classicAccount(response.signer) ||
    classicAccount(nested.account) ||
    classicAccount(nested.signer) ||
    ""
  );
}

export function payloadResolvedAtMs(result) {
  const raw =
    result?.response?.resolved_at ||
    result?.meta?.resolved_at ||
    result?.resolved_at ||
    result?.meta?.signed_at ||
    result?.signed_at ||
    "";
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function payloadLooksSigned(result) {
  if (!result || typeof result !== "object") return false;
  const meta = result.meta && typeof result.meta === "object" ? result.meta : {};
  if (meta.cancelled === true || meta.expired === true) return false;
  if (meta.signed === true || result.signed === true) return true;
  const signed = extractSignedAccount(result);
  return Boolean(
    signed && (result.response?.hex || result.response?.txid || result.response?.dispatched_result)
  );
}

export function payloadSignedThisSession(result, startedAt) {
  if (!payloadLooksSigned(result)) return false;
  const resolved = payloadResolvedAtMs(result);
  if (resolved != null && Number(startedAt) > 0 && resolved + 2500 < Number(startedAt)) {
    return false;
  }
  return true;
}

export function isReusableUnsignedPayload(result) {
  if (!result || typeof result !== "object") return false;
  const meta = result.meta && typeof result.meta === "object" ? result.meta : {};
  if (meta.signed === true || meta.resolved === true || meta.cancelled === true || meta.expired === true) {
    return false;
  }
  return !payloadLooksSigned(result);
}

export function isFreshXamanCreate(raw) {
  if (!raw || typeof raw !== "object") return false;
  const uuid = raw.uuid || raw.payload?.uuid;
  if (!uuid) return false;
  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  if (meta.resolved === true || meta.signed === true || meta.cancelled === true || meta.expired === true) {
    return false;
  }
  return true;
}

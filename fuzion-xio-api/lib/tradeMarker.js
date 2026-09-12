export const TRADE_VENUE = "fuzion-xio";
export const TRADE_MARKER = "FUZION-XIO";
export const SIGN_XAMAN = "xaman";
export const SIGN_PAPER = "paper";

export function textToHex(text) {
  return Buffer.from(String(text || ""), "utf8").toString("hex").toUpperCase();
}

export function hexToText(hex) {
  const raw = String(hex || "").replace(/^0x/i, "");
  if (!raw || raw.length % 2) return "";
  try {
    return Buffer.from(raw, "hex").toString("utf8");
  } catch {
    return "";
  }
}

export function tradeMark(partial = {}) {
  const signed =
    partial.signed === true ||
    Boolean(partial.txid) ||
    partial.sign === SIGN_XAMAN;
  return {
    venue: TRADE_VENUE,
    marker: TRADE_MARKER,
    signed,
    sign: signed ? partial.sign || SIGN_XAMAN : SIGN_PAPER,
    txid: partial.txid || "",
    signedAt: signed ? partial.signedAt || null : null
  };
}

export function paperMark() {
  return tradeMark({ signed: false, sign: SIGN_PAPER });
}

export function signedMark({ txid = "", signedAt } = {}) {
  return tradeMark({
    signed: true,
    sign: SIGN_XAMAN,
    txid,
    signedAt: signedAt || new Date().toISOString()
  });
}

export function stampTrade(row = {}, extra = {}) {
  const merged = { ...row, ...extra };
  return { ...merged, ...tradeMark(merged) };
}

export function stampRows(rows = []) {
  return (rows || []).map((row) => stampTrade(row));
}

export function xrplMemos({ kind = "trade", extra = {} } = {}) {
  const payload = JSON.stringify({
    venue: TRADE_VENUE,
    marker: TRADE_MARKER,
    signed: true,
    kind,
    ...extra
  });
  return {
    Memos: [
      {
        Memo: {
          MemoType: textToHex(TRADE_VENUE),
          MemoFormat: textToHex("text/plain"),
          MemoData: textToHex(payload)
        }
      }
    ]
  };
}

export function memoFromLedger(tx = {}) {
  for (const wrap of tx.Memos || []) {
    const memo = wrap.Memo || wrap;
    const type = hexToText(memo.MemoType);
    const data = hexToText(memo.MemoData);
    const looksFuzion =
      type === TRADE_VENUE ||
      type === TRADE_MARKER ||
      data.includes(TRADE_MARKER) ||
      data.includes(TRADE_VENUE);
    if (!looksFuzion) continue;
    let parsed = {};
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = { marker: TRADE_MARKER };
    }
    return {
      venue: TRADE_VENUE,
      marker: TRADE_MARKER,
      signed: true,
      sign: SIGN_XAMAN,
      kind: parsed.kind || "",
      memo: parsed
    };
  }
  return null;
}

export function signedQuery(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "signed" || raw === "xaman") return true;
  if (raw === "0" || raw === "false" || raw === "paper" || raw === "unsigned") return false;
  return null;
}

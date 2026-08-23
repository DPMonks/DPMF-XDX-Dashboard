import {
  RLUSD_HEX,
  RLUSD_ISSUER,
  XDX_CURRENCY,
  XDX_ISSUER,
  XIO_ISSUER,
  XSQUAD_HEX,
  XSQUAD_ISSUER,
  asciiCurrencyHex,
} from "../constants/ledger.js";

export const AMM_FEE_UNITS = 100_000;
export const AMM_FEE_MAX_UNITS = 1000;
export const AMM_VOTE_SLOTS = 8;

export function feePercentFromUnits(units) {
  const n = Number(units);
  if (!Number.isFinite(n) || n < 0) return 0;
  return (n / AMM_FEE_UNITS) * 100;
}

export function feeUnitsFromPercent(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.max(0, Math.min(AMM_FEE_MAX_UNITS, Math.round((n / 100) * AMM_FEE_UNITS)));
}

export function formatFeePercent(percent, locale = "en") {
  const n = Number(percent);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: n < 0.01 ? 4 : n < 1 ? 3 : 2,
  })}%`;
}

function sameWallet(value, address) {
  return String(value || "").trim().toLowerCase() === String(address || "").trim().toLowerCase();
}

export function voteSlotsFromAmm(amm = {}) {
  const rows = Array.isArray(amm.vote_slots) ? amm.vote_slots : [];
  return rows
    .map((row) => {
      const entry = row.vote_entry || row;
      const units = Number(entry.trading_fee ?? entry.TradingFee);
      const weight = Number(entry.vote_weight ?? entry.VoteWeight);
      if (!Number.isFinite(units)) return null;
      return {
        account: entry.account || entry.Account || null,
        tradingFee: units,
        feePercent: feePercentFromUnits(units),
        voteWeight: Number.isFinite(weight) ? weight : 0,
        weightPct: Number.isFinite(weight) ? weight / 1000 : 0,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.voteWeight - left.voteWeight);
}

export function weightedVotedFee(slots = []) {
  let weight = 0;
  let acc = 0;
  for (const row of slots) {
    const w = Number(row.voteWeight) || 0;
    if (!(w > 0)) continue;
    acc += w * Number(row.tradingFee);
    weight += w;
  }
  if (!(weight > 0)) return null;
  return feePercentFromUnits(acc / weight);
}

export function medianVotedFee(slots = []) {
  const fees = slots.map((row) => Number(row.feePercent)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!fees.length) return null;
  const mid = Math.floor(fees.length / 2);
  return fees.length % 2 ? fees[mid] : (fees[mid - 1] + fees[mid]) / 2;
}

export function quoteIdFromName(pair) {
  const text = String(pair || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!text) return "XRP";
  return text.includes("/") ? text.split("/").pop() || "XRP" : text;
}

export function quoteIssue(quote = {}) {
  const id = String(quote.id || quote.currency || quote.quote || quote).toUpperCase();
  const code = id.includes("/") ? id.split("/").pop() : id;
  if (!code || code === "XRP") return { currency: "XRP" };
  if (code === "RLUSD") return { currency: quote.hex || RLUSD_HEX, issuer: quote.issuer || RLUSD_ISSUER };
  if (code === "XIO") return { currency: "XIO", issuer: quote.issuer || XIO_ISSUER };
  if (code === "XSQUAD") return { currency: quote.hex || XSQUAD_HEX, issuer: quote.issuer || XSQUAD_ISSUER };
  if (quote.issuer && /^[A-Z0-9]{3}$/.test(code)) return { currency: code, issuer: quote.issuer };
  if (quote.issuer) {
    const hex = String(quote.hex || "");
    return {
      currency: /^[A-F0-9]{40}$/i.test(hex) ? hex.toUpperCase() : asciiCurrencyHex(code),
      issuer: quote.issuer,
    };
  }
  return { currency: "XRP" };
}

export function xdxIssue() {
  return { currency: XDX_CURRENCY, issuer: XDX_ISSUER };
}

export function pairFromVoteAssets(asset, asset2) {
  const codes = [asset, asset2].map((row) => {
    if (!row || row.currency === "XRP") return "XRP";
    const code = String(row.currency || "").toUpperCase();
    if (code === "XDX" || code.startsWith("584458")) return "XDX";
    if (code === RLUSD_HEX || code === "RLUSD") return "RLUSD";
    if (code === "XIO" || (row.issuer === XIO_ISSUER)) return "XIO";
    if (code === XSQUAD_HEX || code === "XSQUAD" || row.issuer === XSQUAD_ISSUER) return "XSQUAD";
    if (/^[A-Z0-9]{3}$/.test(code)) return code;
    return quoteIdFromName(code) || "XRP";
  });
  const quote = codes.find((code) => code !== "XDX") || "XRP";
  return `XDX/${quote}`;
}

export function ammVoteTxjson({ account, quote, tradingFee } = {}) {
  const units = Number.isFinite(Number(tradingFee)) && Number(tradingFee) > 20
    ? Math.round(Number(tradingFee))
    : feeUnitsFromPercent(tradingFee);
  const txjson = {
    TransactionType: "AMMVote",
    Asset: xdxIssue(),
    Asset2: quoteIssue(quote),
    TradingFee: Math.max(0, Math.min(AMM_FEE_MAX_UNITS, units)),
  };
  if (account) txjson.Account = account;
  return txjson;
}

export function isVoteTxjson(txjson) {
  return txjson?.TransactionType === "AMMVote";
}

export function governanceFromAmmInfo(result = {}, { address = "", pair = "XDX/XRP", lpBalance = 0 } = {}) {
  const amm = result.amm || result;
  const slots = voteSlotsFromAmm(amm);
  const yours = slots.find((row) => address && sameWallet(row.account, address)) || null;
  const lpSupply = Number(amm.lp_token?.value ?? amm.lp_token);
  const held = Number(lpBalance) || 0;
  const eligible = held > 0;
  return {
    pair,
    ammAccount: amm.account || null,
    tradingFee: Number(amm.trading_fee),
    tradingFeePct: feePercentFromUnits(amm.trading_fee),
    weightedFeePct: weightedVotedFee(slots) ?? feePercentFromUnits(amm.trading_fee),
    medianFeePct: medianVotedFee(slots),
    voteCount: slots.length,
    voteSlots: slots,
    yourVote: yours,
    lpSupply: Number.isFinite(lpSupply) ? lpSupply : null,
    lpBalance: held,
    voteWeight: Number.isFinite(lpSupply) && lpSupply > 0 ? (held / lpSupply) * AMM_FEE_UNITS : 0,
    eligible,
    applies: "immediate",
    slotsFull: slots.length >= AMM_VOTE_SLOTS,
  };
}

export function activityFromAmmVoteTx(row, address) {
  const tx = row.tx || row.tx_json || row;
  if (tx?.TransactionType !== "AMMVote") return null;
  if (address && tx.Account && !sameWallet(tx.Account, address)) return null;
  const meta = row.meta || row.metaData || tx.meta || {};
  const result = meta.TransactionResult || row.TransactionResult || "";
  if (result && result !== "tesSUCCESS") return null;
  const units = Number(tx.TradingFee);
  const pair = pairFromVoteAssets(tx.Asset, tx.Asset2);
  const timestamp =
    row.close_time_iso ||
    (Number.isFinite(Number(row.date ?? tx.date))
      ? new Date((Number(row.date ?? tx.date) + 946684800) * 1000).toISOString()
      : row.timestamp) ||
    new Date().toISOString();
  return {
    kind: "vote",
    account: tx.Account || address || null,
    side: "vote",
    pair,
    pool: pair,
    feeUnits: units,
    feePercent: feePercentFromUnits(units),
    timestamp,
    txid: String(row.hash || tx.hash || "").toUpperCase() || null,
    status: "active",
  };
}

export function voteHistoryFromActivity(rows = [], slots = []) {
  const live = new Set(
    (Array.isArray(slots) ? slots : [])
      .map((row) => String(row.account || "").toLowerCase())
      .filter(Boolean)
  );
  const seenPair = new Set();
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.kind === "vote")
    .map((row) => {
      const key = String(row.pair || "");
      const first = !seenPair.has(key);
      if (first) seenPair.add(key);
      const onLedger = live.has(String(row.account || "").toLowerCase());
      return {
        ...row,
        status: first && onLedger ? "active" : first ? "active" : "replaced",
      };
    });
}

export function pendingVoteFromExecution(detail = {}, address = "") {
  const txjson = detail.txjson || detail.tx || null;
  if (!isVoteTxjson(txjson)) return null;
  const account = address || txjson.Account || detail.account || null;
  if (!account) return null;
  return {
    order: null,
    activity: {
      kind: "vote",
      account,
      side: "vote",
      pair: pairFromVoteAssets(txjson.Asset, txjson.Asset2),
      pool: pairFromVoteAssets(txjson.Asset, txjson.Asset2),
      feeUnits: Number(txjson.TradingFee),
      feePercent: feePercentFromUnits(txjson.TradingFee),
      timestamp: detail.timestamp || new Date().toISOString(),
      txid: detail.txid || null,
      status: "active",
    },
  };
}

export function knownGovernancePairs(pools = []) {
  const ids = ["XDX/XRP", "XDX/RLUSD", "XDX/XIO", "XDX/XSQUAD"];
  for (const row of Array.isArray(pools) ? pools : []) {
    const name = String(row.pool || row.pool_name || row.pair || "").replace(/\s+/g, "").toUpperCase();
    if (name.startsWith("XDX/") && !ids.includes(name)) ids.push(name);
  }
  return ids;
}

import { XDX_ISSUER } from "../constants/ledger.js";
import { feeUnitsFromPercent } from "./ammVote.js";
import {
  DROPS_PER_XRP,
  QUOTE_ASSETS,
  quoteAmount,
  quoteIdFromPair,
  resolveQuote,
  xdxAmount,
} from "../xaman/tradeTx.js";

export const AMM_CREATE_DEFAULT_FEE = 0.25;
export const AMM_CREATE_MAX_FEE = 1;
export const AMM_CREATE_RESERVE_XRP = 2;
export const RATIO_WARN_ABS_PCT = 15;

export function ammCreateTxjson({ account, quote, xdx, quoteQty, tradingFee } = {}) {
  const txjson = {
    TransactionType: "AMMCreate",
    Amount: xdxAmount(xdx),
    Amount2: quoteAmount(quote, quoteQty),
    TradingFee: feeUnitsFromPercent(tradingFee ?? AMM_CREATE_DEFAULT_FEE),
  };
  if (account) txjson.Account = account;
  return txjson;
}

export function existingPoolForQuote(pools, quoteId) {
  const quote = String(quoteId || "").toUpperCase();
  const want = `XDX/${quote}`;
  return (
    (Array.isArray(pools) ? pools : []).find((row) => {
      const name = String(row.pool || row.pool_name || row.pair || "")
        .replace(/\s+/g, "")
        .toUpperCase();
      return name === want || (quote && name.endsWith(`/${quote}`));
    }) || null
  );
}

export function walletLineRows(raw) {
  if (!raw || typeof raw !== "object") return [];
  const rows = [];
  for (const key of ["balances", "lines", "trustlines", "assets", "tokens"]) {
    if (Array.isArray(raw[key])) rows.push(...raw[key]);
  }
  if (!rows.length && raw.balances && typeof raw.balances === "object" && !Array.isArray(raw.balances)) {
    for (const [key, value] of Object.entries(raw.balances)) {
      if (value && typeof value === "object") rows.push({ currency: key, ...value });
    }
  }
  return rows;
}

export function hexCurrencyLabel(hex) {
  const clean = String(hex || "").replace(/0+$/g, "");
  let out = "";
  for (let i = 0; i < clean.length; i += 2) {
    const code = Number.parseInt(clean.slice(i, i + 2), 16);
    if (!Number.isFinite(code) || code < 32 || code > 126) continue;
    out += String.fromCharCode(code);
  }
  return out || String(hex || "").slice(0, 6);
}

export function quotesFromWalletLines(raw) {
  const extra = [];
  for (const row of walletLineRows(raw)) {
    const currency = String(row.currency || row.code || row.hex || "").toUpperCase();
    const issuer = row.issuer || row.account || row.counterparty || null;
    if (!issuer || currency === "XRP" || currency === "XDX" || currency.startsWith("584458")) continue;
    if (/^03[A-F0-9]{38}$/i.test(currency)) continue;
    const known = QUOTE_ASSETS.find(
      (item) =>
        item.issuer &&
        item.issuer === issuer &&
        (item.hex?.toUpperCase() === currency ||
          item.id === currency ||
          item.id === String(row.ticker || "").toUpperCase())
    );
    const ticker =
      known?.id ||
      String(row.ticker || "").toUpperCase() ||
      (/^[A-Z0-9]{3}$/.test(currency) ? currency : hexCurrencyLabel(currency));
    extra.push({
      id: ticker,
      ticker,
      currency: known?.currency || (/^[A-Z0-9]{3}$/.test(currency) ? currency : ticker),
      issuer: known?.issuer || issuer,
      hex: known?.hex || (/^[A-F0-9]{40}$/.test(currency) ? currency : row.hex || null),
      label: known?.label || ticker,
      balance: row.balance ?? row.value ?? row.amount ?? null,
    });
  }
  return extra;
}

function shortIssuer(address) {
  const text = String(address || "");
  if (text.length <= 11) return text;
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

function optionKey(ticker, issuer) {
  return issuer ? `${ticker}:${String(issuer).toUpperCase()}` : ticker;
}

export function createQuoteOptions(pools = [], raw = null) {
  const collected = [];
  function add(row) {
    const ticker = String(row.ticker || row.id || row.currency || "").toUpperCase();
    if (!ticker || ticker === "XDX") return;
    const issuer = row.issuer || null;
    const key = optionKey(ticker, issuer);
    if (collected.some((item) => item.key === key)) return;
    collected.push({
      key,
      ticker,
      issuer,
      currency: row.currency || ticker,
      hex: row.hex || null,
    });
  }
  add({ id: "XRP", ticker: "XRP", currency: "XRP" });
  for (const row of quotesFromWalletLines(raw)) add(row);
  const counts = new Map();
  for (const row of collected) counts.set(row.ticker, (counts.get(row.ticker) || 0) + 1);
  return collected.map((row) => {
    const collided = (counts.get(row.ticker) || 0) > 1 && row.issuer;
    return {
      id: collided ? `${row.ticker}:${row.issuer}` : row.ticker,
      ticker: row.ticker,
      label: collided ? `${row.ticker} · ${shortIssuer(row.issuer)}` : row.ticker,
      exists: Boolean(existingPoolForQuote(pools, row.ticker)),
      currency: row.currency,
      issuer: row.issuer,
      hex: row.hex,
    };
  });
}

export function defaultCreateQuoteId(pools, raw) {
  const options = createQuoteOptions(pools, raw);
  return options.find((row) => !row.exists)?.id || options[0]?.id || "XRP";
}

export function depositRatio(xdx, quoteQty) {
  const base = Number(xdx);
  const quote = Number(quoteQty);
  if (!(base > 0) || !(quote > 0)) return 0;
  return quote / base;
}

export function ratioDeltaPct(ratio, marketQuotePerXdx) {
  const deposit = Number(ratio);
  const market = Number(marketQuotePerXdx);
  if (!(deposit > 0) || !(market > 0)) return null;
  return ((deposit - market) / market) * 100;
}

export function estimatedCreateLp(xdx, quoteQty, quoteIsXrp = false) {
  const base = Number(xdx);
  const quote = Number(quoteQty);
  if (!(base > 0) || !(quote > 0)) return 0;
  const product = quoteIsXrp ? base * quote * DROPS_PER_XRP : base * quote;
  return Math.sqrt(product);
}

export function estimatedPoolValueXrp({ xdxAmount, quoteAmount, xdxXrp, quoteXrp } = {}) {
  const xdxPart = Number(xdxAmount) * Number(xdxXrp) || 0;
  const quotePart = Number(quoteAmount) * Number(quoteXrp || 0) || 0;
  const total = xdxPart + quotePart;
  return total > 0 ? total : 0;
}

export function issuedBalance(raw, quote) {
  if (!quote || quote.currency === "XRP" || !quote.issuer) return null;
  const names = [quote.currency, quote.hex, quote.id]
    .filter(Boolean)
    .map((name) => String(name).toUpperCase());
  const issuer = String(quote.issuer).toUpperCase();
  const list = Array.isArray(raw?.balances)
    ? raw.balances
    : Array.isArray(raw?.lines)
      ? raw.lines
      : [];
  for (const row of list) {
    const currency = String(row.currency || row.code || row.ticker || "").toUpperCase();
    const who = String(row.issuer || row.account || "").toUpperCase();
    if (who && who !== issuer) continue;
    if (names.some((name) => currency === name || currency.includes(name))) {
      const n = Number(row.value ?? row.balance ?? row.amount);
      if (Number.isFinite(n)) return n;
    }
  }
  const hay = JSON.stringify(raw || {}).toUpperCase();
  if (names.some((name) => hay.includes(name)) || hay.includes(issuer)) {
    const n = Number(raw?.[quote.id] ?? raw?.[quote.currency]);
    return Number.isFinite(n) ? n : 0;
  }
  return null;
}

function knownAmount(value) {
  if (value == null || value === "") return false;
  return Number.isFinite(Number(value));
}

export function hasAssetLine(raw, quote, knownBalance) {
  if (!quote || quote.currency === "XRP" || !quote.issuer) return true;
  if (knownAmount(knownBalance)) return true;
  const hay = JSON.stringify(raw || {}).toUpperCase();
  const tokens = [quote.currency, quote.hex, quote.id, quote.issuer]
    .filter(Boolean)
    .map((name) => String(name).toUpperCase());
  return tokens.some((token) => hay.includes(token));
}

export function hasXdxLine(raw, xdxBalance) {
  if (knownAmount(xdxBalance)) return true;
  const hay = JSON.stringify(raw || "").toUpperCase();
  return hay.includes("XDX") || hay.includes("584458") || hay.includes(XDX_ISSUER.toUpperCase());
}

export function createPoolBlocker({
  signedIn,
  xdx,
  quoteQty,
  quote,
  xdxBalance,
  quoteBalance,
  xrpBalance,
  raw,
  existing,
  fee,
} = {}) {
  if (existing) return "exists";
  if (!signedIn) return "wallet";
  const quoteId = String(quote?.id || quote?.currency || "").toUpperCase();
  if (quoteId === "XDX") return "primary";
  if (!hasXdxLine(raw, xdxBalance)) return "xdx-line";
  if (quote?.issuer && !hasAssetLine(raw, quote, quoteBalance)) return "quote-line";
  const base = Number(xdx);
  const quoteAmt = Number(quoteQty);
  if (!(base > 0) || !(quoteAmt > 0)) return "amount";
  const feePct = Number(fee);
  if (!Number.isFinite(feePct) || feePct < 0 || feePct > AMM_CREATE_MAX_FEE) return "fee";
  if (knownAmount(xdxBalance) && base > Number(xdxBalance)) return "xdx-balance";
  const quoteIsXrp = !quote?.issuer || quote.currency === "XRP";
  if (!quoteIsXrp && knownAmount(quoteBalance) && quoteAmt > Number(quoteBalance)) {
    return "quote-balance";
  }
  const spendable = Number(xrpBalance);
  const xrpNeeded = (quoteIsXrp ? quoteAmt : 0) + AMM_CREATE_RESERVE_XRP;
  if (knownAmount(xrpBalance) && spendable < xrpNeeded) return "reserve";
  return null;
}

export function resolveCreateQuote(id, extra = {}) {
  const ticker = extra.ticker || extra.currency || String(id || extra.quote || extra.id || "").split(":")[0];
  const resolved = resolveQuote(quoteIdFromPair(ticker || id || extra.quote || extra.id), extra);
  return {
    ...resolved,
    id: extra.ticker || resolved.id || ticker,
    label: extra.label || resolved.label || ticker,
    currency: resolved.currency || extra.currency || ticker,
    issuer: extra.issuer || extra.quote_issuer || extra.quoteIssuer || resolved.issuer || null,
    hex: extra.hex || extra.quote_hex || extra.quoteHex || resolved.hex || null,
  };
}

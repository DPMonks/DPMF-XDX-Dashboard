import { createQuoteOptions, quotesFromWalletLines } from "../wallet/ammCreate.js";
import { isLpCurrency, QUOTE_ASSETS } from "../xaman/tradeTx.js";

const XDX_ASSET = { id: "XDX", ticker: "XDX", label: "XDX", currency: "XDX" };

function lineBalance(row) {
  const n = Number(row?.balance ?? row?.value ?? row?.amount);
  return Number.isFinite(n) ? n : 0;
}

export function swapAssetOptions({ pools = [], lines = [], balances = {} } = {}) {
  const quotes = createQuoteOptions(pools, lines);
  const fromLines = quotesFromWalletLines(lines);
  const byId = new Map();
  function add(row) {
    const id = String(row.id || row.ticker || "").toUpperCase();
    if (!id || isLpCurrency(row.currency) || isLpCurrency(row.hex)) return;
    if (byId.has(id) && !row.issuer) return;
    byId.set(id, {
      id,
      ticker: row.ticker || id,
      label: row.label || id,
      currency: row.currency || id,
      issuer: row.issuer || null,
      hex: row.hex || null,
      balance: row.balance,
    });
  }

  add({ ...XDX_ASSET, balance: Number(balances.xdx) || 0 });
  for (const row of QUOTE_ASSETS) add(row);
  for (const row of quotes) add(row);
  for (const row of fromLines) add({ ...row, id: row.ticker || row.id, balance: lineBalance(row) });

  const xrp = byId.get("XRP");
  if (xrp) xrp.balance = Number(balances.xrp) || xrp.balance || 0;

  return [byId.get("XDX"), byId.get("XRP"), ...[...byId.values()].filter((row) => row.id !== "XDX" && row.id !== "XRP")].filter(
    Boolean
  );
}

export function swapCounterAsset(fromId, toId) {
  const from = String(fromId || "").toUpperCase();
  const to = String(toId || "").toUpperCase();
  return from === "XDX" ? to : from;
}

export function swapSellingXdx(fromId) {
  return String(fromId || "").toUpperCase() === "XDX";
}

export function pickOtherAsset(current, next, fallback = "XRP") {
  const a = String(current || "").toUpperCase();
  const b = String(next || "").toUpperCase();
  if (b && b !== a) return b;
  if (a === "XDX") return fallback;
  return "XDX";
}

import { ammPoolName, poolQuoteTicker } from "../ammPools.js";
import { quotesFromWalletLines } from "../wallet/ammCreate.js";
import { isLpCurrency, QUOTE_ASSETS } from "../xaman/tradeTx.js";

const XDX_ASSET = { id: "XDX", ticker: "XDX", label: "XDX", currency: "XDX" };
const XRP_ASSET = { id: "XRP", ticker: "XRP", label: "XRP", currency: "XRP", issuer: null, hex: null };

function optionKey(ticker, issuer) {
  return issuer ? `${String(ticker).toUpperCase()}:${String(issuer).toUpperCase()}` : String(ticker || "").toUpperCase();
}

function reserveAmount(pool, keys) {
  for (const key of keys) {
    if (pool?.[key] == null || pool[key] === "") continue;
    const n = Number(pool[key]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function isActiveXdxPool(pool = {}) {
  const name = ammPoolName(pool);
  if (!name.startsWith("XDX/") || name === "XDX/XDX") return false;
  const xdx = reserveAmount(pool, ["reserve_asset", "reserve_xdx"]);
  const quote = reserveAmount(pool, ["reserve_currency", "reserve_quote"]);
  if (xdx != null && quote != null) return xdx > 0 && quote > 0;
  if (xdx === 0 || quote === 0) return false;
  return true;
}

export function quotesFromActiveXdxPools(pools = []) {
  const seen = new Set();
  const rows = [];
  for (const pool of Array.isArray(pools) ? pools : []) {
    if (!isActiveXdxPool(pool)) continue;
    const ticker = poolQuoteTicker(pool);
    if (!ticker || ticker === "XDX" || isLpCurrency(pool.quote_hex || pool.lp_currency)) continue;
    const known = QUOTE_ASSETS.find((item) => item.id === ticker);
    const issuer = pool.quote_issuer || pool.issuer || known?.issuer || null;
    const key = optionKey(ticker, issuer);
    if (seen.has(key) || seen.has(ticker)) continue;
    seen.add(key);
    seen.add(ticker);
    rows.push({
      id: ticker,
      ticker,
      label: ticker,
      currency: known?.currency || ticker,
      issuer,
      hex: pool.quote_hex || pool.hex || known?.hex || null,
    });
  }
  return rows.sort((a, b) => {
    if (a.id === "XRP") return -1;
    if (b.id === "XRP") return 1;
    return a.id.localeCompare(b.id);
  });
}

function sameSwapAsset(line, asset) {
  const ticker = String(line?.ticker || line?.id || "").toUpperCase();
  const want = String(asset?.ticker || asset?.id || "").toUpperCase();
  if (!ticker || ticker !== want) return false;
  const lineIssuer = String(line?.issuer || "").toUpperCase();
  const assetIssuer = String(asset?.issuer || "").toUpperCase();
  if (!lineIssuer || !assetIssuer) return true;
  return lineIssuer === assetIssuer;
}

export function swapAssetOptions({ pools = [], lines = [], balances = {}, signedIn = false } = {}) {
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
  for (const row of swapCounterOptions({ pools, lines, balances, signedIn })) add(row);
  const xrp = byId.get("XRP");
  if (xrp) xrp.balance = Number(balances.xrp) || xrp.balance || 0;
  return [byId.get("XDX"), ...[...byId.values()].filter((row) => row.id !== "XDX")].filter(Boolean);
}

export function swapCounterOptions({ pools = [], lines = [], balances = {}, signedIn = false } = {}) {
  const quotes = quotesFromActiveXdxPools(pools);
  const held = quotesFromWalletLines(lines);
  const rows = quotes.filter((row) => {
    if (row.id === "XRP") return true;
    if (!signedIn) return true;
    return held.some((line) => sameSwapAsset(line, row));
  });
  if (rows.length) return rows.map((row) => (row.id === "XRP" ? { ...row, balance: Number(balances.xrp) || 0 } : row));
  return [{ ...XRP_ASSET, balance: Number(balances.xrp) || 0 }];
}

export function swapCounterAsset(fromId, toId) {
  const from = String(fromId || "").toUpperCase();
  const to = String(toId || "").toUpperCase();
  if (from === "XDX") return to && to !== "XDX" ? to : "XRP";
  if (to === "XDX") return from && from !== "XDX" ? from : "XRP";
  return to && to !== "XDX" ? to : from || "XRP";
}

export function swapSellingXdx(fromId) {
  return String(fromId || "").toUpperCase() === "XDX";
}

export function pickOtherAsset(current, next, fallback = "XRP") {
  const a = String(current || "").toUpperCase();
  const b = String(next || "").toUpperCase();
  if (b && b !== "XDX" && b !== a) return b;
  if (a && a !== "XDX") return a;
  return fallback;
}

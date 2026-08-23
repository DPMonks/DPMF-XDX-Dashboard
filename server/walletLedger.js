import { xrplRpc } from "./xrplBookOffers.js";
import { hexCurrencyLabel } from "../src/wallet/ammCreate.js";
import { activityFromAccountTx, ordersFromAccountOffers } from "../src/wallet/ledgerOrders.js";

const CACHE_MS = 8_000;
const LINE_PAGE_LIMIT = 8;
const LP_CURRENCY_RE = /^03[A-F0-9]{38}$/i;
const XDX_CURRENCY_RE = /^(XDX|5844580000000000000000000000000000000000)$/i;
const cache = new Map();

function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  return loader().then((body) => {
    cache.set(key, { at: Date.now(), body });
    return body;
  });
}

export function invalidateWalletLedger(address) {
  const name = String(address || "").trim();
  if (!name) return;
  cache.delete(`offers:${name}`);
  cache.delete(`activity:${name}`);
  cache.delete(`lines:${name}`);
}

export async function loadWalletOffers(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) return { account: null, orders: [], source: "empty" };
  if (options.fresh) cache.delete(`offers:${name}`);
  return cached(`offers:${name}`, async () => {
    try {
      const result = await xrplRpc("account_offers", {
        account: name,
        ledger_index: "validated",
        limit: 50,
      });
      return {
        account: name,
        orders: ordersFromAccountOffers(result.offers || [], name),
        source: "xrpl",
      };
    } catch {
      return { account: name, orders: [], source: "empty" };
    }
  });
}

function decodeLineCurrency(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.length <= 3) return value.toUpperCase();
  return String(hexCurrencyLabel(value) || value.slice(0, 12)).toUpperCase();
}

export function mapAccountLine(line) {
  const issuer = String(line?.account || line?.issuer || "").trim();
  const currency = String(line?.currency || "").trim();
  if (!issuer || !currency) return null;
  if (XDX_CURRENCY_RE.test(currency) || LP_CURRENCY_RE.test(currency)) return null;
  return {
    currency,
    ticker: decodeLineCurrency(currency),
    issuer,
    balance: String(line?.balance ?? "0"),
    limit: String(line?.limit ?? ""),
    noRipple: Boolean(line?.no_ripple),
  };
}

export function linesFromAccountLines(rows = []) {
  const lines = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const mapped = mapAccountLine(row);
    if (mapped) lines.push(mapped);
  }
  return lines;
}

export async function loadWalletLines(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) return { account: null, lines: [], source: "empty" };
  if (options.fresh) cache.delete(`lines:${name}`);
  return cached(`lines:${name}`, async () => {
    try {
      const lines = [];
      let marker;
      for (let page = 0; page < LINE_PAGE_LIMIT; page += 1) {
        const params = {
          account: name,
          ledger_index: "validated",
          limit: 400,
        };
        if (marker) params.marker = marker;
        const result = await xrplRpc("account_lines", params, options);
        lines.push(...linesFromAccountLines(result?.lines || []));
        marker = result?.marker;
        if (!marker) break;
      }
      return { account: name, lines, source: "xrpl" };
    } catch {
      return { account: name, lines: [], source: "empty" };
    }
  });
}

export async function loadWalletActivity(address, options = {}) {
  const name = String(address || "").trim();
  if (!name) return { account: null, activity: [], source: "empty" };
  if (options.fresh) cache.delete(`activity:${name}`);
  return cached(`activity:${name}`, async () => {
    try {
      const result = await xrplRpc("account_tx", {
        account: name,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 30,
        binary: false,
        forward: false,
      });
      return {
        account: name,
        activity: activityFromAccountTx(result.transactions || [], name),
        source: "xrpl",
      };
    } catch {
      return { account: name, activity: [], source: "empty" };
    }
  });
}

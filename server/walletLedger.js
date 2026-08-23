import { xrplRpc } from "./xrplBookOffers.js";
import { activityFromAccountTx, ordersFromAccountOffers } from "../src/wallet/ledgerOrders.js";

const CACHE_MS = 8_000;
const cache = new Map();

function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  return loader().then((body) => {
    cache.set(key, { at: Date.now(), body });
    return body;
  });
}

export async function loadWalletOffers(address) {
  const name = String(address || "").trim();
  if (!name) return { account: null, orders: [], source: "empty" };
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

export async function loadWalletActivity(address) {
  const name = String(address || "").trim();
  if (!name) return { account: null, activity: [], source: "empty" };
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

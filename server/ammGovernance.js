import { xrplRpc } from "./xrplBookOffers.js";
import {
  activityFromAmmVoteTx,
  governanceFromAmmInfo,
  quoteIdFromName,
  quoteIssue,
  voteHistoryFromActivity,
  xdxIssue,
} from "../src/wallet/ammVote.js";

const CACHE_MS = 10_000;
const cache = new Map();

function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  return loader().then((body) => {
    cache.set(key, { at: Date.now(), body });
    return body;
  });
}

export async function loadPoolGovernance(pair, address = "", lpBalance = 0) {
  const name = String(pair || "XDX/XRP").replace(/\s+/g, "").toUpperCase() || "XDX/XRP";
  const quote = { id: quoteIdFromName(name), currency: quoteIdFromName(name) };
  return cached(`gov:${name}:${address || "-"}`, async () => {
    try {
      const result = await xrplRpc("amm_info", {
        asset: xdxIssue(),
        asset2: quoteIssue(quote),
        ledger_index: "validated",
      });
      return {
        ...governanceFromAmmInfo(result, { address, pair: name, lpBalance }),
        source: "xrpl",
      };
    } catch {
      return {
        ...governanceFromAmmInfo({}, { address, pair: name, lpBalance }),
        source: "empty",
      };
    }
  });
}

export async function loadWalletVotes(address) {
  const name = String(address || "").trim();
  if (!name) return { account: null, activity: [], source: "empty" };
  return cached(`votes:${name}`, async () => {
    try {
      const result = await xrplRpc("account_tx", {
        account: name,
        ledger_index_min: -1,
        ledger_index_max: -1,
        limit: 40,
        binary: false,
        forward: false,
      });
      const activity = (result.transactions || [])
        .map((row) => activityFromAmmVoteTx(row, name))
        .filter(Boolean);
      return {
        account: name,
        activity: voteHistoryFromActivity(activity),
        source: "xrpl",
      };
    } catch {
      return { account: name, activity: [], source: "empty" };
    }
  });
}

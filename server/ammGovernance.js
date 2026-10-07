import { xrplRpc } from "./xrplBookOffers.js";
import { mapLimit } from "./liveAmmReserves.js";
import {
  activityFromAmmVoteTx,
  attachVoteTimestamps,
  governanceFromAmmInfo,
  quoteIdFromName,
  quoteIssue,
  voteHistoryFromActivity,
  xdxIssue,
} from "../src/wallet/ammVote.js";

const CACHE_MS = 10_000;
const cache = new Map();

// Last good governance read per key. A failed amm_info returns this instead of
// an empty body, so the vote tiles never flip to 0% on a rate limited node.
const LAST_GOOD_MS = 15 * 60_000;
const lastGood = new Map();

function cached(key, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.body;
  return loader().then((body) => {
    if (body?.source === "empty") {
      const kept = lastGood.get(key);
      if (kept && Date.now() - kept.at < LAST_GOOD_MS) return { ...kept.body, stale: true };
      // Do not cache a miss; the next request tries the ledger again.
      return body;
    }
    cache.set(key, { at: Date.now(), body });
    lastGood.set(key, { at: Date.now(), body });
    return body;
  });
}

export async function loadPoolGovernance(pair, address = "", extra = {}) {
  const name = String(pair || "XDX/XRP").replace(/\s+/g, "").toUpperCase() || "XDX/XRP";
  const lpBalance = typeof extra === "number" ? extra : Number(extra?.lpBalance ?? extra?.lp ?? 0) || 0;
  const quoteId = quoteIdFromName(name);
  const quote = {
    id: quoteId,
    currency: extra?.currency || extra?.hex || extra?.quote_hex || quoteId,
    issuer: extra?.issuer || extra?.quote_issuer,
    hex: extra?.hex || extra?.quote_hex,
  };
  const ammAccount = String(extra?.ammAccount || extra?.amm || extra?.amm_account || "").trim();
  return cached(`gov:${name}:${address || "-"}:${quote.issuer || ""}:${ammAccount}`, async () => {
    try {
      const asset2 = quoteIssue(quote);
      const unresolvedIssued = quoteId !== "XRP" && asset2.currency === "XRP";
      const result = await xrplRpc(
        "amm_info",
        unresolvedIssued && ammAccount
          ? { amm_account: ammAccount, ledger_index: "validated" }
          : { asset: xdxIssue(), asset2, ledger_index: "validated" }
      );
      const gov = governanceFromAmmInfo(result, { address, pair: name, lpBalance });
      if (!gov.loaded) {
        return { ...gov, source: "empty" };
      }
      return {
        ...gov,
        voteSlots: await withinBudget(datedVoteSlots(gov.voteSlots, name), VOTE_DATES_BUDGET_MS, gov.voteSlots),
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

// Vote dates are a nice to have. Never let the per voter account_tx lookups
// hold back the fee figures.
const VOTE_DATES_BUDGET_MS = 4_000;

function withinBudget(promise, ms, fallback) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
    if (typeof timer.unref === "function") timer.unref();
  });
  return Promise.race([promise.catch(() => fallback), timeout]).finally(() => clearTimeout(timer));
}

async function datedVoteSlots(slots = [], pair = "XDX/XRP") {
  const rows = (Array.isArray(slots) ? slots : []).map((row) => ({ ...row, pair: row.pair || pair }));
  const accounts = [...new Set(rows.map((row) => String(row.account || "").trim()).filter(Boolean))];
  if (!accounts.length) return rows;
  const lists = await mapLimit(accounts, 3, async (account) => {
    const body = await loadWalletVotes(account).catch(() => ({ activity: [] }));
    return Array.isArray(body?.activity) ? body.activity : [];
  });
  return attachVoteTimestamps(rows, lists.flat());
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
        limit: 80,
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

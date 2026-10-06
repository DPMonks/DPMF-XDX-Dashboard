import { overlayLiveAmmReserves } from "../src/utils/ammInfo.js";
import { swapVolumeFromAccountTx } from "../src/utils/ammSwapVolume.js";
import { xdxPairKey } from "../src/utils/lpVolume.js";
import { accountStillExists, loadLiveAmmReserves, mapLimit, withXrplRetry } from "./liveAmmReserves.js";
import { xrplRpc } from "./xrplBookOffers.js";

const CACHE_MS = 60_000;
const DELETED_MS = 10 * 60_000;
const cache = new Map();

export function resetAmmPoolVolumeCache() {
  cache.clear();
}

async function accountTx(account, options = {}) {
  return withXrplRetry(
    () =>
      xrplRpc(
        "account_tx",
        {
          account,
          ledger_index_min: -1,
          ledger_index_max: -1,
          limit: Number(options.limit) || 200,
          binary: false,
          forward: false,
        },
        { fetchImpl: options.fetchImpl, rpcUrl: options.rpcUrl }
      ),
    {
      retries: Number.isFinite(Number(options.retries)) ? Number(options.retries) : 1,
      waitMs: Number(options.waitMs) || 200,
    }
  );
}

function rememberVolume(byPair, byAmm, pair, amm, vol) {
  if (pair && vol) byPair[pair] = vol;
  if (amm && vol && byAmm instanceof Map) byAmm.set(amm, vol);
}

export async function loadLedgerPoolVolumes(pools = [], options = {}) {
  const now = Number(options.now) || Date.now();
  const list = (Array.isArray(pools) ? pools : []).filter((row) => row?.amm_account);
  const byPair = {};
  const byAmm = options.byAmm instanceof Map ? options.byAmm : null;
  const deleted = options.deleted instanceof Set ? options.deleted : null;
  const deadlineMs = Number(options.deadlineMs) || 0;
  const started = Date.now();
  await mapLimit(list, Number(options.concurrency) || 3, async (row) => {
    if (deadlineMs > 0 && Date.now() - started >= deadlineMs) return;
    const amm = String(row.amm_account).trim();
    const pair = xdxPairKey(row.pool || row.pool_name || row.pair);
    if (!amm || !pair) return;
    const hit = cache.get(amm);
    const ttl = hit?.deleted ? DELETED_MS : CACHE_MS;
    if (hit && now - hit.at < ttl && !options.fresh) {
      if (hit.deleted) {
        deleted?.add(amm);
        return;
      }
      rememberVolume(byPair, byAmm, pair, amm, hit.vol);
      return;
    }
    try {
      const result = await accountTx(amm, options);
      if (result?.error === "actNotFound") {
        cache.set(amm, { at: now, deleted: true, vol: null });
        deleted?.add(amm);
        return;
      }
      if (result?.error) return;
      const counted = swapVolumeFromAccountTx(result.transactions || [], {
        ammAccount: amm,
        now,
      });
      const vol = {
        volume24hXdx: counted.volume24hXdx,
        volume24h: counted.volume24hXdx,
        trades24h: counted.trades24h,
        source: "xrpl-amm",
        complete: counted.complete,
      };
      cache.set(amm, { at: now, vol });
      rememberVolume(byPair, byAmm, pair, amm, vol);
    } catch {
      if (hit?.deleted) {
        deleted?.add(amm);
        return;
      }
      if (hit?.vol) rememberVolume(byPair, byAmm, pair, amm, hit.vol);
    }
  });
  return byPair;
}

export function ledgerVolumeOnPool(pool = {}, vol = null) {
  if (vol && vol.source === "xrpl-amm") {
    const n = Number(vol.volume24hXdx);
    const recorded = Number.isFinite(n) && n > 0 ? n : 0;
    return {
      ...pool,
      volume24h: recorded,
      volume24hXdx: recorded,
      volume24hXrp: null,
      volume7d: recorded > 0 ? pool.volume7d ?? null : null,
      volume7dXdx: recorded > 0 ? pool.volume7dXdx ?? null : null,
      volumeSource: "xrpl-amm",
      volumeLedger: true,
      trades24h: vol.trades24h || 0,
    };
  }
  if (pool?.volumeSource === "xrpl.to") {
    return {
      ...pool,
      volume24h: 0,
      volume24hXdx: 0,
      volume24hXrp: null,
      volume7d: null,
      volume7dXdx: null,
      volumeSource: null,
      volumeLedger: false,
    };
  }
  return pool;
}

function poolAlreadyLive(pool) {
  if (pool?.reserve_source !== "amm_info") return false;
  return (
    Number(pool.reserve_xdx ?? pool.reserve_asset) > 0 ||
    Number(pool.reserve_currency ?? pool.reserve_quote) > 0 ||
    Number(pool.lp_supply) > 0
  );
}

export async function verifyAmmPools(pools = [], options = {}) {
  const list = Array.isArray(pools) ? pools : [];
  const deadlineMs = Number(options.deadlineMs) || 9000;
  const started = Date.now();
  const deleted = [];
  let complete = true;
  const rpcOptions = {
    fetchImpl: options.fetchImpl,
    rpcUrl: options.rpcUrl,
    now: options.now,
    retries: Number.isFinite(Number(options.retries)) ? Number(options.retries) : 0,
    waitMs: Number(options.waitMs) || 200,
  };
  const existenceBudget = Math.min(8_000, deadlineMs || 8_000);
  await mapLimit(
    list.filter((pool) => pool?.amm_account && !poolAlreadyLive(pool)),
    Number(options.existenceConcurrency) || 8,
    async (pool) => {
      if (Date.now() - started >= existenceBudget) {
        complete = false;
        return;
      }
      const account = String(pool.amm_account).trim();
      const exists = await accountStillExists(account, { ...rpcOptions, fresh: options.fresh });
      if (exists === false) deleted.push(account);
    }
  );
  const survivors = list.filter((pool) => !deleted.includes(String(pool?.amm_account || "").trim()));
  const rows = await mapLimit(survivors, Number(options.concurrency) || 3, async (pool) => {
    try {
      const account = String(pool?.amm_account || "").trim();
      if (deadlineMs > 0 && Date.now() - started >= deadlineMs) {
        complete = false;
        return ledgerVolumeOnPool(pool, null);
      }
      if (pool?.reserve_source === "deleted" && account) {
        deleted.push(account);
        return null;
      }
      let next = pool;
      if (account && !poolAlreadyLive(pool)) {
        const read = await loadLiveAmmReserves(
          {
            ammAccount: account,
            pair: pool.pool || pool.pool_name,
            quote: pool.quote,
            issuer: pool.quote_issuer,
            hex: pool.quote_hex,
            fresh: options.fresh,
          },
          rpcOptions
        );
        if (read?.reserve_source === "deleted") {
          deleted.push(read.amm_account || account);
          return null;
        }
        if (read?.reserve_source === "amm_info") {
          const over = overlayLiveAmmReserves(pool, read);
          const xdx = Number(over.reserve_xdx ?? over.reserve_asset);
          const quote = Number(over.reserve_currency ?? over.reserve_quote);
          next = {
            ...over,
            price: xdx > 0 && quote > 0 ? quote / xdx : over.price,
            reserve_source: "amm_info",
          };
        }
      }
      if (!account) return ledgerVolumeOnPool(next, null);
      if (deadlineMs > 0 && Date.now() - started >= deadlineMs) {
        complete = false;
        return ledgerVolumeOnPool(next, null);
      }
      const byAmm = new Map();
      const gone = new Set();
      await loadLedgerPoolVolumes([next], {
        ...rpcOptions,
        fresh: options.fresh,
        byAmm,
        deleted: gone,
        concurrency: 1,
        deadlineMs: 0,
        limit: Number(options.limit) || 200,
      });
      if (gone.has(account)) {
        deleted.push(account);
        return null;
      }
      return ledgerVolumeOnPool(next, byAmm.get(account));
    } catch {
      return ledgerVolumeOnPool(pool, null);
    }
  });
  return { pools: rows.filter(Boolean), deleted_amms: deleted, complete };
}

export function mergeVolumeMaps(...maps) {
  const out = {};
  for (const map of maps) {
    for (const [pair, vol] of Object.entries(map || {})) {
      const key = xdxPairKey(pair);
      const incoming = Number(vol?.volume24hXdx ?? vol?.volume24h) || 0;
      const existing = Number(out[key]?.volume24hXdx) || 0;
      if (incoming > existing) {
        out[key] = {
          volume24hXdx: incoming,
          volume24h: incoming,
          volume24hXrp: vol.volume24hXrp ?? out[key]?.volume24hXrp ?? 0,
          volume24hUsd: vol.volume24hUsd ?? out[key]?.volume24hUsd ?? 0,
          volume7dXdx: vol.volume7dXdx ?? out[key]?.volume7dXdx ?? 0,
          source: vol.source || out[key]?.source || "recorded",
        };
      } else if (!out[key] && vol) {
        out[key] = vol;
      }
    }
  }
  return out;
}

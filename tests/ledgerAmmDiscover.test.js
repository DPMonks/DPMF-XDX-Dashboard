import test from "node:test";
import assert from "node:assert/strict";
import { XDX_HEX, XDX_ISSUER } from "../src/constants/ledger.js";
import { mergeLivePools } from "../server/catalogSwitch.js";
import {
  applyXrplToNames,
  discoverLedgerXdxPools,
  resetLedgerAmmDiscoveryCache,
  withLedgerLiquidity,
  xdxAmmCandidateLines,
} from "../server/ledgerAmmDiscover.js";

const FARM = "rNf1vw3aTxAHJmFBRX2L7PLN8E38WoMme9";
const CREATE = "rLYKyx5ozLUMTVn3JZJhNv5wimSqfT7Y7S";
const CREATE_HEX = "4352454154450000000000000000000000000000";
const CREATE_ISSUER = "rMqZY49eXVxU9rgrHVix7jkLeZcEeni9nU";
const WALLET = "rWalletZeroLimit11111111111111111";
const HOLDER = "rHolderWithLimit11111111111111111";

function rpcFetch(handler) {
  return async (_url, options) => {
    const body = JSON.parse(options.body);
    const result = await handler(body.method, body.params?.[0] || {});
    return { ok: true, json: async () => ({ result }) };
  };
}

test("issuer lines keep zero peer limit balances and skip ordinary holders", () => {
  const rows = xdxAmmCandidateLines([
    { account: HOLDER, currency: "XDX", balance: "-10", limit_peer: "100" },
    { account: WALLET, currency: "XDX", balance: "-5", limit_peer: "0" },
    { account: "rNoRippleWallet111111111111111111", currency: "XDX", balance: "-8", limit_peer: "0", no_ripple_peer: true },
    { account: CREATE, currency: XDX_HEX, balance: "-0.000000002", limit_peer: "0" },
    { account: FARM, currency: "XDX", balance: "0", limit_peer: "0" },
    { account: XDX_ISSUER, currency: "XDX", balance: "-1", limit_peer: "0" },
  ]);
  assert.deepEqual(
    rows.map((row) => row.account),
    [WALLET, CREATE]
  );
});

test("ledger discovery confirms AMM accounts and ignores xrpl.to existence", async () => {
  resetLedgerAmmDiscoveryCache();
  let pages = 0;
  const fetchImpl = rpcFetch((method, params) => {
    if (method === "account_lines") {
      pages += 1;
      if (!params.marker) {
        return {
          lines: [
            { account: HOLDER, currency: "XDX", balance: "-10", limit_peer: "1000000" },
            { account: WALLET, currency: "XDX", balance: "-5", limit_peer: "0" },
          ],
          marker: { page: 2 },
        };
      }
      return {
        lines: [{ account: CREATE, currency: "XDX", balance: "-1987510.98", limit_peer: "0" }],
      };
    }
    if (method === "account_info" && params.account === WALLET) {
      return { account_data: { Account: WALLET, Balance: "1000000" } };
    }
    if (method === "account_info" && params.account === CREATE) {
      return { account_data: { Account: CREATE, Balance: "1000000", AMMID: "ABC" } };
    }
    if (method === "amm_info" && params.amm_account === CREATE) {
      return {
        amm: {
          account: CREATE,
          amount: { currency: "XDX", issuer: XDX_ISSUER, value: "1987510.989658572" },
          amount2: { currency: CREATE_HEX, issuer: CREATE_ISSUER, value: "18537507.15700665" },
          lp_token: { currency: "03C0CFC705BD93B396F7F2062F13B0CE9F14B043", issuer: CREATE, value: "6032172.845570655" },
          trading_fee: 331,
        },
      };
    }
    return { error: "actNotFound", error_message: "Account not found." };
  });
  const found = await discoverLedgerXdxPools({ fetchImpl, fresh: true, now: 1_000 });
  assert.equal(found.complete, true);
  assert.equal(found.source, "xrpl-lines");
  assert.equal(pages, 2);
  assert.deepEqual(
    found.pools.map((row) => row.amm_account),
    [CREATE]
  );
  const create = found.pools[0];
  assert.equal(create.pool, "XDX/CREATE");
  assert.equal(create.reserve_xdx, 1987510.989658572);
  assert.equal(create.reserve_currency, 18537507.15700665);
  assert.equal(create.lp_supply, 6032172.845570655);
  assert.equal(create.trading_fee, 331);
  assert.equal(create.reserve_source, "amm_info");
  assert.equal(create.volumeSource, null);
  const named = applyXrplToNames(found.pools, {
    pools: [
      { ammAccount: CREATE, icon: "https://example.test/create.png", apy24h: { volume: 14.43 } },
      { ammAccount: FARM, icon: "https://example.test/farm.png", currentLiquidity: { asset1Amount: 3090000 } },
    ],
  });
  assert.equal(named.length, 1);
  assert.equal(named[0].icon, "https://example.test/create.png");
  assert.equal(named[0].reserve_xdx, 1987510.989658572);
  assert.equal(named[0].amm_account, CREATE);
  resetLedgerAmmDiscoveryCache();
});

test("a slowDown line read tries the next public node", async () => {
  resetLedgerAmmDiscoveryCache();
  let lines = 0;
  const fetchImpl = rpcFetch((method, params) => {
    if (method === "account_lines") {
      lines += 1;
      if (lines === 1) return { error: "slowDown", status: "error" };
      return { lines: [{ account: CREATE, currency: "XDX", balance: "-2", limit_peer: "0" }] };
    }
    if (method === "account_info" && params.account === CREATE) {
      return { account_data: { Account: CREATE, Balance: "1000000", AMMID: "ABC" } };
    }
    if (method === "amm_info") {
      return {
        amm: {
          account: CREATE,
          amount: { currency: "XDX", issuer: XDX_ISSUER, value: "2" },
          amount2: { currency: CREATE_HEX, issuer: CREATE_ISSUER, value: "4" },
          lp_token: { currency: "03C0CFC705BD93B396F7F2062F13B0CE9F14B043", issuer: CREATE, value: "1" },
          trading_fee: 331,
        },
      };
    }
    return { error: "actNotFound", error_message: "Account not found." };
  });
  const found = await discoverLedgerXdxPools({
    fetchImpl,
    fresh: true,
    now: 5_000,
    lineBudgetMs: 5_000,
  });
  assert.equal(found.complete, true);
  assert.equal(found.pools[0].pool, "XDX/CREATE");
  assert.ok(lines >= 2);
  resetLedgerAmmDiscoveryCache();
});

test("confirmation checks the last issuer lines first so a slow wallet cannot hide an AMM", async () => {
  resetLedgerAmmDiscoveryCache();
  const slow = Array.from({ length: 9 }, (_n, index) => `rSlowWallet${index}1111111111111111111`);
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    const method = body.method;
    const params = body.params?.[0] || {};
    const abort = () =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5_000);
        const onAbort = () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        };
        if (options.signal?.aborted) onAbort();
        else options.signal?.addEventListener("abort", onAbort, { once: true });
      });
    let result;
    if (method === "account_lines" && !params.marker) {
      result = {
        lines: slow.map((account) => ({ account, currency: "XDX", balance: "-5", limit_peer: "0" })),
        marker: { page: 2 },
      };
    } else if (method === "account_lines") {
      result = { lines: [{ account: CREATE, currency: "XDX", balance: "-2", limit_peer: "0" }] };
    } else if (method === "account_info" && params.account === CREATE) {
      result = { account_data: { Account: CREATE, Balance: "1000000", AMMID: "ABC" } };
    } else if (method === "account_info") {
      await abort();
      result = { account_data: { Account: params.account, Balance: "1000000" } };
    } else if (method === "amm_info" && params.amm_account === CREATE) {
      result = {
        amm: {
          account: CREATE,
          amount: { currency: "XDX", issuer: XDX_ISSUER, value: "2" },
          amount2: { currency: CREATE_HEX, issuer: CREATE_ISSUER, value: "4" },
          lp_token: { currency: "03C0CFC705BD93B396F7F2062F13B0CE9F14B043", issuer: CREATE, value: "1" },
          trading_fee: 331,
        },
      };
    } else {
      result = { error: "actNotFound", error_message: "Account not found." };
    }
    return { ok: true, json: async () => ({ result }) };
  };
  const found = await discoverLedgerXdxPools({
    fetchImpl,
    fresh: true,
    now: 9_000,
    confirmBudgetMs: 800,
  });
  assert.equal(found.lines_done, true);
  assert.equal(found.complete, false);
  assert.match(found.error, /confirm left \d+ of 10 after 2 pages/);
  assert.ok(found.pools.some((row) => row.amm_account === CREATE));
  assert.equal(found.pools.find((row) => row.amm_account === CREATE).pool, "XDX/CREATE");
  resetLedgerAmmDiscoveryCache();
});

test("low liquidity uses the XRP value of ledger reserves", () => {
  const [small, deep] = withLedgerLiquidity(
    [
      { pool: "XDX/XRP", quote: "XRP", reserve_currency: 40, reserve_xdx: 1_000_000 },
      { pool: "XDX/CREATE", quote: "CREATE", reserve_currency: 2, reserve_xdx: 10 },
    ],
    { xrpPerXdx: 0.00004 }
  );
  assert.equal(small.low_liquidity, true);
  assert.equal(small.liquidity_xrp, 40);
  assert.equal(deep.low_liquidity, true);
  assert.equal(deep.liquidity_xrp, 0.0004);
});

test("a complete ledger list replaces database pools that are no longer on the ledger", () => {
  const merged = mergeLivePools(
    {
      pools: [
        { pool: "XDX/FARM", amm_account: FARM, reserve_xdx: 3_090_000, volume24h: 420_100 },
        { pool: "XDX/CREATE", amm_account: CREATE, reserve_xdx: 1, volume24h: 420_100 },
      ],
    },
    {
      pool_source: "ledger",
      ledger_complete: true,
      pools: [
        {
          pool: "XDX/CREATE",
          amm_account: CREATE,
          reserve_xdx: 1_987_510,
          volume24h: 0,
          volumeLedger: true,
          reserve_source: "amm_info",
        },
      ],
    }
  );
  assert.deepEqual(
    merged.pools.map((row) => row.amm_account),
    [CREATE]
  );
  assert.equal(merged.pools[0].reserve_xdx, 1_987_510);
  assert.ok(merged.deleted_amms.includes(FARM));
});

import test from "node:test";
import assert from "node:assert/strict";
import { XDX_HEX, XDX_ISSUER } from "../src/constants/ledger.js";
import { mergeLivePools } from "../server/catalogSwitch.js";
import { preferRailwayXdxVolume } from "../src/utils/lpVolume.js";
import {
  ledgerVolumeOnPool,
  resetAmmPoolVolumeCache,
  verifyAmmPools,
} from "../server/ammPoolVolume.js";

const FARM = "rNf1vw3aTxAHJmFBRX2L7PLN8E38WoMme9";
const CREATE = "rLYKyx5ozLUMTVn3JZJhNv5wimSqfT7Y7S";
const CREATE_HEX = "4352454154450000000000000000000000000000";
const CREATE_ISSUER = "rMqZY49eXVxU9rgrHVix7jkLeZcEeni9nU";

function rpcFetch(handler) {
  return async (_url, options) => {
    const body = JSON.parse(options.body);
    const result = await handler(body.method, body.params?.[0] || {});
    if (result?.httpStatus) {
      return { ok: false, status: result.httpStatus, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({ result }) };
  };
}

test("a deleted AMM is dropped and a live AMM keeps ledger reserves and ledger volume", async () => {
  resetAmmPoolVolumeCache();
  const fetchImpl = rpcFetch((method, params) => {
    if (method === "account_info" && params.account === FARM) {
      return { error: "actNotFound", error_message: "Account not found.", status: "error" };
    }
    if (method === "account_info") {
      return { account_data: { Account: params.account, Balance: "10000000" } };
    }
    if (method === "amm_info" && params.amm_account === FARM) {
      return { error: "actMalformed", error_message: "Account malformed.", status: "error" };
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
    if (method === "account_tx" && params.account === CREATE) {
      return {
        transactions: [
          {
            close_time_iso: "2026-10-06T12:00:00.000Z",
            tx: { TransactionType: "Payment" },
            meta: {
              TransactionResult: "tesSUCCESS",
              AffectedNodes: [
                {
                  ModifiedNode: {
                    LedgerEntryType: "RippleState",
                    FinalFields: {
                      Balance: { currency: XDX_HEX, value: "1000" },
                      HighLimit: { issuer: CREATE },
                      LowLimit: { issuer: "rTrader" },
                    },
                    PreviousFields: { Balance: { currency: XDX_HEX, value: "1050" } },
                  },
                },
              ],
            },
          },
        ],
      };
    }
    if (method === "account_tx") return { transactions: [] };
    return { error: "actNotFound", status: "error" };
  });
  const checked = await verifyAmmPools(
    [
      {
        pool: "XDX/FARM",
        quote: "FARM",
        quote_issuer: "rFarmIssuer111111111111111111111",
        amm_account: FARM,
        reserve_xdx: 3_090_000,
        reserve_currency: 24,
        volume24h: 420_100,
        volume24hXdx: 420_100,
        volumeSource: "xrpl.to",
      },
      {
        pool: "XDX/CREATE",
        amm_account: CREATE,
        reserve_xdx: 1,
        reserve_currency: 1,
        volume24h: 420_100,
        volume24hXdx: 420_100,
        volumeSource: "xrpl.to",
      },
    ],
    { fetchImpl, fresh: true, now: Date.parse("2026-10-06T14:00:00.000Z"), retries: 0 }
  );
  assert.deepEqual(
    checked.pools.map((row) => row.pool),
    ["XDX/CREATE"]
  );
  assert.ok(checked.deleted_amms.includes(FARM));
  const create = checked.pools[0];
  assert.equal(create.reserve_xdx, 1987510.989658572);
  assert.equal(create.reserve_currency, 18537507.15700665);
  assert.equal(create.lp_supply, 6032172.845570655);
  assert.equal(create.trading_fee, 331);
  assert.equal(create.volume24h, 50);
  assert.equal(create.volumeLedger, true);
  assert.equal(create.volumeSource, "xrpl-amm");
  assert.notEqual(create.volume24h, 420_100);
  resetAmmPoolVolumeCache();
});

test("a ledger read with no swap in 24h stores 0 instead of xrpl.to volume", () => {
  const stamped = ledgerVolumeOnPool(
    { pool: "XDX/GOTHIC", volume24h: 420_100, volume24hXdx: 420_100, volumeSource: "xrpl.to" },
    { volume24hXdx: 0, trades24h: 0, source: "xrpl-amm", complete: true }
  );
  assert.equal(stamped.volume24h, 0);
  assert.equal(stamped.volumeLedger, true);
  assert.equal(stamped.volumeSource, "xrpl-amm");
});

test("an RPC miss keeps the pool and does not keep xrpl.to volume", async () => {
  resetAmmPoolVolumeCache();
  const checked = await verifyAmmPools(
    [
      {
        pool: "XDX/PHNIX",
        amm_account: "rnKu1We1phnixxxxxxxxxxxxxxxxxx",
        reserve_xdx: 10,
        volume24hXdx: 420_100,
        volumeSource: "xrpl.to",
      },
    ],
    {
      fresh: true,
      retries: 0,
      now: Date.parse("2026-10-06T14:00:00.000Z"),
      fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }),
    }
  );
  assert.equal(checked.pools.length, 1);
  assert.equal(checked.pools[0].pool, "XDX/PHNIX");
  assert.equal(checked.pools[0].volume24h, 0);
  assert.equal(checked.pools[0].volumeSource, null);
  assert.equal(checked.deleted_amms.length, 0);
  resetAmmPoolVolumeCache();
});

test("merge drops a database row once the ledger marks that AMM deleted", () => {
  const merged = mergeLivePools(
    { pools: [{ pool: "XDX/FARM", amm_account: FARM, reserve_xdx: 3_090_000, volume24h: 420_100 }] },
    {
      pools: [{ pool: "XDX/CREATE", amm_account: CREATE, reserve_xdx: 1_987_510, volumeLedger: true, volume24h: 0 }],
      deleted_amms: [FARM],
    }
  );
  assert.deepEqual(
    merged.pools.map((row) => row.pool),
    ["XDX/CREATE"]
  );
});

test("a ledger volume of 0 wins over a larger stored xrpl.to figure", () => {
  const kept = preferRailwayXdxVolume(
    { volume24hXdx: 420_100, volumeSource: "xrpl.to" },
    { volume24h: 0, volume24hXdx: 0, volumeLedger: true, volumeSource: "xrpl-amm" }
  );
  assert.equal(kept.volume24hXdx, 0);
  assert.equal(kept.volumeLedger, true);
});

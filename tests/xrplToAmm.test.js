import test from "node:test";
import assert from "node:assert/strict";
import { formatPoolPrice, poolSpotPrice } from "../src/ammPools.js";
import { XDX_ISSUER } from "../src/constants/ledger.js";
import {
  currencyLabelFromCode,
  findDiscoveredPool,
  liveQueryFromPool,
  mergeDiscoveredXdxPools,
  needsDiscoveredAmmLookup,
  poolsFromXrplToAmm,
  sortPoolsByXdxReserve,
} from "../src/utils/xrplToAmm.js";
import {
  loadXrplToXdxAmmPools,
  resetXrplToXdxAmmCache,
  xrplToAmmListUrl,
} from "../server/xrplToCatalog.js";

const CREATE_HEX = "4352454154450000000000000000000000000000";
const CREATE_AMM = "rLYKyx5ozLUMTVn3JZJhNv5wimSqfT7Y7S";
const CREATE_ISSUER = "rMqZY49eXVxU9rgrHVix7jkLeZcEeni9nU";
const CREATE_LP = "03C0CFC705BD93B396F7F2062F13B0CE9F14B043";
const XDX_RESERVE = 1987510.989658572;
const CREATE_RESERVE = 18537507.15700665;

function createPool() {
  return {
    ammAccount: CREATE_AMM,
    asset1: { currency: "XDX", issuer: XDX_ISSUER },
    asset2: { currency: CREATE_HEX, issuer: CREATE_ISSUER },
    lpTokenCurrency: CREATE_LP,
    tradingFee: 331,
    lpHolderCount: 1,
    tags: ["Active Pool"],
    apy24h: { liquidity: 155.12, volume: 1.5 },
    currentLiquidity: {
      asset1Amount: XDX_RESERVE,
      asset2Amount: CREATE_RESERVE,
      lpTokenBalance: 6032172.845570655,
    },
  };
}

test("40 character currency codes decode to their letter label", () => {
  assert.equal(currencyLabelFromCode(CREATE_HEX), "CREATE");
  assert.equal(currencyLabelFromCode("585250" + "0".repeat(34)), "XRP");
  assert.equal(currencyLabelFromCode("4E657572614C696E6B" + "00".repeat(11)), "NeuraLink");
  assert.equal(currencyLabelFromCode("504F57444552204B4547" + "00".repeat(10)), "POWDER KEG");
  assert.equal(currencyLabelFromCode("2443616D656C546F65" + "00".repeat(11)), "$CamelToe");
  assert.equal(currencyLabelFromCode("666"), "666");
});

test("xrpl.to AMM rows keep XDX/CREATE and low liquidity pools", () => {
  const rows = poolsFromXrplToAmm(
    {
      pools: [
        createPool(),
        {
          ammAccount: "rLowShx",
          asset1: { currency: "SHX", issuer: "rfmS3zqrExampleIssuer1111111111" },
          asset2: { currency: "XDX", issuer: XDX_ISSUER },
          tradingFee: 250,
          tags: ["Low Liquidity"],
          apy24h: { liquidity: 21 },
          currentLiquidity: { asset1Amount: 40, asset2Amount: 1200, lpTokenBalance: 8 },
        },
        {
          ammAccount: "rNotXdx",
          asset1: { currency: "USD", issuer: "rNotXdxIssuer111111111111111" },
          asset2: { currency: "XRP", issuer: "XRPL" },
          currentLiquidity: { asset1Amount: 10, asset2Amount: 10 },
        },
      ],
    },
    { xrpPerXdx: 0.000039, xdxUsd: 0.00006 }
  );
  assert.equal(rows.length, 2);
  const create = rows.find((row) => row.amm_account === CREATE_AMM);
  assert.equal(create.pool, "XDX/CREATE");
  assert.equal(create.quote, "CREATE");
  assert.equal(create.quote_issuer, CREATE_ISSUER);
  assert.equal(create.quote_hex, CREATE_HEX);
  assert.equal(create.lp_currency, CREATE_LP);
  assert.equal(create.reserve_xdx, XDX_RESERVE);
  assert.equal(create.reserve_currency, CREATE_RESERVE);
  assert.equal(create.trading_fee, 331);
  assert.equal(create.low_liquidity, false);
  assert.ok(Math.abs(create.price - CREATE_RESERVE / XDX_RESERVE) < 1e-12);
  assert.ok(create.volume24hXdx > 0);
  const shx = rows.find((row) => row.quote === "SHX");
  assert.equal(shx.low_liquidity, true);
  assert.equal(shx.reserve_xdx, 1200);
  assert.equal(shx.reserve_currency, 40);
});

test("the same quote ticker from two issuers stays two pools", () => {
  const rows = poolsFromXrplToAmm({
    pools: [
      {
        ammAccount: "rUsdAmm1111111111111111111111111",
        asset1: { currency: "XDX", issuer: XDX_ISSUER },
        asset2: { currency: "USD", issuer: "rHubIssuer111111111111111111111" },
        currentLiquidity: { asset1Amount: 10, asset2Amount: 2 },
        tradingFee: 1,
      },
      {
        ammAccount: "rUsdAmm2222222222222222222222222",
        asset1: { currency: "XDX", issuer: XDX_ISSUER },
        asset2: { currency: "USD", issuer: "rOtherIssuer11111111111111111111" },
        currentLiquidity: { asset1Amount: 8, asset2Amount: 1 },
        tradingFee: 12,
      },
    ],
  });
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].pool, rows[1].pool);
  assert.ok(rows.every((row) => row.pool.startsWith("XDX/USD ")));
});

test("discovered pools append XDX/CREATE without replacing a known AMM", () => {
  const merged = mergeDiscoveredXdxPools(
    [{ pool: "XDX/XRP", amm_account: "rXrpAmm", reserve_xdx: 80_000_000, trading_fee: 963 }],
    poolsFromXrplToAmm({ pools: [createPool(), {
      ammAccount: "rXrpAmm",
      asset1: { currency: "XDX", issuer: XDX_ISSUER },
      asset2: { currency: "XRP", issuer: "XRPL" },
      tradingFee: 1,
      apy24h: { liquidity: 10 },
      tags: ["Low Liquidity"],
      currentLiquidity: { asset1Amount: 1, asset2Amount: 1 },
    }] })
  );
  assert.deepEqual(
    merged.map((row) => row.pool),
    ["XDX/XRP", "XDX/CREATE"]
  );
  assert.equal(merged[0].reserve_xdx, 80_000_000);
  assert.equal(merged[0].trading_fee, 963);
  assert.equal(merged[0].low_liquidity, true);
  const sorted = sortPoolsByXdxReserve(merged);
  assert.equal(sorted[0].pool, "XDX/XRP");
  assert.equal(sorted[1].pool, "XDX/CREATE");
});

test("a pair-only live lookup can fill the CREATE AMM account", () => {
  const rows = poolsFromXrplToAmm({ pools: [createPool()] });
  assert.equal(needsDiscoveredAmmLookup("XDX/CREATE"), true);
  assert.equal(needsDiscoveredAmmLookup("XDX/XRP"), false);
  assert.equal(needsDiscoveredAmmLookup("XDX/CREATE", { issuer: CREATE_ISSUER }), false);
  const found = findDiscoveredPool(rows, "CREATE");
  const query = liveQueryFromPool({ pair: "XDX/CREATE" }, found);
  assert.equal(query.ammAccount, CREATE_AMM);
  assert.equal(query.issuer, CREATE_ISSUER);
  assert.equal(query.hex, CREATE_HEX);
});

test("pool price keeps a small XRP rate and the CREATE rate", () => {
  assert.equal(formatPoolPrice(null), "-");
  assert.notEqual(formatPoolPrice(0.00003941), "0");
  assert.match(formatPoolPrice(0.00003941), /0\.000039/);
  const spot = poolSpotPrice({ reserve_asset: XDX_RESERVE, reserve_currency: CREATE_RESERVE });
  assert.ok(Math.abs(spot - CREATE_RESERVE / XDX_RESERVE) < 1e-12);
  assert.match(formatPoolPrice(spot), /^9\.327/);
});

test("the AMM list asks xrpl.to for every XDX pool, including thin ones", async () => {
  assert.match(xrplToAmmListUrl(), /status=all/);
  assert.match(xrplToAmmListUrl(), new RegExp(`issuer=${XDX_ISSUER}`));
  resetXrplToXdxAmmCache();
  const seen = [];
  const rows = await loadXrplToXdxAmmPools({
    fresh: true,
    now: 1,
    xrpPerXdx: 0.000039,
    fetchImpl: async (url) => {
      seen.push(String(url));
      return {
        ok: true,
        json: async () => ({ total: 1, pools: [createPool()] }),
      };
    },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pool, "XDX/CREATE");
  assert.match(seen[0], /\/v1\/amm\?/);
  assert.match(seen[0], /status=all/);
  resetXrplToXdxAmmCache();
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLivePoolReserves,
  compactPoolAmount,
  filterAmmPools,
  isLpPoolTrade,
  mergeAmmPoolLists,
  poolAssetTrustlineId,
  poolQuoteTicker,
  poolSplitMeta,
  searchAmmAccount,
  searchPairHint,
  tradePoolHint,
} from "../src/ammPools.js";
import { XDX_ISSUER, XDX_XRP_AMM, XDX_XRP_LP_HEX, XIO_ISSUER, xdxTrustSetTxjson } from "../src/constants/ledger.js";
import { lpTrustSetTxjson, poolForQuote, quoteTrustSetTxjson, resolveQuote } from "../src/xaman/tradeTx.js";
import { knownLivePoolSpecs } from "../server/liveCatalog.js";

test("AMM pool search matches XDX / quote, pair, or AMM account", () => {
  const pools = [
    { pool: "XDX/XRP", quote: "XRP", amm_account: "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB" },
    { pool: "XDX/RLUSD", quote: "RLUSD", amm_account: "rLbBzF9oxntVf4XxcyakNKJTci4yqSmQUu" },
    { pool: "XDX/PLX", quote: "PLX", amm_account: "rPlxPool" },
  ];
  assert.deepEqual(
    filterAmmPools(pools, "rlusd").map((row) => row.pool),
    ["XDX/RLUSD"]
  );
  assert.deepEqual(
    filterAmmPools(pools, "XDX / plx").map((row) => row.pool),
    ["XDX/PLX"]
  );
  assert.deepEqual(
    filterAmmPools(pools, "rhEwhut").map((row) => row.pool),
    ["XDX/XRP"]
  );
  assert.equal(filterAmmPools(pools, "").length, 3);
});

test("searchPairHint turns a quote ticker into an XDX pair", () => {
  assert.equal(searchPairHint("usdc"), "XDX/USDC");
  assert.equal(searchPairHint("xdx / xio"), "XDX/XIO");
  assert.equal(searchPairHint("rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB"), "");
  assert.equal(searchAmmAccount("rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB"), "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB");
});

test("mergeAmmPoolLists keeps a newly found live pool beside the catalog", () => {
  const merged = mergeAmmPoolLists(
    [{ pool: "XDX/XRP", amm_account: "rXrp" }],
    [{ pool: "XDX/USDC", amm_account: "rUsdc" }],
    [{ pool: "XDX/XRP", amm_account: "rXrp" }]
  );
  assert.deepEqual(
    merged.map((row) => row.pool),
    ["XDX/XRP", "XDX/USDC"]
  );
});

test("XRP pools use an XDX trustline; other pools use the quote asset", () => {
  assert.equal(poolAssetTrustlineId({ pool: "XDX/XRP", quote: "XRP" }), "XDX");
  assert.equal(poolAssetTrustlineId({ pool: "XDX/XIO", quote: "XIO" }), "XIO");
  assert.equal(poolAssetTrustlineId({ pool: "XDX/RLUSD" }), "RLUSD");
  assert.equal(poolQuoteTicker({ pool: "XDX/USDC" }), "USDC");
  const xdxLine = xdxTrustSetTxjson("rA");
  assert.equal(xdxLine.LimitAmount.issuer, XDX_ISSUER);
  const xio = resolveQuote("XIO", { quote_issuer: XIO_ISSUER });
  assert.equal(quoteTrustSetTxjson("rA", xio).LimitAmount.issuer, XIO_ISSUER);
  const xrpPool = { pool: "XDX/XRP", quote: "XRP", amm_account: XDX_XRP_AMM, lp_currency: XDX_XRP_LP_HEX };
  const lp = lpTrustSetTxjson("rA", poolForQuote(resolveQuote("XRP"), [xrpPool], xrpPool));
  assert.equal(lp.LimitAmount.issuer, XDX_XRP_AMM);
  assert.equal(lp.LimitAmount.currency, XDX_XRP_LP_HEX);
});

test("compact pool amounts and 1 LP shares fit the ratio box", () => {
  assert.equal(compactPoolAmount(51709564.3635), "51.71M");
  assert.equal(compactPoolAmount(52421.3323), "52.42K");
  assert.equal(compactPoolAmount(0.5403), "0.5403");
  const meta = poolSplitMeta({
    reserve_asset: 51709564.3635,
    reserve_currency: 52421.3323,
    lp_supply: 52421.3323,
  });
  assert.ok(Math.abs(meta.xdxPerLp - 51709564.3635 / 52421.3323) < 1e-9);
  assert.equal(meta.quotePerLp, 1);
  assert.equal(meta.lpSupply, 52421.3323);
});

test("live amm_info updates the ratio box after an LP deposit or withdraw", () => {
  const catalog = {
    pool: "XDX/XIO",
    reserve_asset: 40000000,
    reserve_currency: 80000,
    lp_supply: 40000,
    xdx_pct: 50,
    quote_pct: 50,
  };
  const live = {
    reserve_xdx: 51709564.3635,
    reserve_currency: 52421.3323,
    lp_supply: 52421.3323,
    reserve_source: "amm_info",
  };
  const next = applyLivePoolReserves(catalog, live);
  assert.equal(next.reserve_asset, 51709564.3635);
  assert.equal(next.reserve_currency, 52421.3323);
  assert.equal(next.lp_supply, 52421.3323);
  assert.ok(next.xdx_pct > 99);
  assert.ok(next.quote_pct < 1);
  assert.equal(isLpPoolTrade({ trade: { action: "addLp", pair: "XDX/XIO" } }), true);
  assert.equal(isLpPoolTrade({ txjson: { TransactionType: "AMMWithdraw" } }), true);
  assert.equal(isLpPoolTrade({ trade: { action: "buy" } }), false);
  assert.equal(tradePoolHint({ trade: { pair: "XDX/XIO" } }), "XDX/XIO");
});

test("known live pool specs include featured XDX quotes, not only XRP and RLUSD", () => {
  const pairs = knownLivePoolSpecs().map((row) => row.pair);
  assert.ok(pairs.includes("XDX/XRP"));
  assert.ok(pairs.includes("XDX/RLUSD"));
  assert.ok(pairs.includes("XDX/XIO"));
  assert.ok(pairs.includes("XDX/XSQUAD"));
});

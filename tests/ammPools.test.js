import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLivePoolReserves,
  applySignedLpOwner,
  applyTradePoolReserves,
  applyTradePoolVolume,
  looksLikeLpAsQuote,
  rememberPoolVolume,
  rememberSignedLpOverlay,
  resetHeldPoolVolumes,
  rollingPoolVolume,
  compactPoolAmount,
  filterAmmPools,
  isLpPoolTrade,
  mergeAmmPoolLists,
  poolAssetTrustlineId,
  poolQuoteTicker,
  poolSplitMeta,
  searchAmmAccount,
  searchPairHint,
  signedLpAccount,
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
    reserve_currency: 59.8319,
    lp_supply: 44896.6467,
  });
  assert.ok(Math.abs(meta.xdxPerLp - 51709564.3635 / 44896.6467) < 1e-9);
  assert.ok(Math.abs(meta.quotePerLp - 59.8319 / 44896.6467) < 1e-9);
  assert.equal(meta.lpSupply, 44896.6467);
  const leaked = poolSplitMeta({
    pool: "XDX/XIO",
    quote: "XIO",
    reserve_asset: 51709564.3635,
    reserve_currency: 56027.4283,
    lp_supply: 56027.4283,
  });
  assert.equal(leaked.reserveQuote, null);
  assert.equal(looksLikeLpAsQuote({
    reserveXdx: 63_105_563,
    reserveQuote: 220_406_408,
    lpSupply: 220_406_408,
    quote: "XRP",
  }), true);
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
    reserve_currency: 59.8319,
    lp_supply: 44896.6467,
    reserve_source: "amm_info",
  };
  const next = applyLivePoolReserves(catalog, live);
  assert.equal(next.reserve_asset, 51709564.3635);
  assert.equal(next.reserve_currency, 59.8319);
  assert.equal(next.lp_supply, 44896.6467);
  assert.ok(next.xdx_pct > 99);
  assert.ok(next.quote_pct < 1);
  const leakedLive = applyLivePoolReserves(catalog, {
    reserve_xdx: 51709564.3635,
    reserve_currency: 56027.4283,
    lp_supply: 56027.4283,
    reserve_source: "amm_info",
  });
  assert.equal(leakedLive.reserve_currency, 80000);
  const leakedCatalog = applyLivePoolReserves(
    {
      pool: "XDX/XIO",
      quote: "XIO",
      reserve_asset: 51709564.3635,
      reserve_currency: 56027.4283,
      lp_supply: 56027.4283,
    },
    {
      reserve_xdx: 51709564.3635,
      reserve_currency: 56027.4283,
      lp_supply: 56027.4283,
      reserve_source: "amm_info",
    }
  );
  assert.equal(leakedCatalog.reserve_currency, null);
  assert.equal(isLpPoolTrade({ trade: { action: "addLp", pair: "XDX/XIO" } }), true);
  assert.equal(isLpPoolTrade({ txjson: { TransactionType: "AMMWithdraw" } }), true);
  assert.equal(isLpPoolTrade({ trade: { action: "buy" } }), false);
  assert.equal(tradePoolHint({ trade: { pair: "XDX/XIO" } }), "XDX/XIO");
});

test("add or remove LP updates the card from the signed amounts immediately", () => {
  const pool = {
    pool: "XDX/XIO",
    quote: "XIO",
    reserve_asset: 1000,
    reserve_currency: 40,
    lp_supply: 200,
  };
  const added = applyTradePoolReserves(pool, {
    trade: { action: "addLp", pair: "XDX/XIO", amount: 100, quoteQty: 4, lpOut: 20 },
  });
  assert.equal(added.reserve_asset, 1100);
  assert.equal(added.reserve_currency, 44);
  assert.equal(added.lp_supply, 220);
  const removed = applyTradePoolReserves(added, {
    trade: { action: "removeLp", pair: "XDX/XIO", withdraw: { base: 50, quote: 2 }, lpAmount: 10 },
  });
  assert.equal(removed.reserve_asset, 1050);
  assert.equal(removed.reserve_currency, 42);
  assert.equal(removed.lp_supply, 210);
  const leaked = applyTradePoolReserves(
    {
      pool: "XDX/XIO",
      quote: "XIO",
      reserve_asset: 51_709_564.3635,
      reserve_currency: 56027.4283,
      lp_supply: 56027.4283,
    },
    { trade: { action: "addLp", pair: "XDX/XIO", amount: 100, quoteQty: 4, lpOut: 20 } }
  );
  assert.equal(leaked.reserve_currency, 4);
  assert.equal(leaked.lp_supply, 56047.4283);
});

test("rolling 24h volume keeps the last positive total when a refresh drops to 0", () => {
  resetHeldPoolVolumes();
  assert.equal(rollingPoolVolume(10_645_018, 0), 10_645_018);
  assert.equal(rollingPoolVolume(0, 10_645_018), 10_645_018);
  assert.equal(rollingPoolVolume(null, 2_000), 2_000);
  assert.equal(rollingPoolVolume(12_000, 10_000), 12_000);
  assert.equal(rollingPoolVolume(0, 0), 0);
  assert.equal(rememberPoolVolume("XDX/XRP", 10_645_018, 0), 10_645_018);
  assert.equal(rememberPoolVolume("XDX/XRP", 0, 0), 10_645_018);
  assert.equal(rememberPoolVolume("XDX/XRP", 11_000_000, 0), 11_000_000);
  resetHeldPoolVolumes();
});

test("a signed buy or sell adds XDX to that pool's 24h volume immediately", () => {
  const pool = { pool: "XDX/XIO", volume24h: 100 };
  const bought = applyTradePoolVolume(pool, { trade: { action: "buy", pair: "XDX/XIO", amount: 50 } });
  assert.equal(bought.volume24h, 150);
  assert.equal(bought.volumeUnit, "xdx");
  const other = applyTradePoolVolume(pool, { trade: { action: "buy", pair: "XDX/XRP", amount: 50 } });
  assert.equal(other.volume24h, 100);
  const fresh = applyTradePoolVolume({ pool: "XDX/NEWS" }, { trade: { action: "sell", pair: "XDX/NEWS", amount: 25 } });
  assert.equal(fresh.volume24h, 25);
});

test("a signed add LP paints the owner on that pair immediately", () => {
  const detail = {
    account: "rDPMFBANKMexTKkC7e4Add",
    trade: { action: "addLp", pair: "XDX/XAH", lpOut: 12.5 },
  };
  assert.equal(signedLpAccount(detail), "rDPMFBANKMexTKkC7e4Add");
  const added = applySignedLpOwner(
    [
      { account: "rWhale", pair: "XDX/XAH", lp_balance: 100, rank: 1 },
      { account: "rOther", pair: "XDX/XRP", lp_balance: 50, rank: 2 },
    ],
    detail
  );
  const row = added.find((item) => item.account === "rDPMFBANKMexTKkC7e4Add");
  assert.equal(row.pair, "XDX/XAH");
  assert.equal(row.lp_balance, 12.5);
  assert.equal(row.live, true);
  assert.equal(row.rank, 3);

  const bumped = applySignedLpOwner(added, {
    account: "rDPMFBANKMexTKkC7e4Add",
    trade: { action: "addLp", pair: "XDX/XAH", lpOut: 5 },
  });
  assert.equal(
    bumped.find((item) => item.account === "rDPMFBANKMexTKkC7e4Add").lp_balance,
    17.5
  );

  const held = applySignedLpOwner(bumped, {
    account: "rDPMFBANKMexTKkC7e4Add",
    trade: { action: "addLp", pair: "XDX/XAH", lpOut: 1 },
    lpHeld: 37.41657387,
  });
  assert.equal(
    held.find((item) => item.account === "rDPMFBANKMexTKkC7e4Add").lp_balance,
    37.41657387
  );

  const removed = applySignedLpOwner(held, {
    account: "rDPMFBANKMexTKkC7e4Add",
    trade: { action: "removeLp", pair: "XDX/XAH", lpAmount: 37.41657387 },
  });
  assert.equal(
    removed.some((item) => item.account === "rDPMFBANKMexTKkC7e4Add"),
    false
  );
  assert.equal(
    applySignedLpOwner(held, { trade: { action: "buy", pair: "XDX/XAH", amount: 10 } }, "rSkip")
      .find((item) => item.account === "rDPMFBANKMexTKkC7e4Add").lp_balance,
    37.41657387
  );

  const remembered = rememberSignedLpOverlay(
    [{ account: "rWhale", pair: "XDX/XAH", lp_balance: 100 }],
    detail
  );
  assert.equal(remembered.overlay.detail.lpHeld, 12.5);
  assert.equal(remembered.overlay.account, "rDPMFBANKMexTKkC7e4Add");
});

test("known live pool specs include featured XDX quotes, not only XRP and RLUSD", () => {
  const pairs = knownLivePoolSpecs().map((row) => row.pair);
  assert.ok(pairs.includes("XDX/XRP"));
  assert.ok(pairs.includes("XDX/RLUSD"));
  assert.ok(pairs.includes("XDX/XIO"));
  assert.ok(pairs.includes("XDX/XSQUAD"));
  const squad = knownLivePoolSpecs().find((row) => row.pair === "XDX/XSQUAD");
  assert.equal(squad.ammAccount || squad.amm, "rwpht3XDGMhzYmT5V6ZyMyg6Uc37XFLSwv");
});

test("known live pool specs keep dollar and spaced on-ledger quote names", () => {
  const specs = knownLivePoolSpecs([
    {
      pair: "XDX/$CAMELTOE",
      quote: "$CAMELTOE",
      ammAccount: "rB6NGNJi2XMvYhubxN3SaJGrFKE2SBYh3N",
      issuer: "rM1BJWAQ3hfCStboh4wCXTnGyHqcAvJZy3",
      hex: "2443616D656C546F650000000000000000000000",
    },
    {
      pair: "XDX/POWDERKEG",
      quote: "POWDERKEG",
      amm_account: "rDuJ2NF7kAvioLhy2DfqSevnYhARfoj84y",
    },
  ]);
  const pairs = specs.map((row) => row.pair);
  assert.ok(pairs.includes("XDX/$CAMELTOE"));
  assert.ok(pairs.includes("XDX/POWDERKEG"));
  assert.equal(
    specs.find((row) => row.pair === "XDX/$CAMELTOE").ammAccount,
    "rB6NGNJi2XMvYhubxN3SaJGrFKE2SBYh3N"
  );
});

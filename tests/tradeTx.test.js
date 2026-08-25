import test from "node:test";
import assert from "node:assert/strict";
import {
  pairFromRow,
  RLUSD_HEX,
  RLUSD_ISSUER,
  TF_SET_NO_RIPPLE,
  XDX_ISSUER,
  XDX_RLUSD_AMM,
  XDX_RLUSD_LP_HEX,
  XDX_XRP_AMM,
  XDX_XRP_LP_HEX,
} from "../src/constants/ledger.js";
import {
  MARKET_SLIPPAGE,
  TF_LP_TOKEN,
  TF_ONE_ASSET_LP_TOKEN,
  TF_ONE_ASSET_WITHDRAW_ALL,
  TF_PARTIAL_PAYMENT,
  TF_SINGLE_ASSET,
  TF_TWO_ASSET,
  ammDepositTx,
  ammWithdrawTx,
  expectedLpTokens,
  expectedSingleLpTokens,
  expectedSingleWithdraw,
  expectedWithdraw,
  executionBelongsToOpenTrade,
  executionClosesTradeAction,
  gateUnsignedTrade,
  hasLpRow,
  hasLpTrustline,
  hasQuoteTrustline,
  lpTrustSetTxjson,
  normalizeTradeRequest,
  offerCreateBuyXdx,
  offerCreateSellXdx,
  poolForQuote,
  quoteHintsFromLines,
  quoteAsset,
  quoteIdFromPair,
  quoteTrustSetTxjson,
  shouldAskLpTrustline,
  shouldAskQuoteTrustline,
  recommendedQuote,
  resolveQuote,
  predictedQuoteOut,
  predictedXdxFromQuote,
  quoteUnitUsd,
  depositValueSplit,
  formatLinkedQty,
  linkedDepositAmounts,
  saneOpposingReserve,
  lpHeldForPair,
  sanitizeQtyInput,
  tradeSides,
  visibleQuoteQty,
  xdxUnitUsd,
  tradeTotal,
  xrpDrops,
  xrplIssuedFloor,
  xrplIssuedValue,
} from "../src/xaman/tradeTx.js";

test("market buy is a self Payment that spends SendMax XRP for XDX", () => {
  const tx = offerCreateBuyXdx({
    account: "rBuyer",
    quote: quoteAsset("XRP"),
    xdx: "1000",
    cost: 2.5,
    market: true,
  });
  assert.equal(tx.TransactionType, "Payment");
  assert.equal(tx.Account, "rBuyer");
  assert.equal(tx.Destination, "rBuyer");
  assert.equal(tx.Amount.currency, "XDX");
  assert.equal(tx.Amount.issuer, XDX_ISSUER);
  assert.equal(tx.Amount.value, "1000");
  assert.equal(tx.SendMax, xrpDrops(2.5 * (1 + MARKET_SLIPPAGE)));
  assert.equal(tx.Flags, TF_PARTIAL_PAYMENT);
  assert.equal(tx.TakerPays, undefined);
});

test("limit buy XDX still rests an OfferCreate on the DEX book", () => {
  const tx = offerCreateBuyXdx({
    account: "rBuyer",
    quote: quoteAsset("XRP"),
    xdx: "1000",
    cost: 2.5,
  });
  assert.equal(tx.TransactionType, "OfferCreate");
  assert.equal(tx.TakerPays.value, "1000");
  assert.equal(tx.TakerGets, xrpDrops(2.5));
  assert.equal(tx.Flags, undefined);
});

test("market sell is a self Payment that sends XDX for the quote", () => {
  const tx = offerCreateSellXdx({
    account: "rSeller",
    quote: quoteAsset("XRP"),
    xdx: "500",
    proceeds: 1,
    market: true,
  });
  assert.equal(tx.TransactionType, "Payment");
  assert.equal(tx.SendMax.currency, "XDX");
  assert.equal(tx.SendMax.value, "500");
  assert.equal(tx.Amount, xrpDrops(1 * (1 - MARKET_SLIPPAGE)));
  assert.equal(tx.Flags, TF_PARTIAL_PAYMENT);
});

test("sell XDX for RLUSD is a limit OfferCreate", () => {
  const tx = offerCreateSellXdx({
    account: "rSeller",
    quote: quoteAsset("RLUSD"),
    xdx: "500",
    proceeds: 4,
  });
  assert.equal(tx.TakerGets.currency, "XDX");
  assert.equal(tx.TakerPays.currency, RLUSD_HEX);
  assert.equal(tx.TakerPays.issuer, RLUSD_ISSUER);
  assert.equal(tx.TakerPays.value, "4");
  assert.equal(tx.Flags, undefined);
});

test("AMM deposit and withdraw follow XRPL two-asset / LP token flags", () => {
  const add = ammDepositTx({
    account: "rLp",
    quote: quoteAsset("XRP"),
    xdx: "10000",
    quoteQty: 3,
  });
  assert.equal(add.TransactionType, "AMMDeposit");
  assert.equal(add.Flags, TF_TWO_ASSET);
  assert.deepEqual(add.Asset2, { currency: "XRP" });
  assert.equal(add.Amount.value, "10000");
  assert.equal(add.Amount2, "3000000");
  const messy = ammDepositTx({
    account: "rLp",
    quote: quoteAsset("XRP"),
    xdx: "319.53677886150104",
    quoteQty: 0.01,
  });
  assert.equal(messy.Amount.value, "319.53677886");
  assert.equal(messy.Amount2, "10000");
  assert.equal(/[eE]/.test(messy.Amount.value), false);
  assert.equal(xrplIssuedValue(1.23e-7), "0.000000123");

  const singleXdx = ammDepositTx({
    account: "rLp",
    quote: quoteAsset("XRP"),
    xdx: "250",
    mode: "single",
    singleAsset: "xdx",
  });
  assert.equal(singleXdx.Flags, TF_SINGLE_ASSET);
  assert.equal(singleXdx.Amount.value, "250");
  assert.equal(singleXdx.Amount2, undefined);

  const singleXrp = ammDepositTx({
    account: "rLp",
    quote: quoteAsset("XRP"),
    quoteQty: "0.5",
    mode: "single",
    singleAsset: "quote",
  });
  assert.equal(singleXrp.Flags, TF_SINGLE_ASSET);
  assert.equal(singleXrp.Amount, "500000");
  assert.equal(singleXrp.Amount2, undefined);
  assert.equal(expectedSingleLpTokens(100, 1000, 500), 500 * (Math.sqrt(1.1) - 1));
  assert.equal(expectedSingleLpTokens(0, 1000, 500), 0);

  const take = ammWithdrawTx({
    account: "rLp",
    quote: quoteAsset("XRP"),
    lpAmount: "12.5",
  });
  assert.equal(take.TransactionType, "AMMWithdraw");
  assert.equal(take.Flags, TF_LP_TOKEN);
  assert.equal(take.LPTokenIn.issuer, XDX_XRP_AMM);
  assert.equal(take.LPTokenIn.currency, XDX_XRP_LP_HEX);
  assert.equal(take.LPTokenIn.value, "12.5");
  assert.equal(take.Amount, undefined);

  assert.ok(Math.abs(expectedSingleWithdraw(20, 1000, 200) - 190) < 1e-9);
  assert.equal(expectedSingleWithdraw(0, 1000, 200), 0);
  assert.equal(expectedSingleWithdraw(200, 1000, 200), 1000);
  assert.ok(expectedSingleWithdraw(20, 1000, 200, 1000) < 190);
  assert.ok(expectedSingleWithdraw(20, 1000, 200, 1000) > 0);

  const takeXdx = ammWithdrawTx({
    account: "rLp",
    quote: quoteAsset("XRP"),
    lpAmount: "20",
    mode: "single",
    singleAsset: "xdx",
    amountOut: 190,
  });
  assert.equal(TF_ONE_ASSET_LP_TOKEN, 2_097_152);
  assert.equal(TF_ONE_ASSET_WITHDRAW_ALL, 262_144);
  assert.notEqual(TF_ONE_ASSET_LP_TOKEN, TF_ONE_ASSET_WITHDRAW_ALL);
  assert.equal(takeXdx.Flags, TF_ONE_ASSET_LP_TOKEN);
  assert.equal(takeXdx.Amount.value, "0");
  assert.equal(takeXdx.Amount.currency, "XDX");
  assert.equal(takeXdx.Amount2, undefined);
  assert.equal(takeXdx.LPTokenIn.value, "20");

  const takeXrp = ammWithdrawTx({
    account: "rLp",
    quote: quoteAsset("XRP"),
    lpAmount: "20.00000000000012",
    mode: "single",
    singleAsset: "quote",
    amountOut: 10,
  });
  assert.equal(takeXrp.Flags, TF_ONE_ASSET_LP_TOKEN);
  assert.equal(takeXrp.Amount, "0");
  assert.equal(takeXrp.Amount2, undefined);
  assert.equal(takeXrp.LPTokenIn.value, "20");
  assert.ok(Number(xrplIssuedFloor("4383.261913114705")) <= 4383.261913114705);

  assert.deepEqual(
    tradeSides({
      action: "removeLp",
      lpAmount: 20,
      quoteLabel: "XRP",
      withdraw: { base: 190, quote: 0 },
      singleAsset: "xdx",
    }),
    {
      pay: [{ value: 20, asset: "LP" }],
      receive: [{ value: 190, asset: "XDX" }],
    }
  );
});

test("RLUSD needs a trustline; XRP does not", () => {
  assert.equal(quoteTrustSetTxjson("rA", quoteAsset("XRP")), null);
  const line = quoteTrustSetTxjson("rA", quoteAsset("RLUSD"));
  assert.equal(line.TransactionType, "TrustSet");
  assert.equal(line.LimitAmount.issuer, RLUSD_ISSUER);
  assert.equal(line.LimitAmount.currency, RLUSD_HEX);
  assert.notEqual(line.LimitAmount.currency, "RLUSD");
});

test("LP TrustSet uses the pool LP hex and AMM account", () => {
  const xrp = lpTrustSetTxjson("rLp", poolForQuote(quoteAsset("XRP")));
  assert.equal(xrp.TransactionType, "TrustSet");
  assert.equal(xrp.Flags, TF_SET_NO_RIPPLE);
  assert.equal(xrp.LimitAmount.currency, XDX_XRP_LP_HEX);
  assert.equal(xrp.LimitAmount.issuer, XDX_XRP_AMM);
  assert.equal(xrp.LimitAmount.value, "100000000000");
  const catalog = poolForQuote(quoteAsset("XIO"), [
    {
      pool: "XDX/XIO",
      amm_account: "rXioAmm",
      lp_currency: "03AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    },
  ]);
  assert.equal(catalog.amm, "rXioAmm");
  assert.equal(catalog.lpCurrency, "03AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  const rlusd = poolForQuote(quoteAsset("RLUSD"));
  assert.equal(rlusd.amm, XDX_RLUSD_AMM);
  assert.equal(rlusd.lpCurrency, XDX_RLUSD_LP_HEX);
  assert.equal(poolForQuote(quoteAsset("XIO")).amm, null);
  const liveXio = poolForQuote(quoteAsset("XIO"), [], {
    pair: "XDX/XIO",
    amm_account: "rDJXzsZGACeHGJQYfaudsYshaC5zJxqsHr",
    lp_currency: "03E7A465A6E95CDA21E1110056AA51A71FA55CB9",
  });
  assert.equal(liveXio.amm, "rDJXzsZGACeHGJQYfaudsYshaC5zJxqsHr");
  assert.equal(liveXio.lpCurrency, "03E7A465A6E95CDA21E1110056AA51A71FA55CB9");
  const badCatalog = poolForQuote(quoteAsset("RLUSD"), [
    {
      pool: "XDX/RLUSD",
      amm_account: XDX_RLUSD_AMM,
      lp_currency: "RLUSD",
    },
  ]);
  assert.equal(badCatalog.lpCurrency, XDX_RLUSD_LP_HEX);
  assert.equal(lpTrustSetTxjson("rLp", { amm: XDX_RLUSD_AMM, lpCurrency: "RLUSD" }), null);
});

test("hasLpTrustline matches the pool LP line, not a quote IOU", () => {
  const spec = poolForQuote(quoteAsset("XRP"));
  assert.equal(hasLpTrustline([], spec), false);
  assert.equal(
    hasLpTrustline(
      [{ currency: "XIO", issuer: "rXio", ticker: "XIO" }],
      spec
    ),
    false
  );
  assert.equal(
    hasLpTrustline(
      [{ currency: XDX_XRP_LP_HEX, issuer: XDX_XRP_AMM, ticker: "LP", lp: true }],
      spec
    ),
    true
  );
  assert.equal(
    hasLpTrustline([{ lp: true, issuer: XDX_XRP_AMM, ticker: "LP" }], spec),
    true
  );
  const rlusd = quoteAsset("RLUSD");
  assert.equal(
    hasQuoteTrustline(
      [{ currency: RLUSD_HEX, issuer: RLUSD_ISSUER, ticker: "RLUSD" }],
      rlusd
    ),
    true
  );
  assert.equal(hasQuoteTrustline([], rlusd), false);
  const held = [{ pool: "XDX/RLUSD", pool_name: "XDX/RLUSD", lp_balance: 4383 }];
  assert.equal(lpHeldForPair(held, "XDX/RLUSD", "RLUSD") > 0, true);
  assert.equal(
    shouldAskLpTrustline({
      loaded: false,
      haveLine: false,
      spec: poolForQuote(rlusd),
    }),
    false
  );
  assert.equal(
    shouldAskLpTrustline({
      loaded: true,
      haveLine: true,
      spec: poolForQuote(rlusd),
    }),
    false
  );
  assert.equal(
    shouldAskLpTrustline({
      loaded: true,
      haveLine: false,
      spec: poolForQuote(rlusd),
    }),
    true
  );
  assert.equal(
    shouldAskQuoteTrustline({ loaded: true, haveLine: false, haveLp: true, quote: rlusd }),
    false
  );
  assert.equal(
    shouldAskQuoteTrustline({ loaded: true, haveLine: false, haveLp: false, quote: rlusd }),
    true
  );
});

test("non-XRP pools keep their own LP identity and read hex trustlines", () => {
  const usdc = resolveQuote("USDC");
  assert.equal(usdc.issuer, null);
  assert.notEqual(poolForQuote(usdc).amm, XDX_XRP_AMM);
  const usdcPool = {
    pool: "XDX/USDC",
    quote: "USDC",
    amm_account: "rUsdcAmm11111111111111111111111111",
    lp_currency: "03CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  };
  const usdcSpec = poolForQuote(usdc, [usdcPool]);
  assert.equal(usdcSpec.amm, usdcPool.amm_account);
  assert.equal(usdcSpec.lpCurrency, usdcPool.lp_currency);
  const usdcHex = "5553444300000000000000000000000000000000";
  assert.equal(
    hasLpTrustline(
      [{ currency: `0x${usdcPool.lp_currency.toLowerCase()}`, issuer: usdcPool.amm_account }],
      usdcSpec
    ),
    true
  );
  assert.equal(
    hasQuoteTrustline([{ currency: usdcHex, issuer: "rUsdcIssuer", ticker: "USDC" }], {
      ...usdc,
      issuer: "rUsdcIssuer",
    }),
    true
  );
  const hinted = quoteHintsFromLines(
    [{ currency: usdcHex, issuer: "rUsdcIssuer", ticker: "USDC", balance: "40" }],
    usdc
  );
  assert.equal(hinted.issuer, "rUsdcIssuer");
  assert.equal(hinted.hex, usdcHex);

  const rlusdSpec = poolForQuote(quoteAsset("RLUSD"));
  assert.equal(
    hasLpTrustline(
      [{ currency: `0x${XDX_RLUSD_LP_HEX.toLowerCase()}`, account: XDX_RLUSD_AMM }],
      rlusdSpec
    ),
    true
  );
  assert.equal(
    hasLpTrustline([{ currency: "03DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD", issuer: XDX_RLUSD_AMM }], rlusdSpec),
    true
  );
  assert.equal(hasLpRow([{ pool: "XDX/RLUSD", lp_balance: 0 }], "XDX/RLUSD", "RLUSD", rlusdSpec), true);

  const bitx = resolveQuote("BITX", { quote: "Bitx", amm: "rBitxAmm", lp_currency: "03BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" });
  assert.equal(poolForQuote(bitx).amm, "rBitxAmm");
  assert.equal(normalizeTradeRequest({ action: "addLp", pair: "XDX/USDC", amm: "rAmm", lp_currency: "03AA" }).amm, "rAmm");
});

test("totals and LP hints stay simple numbers", () => {
  assert.equal(tradeTotal("1000", "0.002"), 2);
  assert.equal(recommendedQuote(100, 1000, 50), 5);
  assert.equal(expectedLpTokens(100, 1000, 200), 20);
  assert.deepEqual(expectedWithdraw(20, 1000, 50, 200), { base: 100, quote: 5 });
});

test("remove LP quote preview follows the live pool share, not a cross-market mark", () => {
  // Live XDX/XIO: 52.3M XDX / 59.94 XIO / 44936.65 LP.
  const live = expectedWithdraw(
    4493.664667926788,
    52286366.55495586,
    59.93807084355173,
    44936.64667926788
  );
  assert.ok(Math.abs(live.base - 5228636.655495586) < 1e-6);
  assert.ok(Math.abs(live.quote - 5.993807084355173) < 1e-9);
  assert.ok(Math.abs(saneOpposingReserve(100000, 86.9, 0.000002) - 0.2) < 1e-9);
  const leftover = expectedWithdraw(20, 100000, 86.9, 200, {
    price: 0.000002,
    preferMark: true,
  });
  assert.equal(leftover.base, 10000);
  assert.ok(Math.abs(leftover.quote - 8.69) < 1e-9);
  const missing = expectedWithdraw(20, 100000, 0, 200, {
    price: 0.000002,
    preferMark: true,
  });
  assert.ok(Math.abs(missing.quote - 0.02) < 1e-9);
});

test("opening add LP from a pool card keeps that pair", () => {
  assert.equal(quoteIdFromPair("XDX/XIO"), "XIO");
  assert.equal(lpHeldForPair([{ pool: "XDX/XRP", lp_balance: 12.5 }], "XDX/XRP", "XRP"), 12.5);
  assert.equal(lpHeldForPair([{ pool_name: "XDX/PLX", lp: 3 }], "XDX/PLX", "PLX"), 3);
  assert.equal(lpHeldForPair([], "XDX/XRP", "XRP"), 0);
});

test("remove LP held tokens stay on the selected pair, not another LP line", () => {
  const xsquadHex = "03AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const xsquadAmm = "rXsquadAmm11111111111111111111111";
  const mixed = [
    {
      pool: "XDX/XRP",
      pool_name: "XDX/XRP",
      quote: "XSQUAD",
      lp_balance: 8888,
      amm_account: xsquadAmm,
      lp_currency: xsquadHex,
    },
    {
      pool: "XDX/XRP",
      pool_name: "XDX/XRP",
      lp_balance: 12.5,
      amm_account: XDX_XRP_AMM,
      lp_currency: XDX_XRP_LP_HEX,
    },
  ];
  assert.equal(lpHeldForPair(mixed, "XDX/XRP", "XRP"), 12.5);
  assert.equal(lpHeldForPair([mixed[0]], "XDX/XRP", "XRP"), 0);
  assert.equal(lpHeldForPair([mixed[0]], "XDX/XSQUAD", "XSQUAD"), 8888);
  assert.equal(pairFromRow({ quote: "XSQUAD", quote_issuer: "roBYiFtZsTRpWEUw6TtpUCwZCfjcQeRBg" }), "XDX/XSQUAD");
  assert.equal(pairFromRow({ lp_currency: xsquadHex, amm_account: xsquadAmm }), "XDX/XSQUAD");
  const otherAmm = "rOtherAmm1111111111111111111111111";
  assert.equal(
    pairFromRow({ lp_currency: xsquadHex, amm_account: otherAmm }),
    `XDX/${otherAmm.slice(0, 4)}…${otherAmm.slice(-4)}`
  );
});

test("opening add LP from a pool card keeps extra quote metadata", () => {
  const opened = normalizeTradeRequest({
    action: "addLp",
    pair: "XDX/PLX",
    quote_issuer: "rPlxIssuer",
  });
  assert.equal(opened.action, "addLp");
  assert.equal(opened.quote, "PLX");
  const quote = resolveQuote(opened.quote, opened);
  assert.equal(quote.pair, "XDX/PLX");
  assert.equal(quote.issuer, "rPlxIssuer");
});

test("unsigned trade clicks ask for sign-in before the trade window", () => {
  assert.equal(gateUnsignedTrade("addLp", null).action, "sign-in");
  assert.equal(gateUnsignedTrade({ action: "buy", pair: "XDX/XIO" }, null).trade.quote, "XIO");
  assert.equal(gateUnsignedTrade("sell", "rSignedIn").action, "open");
  assert.equal(gateUnsignedTrade(null, null).action, "ignore");
});

test("a live Connect Wallet session opens add liquidity without a second sign-in", () => {
  assert.equal(gateUnsignedTrade("addLp", "rN7n7suQDqawFkUvqhD56VwThRCFSStdz1").action, "open");
  assert.equal(gateUnsignedTrade({ action: "removeLp", pair: "XDX/XRP" }, "rSignedIn").action, "open");
});

test("trade windows show pay and receive from the selected pair", () => {
  const buy = tradeSides({ action: "buy", amount: 1000, quoteQty: 4.632, quoteLabel: "XIO", total: 4.632 });
  assert.deepEqual(buy.pay, [{ value: 4.632, asset: "XIO" }]);
  assert.deepEqual(buy.receive, [{ value: 1000, asset: "XDX" }]);
  const sell = tradeSides({ action: "sell", amount: 1000, quoteQty: 4.632, quoteLabel: "XIO", total: 4.632 });
  assert.deepEqual(sell.pay, [{ value: 1000, asset: "XDX" }]);
  assert.deepEqual(sell.receive, [{ value: 4.632, asset: "XIO" }]);
  assert.equal(predictedQuoteOut(100, 0, 1000, 50), 5);
  assert.equal(visibleQuoteQty("", 3.12), "3.12");
  assert.equal(visibleQuoteQty("2", 3.12), "2");
  assert.equal(predictedXdxFromQuote(5, 0, 1000, 50), 100);
  assert.equal(formatLinkedQty(115.072148123), "115.07215");
  assert.equal(sanitizeQtyInput("4.52e+21"), null);
  assert.equal(sanitizeQtyInput("12.5"), "12.5");
  assert.equal(formatLinkedQty(4.52e21).includes("e"), false);
  const fromQuote = linkedDepositAmounts({
    editedSide: "quote",
    amount: "100000",
    quoteQty: "0.1",
    reserveBase: 1150.72148,
    reserveQuote: 1,
  });
  assert.equal(fromQuote.quoteInput, "0.1");
  assert.ok(fromQuote.xdx > 100);
  const fromXdx = linkedDepositAmounts({
    editedSide: "xdx",
    amount: "115.072148",
    quoteQty: "9",
    reserveBase: 1150.72148,
    reserveQuote: 1,
  });
  assert.equal(fromXdx.xdxInput, "115.072148");
  assert.ok(Number(fromXdx.quoteInput) > 0);
  assert.equal(
    quoteUnitUsd({
      quoteId: "XIO",
      pool: { reserve_xdx: 1150, reserve_currency: 1, xdxUsd: 0.000087 },
      prices: { XIO: 0.0001, xrpUsd: 2.8 },
    }),
    1150 * 0.000087
  );
  assert.equal(
    quoteUnitUsd({
      quoteId: "XIO",
      pool: { reserve_xdx: 1150, reserve_currency: 1, xdxUsd: 0.000087 },
      prices: { xioXrp: 26.4, xrpUsd: 1 },
      allowImplied: false,
    }),
    26.4
  );
  const add = tradeSides({ action: "addLp", amount: 100, quoteQty: 5, quoteLabel: "XRP", lpOut: 20 });
  assert.equal(add.pay[0].asset, "XDX");
  assert.equal(add.pay[1].asset, "XRP");
  assert.equal(add.receive[0].asset, "LP");
  const singlePay = tradeSides({ action: "addLp", amount: 0, quoteQty: 2, quoteLabel: "XRP", lpOut: 4 });
  assert.equal(singlePay.pay.length, 1);
  assert.equal(singlePay.pay[0].asset, "XRP");
  assert.equal(xdxUnitUsd({ prices: { xdxUsd: 0.00003 } }), 0.00003);
  assert.equal(quoteUnitUsd({ quoteId: "XRP", prices: { xrpUsd: 2 } }), 2);
  assert.equal(
    quoteUnitUsd({
      quoteId: "XRP",
      pool: { quote_usd: 1.5, reserve_xdx: 100000, reserve_currency: 3, xdxUsd: 0.000045 },
      prices: { xrpUsd: 2.8 },
    }),
    2.8
  );
  assert.equal(quoteUnitUsd({ quoteId: "XIO", pool: { reserve_xdx: 1000, reserve_currency: 50, xdxUsd: 0.0001 } }), 0.002);
  assert.equal(quoteUnitUsd({ quoteId: "USDC", pool: { quote_usd: 0.00004 }, prices: {} }), 1);
  const split = depositValueSplit({ xdxAmount: 1000, quoteAmount: 2, xdxUsd: 0.01, quoteUsd: 2.5 });
  assert.equal(split.xdxValue, 10);
  assert.equal(split.quoteValue, 5);
  assert.ok(Math.abs(split.xdxPct - 66.666) < 0.02);
});

test("only a matching ledger tx closes the open trade panel", () => {
  assert.equal(executionClosesTradeAction("buy", { txjson: { TransactionType: "Payment" } }), true);
  assert.equal(executionClosesTradeAction("buy", { txjson: { TransactionType: "OfferCreate" } }), true);
  assert.equal(executionClosesTradeAction("addLp", { txType: "AMMDeposit" }), true);
  assert.equal(executionClosesTradeAction("removeLp", { txType: "AMMWithdraw" }), true);
  assert.equal(executionClosesTradeAction("addLp", { txjson: { TransactionType: "Payment" } }), false);
  assert.equal(executionClosesTradeAction("buy", { txType: "AMMDeposit" }), false);
  assert.equal(executionClosesTradeAction("buy", { txjson: { TransactionType: "TrustSet" } }), false);
  assert.equal(executionClosesTradeAction("addLp", { txType: "SignIn" }), false);
});

test("a leftover executed payload cannot close a newly opened trade panel", () => {
  const opened = {
    action: "buy",
    quote: "XRP",
    openId: Date.now(),
  };
  assert.equal(
    executionBelongsToOpenTrade(opened, {
      uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      txType: "Payment",
    }),
    false
  );
  assert.equal(
    executionBelongsToOpenTrade(opened, {
      uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      txType: "Payment",
      resolved_at: new Date(Date.now() - 60_000).toISOString(),
    }),
    false
  );
  assert.equal(
    executionBelongsToOpenTrade(
      { ...opened, activeUuid: "11111111-2222-4333-a444-555555555555" },
      { uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", txType: "Payment" }
    ),
    false
  );
  assert.equal(
    executionBelongsToOpenTrade(
      { ...opened, activeUuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", signMarker: "ab".repeat(16) },
      {
        uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        txType: "Payment",
        signMarker: "ab".repeat(16),
        resolved_at: new Date(Date.now() + 1000).toISOString(),
      }
    ),
    true
  );
});

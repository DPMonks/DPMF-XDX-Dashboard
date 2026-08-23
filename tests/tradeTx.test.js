import test from "node:test";
import assert from "node:assert/strict";
import {
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
  TF_PARTIAL_PAYMENT,
  TF_TWO_ASSET,
  ammDepositTx,
  ammWithdrawTx,
  expectedLpTokens,
  expectedWithdraw,
  executionBelongsToOpenTrade,
  executionClosesTradeAction,
  gateUnsignedTrade,
  hasLpTrustline,
  hasQuoteTrustline,
  lpTrustSetTxjson,
  normalizeTradeRequest,
  offerCreateBuyXdx,
  offerCreateSellXdx,
  poolForQuote,
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
  lpHeldForPair,
  sanitizeQtyInput,
  tradeSides,
  visibleQuoteQty,
  xdxUnitUsd,
  tradeTotal,
  xrpDrops,
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

test("totals and LP hints stay simple numbers", () => {
  assert.equal(tradeTotal("1000", "0.002"), 2);
  assert.equal(recommendedQuote(100, 1000, 50), 5);
  assert.equal(expectedLpTokens(100, 1000, 200), 20);
  assert.deepEqual(expectedWithdraw(20, 1000, 50, 200), { base: 100, quote: 5 });
});

test("opening add LP from a pool card keeps that pair", () => {
  assert.equal(quoteIdFromPair("XDX/XIO"), "XIO");
  assert.equal(lpHeldForPair([{ pool: "XDX/XRP", lp_balance: 12.5 }], "XDX/XRP", "XRP"), 12.5);
  assert.equal(lpHeldForPair([{ pool_name: "XDX/PLX", lp: 3 }], "XDX/PLX", "PLX"), 3);
  assert.equal(lpHeldForPair([], "XDX/XRP", "XRP"), 0);
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

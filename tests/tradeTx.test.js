import test from "node:test";
import assert from "node:assert/strict";
import { RLUSD_ISSUER, XDX_ISSUER, XDX_XRP_AMM, XDX_XRP_LP_HEX } from "../src/constants/ledger.js";
import {
  TF_IMMEDIATE_OR_CANCEL,
  TF_LP_TOKEN,
  TF_TWO_ASSET,
  ammDepositTx,
  ammWithdrawTx,
  expectedLpTokens,
  expectedWithdraw,
  normalizeTradeRequest,
  offerCreateBuyXdx,
  offerCreateSellXdx,
  quoteAsset,
  quoteIdFromPair,
  quoteTrustSetTxjson,
  recommendedQuote,
  resolveQuote,
  predictedQuoteOut,
  predictedXdxFromQuote,
  quoteUnitUsd,
  depositValueSplit,
  formatLinkedQty,
  linkedDepositAmounts,
  tradeSides,
  visibleQuoteQty,
  xdxUnitUsd,
  tradeTotal,
  xrpDrops,
} from "../src/xaman/tradeTx.js";

test("buy XDX spend XRP as TakerGets drops and receive XDX", () => {
  const tx = offerCreateBuyXdx({
    account: "rBuyer",
    quote: quoteAsset("XRP"),
    xdx: "1000",
    cost: 2.5,
    market: true,
  });
  assert.equal(tx.TransactionType, "OfferCreate");
  assert.equal(tx.Account, "rBuyer");
  assert.equal(tx.TakerPays.currency, "XDX");
  assert.equal(tx.TakerPays.issuer, XDX_ISSUER);
  assert.equal(tx.TakerPays.value, "1000");
  assert.equal(tx.TakerGets, xrpDrops(2.5));
  assert.equal(tx.Flags, TF_IMMEDIATE_OR_CANCEL);
});

test("sell XDX for RLUSD is a limit OfferCreate", () => {
  const tx = offerCreateSellXdx({
    account: "rSeller",
    quote: quoteAsset("RLUSD"),
    xdx: "500",
    proceeds: 4,
  });
  assert.equal(tx.TakerGets.currency, "XDX");
  assert.equal(tx.TakerPays.currency, "RLUSD");
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
});

test("totals and LP hints stay simple numbers", () => {
  assert.equal(tradeTotal("1000", "0.002"), 2);
  assert.equal(recommendedQuote(100, 1000, 50), 5);
  assert.equal(expectedLpTokens(100, 1000, 200), 20);
  assert.deepEqual(expectedWithdraw(20, 1000, 50, 200), { base: 100, quote: 5 });
});

test("opening add LP from a pool card keeps that pair", () => {
  assert.equal(quoteIdFromPair("XDX/XIO"), "XIO");
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

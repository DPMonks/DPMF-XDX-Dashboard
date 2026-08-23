import test from "node:test";
import assert from "node:assert/strict";
import {
  RLUSD_HEX,
  RLUSD_ISSUER,
  XDX_ISSUER,
  XIO_ISSUER,
  XSQUAD_HEX,
  XSQUAD_ISSUER,
} from "../src/constants/ledger.js";
import {
  AMM_CREATE_DEFAULT_FEE,
  AMM_CREATE_RESERVE_XRP,
  ammCreateTxjson,
  createPoolBlocker,
  createQuoteOptions,
  defaultCreateQuoteId,
  depositRatio,
  estimatedCreateLp,
  estimatedPoolValueXrp,
  existingPoolForQuote,
  hasAssetLine,
  ratioDeltaPct,
} from "../src/wallet/ammCreate.js";
import { feeUnitsFromPercent } from "../src/wallet/ammVote.js";
import { activityFromAmmCreateTx, activityFromAmmLpTx, pendingFromExecution } from "../src/wallet/ledgerOrders.js";
import { isTradeTxjson } from "../src/xaman/detectExecution.js";
import { ammWithdrawTx, quoteAsset, xrpDrops } from "../src/xaman/tradeTx.js";

test("ammCreateTxjson deposits XDX plus XRP drops at 0.25%", () => {
  const tx = ammCreateTxjson({
    account: "rCreator",
    quote: quoteAsset("XRP"),
    xdx: "1000000",
    quoteQty: 3,
    tradingFee: AMM_CREATE_DEFAULT_FEE,
  });
  assert.equal(tx.TransactionType, "AMMCreate");
  assert.equal(tx.Account, "rCreator");
  assert.equal(tx.Amount.currency, "XDX");
  assert.equal(tx.Amount.issuer, XDX_ISSUER);
  assert.equal(tx.Amount.value, "1000000");
  assert.equal(tx.Amount2, xrpDrops(3));
  assert.equal(tx.TradingFee, 250);
  assert.equal(tx.Asset, undefined);
  assert.equal(tx.Flags, undefined);
});

test("ammCreateTxjson encodes RLUSD, XIO, and XSQUAD quotes", () => {
  const rlusd = ammCreateTxjson({
    quote: quoteAsset("RLUSD"),
    xdx: 500,
    quoteQty: 12.5,
    tradingFee: 1,
  });
  assert.equal(rlusd.Amount2.currency, RLUSD_HEX);
  assert.equal(rlusd.Amount2.issuer, RLUSD_ISSUER);
  assert.equal(rlusd.Amount2.value, "12.5");
  assert.equal(rlusd.TradingFee, 1000);

  const xio = ammCreateTxjson({
    quote: quoteAsset("XIO"),
    xdx: 10,
    quoteQty: 4,
    tradingFee: 0,
  });
  assert.equal(xio.Amount2.currency, "XIO");
  assert.equal(xio.Amount2.issuer, XIO_ISSUER);
  assert.equal(xio.TradingFee, 0);

  const xsquad = ammCreateTxjson({
    quote: quoteAsset("XSQUAD"),
    xdx: 10,
    quoteQty: 1,
    tradingFee: 0.1,
  });
  assert.equal(xsquad.Amount2.currency, XSQUAD_HEX);
  assert.equal(xsquad.Amount2.issuer, XSQUAD_ISSUER);
  assert.equal(xsquad.TradingFee, feeUnitsFromPercent(0.1));
});

test("fee units never exceed 1 percent", () => {
  assert.equal(ammCreateTxjson({ quote: quoteAsset("XRP"), xdx: 1, quoteQty: 1, tradingFee: 5 }).TradingFee, 1000);
});

test("existing pool detection skips XDX/XRP and prefers a trustline quote", () => {
  const pools = [{ pool: "XDX/XRP" }, { pool_name: "XDX / RLUSD" }];
  const raw = {
    lines: [
      { currency: "XIO", issuer: XIO_ISSUER, value: "12" },
      { currency: RLUSD_HEX, issuer: RLUSD_ISSUER, value: "4" },
    ],
  };
  assert.equal(existingPoolForQuote(pools, "XRP")?.pool, "XDX/XRP");
  assert.equal(existingPoolForQuote(pools, "XIO"), null);
  assert.equal(defaultCreateQuoteId(pools, raw), "XIO");
  const options = createQuoteOptions(pools, raw);
  assert.equal(options.find((row) => row.id === "XRP").exists, true);
  assert.equal(options.find((row) => row.id === "XRP").label, "XRP");
  assert.equal(options.find((row) => row.id === "XIO").exists, false);
  assert.equal(options.find((row) => row.id === "XIO").label, "XIO");
  assert.ok(!options.some((row) => /XDX\s*\//.test(row.label)));
  assert.ok(!options.some((row) => /exists/i.test(row.label)));
  assert.ok(!options.some((row) => row.id === "XSQUAD"));
});

test("secondary quotes come from wallet trustlines, never a hardcoded catalogue", () => {
  const empty = createQuoteOptions([{ pool: "XDX/XRP" }]);
  assert.deepEqual(empty.map((row) => row.id), ["XRP"]);
  const lined = createQuoteOptions([], {
    balances: [{ currency: "USD", issuer: "rExampleIssuer1111111111111111111", value: "8" }],
  });
  assert.ok(lined.some((row) => row.id === "USD" && row.issuer === "rExampleIssuer1111111111111111111"));
  assert.ok(!lined.some((row) => row.id === "XDX"));
});

test("secondary picker lists every account_lines trustline as a singular asset", () => {
  const raw = {
    lines: [
      { currency: "XIO", account: XIO_ISSUER, balance: "0" },
      { currency: RLUSD_HEX, account: RLUSD_ISSUER, balance: "4" },
      { currency: "XDX", account: XDX_ISSUER, balance: "9" },
      { currency: "03BCD44104644B711C58CD14CD13CBA65757CFBE", account: "rAmmLpTokenIssuer11111111111111111", balance: "1" },
      { currency: "USD", account: "rGateUsdIssuer11111111111111111111", balance: "2" },
      { currency: "USD", issuer: "rBitstampUsdIssuer111111111111111", balance: "0" },
    ],
  };
  const options = createQuoteOptions([{ pool: "XDX/XRP" }], raw);
  assert.deepEqual(
    options.map((row) => row.ticker),
    ["XRP", "XIO", "RLUSD", "USD", "USD"]
  );
  assert.equal(options.find((row) => row.ticker === "XIO").label, "XIO");
  assert.equal(options.find((row) => row.ticker === "RLUSD").label, "RLUSD");
  assert.ok(options.every((row) => !/XDX\s*\//.test(row.label)));
  assert.ok(!options.some((row) => row.ticker === "XDX"));
  const usd = options.filter((row) => row.ticker === "USD");
  assert.equal(usd.length, 2);
  assert.ok(usd.every((row) => row.id.startsWith("USD:")));
  assert.ok(usd.every((row) => row.label.startsWith("USD · ")));
});

test("deposit ratio warns when the mark is 20 percent off", () => {
  assert.equal(depositRatio(1000, 2), 0.002);
  assert.ok(Math.abs(ratioDeltaPct(0.0024, 0.002) - 20) < 1e-9);
  assert.equal(ratioDeltaPct(0, 0.002), null);
});

test("estimated create LP uses the geometric mean and XRP drops", () => {
  assert.equal(estimatedCreateLp(100, 4, false), 20);
  assert.equal(estimatedCreateLp(1, 1, true), Math.sqrt(1_000_000));
  assert.equal(estimatedPoolValueXrp({ xdxAmount: 1000, quoteAmount: 2, xdxXrp: 0.001, quoteXrp: 1 }), 3);
});

test("create pool blockers cover wallet, existing pool, amounts, and reserve", () => {
  assert.equal(createPoolBlocker({ existing: { pool: "XDX/XRP" } }), "exists");
  assert.equal(createPoolBlocker({ signedIn: false }), "wallet");
  assert.equal(
    createPoolBlocker({
      signedIn: true,
      xdx: 10,
      quoteQty: 1,
      quote: quoteAsset("XRP"),
      xdxBalance: 5,
      xrpBalance: 20,
      raw: { xdx: 5 },
      fee: 0.25,
    }),
    "xdx-balance"
  );
  assert.equal(
    createPoolBlocker({
      signedIn: true,
      xdx: 10,
      quoteQty: 5,
      quote: quoteAsset("XRP"),
      xdxBalance: 20,
      xrpBalance: 6,
      raw: { xdx: 20, xrp: 6 },
      fee: 0.25,
    }),
    "reserve"
  );
  assert.equal(
    createPoolBlocker({
      signedIn: true,
      xdx: 10,
      quoteQty: 1,
      quote: quoteAsset("XRP"),
      xdxBalance: 20,
      xrpBalance: 10 + AMM_CREATE_RESERVE_XRP,
      raw: { xdx: 20, xrp: 12 },
      fee: 0.25,
    }),
    null
  );
});

test("IOU create still asks for a trustline when the wallet has no line", () => {
  assert.equal(hasAssetLine({}, quoteAsset("RLUSD"), null), false);
  assert.equal(
    createPoolBlocker({
      signedIn: true,
      xdx: 10,
      quoteQty: 1,
      quote: quoteAsset("RLUSD"),
      xdxBalance: 20,
      quoteBalance: null,
      xrpBalance: 10,
      raw: { xdx: 20, xrp: 10 },
      fee: 0.25,
    }),
    "quote-line"
  );
});

test("AMMCreate is a signed trade and records create-pool activity", () => {
  assert.equal(isTradeTxjson({ TransactionType: "AMMCreate" }), true);
  const pending = pendingFromExecution(
    {
      txjson: ammCreateTxjson({
        account: "rCreator",
        quote: quoteAsset("XIO"),
        xdx: 10,
        quoteQty: 2,
        tradingFee: 0.25,
      }),
      txid: "A".repeat(64),
    },
    "rCreator"
  );
  assert.equal(pending.activity.side, "createPool");
  assert.equal(pending.activity.pair, "XDX/XIO");
  const history = activityFromAmmCreateTx(
    {
      hash: "B".repeat(64),
      tx: ammCreateTxjson({
        account: "rCreator",
        quote: quoteAsset("XRP"),
        xdx: 10,
        quoteQty: 1,
      }),
      meta: { TransactionResult: "tesSUCCESS" },
    },
    "rCreator"
  );
  assert.equal(history.side, "createPool");
  assert.equal(history.pair, "XDX/XRP");
});

test("a successful AMMWithdraw records removed LP on recent activity", () => {
  const txjson = ammWithdrawTx({
    account: "rLp",
    quote: quoteAsset("XRP"),
    lpAmount: "2500",
  });
  const pending = pendingFromExecution({ txjson, txid: "C".repeat(64) }, "rLp");
  assert.equal(pending.activity.side, "removeLp");
  assert.equal(pending.activity.pair, "XDX/XRP");
  assert.equal(pending.activity.lp, 2500);
  const history = activityFromAmmLpTx(
    {
      hash: "D".repeat(64),
      tx: txjson,
      meta: { TransactionResult: "tesSUCCESS" },
    },
    "rLp"
  );
  assert.equal(history.side, "removeLp");
  assert.equal(history.lp, 2500);
  assert.equal(
    activityFromAmmLpTx(
      { tx: txjson, meta: { TransactionResult: "tecUNFUNDED_AMM" } },
      "rLp"
    ),
    null
  );
});

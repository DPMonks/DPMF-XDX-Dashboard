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
import { activityFromAmmCreateTx, pendingFromExecution } from "../src/wallet/ledgerOrders.js";
import { isTradeTxjson } from "../src/xaman/detectExecution.js";
import { quoteAsset, xrpDrops } from "../src/xaman/tradeTx.js";

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

test("existing pool detection skips XDX/XRP and prefers a new quote", () => {
  const pools = [{ pool: "XDX/XRP" }, { pool_name: "XDX / RLUSD" }];
  assert.equal(existingPoolForQuote(pools, "XRP")?.pool, "XDX/XRP");
  assert.equal(existingPoolForQuote(pools, "XIO"), null);
  assert.equal(defaultCreateQuoteId(pools), "XIO");
  const options = createQuoteOptions(pools);
  assert.equal(options.find((row) => row.id === "XRP").exists, true);
  assert.equal(options.find((row) => row.id === "XIO").exists, false);
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

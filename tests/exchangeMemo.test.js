import test from "node:test";
import assert from "node:assert/strict";
import {
  EXCHANGE_MEMO_VERSION,
  EXCHANGE_PLATFORM,
  exchangeMemoJson,
  extractExchangeMemo,
  stampExchangeMemo,
} from "../src/xaman/exchangeMemo.js";
import { stampTradeTxjson } from "../src/xaman/signMarker.js";
import {
  ammDepositTx,
  ammWithdrawTx,
  offerCreateBuyXdx,
  offerCreateSellXdx,
  quoteAsset,
} from "../src/xaman/tradeTx.js";
import { xdxTrustSetTxjson } from "../src/constants/ledger.js";

test("swap memos tag market and limit buys and sells", () => {
  const marketBuy = exchangeMemoJson({
    txjson: offerCreateBuyXdx({
      account: "rBuyer",
      quote: quoteAsset("XRP"),
      xdx: "1000",
      cost: 2.5,
      market: true,
    }),
    trade: { action: "buy", pair: "XDX/XRP" },
  });
  assert.deepEqual(marketBuy, {
    platform: EXCHANGE_PLATFORM,
    module: "swap",
    pool: "XDX/XRP",
    version: EXCHANGE_MEMO_VERSION,
    action: "buy",
    order: "market",
  });

  const limitSell = exchangeMemoJson({
    txjson: offerCreateSellXdx({
      account: "rSeller",
      quote: quoteAsset("RLUSD"),
      xdx: "1000",
      proceeds: 1,
    }),
    trade: { action: "sell", pair: "XDX/RLUSD" },
  });
  assert.equal(limitSell.module, "swap");
  assert.equal(limitSell.action, "sell");
  assert.equal(limitSell.order, "limit");
  assert.equal(limitSell.pool, "XDX/RLUSD");
});

test("LP, vote, and pool-create memos follow the platform templates", () => {
  assert.deepEqual(
    exchangeMemoJson({
      txjson: ammDepositTx({ account: "rLp", quote: quoteAsset("XRP"), xdx: "100", quoteQty: "1" }),
      trade: { action: "addLp", pair: "XDX/XRP" },
    }),
    {
      platform: EXCHANGE_PLATFORM,
      module: "add_liquidity",
      pool: "XDX/XRP",
    }
  );
  assert.equal(
    exchangeMemoJson({
      txjson: ammWithdrawTx({ account: "rLp", quote: quoteAsset("XRP"), lpAmount: "5" }),
      trade: { action: "removeLp", pair: "XDX/XRP" },
    }).module,
    "remove_liquidity"
  );
  assert.deepEqual(
    exchangeMemoJson({
      txjson: { TransactionType: "AMMVote", Asset: { currency: "XDX" }, Asset2: { currency: "XRP" } },
      trade: { action: "vote", voteType: "trading_fee" },
    }),
    {
      platform: EXCHANGE_PLATFORM,
      module: "amm_vote",
      vote_type: "trading_fee",
    }
  );
  assert.deepEqual(
    exchangeMemoJson({
      txjson: { TransactionType: "AMMCreate", Amount: { currency: "XDX" }, Amount2: "1000000" },
      trade: { action: "createPool", pair: "XDX/XRP" },
    }),
    {
      platform: EXCHANGE_PLATFORM,
      module: "pool_create",
      pair: "XDX/XRP",
    }
  );
  assert.equal(
    exchangeMemoJson({ txjson: xdxTrustSetTxjson("rA") }).module,
    "lp_action"
  );
});

test("stamping keeps the platform memo and the sign marker together", () => {
  const buy = offerCreateBuyXdx({
    account: "rBuyer",
    quote: quoteAsset("XRP"),
    xdx: "10",
    cost: 1,
    market: true,
  });
  const { txjson } = stampTradeTxjson(stampExchangeMemo(buy, { trade: { action: "buy", pair: "XDX/XRP" } }));
  const memo = extractExchangeMemo(txjson);
  assert.equal(memo.platform, EXCHANGE_PLATFORM);
  assert.equal(memo.module, "swap");
  assert.equal(txjson.Memos.length, 2);
  assert.equal(JSON.stringify(memo).includes("rBuyer"), false);
});

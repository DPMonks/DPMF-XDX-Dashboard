import test from "node:test";
import assert from "node:assert/strict";
import {
  EXCHANGE_MEMO_FORMAT,
  EXCHANGE_MEMO_VERSION,
  EXCHANGE_PLATFORM,
  exchangeMemoText,
  extractExchangeMemo,
  stampExchangeMemo,
} from "../src/xaman/exchangeMemo.js";
import { hexToAscii, stampTradeTxjson } from "../src/xaman/signMarker.js";
import {
  ammDepositTx,
  ammWithdrawTx,
  offerCreateBuyXdx,
  offerCreateSellXdx,
  quoteAsset,
} from "../src/xaman/tradeTx.js";
import { xdxTrustSetTxjson } from "../src/constants/ledger.js";

test("swap memos read as a natural executed-swap line", () => {
  const marketBuy = exchangeMemoText({
    txjson: offerCreateBuyXdx({
      account: "rBuyer",
      quote: quoteAsset("XRP"),
      xdx: "1000",
      cost: 2.5,
      market: true,
    }),
    trade: { action: "buy", pair: "XDX/XRP" },
  });
  assert.equal(marketBuy, `${EXCHANGE_PLATFORM} | Swap executed in XDX/XRP | v${EXCHANGE_MEMO_VERSION}`);

  const limitSell = exchangeMemoText({
    txjson: offerCreateSellXdx({
      account: "rSeller",
      quote: quoteAsset("RLUSD"),
      xdx: "1000",
      proceeds: 1,
    }),
    trade: { action: "sell", pair: "XDX/RLUSD" },
  });
  assert.equal(limitSell, `${EXCHANGE_PLATFORM} | Swap executed in XDX/RLUSD | v${EXCHANGE_MEMO_VERSION}`);
});

test("LP, vote, and pool-create memos follow the natural templates", () => {
  assert.equal(
    exchangeMemoText({
      txjson: ammDepositTx({ account: "rLp", quote: quoteAsset("XRP"), xdx: "100", quoteQty: "1" }),
      trade: { action: "addLp", pair: "XDX/XRP" },
    }),
    `${EXCHANGE_PLATFORM} | Liquidity added to XDX/XRP pool`
  );
  assert.equal(
    exchangeMemoText({
      txjson: ammDepositTx({ account: "rLp", quote: quoteAsset("XIO"), xdx: "100", quoteQty: "1" }),
      trade: { action: "addLp", pair: "XDX/XIO" },
    }),
    `${EXCHANGE_PLATFORM} | Liquidity added to XDX/XIO pool`
  );
  assert.equal(
    exchangeMemoText({
      txjson: ammDepositTx({
        account: "rLp",
        quote: quoteAsset("XRP"),
        xdx: "100",
        mode: "single",
        singleAsset: "xdx",
      }),
      trade: { action: "addLp", pair: "XDX/XRP", lpMode: "single" },
    }),
    `${EXCHANGE_PLATFORM} | Single-sided liquidity added to XDX/XRP pool`
  );
  assert.equal(
    exchangeMemoText({
      txjson: ammWithdrawTx({ account: "rLp", quote: quoteAsset("XRP"), lpAmount: "5" }),
      trade: { action: "removeLp", pair: "XDX/XRP" },
    }),
    `${EXCHANGE_PLATFORM} | Liquidity removed from XDX/XRP pool`
  );
  assert.equal(
    exchangeMemoText({
      txjson: ammWithdrawTx({
        account: "rLp",
        quote: quoteAsset("XRP"),
        lpAmount: "5",
        mode: "single",
        singleAsset: "xdx",
        amountOut: 10,
      }),
      trade: { action: "removeLp", pair: "XDX/XRP", lpMode: "single" },
    }),
    `${EXCHANGE_PLATFORM} | Single-sided liquidity removed from XDX/XRP pool`
  );
  assert.equal(
    exchangeMemoText({
      txjson: { TransactionType: "AMMVote", Asset: { currency: "XDX" }, Asset2: { currency: "XRP" } },
      trade: { action: "vote", voteType: "trading_fee" },
    }),
    `${EXCHANGE_PLATFORM} | Governance vote submitted: fee adjustment`
  );
  assert.equal(
    exchangeMemoText({
      txjson: { TransactionType: "AMMCreate", Amount: { currency: "XDX" }, Amount2: "1000000" },
      trade: { action: "createPool", pair: "XDX/XIO" },
    }),
    `${EXCHANGE_PLATFORM} | New pool created: XDX/XIO`
  );
  assert.equal(
    exchangeMemoText({ txjson: xdxTrustSetTxjson("rA") }),
    `${EXCHANGE_PLATFORM} | XDX trustline opened`
  );
  assert.equal(
    exchangeMemoText({
      txjson: { TransactionType: "Payment", Destination: "rDPMFBANKMexTKkC7e4n3ekD9HfhmWHva8" },
      trade: { action: "xdxPlatformFee" },
    }),
    `${EXCHANGE_PLATFORM} | 1% XDX platform fee`
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
  assert.equal(memo.text, `${EXCHANGE_PLATFORM} | Swap executed in XDX/XRP | v${EXCHANGE_MEMO_VERSION}`);
  assert.equal(hexToAscii(txjson.Memos.find((row) => hexToAscii(row.Memo.MemoFormat) === EXCHANGE_MEMO_FORMAT)?.Memo.MemoFormat), "text/plain");
  assert.equal(txjson.Memos.length, 2);
  assert.equal(memo.text.includes("rBuyer"), false);
});

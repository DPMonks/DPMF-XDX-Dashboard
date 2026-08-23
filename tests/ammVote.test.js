import test from "node:test";
import assert from "node:assert/strict";
import {
  activityFromAmmVoteTx,
  ammVoteTxjson,
  feePercentFromUnits,
  feeUnitsFromPercent,
  governanceFromAmmInfo,
  medianVotedFee,
  voteHistoryFromActivity,
  weightedVotedFee,
} from "../src/wallet/ammVote.js";
import { XDX_ISSUER } from "../src/constants/ledger.js";

test("fee units map 0.25% to 250 and back", () => {
  assert.equal(feeUnitsFromPercent(0.25), 250);
  assert.equal(feePercentFromUnits(250), 0.25);
  assert.equal(feeUnitsFromPercent(1), 1000);
});

test("ammVoteTxjson uses TradingFee units and XDX plus the quote asset", () => {
  const tx = ammVoteTxjson({
    account: "rVoter",
    quote: { id: "XRP", currency: "XRP" },
    tradingFee: 0.6,
  });
  assert.equal(tx.TransactionType, "AMMVote");
  assert.equal(tx.Account, "rVoter");
  assert.equal(tx.TradingFee, 600);
  assert.equal(tx.Asset.currency, "XDX");
  assert.equal(tx.Asset.issuer, XDX_ISSUER);
  assert.equal(tx.Asset2.currency, "XRP");
});

test("governanceFromAmmInfo reads vote slots and the wallet's vote", () => {
  const gov = governanceFromAmmInfo(
    {
      amm: {
        account: "rAmm",
        trading_fee: 500,
        lp_token: { value: "1000" },
        vote_slots: [
          { account: "rVoter", trading_fee: 600, vote_weight: 40000 },
          { account: "rOther", trading_fee: 200, vote_weight: 10000 },
        ],
      },
    },
    { address: "rVoter", pair: "XDX/XRP", lpBalance: 400 }
  );
  assert.equal(gov.eligible, true);
  assert.equal(gov.tradingFeePct, 0.5);
  assert.equal(gov.yourVote.feePercent, 0.6);
  assert.equal(gov.voteCount, 2);
  assert.equal(weightedVotedFee(gov.voteSlots), 0.52);
  assert.equal(medianVotedFee(gov.voteSlots), 0.4);
});

test("activityFromAmmVoteTx keeps a signed fee vote for recent activity", () => {
  const row = activityFromAmmVoteTx(
    {
      hash: "A".repeat(64),
      close_time_iso: "2026-08-23T02:00:00.000Z",
      tx_json: {
        TransactionType: "AMMVote",
        Account: "rVoter",
        TradingFee: 250,
        Asset: { currency: "XDX", issuer: XDX_ISSUER },
        Asset2: { currency: "XRP" },
      },
      meta: { TransactionResult: "tesSUCCESS" },
    },
    "rVoter"
  );
  assert.equal(row.kind, "vote");
  assert.equal(row.pair, "XDX/XRP");
  assert.equal(row.feePercent, 0.25);
});

test("voteHistoryFromActivity marks an older vote on the same pair replaced", () => {
  const rows = voteHistoryFromActivity(
    [
      { kind: "vote", account: "rVoter", pair: "XDX/XRP", feePercent: 0.25, timestamp: "2026-08-23T02:00:00Z" },
      { kind: "vote", account: "rVoter", pair: "XDX/XRP", feePercent: 0.3, timestamp: "2026-08-20T02:00:00Z" },
    ],
    [{ account: "rVoter" }]
  );
  assert.equal(rows[0].status, "active");
  assert.equal(rows[1].status, "replaced");
});

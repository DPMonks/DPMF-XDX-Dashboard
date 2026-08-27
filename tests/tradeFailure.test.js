import test from "node:test";
import assert from "node:assert/strict";
import { XDX_ISSUER } from "../src/constants/ledger.js";
import { getMessages } from "../src/i18n/messages.js";
import {
  engineCodeOf,
  explainTradeFailure,
  failureActionKind,
  failureFamilyOf,
  failurePairLabel,
} from "../src/wallet/tradeFailure.js";

const t = getMessages("en");

test("failureFamilyOf maps common ledger codes", () => {
  assert.equal(failureFamilyOf("tecUNFUNDED_AMM"), "unfundedAmm");
  assert.equal(failureFamilyOf("tecUNFUNDED_PAYMENT"), "unfunded");
  assert.equal(failureFamilyOf("tecINSUF_RESERVE_LINE"), "reserve");
  assert.equal(failureFamilyOf("tecNO_LINE"), "noLine");
  assert.equal(failureFamilyOf("tecPATH_DRY"), "pathDry");
  assert.equal(failureFamilyOf("tecPATH_PARTIAL"), "pathPartial");
  assert.equal(failureFamilyOf("tecKILLED"), "killed");
  assert.equal(failureFamilyOf("tecAMM_FAILED"), "amm");
  assert.equal(failureFamilyOf("temMALFORMED"), "malformed");
  assert.equal(failureFamilyOf("tefPAST_SEQ"), "stale");
  assert.equal(failureFamilyOf("telINSUF_FEE_P"), "fee");
  assert.equal(failureFamilyOf(""), "unknown");
  assert.equal(failureFamilyOf("tecINTERNAL"), "generic");
});

test("explainTradeFailure names the pair and add-LP shortfall", () => {
  const explained = explainTradeFailure(
    {
      engineResult: "tecUNFUNDED_AMM",
      trade: { action: "addLp", pair: "XDX/XAH" },
      txjson: {
        TransactionType: "AMMDeposit",
        Amount: { currency: "XDX", issuer: XDX_ISSUER, value: "1000" },
        Amount2: { currency: "XAH", issuer: "rXah", value: "50" },
      },
    },
    t
  );
  assert.equal(explained.family, "unfundedAmm");
  assert.equal(explained.action, "addLp");
  assert.equal(explained.pair, "XDX/XAH");
  assert.match(explained.why, /XDX\/XAH/);
  assert.match(explained.why, /add liquidity/);
  assert.match(explained.fix, /smaller amount/);
  assert.equal(explained.title, "Why this failed");
  assert.equal(explained.fixTitle, "What to do");
});

test("explainTradeFailure tells a swap why the path was dry", () => {
  const explained = explainTradeFailure(
    {
      engineResult: "tecPATH_DRY",
      trade: { action: "crossSwap", fromId: "XRP", toId: "XDX" },
      txjson: { TransactionType: "Payment" },
    },
    t
  );
  assert.equal(explained.action, "swap");
  assert.equal(explained.pair, "XRP/XDX");
  assert.match(explained.why, /no path/i);
  assert.match(explained.why, /swap/);
  assert.match(explained.fix, /smaller size/);
});

test("explainTradeFailure points missing LP trust line on withdraw", () => {
  const explained = explainTradeFailure(
    {
      engineResult: "tecNO_LINE",
      trade: { action: "removeLp", pair: "XDX/XRP" },
      txjson: { TransactionType: "AMMWithdraw" },
    },
    t
  );
  assert.match(explained.why, /LP trust line/);
  assert.match(explained.fix, /LP Trustline/);
});

test("explainTradeFailure names paid assets on an unfunded payment", () => {
  const explained = explainTradeFailure(
    {
      engineResult: "tecUNFUNDED_PAYMENT",
      trade: { action: "sell", pair: "XDX/XRP" },
      txjson: {
        TransactionType: "Payment",
        SendMax: { currency: "XDX", issuer: XDX_ISSUER, value: "250" },
        Amount: "1000000",
      },
    },
    t
  );
  assert.equal(explained.family, "unfunded");
  assert.match(explained.why, /XDX/);
  assert.match(explained.why, /sell/);
});

test("explainTradeFailure still speaks when the ledger posted no code", () => {
  const explained = explainTradeFailure({ trade: { action: "buy", pair: "XDX/RLUSD" } }, t);
  assert.equal(explained.family, "unknown");
  assert.match(explained.why, /before the ledger posted/);
  assert.match(explained.fix, /fresh transaction/);
  assert.equal(engineCodeOf({}), "");
  assert.equal(failureActionKind({ trade: { action: "vote" } }), "vote");
  assert.equal(failurePairLabel({ trade: { quote: "XAH" } }), "XDX/XAH");
});

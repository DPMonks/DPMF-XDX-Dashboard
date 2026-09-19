import test from "node:test";
import assert from "node:assert/strict";
import { AIM_ADMIN_WALLET, extractClassicAddress, isAimAdminWallet } from "../src/constants/ledger.js";
import { classicAimWallet } from "../src/api/aim.js";
import {
  hasLeadingTeachPrefix,
  looksLikeAdminDirectionReadiness,
  looksLikeAdminObjective,
  looksLikeTeachLesson,
  resolveBodyWallet,
} from "../server/aimMatrix.js";

const ADMIN = AIM_ADMIN_WALLET;
const OTHER = "rN7n7otQDd6FczFgLdphjsiEaUsfoe5bX";

function resolveChatWallet(text, body = {}) {
  const fromMsg = extractClassicAddress(text);
  if (fromMsg) return fromMsg;
  return resolveBodyWallet(body);
}

function isAdminForTeach(text, body) {
  const bodyWallet = resolveBodyWallet(body);
  const chatWallet = resolveChatWallet(text, body);
  return isAimAdminWallet(bodyWallet) || isAimAdminWallet(chatWallet);
}

test("leading Teach prefixes", () => {
  for (const msg of ["teach - testing", "Teach:", "Teach — note", "  teach bias long", "teach"]) {
    assert.equal(hasLeadingTeachPrefix(msg), true, msg);
  }
});

test("admin body wallet wins over pasted message wallet", () => {
  assert.equal(isAdminForTeach(`teach - check ${OTHER}`, { wallet: ADMIN }), true);
  assert.equal(resolveChatWallet(`teach - check ${OTHER}`, { wallet: ADMIN }), OTHER);
});

test("missing wallet is not admin", () => {
  assert.equal(isAdminForTeach("teach - testing teach function", {}), false);
});

test("exact admin classic match from signed-in body fields", () => {
  assert.equal(isAimAdminWallet(ADMIN), true);
  assert.equal(isAimAdminWallet(`signed in as ${ADMIN}`), true);
  assert.equal(isAimAdminWallet({ walletAddress: ADMIN }), true);
  assert.equal(isAdminForTeach("teach - testing", { wallet: ADMIN, account: ADMIN }), true);
  assert.equal(isAdminForTeach("teach - testing", { walletAddress: ADMIN }), true);
  assert.equal(classicAimWallet(null, { account: ADMIN }), ADMIN);
});

test("admin objectives and XRPL direction are durable teach for the signed-in admin", () => {
  assert.equal(looksLikeAdminObjective("Objective: grow XRP/RLUSD inventory this session"), true);
  assert.equal(looksLikeAdminObjective("Set the desk objective to stay long XDX/XRP"), true);
  assert.equal(looksLikeAdminObjective("XRPL direction: favour XRP strength vs RLUSD"), true);
  assert.equal(looksLikeTeachLesson("Set the desk objective to stay long XDX/XRP"), true);
  assert.equal(looksLikeAdminDirectionReadiness("ready for objectives and xrpl direction"), true);
  assert.equal(looksLikeAdminObjective("what is the desk objective today"), false);
});

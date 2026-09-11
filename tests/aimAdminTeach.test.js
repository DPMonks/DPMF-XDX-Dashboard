import test from "node:test";
import assert from "node:assert/strict";

function extractClassicAddress(text) {
  const m = String(text || "").match(/\br[1-9A-HJ-NP-Za-km-z]{24,34}\b/);
  return m ? m[0] : null;
}
function classicFromUnknown(value) {
  if (value == null) return null;
  if (typeof value === "object") {
    return (
      classicFromUnknown(value.wallet) ||
      classicFromUnknown(value.account) ||
      classicFromUnknown(value.address) ||
      classicFromUnknown(value.walletAddress) ||
      classicFromUnknown(value.classic_address) ||
      classicFromUnknown(value.classicAddress) ||
      null
    );
  }
  return extractClassicAddress(String(value).trim());
}
function resolveBodyWallet(body = {}) {
  return (
    classicFromUnknown(body.wallet) ||
    classicFromUnknown(body.account) ||
    classicFromUnknown(body.address) ||
    classicFromUnknown(body.walletAddress) ||
    classicFromUnknown(body.classic_address) ||
    classicFromUnknown(body.classicAddress) ||
    null
  );
}
function resolveChatWallet(text, body = {}) {
  const fromMsg = extractClassicAddress(text);
  if (fromMsg) return fromMsg;
  return resolveBodyWallet(body);
}
const AIM_ADMIN_WALLET = "rDPMFBANKMexTKkC7e4n3ekD9HfhmWHva8";
function isAimAdminWallet(addr) {
  const classic = extractClassicAddress(addr) || String(addr || "").trim();
  return classic === AIM_ADMIN_WALLET;
}
function hasLeadingTeachPrefix(text) {
  const q = String(text || "").replace(/^\uFEFF/, "");
  return /^\s*teach(?:\s*[:\-\u2013\u2014|,.]|\s+|$)/i.test(q);
}
function isAdminForTeach(text, body) {
  const bodyWallet = resolveBodyWallet(body);
  const chatWallet = resolveChatWallet(text, body);
  return isAimAdminWallet(bodyWallet) || isAimAdminWallet(chatWallet);
}

const ADMIN = AIM_ADMIN_WALLET;
const OTHER = "rN7n7otQDd6FczFgLdphjsiEaUsfoe5bX";

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

test("exact admin classic match", () => {
  assert.equal(isAdminForTeach("teach - testing", { wallet: ADMIN, account: ADMIN }), true);
  assert.equal(isAdminForTeach("teach - testing", { walletAddress: ADMIN }), true);
});

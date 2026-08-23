import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSignInPayload,
  buildTrustSetPayload,
  buildXamanPayload,
  cleanCredential,
  requestOrigin,
  shouldSubmitTxjson,
  siteOriginFrom,
  xamanErrorMessage,
  xamanReturnUrl,
  xummConfigured,
} from "../api/xaman/_xumm.js";
import {
  TF_SET_NO_RIPPLE,
  XDX_ISSUER,
  XDX_TOTAL_SUPPLY,
  xdxTrustSetTxjson,
} from "../src/constants/ledger.js";
import {
  extractSignedAccount,
  isClassicAddress,
  isPhoneDevice,
  normalizePayload,
  payloadLooksSigned,
  xamanAppUrl,
  xamanSignUrl,
} from "../src/xaman/xamanClient.js";
import {
  clearPendingPayload,
  isPayloadUuid,
  peekPendingPayload,
  readXamanReturnUuid,
  rememberPendingPayload,
  takeXamanReturnUuid,
  xamanWebsocketUrl,
} from "../src/xaman/payloadResume.js";
import { nextPayloadSession, payloadSessionOpen } from "../src/xaman/payloadSession.js";
import { normalizeTradeRequest } from "../src/xaman/tradeTx.js";

test("cleanCredential strips quotes and whitespace", () => {
  assert.equal(cleanCredential('  "abc-def" \n'), "abc-def");
  assert.equal(cleanCredential(""), "");
  assert.equal(cleanCredential(null), "");
});

test("xdxTrustSetTxjson is a NoRipple TrustSet for the XDX issuer", () => {
  const txjson = xdxTrustSetTxjson("rTestAccount111111111111111111111");
  assert.equal(txjson.TransactionType, "TrustSet");
  assert.equal(txjson.Flags, TF_SET_NO_RIPPLE);
  assert.equal(txjson.LimitAmount.currency, "XDX");
  assert.equal(txjson.LimitAmount.issuer, XDX_ISSUER);
  assert.equal(txjson.LimitAmount.value, String(XDX_TOTAL_SUPPLY));
  assert.equal(txjson.Account, "rTestAccount111111111111111111111");
  assert.equal(xdxTrustSetTxjson().Account, undefined);
});

test("TrustSet payloads submit to XRPL; SignIn payloads do not", () => {
  const signIn = buildSignInPayload("https://xdx-exchange.dpmf.technology/");
  assert.equal(signIn.options.submit, false);
  assert.equal(shouldSubmitTxjson(signIn.txjson), false);

  const trust = buildTrustSetPayload(
    "https://xdx-exchange.dpmf.technology/",
    xdxTrustSetTxjson()
  );
  assert.equal(trust.txjson.TransactionType, "TrustSet");
  assert.equal(trust.options.submit, true);
  assert.equal(trust.options.return_url.app, "https://xdx-exchange.dpmf.technology/?xaman={id}");
  assert.equal(trust.options.return_url.web, "https://xdx-exchange.dpmf.technology/?xaman={id}");
  assert.equal(shouldSubmitTxjson(trust.txjson), true);

  const fromBody = buildXamanPayload("https://xdx-exchange.dpmf.technology", xdxTrustSetTxjson());
  assert.equal(fromBody.options.submit, true);
});

test("buildSignInPayload returns to the site with the payload id after Xaman", () => {
  const payload = buildSignInPayload("https://xdx-exchange.dpmf.technology/");
  assert.equal(payload.txjson.TransactionType, "SignIn");
  assert.equal(payload.options.return_url.app, "https://xdx-exchange.dpmf.technology/?xaman={id}");
  assert.equal(payload.options.return_url.web, "https://xdx-exchange.dpmf.technology/?xaman={id}");
  assert.equal(payload.options.submit, false);
});

test("requestOrigin prefers the forwarded host", () => {
  assert.equal(
    requestOrigin({
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "xdx-exchange.dpmf.technology",
      },
    }),
    "https://xdx-exchange.dpmf.technology"
  );
});

test("Xaman Next never returns to a Vercel login host", () => {
  assert.equal(
    requestOrigin({
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "dpmf-xdx-dashboard-git-cursor-mobile-sig-a5d2b5-dpmf-s-projects.vercel.app",
      },
    }),
    "https://xdx-exchange.dpmf.technology"
  );
  assert.equal(
    requestOrigin({
      headers: { host: "dpmf-xdx-dashboard.vercel.app" },
    }),
    "https://xdx-exchange.dpmf.technology"
  );
  assert.equal(
    siteOriginFrom("https://vercel.com/dpmf-s-projects/dpmf-xdx-dashboard"),
    "https://xdx-exchange.dpmf.technology"
  );
  assert.equal(
    xamanReturnUrl("https://dpmf-xdx-dashboard.vercel.app"),
    "https://xdx-exchange.dpmf.technology/?xaman={id}"
  );
  assert.equal(
    requestOrigin({
      headers: { host: "localhost:5173", "x-forwarded-proto": "http" },
    }),
    "http://localhost:5173"
  );
});

test("xamanErrorMessage explains an invalid transaction 603", () => {
  const message = xamanErrorMessage({ error: { code: 603, message: "Invalid Hex" } });
  assert.match(message, /Invalid Hex|603|transaction/i);
});

test("xamanErrorMessage does not stringify Xaman error objects", () => {
  const message = xamanErrorMessage({
    error: { reference: "abc", code: 811 },
  });
  assert.equal(message.includes("[object Object]"), false);
  assert.match(message, /XUMM_API_KEY|return URL|811/);
});

test("xummConfigured reports key and secret presence without exposing them", () => {
  const configured = xummConfigured();
  assert.equal(typeof configured.key, "boolean");
  assert.equal(typeof configured.secret, "boolean");
});

test("normalizePayload reads the Xaman QR refs", () => {
  const payload = normalizePayload({
    uuid: "payload-1",
    refs: { qr_png: "https://xumm.app/sign/payload-1_q.png" },
    next: { always: "https://xumm.app/sign/payload-1" },
  });
  assert.equal(payload.uuid, "payload-1");
  assert.ok(payload.qr.includes("payload-1"));
  assert.equal(payload.mobileUrl, "https://xumm.app/sign/payload-1");
});

test("xaman sign links stay on the payload uuid and phones are detected", () => {
  assert.equal(xamanSignUrl("abc-1"), "https://xumm.app/sign/abc-1");
  assert.equal(xamanAppUrl("abc-1"), "xumm://xumm.app/sign/abc-1");
  assert.equal(isPhoneDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"), true);
  assert.equal(isPhoneDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), true);
  assert.equal(isPhoneDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)", { platform: "MacIntel", maxTouchPoints: 5 }), true);
  assert.equal(isPhoneDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), false);
});

test("xaman return URLs carry the payload id placeholder", () => {
  assert.equal(
    xamanReturnUrl("https://xdx-exchange.dpmf.technology/"),
    "https://xdx-exchange.dpmf.technology/?xaman={id}"
  );
  assert.equal(
    xamanWebsocketUrl("11111111-2222-4333-a444-555555555555"),
    "wss://xumm.app/sign/11111111-2222-4333-a444-555555555555"
  );
});

test("extractSignedAccount reads Xaman SignIn response shapes", () => {
  const account = "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo";
  assert.equal(isClassicAddress(account), true);
  assert.equal(extractSignedAccount({ response: { account } }), account);
  assert.equal(extractSignedAccount({ meta: { signed: true } }), null);
  assert.equal(payloadLooksSigned({ meta: { signed: true } }), true);
  assert.equal(payloadLooksSigned({ response: { account } }), true);
  assert.equal(extractSignedAccount({ account: "not-an-address" }), null);
});

function memoryStore() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

test("Xaman return query and pending payload survive a fresh page", () => {
  const uuid = "11111111-2222-4333-a444-555555555555";
  assert.equal(isPayloadUuid(uuid), true);
  assert.equal(readXamanReturnUuid(`?xaman=${uuid}&utm=1`), uuid);
  assert.equal(readXamanReturnUuid("?foo=1"), null);

  const previous = {
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage,
  };
  globalThis.sessionStorage = memoryStore();
  globalThis.localStorage = memoryStore();
  try {
    rememberPendingPayload(uuid);
    assert.equal(peekPendingPayload()?.uuid, uuid);
    assert.equal(takeXamanReturnUuid(""), uuid);
  } finally {
    clearPendingPayload();
    if (previous.sessionStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous.sessionStorage;
    if (previous.localStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous.localStorage;
  }
});

test("a new Xaman sign-in still resumes after iOS drops sessionStorage", () => {
  const uuid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const previous = {
    sessionStorage: globalThis.sessionStorage,
    localStorage: globalThis.localStorage,
  };
  globalThis.sessionStorage = memoryStore();
  globalThis.localStorage = memoryStore();
  try {
    rememberPendingPayload(uuid);
    globalThis.sessionStorage.removeItem("dpmf-xaman-pending");
    assert.equal(peekPendingPayload()?.uuid, uuid);
    assert.equal(takeXamanReturnUuid(""), uuid);
    clearPendingPayload();
    assert.equal(peekPendingPayload(), null);
  } finally {
    clearPendingPayload();
    if (previous.sessionStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = previous.sessionStorage;
    if (previous.localStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous.localStorage;
  }
});

test("cancelled Xaman sessions do not stay open after reset", () => {
  const first = nextPayloadSession(0);
  const afterCancel = nextPayloadSession(first);
  assert.equal(payloadSessionOpen(first, first), true);
  assert.equal(payloadSessionOpen(first, afterCancel), false);
  assert.equal(payloadSessionOpen(0, 0), false);
  const buy = normalizeTradeRequest("buy");
  const sell = normalizeTradeRequest("sell");
  assert.equal(buy.action, "buy");
  assert.equal(sell.action, "sell");
});

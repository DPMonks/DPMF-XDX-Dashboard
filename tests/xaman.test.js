import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSignInPayload,
  buildTrustSetPayload,
  buildXamanPayload,
  cleanCredential,
  requestOrigin,
  shouldSubmitTxjson,
  xamanErrorMessage,
  xummConfigured,
} from "../api/xaman/_xumm.js";
import {
  TF_SET_NO_RIPPLE,
  XDX_ISSUER,
  XDX_TOTAL_SUPPLY,
  xdxTrustSetTxjson,
} from "../src/constants/ledger.js";
import {
  isPhoneDevice,
  normalizePayload,
  xamanAppUrl,
  xamanSignUrl,
} from "../src/xaman/xamanClient.js";
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
  assert.equal(trust.options.return_url.app, "https://xdx-exchange.dpmf.technology");
  assert.equal(trust.options.return_url.web, undefined);
  assert.equal(shouldSubmitTxjson(trust.txjson), true);

  const fromBody = buildXamanPayload("https://xdx-exchange.dpmf.technology", xdxTrustSetTxjson());
  assert.equal(fromBody.options.submit, true);
});

test("buildSignInPayload returns to the site from the app, not a Xaman web page", () => {
  const payload = buildSignInPayload("https://xdx-exchange.dpmf.technology/");
  assert.equal(payload.txjson.TransactionType, "SignIn");
  assert.equal(payload.options.return_url.app, "https://xdx-exchange.dpmf.technology");
  assert.equal(payload.options.return_url.web, undefined);
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
  assert.equal(isPhoneDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), false);
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

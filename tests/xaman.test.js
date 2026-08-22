import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSignInPayload,
  cleanCredential,
  requestOrigin,
  xamanErrorMessage,
  xummConfigured,
} from "../api/xaman/_xumm.js";
import {
  isPhoneDevice,
  normalizePayload,
  xamanAppUrl,
  xamanSignUrl,
} from "../src/xaman/xamanClient.js";

test("cleanCredential strips quotes and whitespace", () => {
  assert.equal(cleanCredential('  "abc-def" \n'), "abc-def");
  assert.equal(cleanCredential(""), "");
  assert.equal(cleanCredential(null), "");
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

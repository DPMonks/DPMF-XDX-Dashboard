import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSignInPayload,
  cleanCredential,
  requestOrigin,
  xamanErrorMessage,
} from "../api/xaman/_xumm.js";
import { normalizePayload } from "../src/xaman/xamanClient.js";

test("cleanCredential strips quotes and whitespace", () => {
  assert.equal(cleanCredential('  "abc-def" \n'), "abc-def");
  assert.equal(cleanCredential(""), "");
  assert.equal(cleanCredential(null), "");
});

test("buildSignInPayload sends the site as the Xaman return URL", () => {
  const payload = buildSignInPayload("https://xdx-exchange.dpmf.technology/");
  assert.equal(payload.txjson.TransactionType, "SignIn");
  assert.equal(payload.options.return_url.web, "https://xdx-exchange.dpmf.technology");
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

test("normalizePayload reads the Xaman QR refs", () => {
  const payload = normalizePayload({
    uuid: "payload-1",
    refs: { qr_png: "https://xumm.app/sign/payload-1_q.png" },
    next: { always: "https://xumm.app/sign/payload-1" },
  });
  assert.equal(payload.uuid, "payload-1");
  assert.ok(payload.qr.includes("payload-1"));
});

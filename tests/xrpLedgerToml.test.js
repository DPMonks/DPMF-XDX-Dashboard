import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const TOML = `# XRP Ledger well-known (XLS-0006 / XLS-0026)
# Hosted at https://xdx-exchange.dpmf.technology/.well-known/xrp-ledger.toml

[[ACCOUNTS]]
address = "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo"
name = "DPMF"
desc = "DPMF issuer on the XRP Ledger."
icon = "https://xdx-exchange.dpmf.technology/favicon.png"

[[TOKENS]]
issuer = "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo"
currency = "XDX"
name = "XDX"
desc = "XDX token by DPMF on the XRP Ledger."
icon = "https://xdx-exchange.dpmf.technology/favicon.png"
`;

function spaFallbackSource(vercel) {
  const row = vercel.rewrites?.find((item) => item.destination === "/index.html");
  assert.ok(row, "missing SPA fallback rewrite");
  return row.source;
}

function spaFallbackPattern(source) {
  assert.equal(source.startsWith("/"), true);
  return new RegExp(`^${source}$`);
}

test("xrp-ledger.toml is the public Xaman file and favicon.png is already an image asset", () => {
  const toml = readFileSync(new URL("../public/.well-known/xrp-ledger.toml", import.meta.url), "utf8");
  assert.equal(toml, TOML);
  assert.equal(existsSync(new URL("../public/favicon.png", import.meta.url)), true);
});

test("SPA rewrite skips .well-known and the toml is served as text", () => {
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url)));
  const source = spaFallbackSource(vercel);
  assert.match(source, /\\.well-known\//);
  assert.match(source, /favicon\\.png/);
  const pattern = spaFallbackPattern(source);
  assert.equal(pattern.test("/.well-known/xrp-ledger.toml"), false);
  assert.equal(pattern.test("/.well-known/security.txt"), false);
  assert.equal(pattern.test("/favicon.png"), false);
  assert.equal(pattern.test("/robots.txt"), false);
  assert.equal(pattern.test("/api/overview"), false);
  assert.equal(pattern.test("/assets/index.js"), false);
  assert.equal(pattern.test("/"), true);
  assert.equal(pattern.test("/trade"), true);

  const headers = vercel.headers?.find((item) => item.source === "/.well-known/xrp-ledger.toml");
  assert.ok(headers, "missing toml header rule");
  const got = Object.fromEntries(
    (headers.headers || []).map((item) => [item.key, item.value])
  );
  assert.equal(got["Content-Type"], "application/toml; charset=utf-8");
  assert.equal(got["Access-Control-Allow-Origin"], "*");
});

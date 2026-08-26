import test from "node:test";
import assert from "node:assert/strict";
import { orderbookPairFromSearch } from "../server/liveCatalog.js";

test("orderbookPairFromSearch honors pair, quote, and market query params", () => {
  assert.equal(orderbookPairFromSearch("?pair=XDX/XIO"), "XDX/XIO");
  assert.equal(orderbookPairFromSearch("pair=XDX%2FXSQUAD"), "XDX/XSQUAD");
  assert.equal(orderbookPairFromSearch("?quote=RLUSD"), "XDX/RLUSD");
  assert.equal(orderbookPairFromSearch("?market=xio"), "XDX/XIO");
  assert.equal(orderbookPairFromSearch(""), "XDX/XRP");
});

import test from "node:test";
import assert from "node:assert/strict";
import { asciiCurrencyHex, RLUSD_HEX, RLUSD_ISSUER } from "../src/constants/ledger.js";
import { fillNativeBookFromXrpl, quoteSpecForPair } from "../server/xrplBookOffers.js";

test("quoteSpecForPair uses 3-letter XDX quotes and RLUSD hex", () => {
  assert.deepEqual(quoteSpecForPair("XDX/XRP"), { currency: "XRP" });
  assert.deepEqual(quoteSpecForPair("XDX/RLUSD"), {
    currency: RLUSD_HEX,
    issuer: RLUSD_ISSUER,
  });
  assert.equal(asciiCurrencyHex("XSQUAD"), "5853515541440000000000000000000000000000");
});

test("fillNativeBookFromXrpl reads both book_offers sides", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body.params[0]);
    const gets = body.params[0].taker_gets;
    const sellingXdx = gets.currency === "XDX";
    return {
      ok: true,
      json: async () => ({
        result: {
          status: "success",
          offers: sellingXdx
            ? [
                {
                  TakerGets: { currency: "XDX", issuer: "rIssuer", value: "29032.3" },
                  TakerPays: "1100000",
                },
              ]
            : [
                {
                  TakerGets: "25000000",
                  TakerPays: { currency: "XDX", issuer: "rIssuer", value: "874778.061501" },
                },
              ],
        },
      }),
    };
  };

  const book = await fillNativeBookFromXrpl("XDX/XRP", {}, { fetchImpl });
  assert.equal(calls.length, 2);
  assert.equal(book.pair, "XDX/XRP");
  assert.equal(book.dex_present, true);
  assert.equal(book.bids.length, 1);
  assert.equal(book.asks.length, 1);
  assert.equal(book.asks[0].base_size, 29032.3);
  assert.equal(book.source, "xrpl");
});

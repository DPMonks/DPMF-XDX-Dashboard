import test from "node:test";
import assert from "node:assert/strict";
import {
  FUZION_GENERIC_LOGO,
  FUZION_XRP_LOGO,
  applyFuzionAssets,
  fuzionLogoUrl,
  loadFuzionAssetListings,
  resetFuzionAssetCache,
} from "../server/fuzionAssets.js";

const CREATE = "rLYKyx5ozLUMTVn3JZJhNv5wimSqfT7Y7S";
const CREATE_ISSUER = "rMqZY49eXVxU9rgrHVix7jkLeZcEeni9nU";
const CREATE_HEX = "4352454154450000000000000000000000000000";
const BTC_ISSUER = "rchGBxcD1A1C9exampleissuer111111111";
const FARM = "rNf1vw3aTxAHJmFBRX2L7PLN8E38WoMme9";

const listings = {
  listings: [
    {
      currency: CREATE_HEX,
      issuer: CREATE_ISSUER,
      ticker: "CREATE",
      name: "Create",
      logoUrl: "/create-logo.png",
    },
    {
      currency: "BTC",
      issuer: BTC_ISSUER,
      ticker: "BTC",
      name: "Bitcoin",
      logoUrl: "data:image/png;base64,aaaa",
    },
    {
      currency: "BTC",
      issuer: "rOtherBtcIssuer11111111111111111",
      ticker: "BTC",
      name: "Other Bitcoin",
      logoUrl: "https://cdn.example/other.png",
    },
  ],
};

test("Fuzion logo paths stay on the Fuzion host and data urls pass through", () => {
  assert.equal(fuzionLogoUrl("/xdx-logo.png"), "https://fuzion-xio.dpmf.technology/xdx-logo.png");
  assert.equal(fuzionLogoUrl("data:image/png;base64,aaaa"), "data:image/png;base64,aaaa");
  assert.equal(fuzionLogoUrl("/logo.png"), "");
  assert.equal(fuzionLogoUrl(""), "");
});

test("pool logos and names come from currency plus issuer, with a generic fallback", () => {
  const named = applyFuzionAssets(
    [
      {
        pool: "XDX/CREATE",
        quote: "CREATE",
        quote_hex: CREATE_HEX,
        quote_issuer: CREATE_ISSUER,
        amm_account: CREATE,
        reserve_xdx: 2e-9,
      },
      {
        pool: "XDX/BTC",
        quote: "BTC",
        quote_issuer: BTC_ISSUER,
        amm_account: "rBtcAmm1111111111111111111111111",
      },
      {
        pool: "XDX/XRP",
        quote: "XRP",
        amm_account: "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB",
      },
      {
        pool: "XDX/POWDER KEG",
        quote: "POWDER KEG",
        quote_issuer: "rPowderIssuer1111111111111111111",
        amm_account: "rPowderAmm11111111111111111111111",
      },
    ],
    listings
  );
  assert.equal(named.length, 4);
  assert.equal(named[0].icon, "https://fuzion-xio.dpmf.technology/create-logo.png");
  assert.equal(named[0].icon_source, "fuzion");
  assert.equal(named[0].quote_name, "Create");
  assert.equal(named[0].pool, "XDX/CREATE");
  assert.equal(named[0].reserve_xdx, 2e-9);
  assert.equal(named[1].icon, "data:image/png;base64,aaaa");
  assert.equal(named[1].quote_name, "Bitcoin");
  assert.equal(named[2].icon, FUZION_XRP_LOGO);
  assert.equal(named[2].icon_source, "generic");
  assert.equal(named[2].quote_name, null);
  assert.equal(named[3].icon, FUZION_GENERIC_LOGO);
  assert.equal(named[3].icon_source, "generic");
  assert.equal(named.some((row) => row.amm_account === FARM), false);
});

test("a Fuzion outage still leaves the generic icon", async () => {
  resetFuzionAssetCache();
  const fetchImpl = async () => {
    throw new Error("down");
  };
  const body = await loadFuzionAssetListings({ fetchImpl, fresh: true, now: 20 });
  assert.equal(body, null);
  const [pool] = applyFuzionAssets([{ pool: "XDX/MAG", quote: "MAG", quote_issuer: "rMag" }], null);
  assert.equal(pool.icon, FUZION_GENERIC_LOGO);
  assert.equal(pool.icon_source, "generic");
});

test("asset listings are cached and indexed from the Fuzion response", async () => {
  resetFuzionAssetCache();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return { ok: true, json: async () => listings };
  };
  const first = await loadFuzionAssetListings({ fetchImpl, fresh: true, now: 100 });
  const second = await loadFuzionAssetListings({ fetchImpl, now: 200 });
  assert.equal(calls, 1);
  assert.equal(first.listings.length, 3);
  assert.equal(second, first);
  resetFuzionAssetCache();
});

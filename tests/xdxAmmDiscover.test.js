import test from "node:test";
import assert from "node:assert/strict";
import { decodeCurrency } from "../src/utils/currency.js";
import { quoteTickerFromCurrency } from "../src/wallet/ammVote.js";
import {
  discoverXdxAmmSpecs,
  mergeDiscoveredAmmRows,
  parseXrplToAmmPools,
  resetXdxAmmDiscoverCache,
  specsFromXrplToPool,
} from "../server/xdxAmmDiscover.js";

const CAMEL_HEX = "2443616D656C546F650000000000000000000000";
const POWDER_HEX = "504F57444552204B454700000000000000000000";

test("decodeCurrency keeps $ tickers and strips spaces in hex names", () => {
  assert.equal(decodeCurrency(CAMEL_HEX), "$CAMELTOE");
  assert.equal(decodeCurrency(POWDER_HEX), "POWDERKEG");
  assert.equal(quoteTickerFromCurrency(CAMEL_HEX), "$CAMELTOE");
  assert.equal(quoteTickerFromCurrency(POWDER_HEX), "POWDERKEG");
});

test("specsFromXrplToPool maps XRP, hex, dollar, and spaced quotes", () => {
  assert.deepEqual(
    specsFromXrplToPool({
      status: "active",
      ammAccount: "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB",
      lpTokenCurrency: "03970105D80AE3C54085F6E97EE16CEDE6CE8200",
      asset1: { currency: "XRP", issuer: "XRPL" },
      asset2: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo" },
    }),
    {
      pair: "XDX/XRP",
      quote: "XRP",
      ammAccount: "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB",
      amm: "rhEwhutV5EyYzTbBYDdK7dHxwdi5omqffB",
      issuer: null,
      quote_issuer: null,
      hex: null,
      quote_hex: null,
      lpHex: "03970105D80AE3C54085F6E97EE16CEDE6CE8200",
      pool_name: "XDX/XRP",
      pool: "XDX/XRP",
    }
  );
  const camel = specsFromXrplToPool({
    status: "active",
    ammAccount: "rB6NGNJi2XMvYhubxN3SaJGrFKE2SBYh3N",
    asset1: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo" },
    asset2: { currency: CAMEL_HEX, issuer: "rM1BJWAQ3hfCStboh4wCXTnGyHqcAvJZy3" },
  });
  assert.equal(camel.pair, "XDX/$CAMELTOE");
  assert.equal(camel.quote, "$CAMELTOE");
  assert.equal(camel.hex, CAMEL_HEX);
  const powder = specsFromXrplToPool({
    status: "active",
    ammAccount: "rDuJ2NF7kAvioLhy2DfqSevnYhARfoj84y",
    asset1: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo" },
    asset2: { currency: POWDER_HEX, issuer: "rwrsUT6ynqimffkxd6tAohFRDGHgGFmFjc" },
  });
  assert.equal(powder.pair, "XDX/POWDERKEG");
  assert.equal(specsFromXrplToPool({ status: "closed", ammAccount: "rDead", asset1: { currency: "XRP" }, asset2: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo" } }), null);
});

test("parseXrplToAmmPools keeps every active XDX AMM and skips duplicates", () => {
  const specs = parseXrplToAmmPools({
    pools: [
      {
        status: "active",
        ammAccount: "rXah",
        asset1: { currency: "XAH", issuer: "rswh1fvyLqHizBS2awu1vs6QcmwTBd9qiv" },
        asset2: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo" },
      },
      {
        status: "active",
        ammAccount: "rXah",
        asset1: { currency: "XAH", issuer: "rswh1fvyLqHizBS2awu1vs6QcmwTBd9qiv" },
        asset2: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo" },
      },
      {
        status: "active",
        ammAccount: "rCamel",
        asset1: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo" },
        asset2: { currency: CAMEL_HEX, issuer: "rM1BJWAQ3hfCStboh4wCXTnGyHqcAvJZy3" },
      },
    ],
  });
  assert.deepEqual(
    specs.map((row) => row.pair),
    ["XDX/XAH", "XDX/$CAMELTOE"]
  );
});

test("mergeDiscoveredAmmRows appends ledger pools the DB does not have yet", () => {
  const merged = mergeDiscoveredAmmRows(
    [{ amm_account: "rXrp", pool_name: "XDX/XRP", quote: "XRP" }],
    [
      { pair: "XDX/XRP", ammAccount: "rXrp" },
      { pair: "XDX/$CAMELTOE", quote: "$CAMELTOE", ammAccount: "rCamel", issuer: "rIssuer", hex: CAMEL_HEX },
    ]
  );
  assert.deepEqual(
    merged.map((row) => row.pool_name),
    ["XDX/XRP", "XDX/$CAMELTOE"]
  );
  assert.equal(merged[1].quote_hex, CAMEL_HEX);
});

test("discoverXdxAmmSpecs walks xrpl.to pages and caches the mapped specs", async () => {
  resetXdxAmmDiscoverCache();
  const pages = [
    {
      total: 2,
      pools: [
        {
          status: "active",
          ammAccount: "rXrp",
          asset1: { currency: "XRP", issuer: "XRPL" },
          asset2: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo" },
        },
      ],
    },
    {
      total: 2,
      pools: [
        {
          status: "active",
          ammAccount: "rCamel",
          asset1: { currency: "XDX", issuer: "rMJAXYsbNzhwp7FfYnAsYP5ty3R9XnurPo" },
          asset2: { currency: CAMEL_HEX, issuer: "rM1BJWAQ3hfCStboh4wCXTnGyHqcAvJZy3" },
        },
      ],
    },
  ];
  let calls = 0;
  const fetchImpl = async (url) => {
    const offset = Number(new URL(url).searchParams.get("offset") || 0);
    const body = pages[offset] || { total: 2, pools: [] };
    calls += 1;
    return { ok: true, json: async () => body };
  };
  const first = await discoverXdxAmmSpecs({ fetchImpl, limit: 1, now: 1 });
  assert.deepEqual(
    first.map((row) => row.pair),
    ["XDX/XRP", "XDX/$CAMELTOE"]
  );
  assert.equal(calls, 2);
  const cached = await discoverXdxAmmSpecs({ fetchImpl, limit: 1, now: 2 });
  assert.equal(cached.length, 2);
  assert.equal(calls, 2);
  resetXdxAmmDiscoverCache();
});

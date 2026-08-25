import test from "node:test";
import assert from "node:assert/strict";
import {
  applyUsdFx,
  fillMissingXdxFiat,
  pickXdxUsd,
  pricesNeedFiat,
  usdFxFromSources,
  xdxUsdFromRlusdPool,
  xdxUsdFromXrpPool,
} from "../src/utils/fiatFx.js";
import { applyXrplToPrices, parseXrplToToken } from "../src/utils/xrplToToken.js";
import { composeTokenDetails } from "../src/tokenDetails.js";
import { xdxFiatValues } from "../src/wallet/composeWallet.js";
import { XDX_ISSUER } from "../src/constants/ledger.js";
import { XDX_BLACKHOLED_AT } from "../src/utils/blackhole.js";
import { mergeLiveOverview, mergeLivePrices } from "../server/catalogSwitch.js";
import {
  composeFiatQuote,
  usdFxFromCurrencyApi,
  usdFxFromFrankfurter,
  usdFxFromOpenEr,
  xrpQuoteFromCoinGecko,
} from "../server/fiatQuotes.js";

test("XDX/RLUSD AMM marks XDX in USD because RLUSD is a dollar", () => {
  const usd = xdxUsdFromRlusdPool({ reserve_xdx: 2_000_000, reserve_currency: 80 }, 1);
  assert.ok(Math.abs(usd - 0.00004) < 1e-12);
  const xrp = xdxUsdFromXrpPool({ reserve_xdx: 64_000_000, reserve_currency: 2000 }, 1.6);
  assert.ok(Math.abs(xrp - 0.00005) < 1e-12);
  assert.equal(pickXdxUsd({ ammXrp: 0.00005, ammRlusd: 0.00004, xrplTo: 0.000046 }), 0.00005);
  assert.equal(pickXdxUsd({ ammXrp: 0, ammRlusd: 0.00004, xrplTo: 0.000046 }), 0.00004);
});

test("USD FX converts an XDX dollar mark into GBP EUR and JPY", () => {
  const fx = usdFxFromSources({ usd: 2, gbp: 1.5, eur: 1.8, jpy: 300 });
  assert.ok(Math.abs(fx.usdGbp - 0.75) < 1e-12);
  const attached = applyUsdFx(0.00004, fx);
  assert.ok(Math.abs(attached.xdxGbp - 0.00003) < 1e-12);
  assert.ok(Math.abs(attached.xdxEur - 0.000036) < 1e-12);
  assert.ok(Math.abs(attached.xdxJpy - 0.006) < 1e-12);
});

test("zero XDX GBP is treated as missing and filled from USD FX", () => {
  const prices = fillMissingXdxFiat({
    xdxUsd: 0.00004,
    xdxGbp: 0,
    xdxEur: 0,
    xrpUsd: 2,
    usdGbp: 0.75,
    usdEur: 0.9,
  });
  assert.ok(Math.abs(prices.xdxGbp - 0.00003) < 1e-12);
  assert.ok(Math.abs(prices.xdxEur - 0.000036) < 1e-12);
  assert.equal(pricesNeedFiat({ xdxUsd: 0.00004, xdxGbp: 0, xdxEur: 0 }), true);
  assert.equal(pricesNeedFiat(prices), false);
});

test("xdxFiatValues does not paint £0 when the GBP mark is a leftover zero", () => {
  const fiat = xdxFiatValues(1_000_000, {
    xdxUsd: 0.00004,
    xdxGbp: 0,
    xdxEur: 0,
    usdGbp: 0.75,
    usdEur: 0.9,
  });
  assert.ok(Math.abs(fiat.usd - 40) < 1e-9);
  assert.ok(Math.abs(fiat.gbp - 30) < 1e-9);
  assert.ok(Math.abs(fiat.eur - 36) < 1e-9);
  assert.ok(Math.abs(fiat.rlusd - 40) < 1e-9);
});

test("xrpl.to still fills a zero Railway price and now also fills missing FX", () => {
  const token = parseXrplToToken({
    token: { usd: "0.000046", exch: 0.00003, holders: 10, trustlines: 12, lpHolderCount: 3 },
  });
  const prices = applyXrplToPrices(
    { xdxUsd: 0, xdxGbp: 0, xrpUsd: 1.5, xrpGbp: 1.125, source: "db" },
    token
  );
  assert.ok(prices.xdxUsd > 0.00004);
  assert.ok(prices.xdxGbp > 0.00003);
  assert.equal(prices.source, "hybrid");
});

test("empty token details take ledger constants and a free-API price", () => {
  const row = composeTokenDetails({
    overview: {},
    prices: { xdxUsd: 0.00004, xrpUsd: 2 },
  });
  assert.equal(row.tokenType, "XDX");
  assert.equal(row.issuer, XDX_ISSUER);
  assert.equal(row.blackholed, true);
  assert.equal(row.blackholed_at, XDX_BLACKHOLED_AT);
  assert.equal(row.price, 0.00004);
  assert.ok(row.xrplMarketCap > 0);
  assert.ok(row.circulating > 0);
});

test("Frankfurter and CoinGecko payloads compose a last-good FX quote", () => {
  const xrp = xrpQuoteFromCoinGecko({ ripple: { usd: 2, usd_24h_change: 1.2 } });
  const fx = usdFxFromFrankfurter({ rates: { GBP: 0.75, EUR: 0.9, JPY: 150 } });
  const quote = composeFiatQuote(xrp, fx);
  assert.equal(quote.usd, 2);
  assert.equal(quote.gbp, 1.5);
  assert.equal(quote.eur, 1.8);
  assert.equal(quote.jpy, 300);
  assert.equal(quote.usdGbp, 0.75);
  assert.equal(usdFxFromOpenEr({ rates: { GBP: 0.8, EUR: 0.92, JPY: 147 } }).usdGbp, 0.8);
  assert.equal(usdFxFromCurrencyApi({ usd: { gbp: 0.74, eur: 0.86, jpy: 148 } }).usdGbp, 0.74);
});

test("blank Railway FX and token meta take the live free-API row", () => {
  const prices = mergeLivePrices(
    { xdxUsd: 0, xdxGbp: 0, xrpUsd: 1.4, source: "db" },
    { xdxUsd: 0.00005, xdxGbp: 0.000037, xrpUsd: 1.5, usdGbp: 0.74, source: "xrpl" }
  );
  assert.equal(prices.xdxUsd, 0.00005);
  assert.equal(prices.xdxGbp, 0.000037);
  assert.equal(prices.usdGbp, 0.74);

  const overview = mergeLiveOverview(
    { xdxUsd: 0, holder_count: 0, issuer: "", blackholed: null, source: "db" },
    {
      xdxUsd: 0.00005,
      holder_count: 15941,
      issuer: XDX_ISSUER,
      blackholed: true,
      blackholed_at: XDX_BLACKHOLED_AT,
      circulating: 9_000_000_000,
      source: "xrpl",
    }
  );
  assert.equal(overview.holder_count, 15941);
  assert.equal(overview.issuer, XDX_ISSUER);
  assert.equal(overview.blackholed, true);
  assert.equal(overview.circulating, 9_000_000_000);
});

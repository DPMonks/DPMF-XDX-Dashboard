import test from "node:test";
import assert from "node:assert/strict";
import {
  ammPageDescription,
  ammPagePath,
  ammPageTitle,
  ammPairFromSlug,
  ammSlugFromPair,
  readAmmRoute,
} from "../src/ammPage.js";
import { ammShareMeta, poolCardSvg, rewriteAmmHtml } from "../server/ammOg.js";

test("AMM page slugs keep dollar and compact quote names", () => {
  assert.equal(ammSlugFromPair("XDX/XRP"), "XDX-XRP");
  assert.equal(ammSlugFromPair("xdx / $cameltoe"), "XDX-$CAMELTOE");
  assert.equal(ammPairFromSlug("XDX-POWDERKEG"), "XDX/POWDERKEG");
  assert.equal(ammPairFromSlug("XDX-%24CAMELTOE"), "XDX/$CAMELTOE");
  assert.equal(ammPairFromSlug("SOLO-USD"), "");
});

test("readAmmRoute pulls the pair from /amm/slug", () => {
  assert.equal(readAmmRoute("/amm/XDX-XIO"), "XDX/XIO");
  assert.equal(readAmmRoute("/amm/XDX-$CAMELTOE"), "XDX/$CAMELTOE");
  assert.equal(readAmmRoute("/"), "");
  assert.equal(ammPagePath("XDX/XRP", "orderbook"), "/amm/XDX-XRP#orderbook");
  assert.equal(ammPageTitle("XDX/XRP"), "XDX/XRP AMM · XDX Exchange");
  assert.match(ammPageDescription({ quote: "XRP", trading_fee: "1%", volume24h: 12 }, "XDX/XRP"), /XDX\/XRP/);
});

test("share rewrite paints the home pool card for that AMM URL", () => {
  const meta = ammShareMeta({
    origin: "https://xdx-exchange.dpmf.technology",
    pair: "XDX/XRP",
    pool: { quote: "XRP", reserve_asset: 100, volume24h: 12, trading_fee: "1%" },
  });
  assert.equal(meta.title, "XDX/XRP AMM · XDX Exchange");
  assert.match(meta.image, /\/api\/og-amm\/XDX-XRP/);
  const html = rewriteAmmHtml(
    `<title>XDX Exchange</title><meta property="og:title" content="XDX Exchange" /><meta property="og:image" content="https://xdx-exchange.dpmf.technology/og-image.jpg" />`,
    meta
  );
  assert.match(html, /XDX\/XRP AMM/);
  assert.match(html, /\/api\/og-amm\/XDX-XRP/);
  assert.match(poolCardSvg({ reserve_asset: 62910000, quote: "XRP" }, "XDX/XRP"), /XDX\/XRP/);
});

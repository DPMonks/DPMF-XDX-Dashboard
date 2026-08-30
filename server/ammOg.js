import {
  ammPageDescription,
  ammPagePath,
  ammPageTitle,
  ammPairFromSlug,
  ammSlugFromPair,
  readAmmRoute,
} from "../src/ammPage.js";
import { compactPoolAmount } from "../src/ammPools.js";

const PUBLIC_ORIGIN = "https://xdx-exchange.dpmf.technology";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function poolCardSvg(pool = {}, pair = "") {
  const name = String(pool.pool || pool.pool_name || pair || "XDX/XRP")
    .replace(/\s+/g, "")
    .toUpperCase();
  const quote = pool.quote || name.split("/")[1] || "XRP";
  const xdx = compactPoolAmount(pool.reserve_asset ?? pool.reserve_xdx);
  const other = compactPoolAmount(pool.reserve_currency);
  const vol = compactPoolAmount(pool.volume24h ?? pool.volume24hXdx ?? 0);
  const fee = pool.trading_fee == null || pool.trading_fee === "" ? "—" : String(pool.trading_fee);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#050507"/>
  <rect x="80" y="70" width="1040" height="490" rx="28" fill="#0b0c10" stroke="#c770ff" stroke-width="3"/>
  <rect x="110" y="100" width="220" height="44" rx="22" fill="#1a1524" stroke="#c770ff"/>
  <text x="220" y="129" text-anchor="middle" fill="#d8caff" font-family="ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="700">${esc(name)}</text>
  <text x="110" y="200" fill="#b6ff4a" font-family="ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="700">XDX ${esc(xdx)}</text>
  <text x="1090" y="200" text-anchor="end" fill="#d8caff" font-family="ui-sans-serif, system-ui, sans-serif" font-size="28" font-weight="700">${esc(other)} ${esc(quote)}</text>
  <rect x="110" y="230" width="980" height="22" rx="11" fill="#14121c"/>
  <rect x="110" y="230" width="490" height="22" rx="11" fill="#b6ff4a"/>
  <rect x="600" y="230" width="490" height="22" rx="11" fill="#c770ff"/>
  <text x="110" y="310" fill="#9aa0b5" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22">24H VOLUME</text>
  <text x="110" y="350" fill="#b6ff4a" font-family="ui-sans-serif, system-ui, sans-serif" font-size="40" font-weight="700">${esc(vol)} XDX</text>
  <text x="1090" y="310" text-anchor="end" fill="#9aa0b5" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22">FEE</text>
  <text x="1090" y="350" text-anchor="end" fill="#ffffff" font-family="ui-sans-serif, system-ui, sans-serif" font-size="40" font-weight="700">${esc(fee)}</text>
  <text x="110" y="500" fill="#6f7690" font-family="ui-sans-serif, system-ui, sans-serif" font-size="22">XDX Exchange · AMM card</text>
</svg>`;
}

export function ammShareMeta({ origin = PUBLIC_ORIGIN, pair, pool } = {}) {
  const name = String(pair || pool?.pool || "XDX/XRP");
  const url = `${String(origin).replace(/\/$/, "")}${ammPagePath(name)}`;
  const image = `${String(origin).replace(/\/$/, "")}/api/og-amm/${encodeURIComponent(ammSlugFromPair(name))}.svg`;
  return {
    title: ammPageTitle(name),
    description: ammPageDescription(pool, name),
    url,
    image,
  };
}

export function rewriteAmmHtml(html, meta) {
  const homeDesc = "XDX Exchange — DPMF operational dashboard for XRPL holders, LP positions and AMM pools.";
  return String(html || "")
    .replace(/<title>XDX Exchange<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replaceAll(homeDesc, meta.description)
    .replaceAll('content="XDX Exchange"', `content="${esc(meta.title)}"`)
    .replace('content="https://xdx-exchange.dpmf.technology/"', `content="${esc(meta.url)}"`)
    .replaceAll("https://xdx-exchange.dpmf.technology/og-image.jpg", meta.image)
    .replace('content="image/jpeg"', 'content="image/svg+xml"');
}

export function ogAmmSlugFromPath(pathOnly = "") {
  const match = String(pathOnly || "").match(/^\/api\/og-amm\/([^/]+?)(?:\.svg)?$/i);
  return match ? ammPairFromSlug(match[1]) : "";
}

export function requestOrigin(req, fallback = PUBLIC_ORIGIN) {
  const host = req?.headers?.host;
  if (!host) return fallback;
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  return `${proto}://${host}`;
}

export { readAmmRoute };

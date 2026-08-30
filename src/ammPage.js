import { isXdxAmmPair } from "./wallet/lpIncome.js";

export const AMM_PAGE_PREFIX = "/amm";

export function normalizeAmmPair(value) {
  const pair = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/_/g, "/")
    .toUpperCase();
  if (!pair) return "";
  if (pair.startsWith("XDX/")) return pair;
  if (pair.startsWith("XDX-")) return `XDX/${pair.slice(4)}`;
  return `XDX/${pair}`;
}

export function ammSlugFromPair(pair) {
  const name = normalizeAmmPair(pair);
  return name ? name.replace("/", "-") : "";
}

export function ammPairFromSlug(slug) {
  const raw = decodeURIComponent(String(slug || "").trim());
  const pair = normalizeAmmPair(raw.includes("/") ? raw : raw.replace(/^XDX-/i, "XDX-"));
  return isXdxAmmPair(pair) ? pair : "";
}

export function ammPagePath(pair, hash = "") {
  const slug = ammSlugFromPair(pair);
  if (!slug) return "/";
  const jump = String(hash || "").replace(/^#/, "");
  return jump ? `${AMM_PAGE_PREFIX}/${encodeURIComponent(slug)}#${jump}` : `${AMM_PAGE_PREFIX}/${encodeURIComponent(slug)}`;
}

export function readAmmRoute(pathname = "", search = "") {
  const path = String(pathname || "").split("?")[0];
  const fromPath = path.match(/^\/amm\/([^/]+)\/?$/i);
  if (fromPath) return ammPairFromSlug(fromPath[1]);
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  return ammPairFromSlug(params.get("pair") || params.get("amm") || "");
}

export function isAmmPagePath(pathname = "") {
  return Boolean(readAmmRoute(pathname));
}

export function openAmmPage(pair) {
  const next = ammPagePath(pair);
  if (!next || typeof window === "undefined") return next;
  if (window.location.pathname === next.split("#")[0]) return next;
  window.history.pushState({ amm: normalizeAmmPair(pair) }, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return next;
}

export function closeAmmPage(hash = "pools") {
  if (typeof window === "undefined") return "/";
  const next = hash ? `/#${String(hash).replace(/^#/, "")}` : "/";
  window.history.pushState({}, "", next);
  window.dispatchEvent(new PopStateEvent("popstate"));
  return next;
}

export function ammPageTitle(pair) {
  const name = normalizeAmmPair(pair);
  return name ? `${name} AMM · XDX Exchange` : "XDX Exchange";
}

export function ammPageDescription(pool = {}, pair = "") {
  const name = normalizeAmmPair(pool.pool || pool.pool_name || pair);
  const quote = pool.quote || name.split("/")[1] || "XRP";
  const fee = pool.trading_fee;
  const vol = pool.volume24h ?? pool.volume24hXdx;
  const bits = [`Live XDX/${quote} AMM on the XRP Ledger.`];
  if (fee != null && fee !== "") bits.push(`Fee ${fee}.`);
  if (vol != null && Number(vol) > 0) bits.push(`24h volume ${vol} XDX.`);
  return bits.join(" ");
}

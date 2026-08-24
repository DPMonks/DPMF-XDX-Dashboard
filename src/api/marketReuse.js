export const MARKET_REUSE_MS = 45_000;
export const COUNT_REUSE_MS = 60_000;

let lastMarket = { at: 0 };
let lastCounts = { at: 0 };

export function shouldReuseCached(at, now = Date.now(), ttl = MARKET_REUSE_MS) {
  return Number(at) > 0 && now - Number(at) < Number(ttl);
}

export function rememberMarket(part = {}, now = Date.now()) {
  lastMarket = { ...lastMarket, ...part, at: now };
  return lastMarket;
}

export function freshMarket(key, now = Date.now(), ttl = MARKET_REUSE_MS) {
  if (!shouldReuseCached(lastMarket.at, now, ttl)) return null;
  if (!Object.prototype.hasOwnProperty.call(lastMarket, key)) return null;
  const value = lastMarket[key];
  if (value == null) return null;
  if (Array.isArray(value) && !value.length) return null;
  return value;
}

export function rememberTokenCounts(part = {}, now = Date.now()) {
  lastCounts = { ...lastCounts, ...part, at: now };
  return lastCounts;
}

export function freshTokenCounts(now = Date.now(), ttl = COUNT_REUSE_MS) {
  if (!shouldReuseCached(lastCounts.at, now, ttl)) return null;
  if (!lastCounts.holders && !lastCounts.trustlines) return null;
  return lastCounts;
}

export function resetMarketReuse() {
  lastMarket = { at: 0 };
  lastCounts = { at: 0 };
}

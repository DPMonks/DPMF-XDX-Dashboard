export const GENERATED_AT_HEADER = "x-dpmf-generated-at";

/** When the server built this response (cached with the body at the edge). */
export function generatedAtFromHeaders(headers) {
  const raw = headers?.get?.(GENERATED_AT_HEADER);
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(ms) ? ms : null;
}

export function dataAgeMs(generatedAt, now = Date.now()) {
  return generatedAt == null ? null : Math.max(0, now - generatedAt);
}

/** Short, plain age label for figures served from the edge cache. */
export function formatDataAge(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "";
  const minutes = Math.floor(n / 60_000);
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return minutes === 1 ? "1 min" : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

/** Label text when data is older than staleMs, otherwise null. */
export function staleDataLabel(ageMs, template, staleMs = 120_000) {
  if (ageMs == null || !(Number(ageMs) > staleMs)) return null;
  return String(template || "Showing figures from {age} ago, refreshing").replace("{age}", formatDataAge(ageMs));
}

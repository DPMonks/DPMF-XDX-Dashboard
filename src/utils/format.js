export function shortAddress(addr) {
  if (!addr) return "";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 9)}…${addr.slice(-4)}`;
}

function localeOf(locale) {
  return locale || (typeof navigator !== "undefined" ? navigator.language : "en");
}

export function formatNumber(value, locale, options = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(localeOf(locale), {
    maximumFractionDigits: 2,
    ...options,
  });
}

export function formatUsd(value, locale) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(localeOf(locale), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatToken(value, locale, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(localeOf(locale), {
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value, locale) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${num.toLocaleString(localeOf(locale), {
    maximumFractionDigits: 2,
  })}%`;
}

export function formatWhen(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(localeOf(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(value, locale) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(localeOf(locale), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function shareOf(part, total) {
  const value = Number(part);
  const sum = Number(total);
  if (!Number.isFinite(value) || !Number.isFinite(sum) || sum <= 0) return null;
  return (value / sum) * 100;
}

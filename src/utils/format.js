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
  const digits = Math.abs(num) > 0 && Math.abs(num) < 0.01 ? 8 : 2;
  return num.toLocaleString(localeOf(locale), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits === 8 ? 8 : 2,
    maximumFractionDigits: digits,
  });
}

export function formatUsdPrice(value, locale) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(localeOf(locale), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 8,
    maximumFractionDigits: 8,
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

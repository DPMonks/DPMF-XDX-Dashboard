export function shortAddress(addr) {
  if (!addr) return "";
  if (addr.length <= 16) return addr;
  return `${addr.slice(0, 9)}…${addr.slice(-4)}`;
}

export function formatNumber(value, options = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    ...options,
  });
}

export function formatUsd(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `$${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatToken(value, digits = 4) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

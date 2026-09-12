export function assetsLabel(row = {}) {
  const assets =
    Array.isArray(row?.assets) && row.assets.length
      ? row.assets
      : [{ amount: row?.amount, currency: row?.currency }];
  const parts = assets
    .filter((item) => item && item.amount != null && item.amount !== "")
    .map((item) => `${item.amount} ${item.currency || "XRP"}`);
  return parts.length ? parts.join(" + ") : row?.label || "—";
}

export function asTicker(asset = {}) {
  const currency = asset.currency || asset.curr || asset.code || "XRP";
  const issuer = currency === "XRP" ? "" : asset.issuer || asset.account || "";
  const key = asset.key || (issuer ? `${currency}:${issuer}` : currency);
  return {
    curr: key,
    currency,
    issuer,
    name: asset.name || currency,
    source: asset.source || "catalog"
  };
}

export function mergeTickers(...lists) {
  const map = new Map();
  for (const list of lists) {
    for (const row of list || []) {
      if (!row) continue;
      const ticker = asTicker(row);
      if (!ticker.currency) continue;
      map.set(ticker.curr, { ...map.get(ticker.curr), ...ticker });
    }
  }
  return [...map.values()];
}

export function findTicker(list, value) {
  if (!value) return null;
  return (
    (list || []).find(
      (row) =>
        row.curr === value ||
        row.key === value ||
        row.currency === value ||
        `${row.currency}:${row.issuer || ""}` === value
    ) || null
  );
}

export function optionLabel(asset) {
  if (!asset?.issuer) return asset?.currency || "XRP";
  return `${asset.currency} · ${String(asset.issuer).slice(0, 6)}…`;
}

export function decodeCurrency(code) {
  const raw = String(code || "").trim();
  if (!raw || raw === "XRP") return "XRP";
  if (raw.length <= 3) return raw;
  if (!/^[0-9A-Fa-f]{40}$/.test(raw)) return raw;
  let text = "";
  for (let i = 0; i < 40; i += 2) {
    const byte = parseInt(raw.slice(i, i + 2), 16);
    if (byte === 0) break;
    text += String.fromCharCode(byte);
  }
  return text || raw;
}

export function encodeCurrency(code) {
  const raw = String(code || "").trim();
  if (!raw || raw === "XRP" || raw.length <= 3) return raw || "XRP";
  if (/^[0-9A-Fa-f]{40}$/.test(raw)) return raw.toUpperCase();
  return Buffer.from(raw, "utf8").toString("hex").toUpperCase().padEnd(40, "0");
}

export function assetKey(currency, issuer = "") {
  const code = decodeCurrency(currency);
  if (code === "XRP") return "XRP";
  return `${code}:${issuer || ""}`;
}

export function normalizeAsset(row = {}) {
  const currency = decodeCurrency(row.currency || row.curr || row.code || "XRP");
  const issuer = currency === "XRP" ? "" : row.issuer || row.account || row.issuerAdd || "";
  return {
    currency,
    issuer,
    hex: row.hex || row.currency,
    name: row.name || currency,
    balance: row.balance ?? row.value ?? null,
    role: row.role || (currency === "XRP" ? "native" : "issued"),
    key: assetKey(currency, issuer),
    source: row.source || "catalog"
  };
}

export function offerAssets(row = {}, fallbackCurrency = "XRP") {
  const raw =
    Array.isArray(row.assets) && row.assets.length
      ? row.assets
      : [
          {
            currency: row.currency || fallbackCurrency || "XRP",
            issuer: row.issuer || row.issuerAdd || "",
            amount: row.amount
          }
        ];
  return raw
    .map((item) => {
      const asset = normalizeAsset(item);
      const amount = item.amount ?? item.value ?? "";
      return { ...asset, amount: amount === "" || amount == null ? "" : String(amount) };
    })
    .filter((item) => item.amount !== "");
}

export function assetsLabel(row = {}) {
  const assets = offerAssets(row);
  if (!assets.length) return "—";
  return assets.map((item) => `${item.amount} ${item.currency}`).join(" + ");
}

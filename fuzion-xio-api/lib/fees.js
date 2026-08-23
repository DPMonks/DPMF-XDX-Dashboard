export const PLATFORM_FEE_BPS = 10;
export const FEE_COLLECTOR = process.env.FEE_COLLECTOR || "";

export function feePolicy() {
  return {
    bps: PLATFORM_FEE_BPS,
    percent: PLATFORM_FEE_BPS / 100,
    label: `${(PLATFORM_FEE_BPS / 100).toFixed(1)}%`,
    collector: FEE_COLLECTOR || null,
    pendingAddress: !FEE_COLLECTOR,
    note: FEE_COLLECTOR
      ? "0.1% of every traded asset is collected to the platform wallet."
      : "0.1% of every traded asset is recorded. Collector address will be added later."
  };
}

export function feeAmount(amount, bps = PLATFORM_FEE_BPS) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return +((n * bps) / 10000).toFixed(8);
}

export function splitTrade(amount, bps = PLATFORM_FEE_BPS) {
  const gross = Number(amount) || 0;
  const fee = feeAmount(gross, bps);
  return {
    gross,
    fee,
    net: +(Math.max(0, gross - fee)).toFixed(8),
    bps,
    collector: FEE_COLLECTOR || null,
    pending: !FEE_COLLECTOR
  };
}

export function feeAssets(assets = []) {
  return assets.map((asset) => ({
    ...asset,
    ...splitTrade(asset.amount)
  }));
}

export function recordFees(store, { assets, from, to, nftId, type }) {
  store.fees = store.fees || [];
  const rows = feeAssets(assets || []).map((asset, index) => {
    const row = {
      _id: `fee-${Date.now()}-${index + 1}`,
      type: type || "trade",
      nftId: nftId || null,
      currency: asset.currency,
      issuer: asset.issuer || "",
      gross: asset.gross,
      fee: asset.fee,
      net: asset.net,
      bps: asset.bps,
      collector: asset.collector,
      pending: asset.pending,
      from: from || "",
      to: to || "",
      createdAt: new Date().toISOString()
    };
    store.fees.unshift(row);
    return row;
  });
  return rows;
}

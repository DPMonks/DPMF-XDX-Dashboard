import { assetKey, encodeCurrency, normalizeAsset } from "./currency.js";

export function ensureWallet(store, address) {
  store.wallets = store.wallets || [];
  if (!address) return null;
  let wallet = store.wallets.find((row) => row.address === address);
  if (!wallet) {
    wallet = {
      address,
      trustlines: [],
      createdAt: new Date().toISOString()
    };
    store.wallets.push(wallet);
  }
  wallet.trustlines = wallet.trustlines || [];
  return wallet;
}

export function ensureTrustline(store, { address, currency, issuer }) {
  const asset = normalizeAsset({ currency, issuer });
  if (!address) return { ok: false, error: "address required" };
  if (!asset.currency || asset.currency === "XRP") {
    return { ok: true, skipped: true, reason: "XRP does not use a trustline" };
  }
  if (!asset.issuer) {
    return { ok: false, error: "issuer required for issued assets" };
  }
  const wallet = ensureWallet(store, address);
  const key = assetKey(asset.currency, asset.issuer);
  let line = wallet.trustlines.find((row) => row.key === key);
  const created = !line;
  if (!line) {
    line = {
      key,
      currency: asset.currency,
      issuer: asset.issuer,
      limit: "1000000000",
      status: "downloaded",
      source: "auto",
      signed: false,
      trustSet: {
        TransactionType: "TrustSet",
        Account: address,
        LimitAmount: {
          currency: encodeCurrency(asset.currency),
          issuer: asset.issuer,
          value: "1000000000"
        }
      },
      createdAt: new Date().toISOString()
    };
    wallet.trustlines.push(line);
  }
  return { ok: true, created, skipped: false, line, wallet };
}

export function ensureTrustlines(store, { address, assets = [] }) {
  const results = [];
  for (const asset of assets) {
    results.push(
      ensureTrustline(store, {
        address,
        currency: asset.currency,
        issuer: asset.issuer
      })
    );
  }
  return {
    ok: results.every((row) => row.ok),
    address,
    wallet: address ? ensureWallet(store, address) : null,
    downloaded: results.filter((row) => row.created).map((row) => row.line),
    existing: results.filter((row) => row.ok && !row.created && !row.skipped).map((row) => row.line),
    skipped: results.filter((row) => row.skipped),
    results
  };
}

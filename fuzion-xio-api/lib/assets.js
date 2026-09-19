import {
  RLUSD_CURRENCY,
  RLUSD_ISSUER,
  XDX_CURRENCY,
  XDX_ISSUER,
  XIO_CURRENCY,
  XIO_ISSUER,
  XSQUAD_CURRENCY,
  XSQUAD_ISSUER
} from "./constants.js";
import { tokenCatalog, walletTokenData } from "./indexer.js";
import { decodeCurrency, encodeCurrency, normalizeAsset } from "./currency.js";
import { memoFromLedger } from "./tradeMarker.js";
import { readStore, update } from "./store.js";
import {
  accountInfo,
  accountLines,
  accountNfts,
  accountTx,
  bookOffers,
  nftBuyOffers,
  nftSellOffers
} from "./xrpl.js";

const CORE = [
  { currency: "XRP", name: "XRP", role: "native", source: "ledger" },
  { currency: XIO_CURRENCY, issuer: XIO_ISSUER, name: "XIO", role: "governance", source: "core" },
  { currency: XDX_CURRENCY, issuer: XDX_ISSUER, name: "XDX", role: "utility", source: "core" },
  { currency: XSQUAD_CURRENCY, issuer: XSQUAD_ISSUER, name: "XSQUAD", role: "community", source: "core" },
  { currency: RLUSD_CURRENCY, issuer: RLUSD_ISSUER, name: "RLUSD", role: "stable", source: "core" }
];

function mergeAssets(rows) {
  const map = new Map();
  for (const row of rows) {
    const asset = normalizeAsset(row);
    if (!asset.currency) continue;
    const prev = map.get(asset.key) || {};
    map.set(asset.key, { ...prev, ...asset });
  }
  return [...map.values()].sort((a, b) => {
    if (a.currency === "XRP") return -1;
    if (b.currency === "XRP") return 1;
    return a.currency.localeCompare(b.currency);
  });
}

function tokensFromIndexer(catalog) {
  const rows = [...(catalog.tokens || [])];
  const prices = catalog.prices || {};
  if (prices && typeof prices === "object") {
    for (const key of Object.keys(prices)) {
      if (["xrpUsd", "xrpGbp", "xdxUsd", "xdxGbp", "source"].includes(key)) continue;
      if (typeof prices[key] === "object" && prices[key].currency) {
        rows.push({ ...prices[key], source: "indexer" });
      }
    }
  }
  return rows.map((row) => ({ ...row, source: row.source || "indexer" }));
}

export function rememberAsset(row) {
  const asset = normalizeAsset({ ...row, source: row.source || "lookup" });
  if (!asset.currency) return asset;
  update((store) => {
    store.knownAssets = store.knownAssets || [];
    if (!store.knownAssets.some((item) => item.key === asset.key)) {
      store.knownAssets.push(asset);
    }
    return store;
  });
  return asset;
}

export async function lookupIssuedAsset(currency, issuer) {
  const code = decodeCurrency(currency);
  if (!code) return { ok: false, error: "currency required" };
  if (code === "XRP") {
    return { ok: true, asset: normalizeAsset({ currency: "XRP", source: "ledger" }), source: "xrpl" };
  }
  if (!issuer) return { ok: false, error: "issuer required for issued assets" };
  const info = await accountInfo(issuer);
  if (!info.ok) {
    return { ok: false, error: info.error || "issuer is not on the XRP Ledger" };
  }
  const book = await bookOffers(
    { currency: encodeCurrency(currency), issuer },
    { currency: "XRP" }
  ).catch(() => ({ ok: false }));
  const asset = normalizeAsset({
    currency: code,
    issuer,
    hex: currency,
    source: "xrpl",
    role: "issued"
  });
  return {
    ok: true,
    asset: {
      ...asset,
      tradable: book.ok ? (book.result?.offers || []).length > 0 : null
    },
    ledger: {
      account: issuer,
      sequence: info.result?.account_data?.Sequence,
      book: book.ok ? (book.result?.offers || []).length : 0
    },
    source: "xrpl"
  };
}

export async function tradeCatalog(address) {
  const catalog = await tokenCatalog();
  const known = readStore().knownAssets || [];
  const lines = address ? await accountLines(address).catch(() => ({ ok: false })) : { ok: false };
  const wallet = address ? await walletTokenData(address).catch(() => ({ ok: false })) : { ok: false };
  const trust = lines.ok
    ? (lines.result.lines || []).map((line) => ({
        currency: line.currency,
        issuer: line.account,
        balance: line.balance,
        limit: line.limit,
        source: "xrpl"
      }))
    : [];
  const indexerWallet = wallet.ok
    ? []
        .concat(wallet.data?.balances || wallet.data?.tokens || wallet.data || [])
        .filter((row) => row && (row.currency || row.curr))
        .map((row) => ({ ...row, source: "indexer-wallet" }))
    : [];

  const assets = mergeAssets([
    ...CORE,
    ...known,
    ...tokensFromIndexer(catalog),
    ...trust,
    ...indexerWallet
  ]);

  return {
    ok: true,
    source: {
      indexer: catalog.indexerStatus,
      xrpl: lines.ok ? "live" : lines.error || "skipped",
      wallet: address || null
    },
    count: assets.length,
    assets,
    prices: catalog.prices
  };
}

function amountFromLedger(amount) {
  if (amount == null) return null;
  if (typeof amount === "string") {
    return { currency: "XRP", issuer: "", amount: String(Number(amount) / 1_000_000) };
  }
  return {
    currency: amount.currency,
    issuer: amount.issuer || "",
    amount: amount.value
  };
}

export async function ledgerNftOffers(nftId) {
  const [buy, sell, info] = await Promise.all([
    nftBuyOffers(nftId),
    nftSellOffers(nftId),
    import("./xrpl.js").then((mod) => mod.nftInfo(nftId))
  ]);
  const buys = (buy.result?.offers || []).map((row) => ({
    side: "buy",
    offerId: row.nft_offer_index,
    owner: row.owner,
    destination: row.destination || null,
    ...amountFromLedger(row.amount),
    source: "xrpl"
  }));
  const sells = (sell.result?.offers || []).map((row) => ({
    side: "sell",
    offerId: row.nft_offer_index,
    owner: row.owner,
    destination: row.destination || null,
    ...amountFromLedger(row.amount),
    source: "xrpl"
  }));
  const sourceOf = (result) => {
    if (result.ok) return "xrpl";
    const err = String(result.error || "");
    if (/not found/i.test(err)) return "empty";
    return err || "error";
  };
  return {
    ok: true,
    nftId,
    ledger: info.ok ? info.result : null,
    buy: buys,
    sell: sells,
    offers: [...buys, ...sells],
    source: {
      buy: sourceOf(buy),
      sell: sourceOf(sell)
    }
  };
}

export async function ledgerAccountTape(address) {
  const [tx, nfts] = await Promise.all([
    accountTx(address, 30),
    accountNfts(address)
  ]);
  const rows = [];
  for (const item of tx.result?.transactions || []) {
    const inner = item.tx || item.tx_json || {};
    const meta = item.meta || {};
    const type = inner.TransactionType;
    if (!type) continue;
    if (!/NFToken|Offer/i.test(type)) continue;
    const fuzion = memoFromLedger(inner);
    rows.push({
      type,
      hash: inner.hash || item.hash,
      date: item.date,
      account: inner.Account,
      nftId: inner.NFTokenID || inner.nft_id || meta.nftoken_id || meta.NFTokenID,
      amount: amountFromLedger(inner.Amount || inner.NFTokenBrokerFee),
      source: fuzion ? "fuzion-xio" : "xrpl",
      venue: fuzion?.venue || "",
      marker: fuzion?.marker || "",
      signed: Boolean(fuzion?.signed),
      sign: fuzion?.sign || ""
    });
  }
  return {
    ok: true,
    address,
    nfts: nfts.ok ? nfts.result.account_nfts || [] : [],
    activity: rows,
    source: tx.ok ? "xrpl" : tx.error
  };
}

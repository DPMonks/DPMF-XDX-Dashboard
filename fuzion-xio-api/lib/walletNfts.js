import { pageShape } from "./collections.js";
import { describeAsset } from "./filetypes.js";
import { hexToText, publicUri } from "./ledgerMints.js";
import { nftValidation } from "./validation.js";
import { accountNfts } from "./xrpl.js";

function ownedStoreNfts(store, address) {
  return (store.nfts || []).filter(
    (nft) =>
      !nft.collectionTemplate &&
      (nft.accountNumber === address || nft.Issuer === address || nft.issuer === address)
  );
}

const cache = new Map();
const CACHE_MS = 30_000;

export async function accountNftsAll(address, { maxPages = 8 } = {}) {
  if (!address) return { ok: false, nfts: [], error: "address required" };
  const nfts = [];
  let marker;
  let pages = 0;
  while (pages < maxPages) {
    const page = await accountNfts(address, marker);
    if (!page.ok) {
      return {
        ok: nfts.length > 0,
        nfts,
        error: page.error,
        incomplete: true,
        pages
      };
    }
    nfts.push(...(page.result.account_nfts || []));
    marker = page.result.marker;
    pages += 1;
    if (!marker) break;
  }
  return { ok: true, nfts, marker: marker || null, pages, incomplete: Boolean(marker) };
}

export function fileKindFromUri(uri) {
  const described = describeAsset(uri || "");
  if (described.kind && described.kind !== "file") return described.kind;
  return "image";
}

export function fromLedgerNft(row, address) {
  const uri = hexToText(row.URI);
  const url = publicUri(uri);
  const looksJson = /\.json(\?|$)/i.test(url);
  const kind = looksJson ? "image" : fileKindFromUri(url);
  const id = row.NFTokenID;
  return {
    _id: id,
    NFTokenID: id,
    name: `XRPL NFT ${String(id || "").slice(0, 8)}…`,
    description: "Detected from account_nfts on the XRP Ledger.",
    uri,
    image: looksJson ? "" : url,
    metaDataUrl: url,
    fileType: kind,
    contentType: kind,
    issuer: row.Issuer,
    Issuer: row.Issuer,
    accountNumber: address,
    status: "minted",
    source: "xrpl",
    found: true,
    NFTokenTaxon: row.NFTokenTaxon,
    Flags: row.Flags
  };
}

export function nftActions(nft) {
  const burned = nft.status === "burned";
  const listed = nft.status === "sale";
  return {
    canView: true,
    canSale: !burned && !listed,
    canDelist: listed,
    canBurn: !burned,
    canAddToProfile: !burned,
    canSend: !burned
  };
}

export function decorateWalletNft(store, nft) {
  const validation = nftValidation(store, nft);
  return {
    ...nft,
    vscore: validation.vScore,
    badge: validation.badge,
    validation,
    actions: nftActions(nft),
    threeD: ["glb", "gltf", "fbx", "usdz", "obj"].includes(
      String(nft.fileType || nft.contentType || "").toLowerCase()
    )
  };
}

export function mergeWalletNfts(storeRows, ledgerRows) {
  const map = new Map();
  for (const nft of [...ledgerRows, ...storeRows]) {
    const key = nft.NFTokenID || nft._id;
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, nft);
      continue;
    }
    map.set(key, {
      ...nft,
      ...prev,
      source: prev.source === "store" || nft.source === "store" ? "store" : nft.source,
      image: prev.image || nft.image,
      name: prev.source === "store" ? prev.name : nft.name || prev.name
    });
  }
  return [...map.values()];
}

export function rememberWalletNfts(store, rows) {
  store.nfts = store.nfts || [];
  let added = 0;
  for (const nft of rows) {
    if (nft.source !== "xrpl" || !nft.NFTokenID) continue;
    const existing = store.nfts.find(
      (row) => row.NFTokenID === nft.NFTokenID || row._id === nft.NFTokenID
    );
    if (existing) {
      existing.accountNumber = nft.accountNumber || existing.accountNumber;
      existing.fileType = existing.fileType || nft.fileType;
      existing.contentType = existing.contentType || nft.contentType;
      existing.image = existing.image || nft.image;
      continue;
    }
    store.nfts.push({ ...nft });
    added += 1;
  }
  return added;
}

export async function ledgerNftsCached(address) {
  if (!address || /demo|fuzionxio/i.test(address)) {
    return { ok: true, rows: [], nfts: [], skipped: true };
  }
  const hit = cache.get(address);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const scan = await accountNftsAll(address);
  const rows = (scan.nfts || []).map((row) => fromLedgerNft(row, address));
  const value = { ...scan, rows };
  cache.set(address, { at: Date.now(), value });
  return value;
}

export async function walletNftDesk(store, address, query = {}) {
  const storeRows = ownedStoreNfts(store, address);
  const ledger = await ledgerNftsCached(address);
  const merged = mergeWalletNfts(storeRows, ledger.rows || []);
  const docs = merged
    .filter((nft) => nft.status !== "burned")
    .map((nft) => decorateWalletNft(store, nft));
  const page = Number(query.page || 1);
  const size = Number(query.size || 48);
  return {
    address,
    ...pageShape(docs.slice((page - 1) * size, page * size), page, size, docs.length),
    ledgerCount: (ledger.rows || []).length,
    storeCount: storeRows.length,
    incomplete: Boolean(ledger.incomplete),
    source: ledger.ok ? "store+xrpl" : "store"
  };
}

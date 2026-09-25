import { readStore, update } from "./store.js";
import { ledger } from "./xrpl.js";

const RIPPLE_EPOCH = 946684800;
const CACHE_MS = 60_000;
const IPFS_GATEWAY = "https://dweb.link/ipfs/";

let memory = { at: 0, rows: [] };

export function hexToText(hex) {
  const raw = String(hex || "").replace(/^0x/i, "");
  if (!raw || raw.length % 2) return "";
  try {
    return Buffer.from(raw, "hex").toString("utf8").replace(/\0/g, "");
  } catch {
    return "";
  }
}

export function rippleTimeToIso(closeTime) {
  const n = Number(closeTime);
  if (!Number.isFinite(n) || n <= 0) return new Date().toISOString();
  return new Date((n + RIPPLE_EPOCH) * 1000).toISOString();
}

export function publicUri(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("ipfs://")) return `${IPFS_GATEWAY}${text.slice("ipfs://".length)}`;
  const ipfs = text.match(/\/ipfs\/(.+)$/);
  if (ipfs && !text.startsWith("http")) return `${IPFS_GATEWAY}${ipfs[1]}`;
  return text;
}

export function nftIdFromMeta(meta = {}) {
  if (meta.nftoken_id) return meta.nftoken_id;
  if (Array.isArray(meta.nftoken_ids) && meta.nftoken_ids[0]) return meta.nftoken_ids[0];
  const ids = new Set();
  const prev = new Set();
  for (const node of meta.AffectedNodes || []) {
    const page = node.CreatedNode || node.ModifiedNode || node.DeletedNode;
    if (!page || page.LedgerEntryType !== "NFTokenPage") continue;
    for (const tok of page.FinalFields?.NFTokens || page.NewFields?.NFTokens || []) {
      const id = (tok.NFToken || tok).NFTokenID;
      if (id) ids.add(id);
    }
    for (const tok of page.PreviousFields?.NFTokens || []) {
      const id = (tok.NFToken || tok).NFTokenID;
      if (id) prev.add(id);
    }
  }
  for (const id of prev) ids.delete(id);
  return [...ids][0] || "";
}

export function parseMintTx(tx, ledgerIndex, closeTime) {
  const type = tx?.TransactionType || tx?.tx_json?.TransactionType;
  if (type !== "NFTokenMint") return null;
  const meta = tx.metaData || tx.meta || {};
  if (meta.TransactionResult && meta.TransactionResult !== "tesSUCCESS") return null;
  const nftId = nftIdFromMeta(meta);
  const uri = hexToText(tx.URI);
  const issuer = tx.Issuer || tx.Account;
  return {
    _id: nftId || tx.hash,
    NFTokenID: nftId,
    hash: tx.hash,
    name: uri ? uri.split("/").pop() : `XRPL mint ${String(nftId || tx.hash).slice(0, 8)}`,
    description: "Successfully minted on the XRP Ledger.",
    image: "",
    uri,
    issuer,
    Issuer: issuer,
    accountNumber: tx.Account,
    collectionName: "",
    status: "minted",
    source: "xrpl",
    ledgerIndex: Number(ledgerIndex) || null,
    createdAt: rippleTimeToIso(closeTime),
    explorer: nftId
      ? `https://livenet.xrpl.org/nft/${nftId}`
      : `https://livenet.xrpl.org/transactions/${tx.hash}`,
    badge: "Minted on XRPL"
  };
}

export function deskMints(store) {
  const rows = [];
  const seen = new Set();
  const push = (nft, extra = {}) => {
    const id = nft.NFTokenID || nft._id;
    if (!id || seen.has(id)) return;
    seen.add(id);
    rows.push({
      _id: nft._id || id,
      NFTokenID: nft.NFTokenID || "",
      name: nft.name,
      description: nft.description || "Minted on FUZION-XIO.",
      image: nft.image || nft.previewImage || nft.metaverse || "",
      fileType: nft.fileType,
      contentType: nft.contentType || nft.fileType,
      issuer: nft.issuer || nft.Issuer,
      Issuer: nft.Issuer || nft.issuer,
      accountNumber: nft.accountNumber,
      collectionName: nft.collectionName || "",
      status: nft.status || "minted",
      source: extra.source || "desk",
      createdAt: nft.createdAt || extra.createdAt,
      explorer: nft.NFTokenID ? `https://livenet.xrpl.org/nft/${nft.NFTokenID}` : "",
      badge: extra.badge || "Minted on FUZION-XIO"
    });
  };
  for (const row of store.activity || []) {
    if (row.type !== "mint") continue;
    const nft = (store.nfts || []).find((item) => item._id === row.nftId);
    if (nft) push(nft, { source: "desk", createdAt: row.createdAt, badge: "Minted on FUZION-XIO" });
    else {
      push(
        {
          _id: row.nftId,
          name: row.name,
          collectionName: row.collectionName,
          accountNumber: row.from,
          issuer: row.from,
          createdAt: row.createdAt
        },
        { source: "desk" }
      );
    }
  }
  for (const nft of store.nfts || []) {
    if (nft.status === "minted" || nft.status === "created") push(nft);
  }
  return rows;
}

async function fetchJson(url, ms = 4000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json,image/*,*/*", "user-agent": "fuzion-xio" }
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (type.includes("json")) return res.json();
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichMint(row) {
  if (row.image && row.name && !String(row.name).includes(".json")) return row;
  const url = publicUri(row.uri);
  if (!url) return row;
  const meta = await fetchJson(url);
  if (!meta || typeof meta !== "object") return { ...row, uri: url };
  const image = publicUri(meta.image || meta.image_url || meta.animation_url || "");
  return {
    ...row,
    name: meta.name || row.name,
    description: meta.description || row.description,
    image: image || row.image,
    collectionName: meta.collection?.name || row.collectionName,
    uri: url,
    fileType: String(image).match(/\.(glb|gltf|fbx|usdz|obj)(\?|$)/i)?.[1] || row.fileType || "image",
    contentType: String(image).match(/\.(mp4|webm)(\?|$)/i) ? "video" : row.contentType || "image"
  };
}

async function scanLedgers(count = 30) {
  const head = await ledger("validated", { transactions: false, expand: false });
  if (!head.ok) return { ok: false, error: head.error || "ledger unavailable", rows: [] };
  const start = Number(head.result?.ledger?.ledger_index || head.result?.ledger_index);
  if (!start) return { ok: false, error: "no ledger index", rows: [] };
  const indexes = Array.from({ length: count }, (_, i) => start - i);
  const found = [];
  const batch = 8;
  for (let i = 0; i < indexes.length && found.length < 24; i += batch) {
    const slice = indexes.slice(i, i + batch);
    const pages = await Promise.all(
      slice.map((index) => ledger(index).catch((error) => ({ ok: false, error: String(error) })))
    );
    for (const page of pages) {
      if (!page.ok) continue;
      const led = page.result?.ledger || {};
      for (const tx of led.transactions || []) {
        const mint = parseMintTx(tx, led.ledger_index || led.ledger_index, led.close_time);
        if (mint) found.push(mint);
      }
    }
  }
  const unique = [];
  const seen = new Set();
  for (const row of found) {
    const key = row.NFTokenID || row.hash;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return { ok: true, ledgerIndex: start, rows: unique.slice(0, 24) };
}

export async function refreshLedgerMints(store = readStore()) {
  const scan = await scanLedgers(30);
  if (!scan.ok) return { ok: false, error: scan.error, rows: store.ledgerMints || [] };
  const enriched = await Promise.all(scan.rows.slice(0, 16).map((row) => enrichMint(row)));
  const rows = [...enriched, ...scan.rows.slice(16)];
  memory = { at: Date.now(), rows };
  update((current) => {
    current.ledgerMints = rows;
    current.ledgerMintsAt = new Date().toISOString();
    current.ledgerMintsHead = scan.ledgerIndex;
    return current;
  });
  return { ok: true, rows, ledgerIndex: scan.ledgerIndex };
}

export async function recentLedgerMints(store = readStore()) {
  const desk = deskMints(store);
  const cached = memory.rows.length ? memory.rows : store.ledgerMints || [];
  const fresh = Date.now() - memory.at < CACHE_MS;
  let ledgerRows = cached;
  if (!fresh) {
    if (cached.length) {
      refreshLedgerMints(store).catch(() => {});
    } else {
      const scan = await refreshLedgerMints(store);
      ledgerRows = scan.rows || [];
    }
  }
  const seen = new Set();
  const merged = [];
  for (const row of [...ledgerRows, ...desk]) {
    const key = row.NFTokenID || row._id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  merged.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return {
    ok: true,
    source: fresh || cached.length ? "xrpl+desk" : "desk",
    count: merged.length,
    rows: merged.slice(0, 24)
  };
}

export function findLedgerMint(store, id) {
  return (store.ledgerMints || memory.rows || []).find(
    (row) => row._id === id || row.NFTokenID === id || row.hash === id
  );
}
